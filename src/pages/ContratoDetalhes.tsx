import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, Send, MessageSquarePlus, CheckCircle2, FileDown, Mail } from "lucide-react";
import { toast } from "sonner";
import { ProposalRenderer } from "@/components/proposal/ProposalRenderer";
import { format, parseISO } from "date-fns";
import { RequestClauseRevisionDialog } from "@/components/contracts/RequestClauseRevisionDialog";
import { ClauseReviewPanel } from "@/components/contracts/ClauseReviewPanel";
import { SendContractEmailDialog } from "@/components/contracts/SendContractEmailDialog";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-gray-500" },
  sent: { label: "Enviado", color: "bg-blue-500" },
  under_negotiation: { label: "Em negociação", color: "bg-amber-500" },
  approved: { label: "Aprovado", color: "bg-emerald-500" },
  final: { label: "Final", color: "bg-primary" },
  cancelled: { label: "Cancelado", color: "bg-red-500" },
};

const REVISION_STATUS: Record<string, string> = {
  pending_extraction: "Analisando IA",
  pending_admin_review: "Aguardando aprovação",
  reviewed: "Revisado",
  final_consolidated: "Consolidado",
  cancelled: "Cancelado",
};

export default function ContratoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<any>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [activeRevision, setActiveRevision] = useState<any | null>(null);

  useEffect(() => { if (id) load(); }, [id]);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
    if (user) {
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setRoles((r || []).map(x => x.role));
    }
    const [{ data: c }, { data: rev }, { data: fs }] = await Promise.all([
      supabase.from("contracts").select("*, clients(company_name), profiles!contracts_created_by_fkey(full_name, email)").eq("id", id).single(),
      supabase.from("contract_clause_revisions").select("*").eq("contract_id", id).order("submitted_at", { ascending: false }),
      supabase.from("contract_files").select("*").eq("contract_id", id).order("created_at", { ascending: false }),
    ]);
    setContract(c);
    setRevisions(rev || []);
    setFiles(fs || []);
    setLoading(false);
  };

  const isAdmin = roles.includes("admin");
  const isPreVendas = roles.includes("pre_vendas");
  const isOwner = contract && userId === contract.created_by;
  const canRequest = isOwner || isAdmin || isPreVendas;
  const canReview = isAdmin || isPreVendas;

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("contracts").update({ status, ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}) }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    load();
  };

  const generateFinalContract = async () => {
    if (!contract) return;
    const lastReviewed = revisions.find(r => r.status === "reviewed");
    if (!lastReviewed) return toast.error("Nenhuma revisão concluída para consolidar");

    const { data: decisions } = await supabase
      .from("contract_clause_decisions")
      .select("*")
      .eq("revision_id", lastReviewed.id);

    // Anexa um bloco de texto consolidado (richtext) ao final, com todas as decisões aceitas/contrapropostas
    const accepted = (decisions || []).filter(d => d.decision === "accepted" || d.decision === "counter_proposal");
    const consolidationBlock = {
      id: crypto.randomUUID(),
      type: "richtext" as const,
      html: `<h2>Aditivo consolidado de cláusulas (v${(contract.version || 1) + 1})</h2>` +
        accepted.map(d =>
          `<p><strong>${d.clause_reference}</strong><br/>${d.decision === "counter_proposal" ? `Contraproposta acordada: ${d.counter_text || ""}` : `Alteração aceita: ${d.proposed_change}`}${d.admin_comment ? `<br/><em>${d.admin_comment}</em>` : ""}</p>`
        ).join(""),
    };

    const newBlocks = [...(contract.blocks || []), consolidationBlock];
    const { data: { user } } = await supabase.auth.getUser();
    const { data: newContract, error } = await supabase.from("contracts").insert({
      template_id: contract.template_id,
      opportunity_id: contract.opportunity_id,
      client_id: contract.client_id,
      created_by: user!.id,
      title: `${contract.title} (Final v${(contract.version || 1) + 1})`,
      blocks: newBlocks,
      variables: contract.variables,
      status: "final",
      version: (contract.version || 1) + 1,
      parent_contract_id: contract.id,
      finalized_at: new Date().toISOString(),
    }).select("id").single();

    if (error) return toast.error(error.message);

    await supabase.from("contract_clause_revisions").update({ status: "final_consolidated" }).eq("id", lastReviewed.id);
    await supabase.from("contracts").update({ status: "approved" }).eq("id", contract.id);

    toast.success("Contrato final gerado");
    navigate(`/contratos/${newContract.id}`);
  };

  if (loading) return <div className="p-6"><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-96" /></div>;
  if (!contract) return <div className="p-6">Contrato não encontrado</div>;

  const st = STATUS_LABELS[contract.status] || STATUS_LABELS.draft;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <Button size="icon" variant="ghost" onClick={() => navigate("/contratos")}><ArrowLeft size={18} /></Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 flex-wrap">
              <FileText className="text-primary" />
              {contract.title}
              <Badge className={`${st.color} text-white`}>{st.label}</Badge>
              {contract.version > 1 && <Badge variant="outline">v{contract.version}</Badge>}
            </h1>
            <div className="text-xs text-muted-foreground mt-1">
              Cliente: {contract.clients?.company_name} • Vendedor: {contract.profiles?.full_name} • {format(parseISO(contract.created_at), "dd/MM/yyyy HH:mm")}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {contract.status === "draft" && isOwner && (
            <Button size="sm" variant="outline" onClick={() => updateStatus("sent")} className="gap-1">
              <Send size={14} /> Marcar como enviado
            </Button>
          )}
          {canRequest && contract.status !== "final" && (
            <Button size="sm" onClick={() => setRevisionDialogOpen(true)} className="gap-1">
              <MessageSquarePlus size={14} /> Solicitar revisão
            </Button>
          )}
          {canRequest && contract.status !== "final" && revisions.some(r => r.status === "reviewed") && (
            <Button size="sm" variant="default" onClick={generateFinalContract} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 size={14} /> Gerar contrato final
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
          <TabsTrigger value="revisions">
            Revisões {revisions.length > 0 && <Badge variant="secondary" className="ml-2">{revisions.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="files">Arquivos</TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          <Card><CardContent className="p-4 md:p-6">
            <ProposalRenderer blocks={contract.blocks || []} variables={contract.variables || {}} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="revisions" className="space-y-3">
          {revisions.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              Nenhuma revisão de cláusula solicitada.
            </CardContent></Card>
          ) : revisions.map(rev => (
            <Card key={rev.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <Badge variant="secondary">{REVISION_STATUS[rev.status] || rev.status}</Badge>
                    <span className="ml-2 text-xs text-muted-foreground">
                      Solicitado em {format(parseISO(rev.submitted_at), "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>
                  {(canReview || isOwner) && (
                    <Button size="sm" variant="outline" onClick={() => setActiveRevision(rev)}>
                      Abrir
                    </Button>
                  )}
                </div>
                {rev.prospect_input && (
                  <div className="text-sm bg-muted/40 rounded p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {rev.prospect_input.slice(0, 600)}{rev.prospect_input.length > 600 && "…"}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="files" className="space-y-2">
          {files.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              Nenhum arquivo gerado ainda.
            </CardContent></Card>
          ) : files.map(f => (
            <Card key={f.id}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileDown size={16} className="text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{f.file_name}</div>
                    <div className="text-xs text-muted-foreground">{f.kind} • {format(parseISO(f.created_at), "dd/MM/yyyy")}</div>
                  </div>
                </div>
                <a href={f.file_url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">Abrir</Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <RequestClauseRevisionDialog
        open={revisionDialogOpen}
        onOpenChange={setRevisionDialogOpen}
        contractId={contract.id}
        onCreated={() => { setRevisionDialogOpen(false); load(); }}
      />

      {activeRevision && (
        <ClauseReviewPanel
          revision={activeRevision}
          contract={contract}
          canReview={canReview}
          onClose={() => { setActiveRevision(null); load(); }}
        />
      )}
    </div>
  );
}
