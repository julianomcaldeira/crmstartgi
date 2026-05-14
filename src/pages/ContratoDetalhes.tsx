import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, Send, MessageSquarePlus, CheckCircle2, FileDown, Mail, Pencil, Save, X, Columns2, Rows2, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { ProposalRenderer } from "@/components/proposal/ProposalRenderer";
import { ProposalBuilder } from "@/components/proposal/ProposalBuilder";
import { ProposalBlock, PageSettings, DEFAULT_PAGE_SETTINGS } from "@/lib/proposalTypes";
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
  const [sendOpen, setSendOpen] = useState(false);
  const [clientEmail, setClientEmail] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [editBlocks, setEditBlocks] = useState<ProposalBlock[]>([]);
  const [editPage, setEditPage] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
  const [savingEdit, setSavingEdit] = useState(false);
  const [previewMode, setPreviewMode] = useState<"side" | "stacked" | "hidden">("side");
  const [splitPct, setSplitPct] = useState<number>(50);

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
      supabase.from("contracts").select("*").eq("id", id).maybeSingle(),
      supabase.from("contract_clause_revisions").select("*").eq("contract_id", id).order("submitted_at", { ascending: false }),
      supabase.from("contract_files").select("*").eq("contract_id", id).order("created_at", { ascending: false }),
    ]);
    let client: any = null;
    let seller: any = null;
    if (c) {
      const [{ data: clientData }, { data: sellerData }] = await Promise.all([
        supabase.from("clients").select("company_name, email").eq("id", (c as any).client_id).maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", (c as any).created_by).maybeSingle(),
      ]);
      client = clientData;
      seller = sellerData;
    }
    setContract(c ? { ...c, clients: client, profiles: seller } : null);
    setClientEmail(client?.email || "");
    setRevisions(rev || []);
    setFiles(fs || []);
    setLoading(false);
  };

  const isAdmin = roles.includes("admin");
  const isPreVendas = roles.includes("pre_vendas");
  const isOwner = contract && userId === contract.created_by;
  const canRequest = isOwner || isAdmin || isPreVendas;
  const canReview = isAdmin || isPreVendas;
  const canEdit = (isOwner || isAdmin) && contract?.status !== "final";

  const startEdit = () => {
    setEditBlocks((contract?.blocks || []) as ProposalBlock[]);
    setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setEditBlocks([]); };
  const saveEdit = async () => {
    if (!contract) return;
    setSavingEdit(true);
    const { error } = await supabase.from("contracts").update({ blocks: editBlocks as any }).eq("id", contract.id);
    setSavingEdit(false);
    if (error) return toast.error(error.message);
    toast.success("Conteúdo atualizado");
    setEditing(false);
    load();
  };

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
          {!editing && canEdit && (
            <Button size="sm" variant="outline" onClick={startEdit} className="gap-1">
              <Pencil size={14} /> Editar conteúdo
            </Button>
          )}
          {editing && (
            <>
              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={savingEdit} className="gap-1">
                <X size={14} /> Cancelar
              </Button>
              <Button size="sm" onClick={saveEdit} disabled={savingEdit} className="gap-1">
                <Save size={14} /> {savingEdit ? "Salvando..." : "Salvar"}
              </Button>
            </>
          )}
          {!editing && contract.status !== "final" && isOwner && (
            <Button size="sm" variant="default" onClick={() => setSendOpen(true)} className="gap-1">
              <Mail size={14} /> Enviar por e-mail
            </Button>
          )}
          {!editing && contract.status === "draft" && isOwner && (
            <Button size="sm" variant="outline" onClick={() => updateStatus("sent")} className="gap-1">
              <Send size={14} /> Marcar como enviado
            </Button>
          )}
          {!editing && canRequest && contract.status !== "final" && (
            <Button size="sm" onClick={() => setRevisionDialogOpen(true)} className="gap-1">
              <MessageSquarePlus size={14} /> Solicitar revisão
            </Button>
          )}
          {!editing && canRequest && contract.status !== "final" && revisions.some(r => r.status === "reviewed") && (
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
          {editing ? (
            <div className="space-y-2">
              <div className="flex items-center justify-end gap-1 bg-muted/40 border rounded-md p-1">
                <span className="text-xs text-muted-foreground mr-2">Layout do preview:</span>
                <Button size="sm" variant={previewMode === "side" ? "default" : "ghost"} onClick={() => setPreviewMode("side")} className="h-7 gap-1 text-xs">
                  <Columns2 size={13} /> Lado a lado
                </Button>
                <Button size="sm" variant={previewMode === "stacked" ? "default" : "ghost"} onClick={() => setPreviewMode("stacked")} className="h-7 gap-1 text-xs">
                  <Rows2 size={13} /> Empilhado
                </Button>
                <Button size="sm" variant={previewMode === "hidden" ? "default" : "ghost"} onClick={() => setPreviewMode("hidden")} className="h-7 gap-1 text-xs">
                  <EyeOff size={13} /> Ocultar
                </Button>
              </div>

              {previewMode === "side" && (
                <SplitPane
                  splitPct={splitPct}
                  onSplitChange={setSplitPct}
                  left={
                    <Card className="h-full"><CardContent className="p-3 h-full">
                      <div className="h-full"><ProposalBuilder blocks={editBlocks} onChange={setEditBlocks} /></div>
                    </CardContent></Card>
                  }
                  right={
                    <PreviewPane blocks={editBlocks} variables={contract.variables || {}} />
                  }
                />
              )}

              {previewMode === "stacked" && (
                <div className="space-y-3">
                  <Card><CardContent className="p-3"><div className="h-[55vh]"><ProposalBuilder blocks={editBlocks} onChange={setEditBlocks} /></div></CardContent></Card>
                  <div className="h-[55vh]"><PreviewPane blocks={editBlocks} variables={contract.variables || {}} /></div>
                </div>
              )}

              {previewMode === "hidden" && (
                <Card><CardContent className="p-3"><div className="h-[78vh]"><ProposalBuilder blocks={editBlocks} onChange={setEditBlocks} /></div></CardContent></Card>
              )}
            </div>
          ) : (
            <Card><CardContent className="p-4 md:p-6">
              <ProposalRenderer blocks={contract.blocks || []} variables={contract.variables || {}} />
            </CardContent></Card>
          )}
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

      <SendContractEmailDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        contract={contract}
        defaultTo={clientEmail}
        onSent={load}
      />
    </div>
  );
}

function PreviewPane({ blocks, variables }: { blocks: ProposalBlock[]; variables: any }) {
  return (
    <Card className="h-full flex flex-col">
      <div className="px-4 py-2 border-b text-xs font-medium text-muted-foreground flex items-center gap-2 shrink-0">
        <FileText size={12} /> Pré-visualização em tempo real
      </div>
      <div className="flex-1 min-h-0 overflow-auto bg-gray-100 p-4">
        <div className="mx-auto bg-white shadow" style={{ width: 794, maxWidth: "100%" }}>
          <ProposalRenderer blocks={blocks} variables={variables} />
        </div>
      </div>
    </Card>
  );
}

function SplitPane({ left, right, splitPct, onSplitChange }: { left: React.ReactNode; right: React.ReactNode; splitPct: number; onSplitChange: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const el = ref.current; if (!el) return;
      const rect = el.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      onSplitChange(Math.min(80, Math.max(20, pct)));
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, onSplitChange]);

  return (
    <div ref={ref} className="flex h-[78vh] w-full select-none" style={{ cursor: dragging ? "col-resize" : "auto" }}>
      <div style={{ width: `${splitPct}%` }} className="min-w-0 pr-1">{left}</div>
      <div
        onMouseDown={() => setDragging(true)}
        className="w-1.5 bg-border hover:bg-primary/60 cursor-col-resize transition-colors rounded-full mx-0.5"
        title="Arraste para redimensionar"
      />
      <div style={{ width: `${100 - splitPct}%` }} className="min-w-0 pl-1">{right}</div>
    </div>
  );
}
