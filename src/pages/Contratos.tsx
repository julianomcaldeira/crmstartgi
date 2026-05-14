import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FileText, Pencil, Trash2, Eye, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { ProposalBlock, buildVariableContext, interpolate } from "@/lib/proposalTypes";
import { ProposalBuilder } from "@/components/proposal/ProposalBuilder";
import { ProposalRenderer } from "@/components/proposal/ProposalRenderer";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-gray-500" },
  sent: { label: "Enviado", color: "bg-blue-500" },
  under_negotiation: { label: "Em negociação", color: "bg-amber-500" },
  approved: { label: "Aprovado", color: "bg-emerald-500" },
  final: { label: "Final", color: "bg-primary" },
  cancelled: { label: "Cancelado", color: "bg-red-500" },
};

export default function Contratos() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("contracts");
  const [hasTemplateAccess, setHasTemplateAccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Exclusão de contrato (dupla checagem)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [templates, setTemplates] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);

  // Editor de modelo
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplBlocks, setTplBlocks] = useState<ProposalBlock[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Diálogo: gerar contrato
  const [genOpen, setGenOpen] = useState(false);
  const [genTemplateId, setGenTemplateId] = useState<string>("");
  const [genOpportunityId, setGenOpportunityId] = useState<string>("");
  const [opportunities, setOpportunities] = useState<any[]>([]);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const r = (roles || []).map(x => x.role);
    setHasTemplateAccess(r.includes("admin") || r.includes("pre_vendas"));
    setIsAdmin(r.includes("admin"));
    await loadAll();
    setLoading(false);
  };

  const loadAll = async () => {
    const [{ data: tpls }, { data: cs }, { data: opps }] = await Promise.all([
      supabase.from("contract_templates").select("*").order("created_at", { ascending: false }),
      supabase
        .from("contracts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("opportunities")
        .select("id, title, client_id, value, monthly_value")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    const clientIds = Array.from(new Set([...(cs || []).map((c: any) => c.client_id), ...(opps || []).map((o: any) => o.client_id)].filter(Boolean)));
    const profileIds = Array.from(new Set((cs || []).map((c: any) => c.created_by).filter(Boolean)));
    const [{ data: clients }, { data: profiles }] = await Promise.all([
      clientIds.length ? supabase.from("clients").select("id, company_name").in("id", clientIds) : Promise.resolve({ data: [] } as any),
      profileIds.length ? supabase.from("profiles").select("id, full_name").in("id", profileIds) : Promise.resolve({ data: [] } as any),
    ]);
    const clientById = new Map((clients || []).map((c: any) => [c.id, c]));
    const profileById = new Map((profiles || []).map((p: any) => [p.id, p]));
    setTemplates(tpls || []);
    setContracts((cs || []).map((c: any) => ({ ...c, clients: clientById.get(c.client_id), profiles: profileById.get(c.created_by) })));
    setOpportunities((opps || []).map((o: any) => ({ ...o, clients: clientById.get(o.client_id) })));
  };

  const openNewTemplate = () => {
    setEditing(null);
    setTplName("");
    setTplDesc("");
    setTplBlocks([]);
    setEditorOpen(true);
  };

  const openEditTemplate = (t: any) => {
    setEditing(t);
    setTplName(t.name);
    setTplDesc(t.description || "");
    setTplBlocks(t.blocks || []);
    setEditorOpen(true);
  };

  const saveTemplate = async () => {
    if (!tplName.trim()) {
      toast.error("Informe o nome do modelo");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      name: tplName.trim(),
      description: tplDesc.trim() || null,
      blocks: tplBlocks as any,
      created_by: user.id,
    };

    if (editing) {
      const { error } = await supabase.from("contract_templates").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Modelo atualizado");
    } else {
      const { error } = await supabase.from("contract_templates").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Modelo criado");
    }
    setEditorOpen(false);
    loadAll();
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Excluir este modelo?")) return;
    const { error } = await supabase.from("contract_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Modelo excluído");
    loadAll();
  };

  const openDeleteContract = (c: any) => {
    setDeleteTarget(c);
    setDeleteStep(1);
    setDeleteConfirmText("");
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteStep(1);
    setDeleteConfirmText("");
  };

  const confirmDeleteContract = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmText.trim().toUpperCase() !== "EXCLUIR") {
      toast.error('Digite EXCLUIR para confirmar');
      return;
    }
    setDeleting(true);
    try {
      // Limpa registros dependentes (sem FK cascade)
      const { data: revs } = await supabase
        .from("contract_clause_revisions")
        .select("id")
        .eq("contract_id", deleteTarget.id);
      const revIds = (revs || []).map((r: any) => r.id);
      if (revIds.length) {
        await supabase.from("contract_clause_decisions").delete().in("revision_id", revIds);
        await supabase.from("contract_clause_revisions").delete().in("id", revIds);
      }
      await supabase.from("contract_files").delete().eq("contract_id", deleteTarget.id);

      const { error } = await supabase.from("contracts").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Contrato excluído");
      setDeleteTarget(null);
      setDeleteStep(1);
      setDeleteConfirmText("");
      loadAll();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir contrato");
    } finally {
      setDeleting(false);
    }
  };

  const generateContract = async () => {
    if (!genTemplateId || !genOpportunityId) {
      toast.error("Selecione modelo e oportunidade");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const tpl = templates.find(t => t.id === genTemplateId);
    const opp = opportunities.find(o => o.id === genOpportunityId);
    if (!tpl || !opp) return;

    const { data: client } = await supabase.from("clients").select("*").eq("id", opp.client_id).single();
    const { data: seller } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    const vars = buildVariableContext({ client, opportunity: opp, seller });

    const payload = {
      template_id: tpl.id,
      opportunity_id: opp.id,
      client_id: opp.client_id,
      created_by: user.id,
      title: `${tpl.name} - ${client?.company_name || ""}`,
      blocks: tpl.blocks,
      variables: vars as any,
      status: "draft",
    };
    const { data, error } = await supabase.from("contracts").insert(payload).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Contrato gerado");
    setGenOpen(false);
    setGenTemplateId("");
    setGenOpportunityId("");
    navigate(`/contratos/${data.id}`);
  };

  if (loading) return <div className="p-6"><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ScrollText className="text-primary" /> Contratos
          </h1>
          <p className="text-sm text-muted-foreground">Modelos, geração e negociação de contratos StartGi</p>
        </div>
        <div className="flex gap-2">
          {templates.length > 0 && (
            <Button onClick={() => setGenOpen(true)} className="gap-2">
              <Plus size={16} /> Gerar contrato
            </Button>
          )}
          {hasTemplateAccess && (
            <Button variant="outline" onClick={openNewTemplate} className="gap-2">
              <Plus size={16} /> Novo modelo
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="contracts">Contratos gerados</TabsTrigger>
          {hasTemplateAccess && <TabsTrigger value="templates">Modelos</TabsTrigger>}
        </TabsList>

        <TabsContent value="contracts" className="space-y-3">
          {contracts.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              Nenhum contrato gerado ainda.
            </CardContent></Card>
          ) : contracts.map((c) => {
            const st = STATUS_LABELS[c.status] || STATUS_LABELS.draft;
            return (
              <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/contratos/${c.id}`)}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={16} className="text-primary shrink-0" />
                      <span className="font-medium truncate">{c.title}</span>
                      <Badge className={`${st.color} text-white`}>{st.label}</Badge>
                      {c.version > 1 && <Badge variant="outline">v{c.version}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.clients?.company_name} • Por {c.profiles?.full_name} • {format(parseISO(c.created_at), "dd/MM/yyyy")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost"><Eye size={14} /></Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); openDeleteContract(c); }}
                        title="Excluir contrato"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {hasTemplateAccess && (
          <TabsContent value="templates" className="space-y-3">
            {templates.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">
                Nenhum modelo. Crie o primeiro modelo de contrato.
              </CardContent></Card>
            ) : templates.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{t.name}</div>
                    {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEditTemplate(t)}><Pencil size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)}><Trash2 size={14} /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        )}
      </Tabs>

      {/* Editor de modelo */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar modelo" : "Novo modelo de contrato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Nome do modelo</Label>
                <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Ex.: Contrato SaaS Padrão" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={tplDesc} onChange={(e) => setTplDesc(e.target.value)} />
              </div>
            </div>
            <ProposalBuilder blocks={tplBlocks} onChange={setTplBlocks} />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setPreviewOpen(true)}>Pré-visualizar</Button>
              <Button onClick={saveTemplate}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Pré-visualização</DialogTitle></DialogHeader>
          <ProposalRenderer
            blocks={tplBlocks}
            variables={buildVariableContext({}) as any}
          />
        </DialogContent>
      </Dialog>

      {/* Gerar contrato */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar contrato</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Modelo</Label>
              <Select value={genTemplateId} onValueChange={setGenTemplateId}>
                <SelectTrigger><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
                <SelectContent>
                  {templates.filter(t => t.is_active).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Oportunidade</Label>
              <Select value={genOpportunityId} onValueChange={setGenOpportunityId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma oportunidade" /></SelectTrigger>
                <SelectContent>
                  {opportunities.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.title} — {o.clients?.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setGenOpen(false)}>Cancelar</Button>
              <Button onClick={generateContract}>Gerar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exclusão de contrato com dupla checagem */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) closeDeleteDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {deleteStep === 1 ? "Excluir contrato?" : "Confirmação final"}
            </DialogTitle>
            <DialogDescription>
              {deleteStep === 1 ? (
                <>
                  Você está prestes a excluir <span className="font-semibold text-foreground">{deleteTarget?.title}</span>.
                  Esta ação remove o contrato, suas revisões de cláusulas, decisões e arquivos vinculados. Não é possível desfazer.
                </>
              ) : (
                <>
                  Para confirmar a exclusão definitiva, digite <span className="font-mono font-semibold text-destructive">EXCLUIR</span> abaixo.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {deleteStep === 2 && (
            <div className="space-y-2">
              <Label htmlFor="confirm-delete">Confirmação</Label>
              <Input
                id="confirm-delete"
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Digite EXCLUIR"
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDeleteDialog} disabled={deleting}>
              Cancelar
            </Button>
            {deleteStep === 1 ? (
              <Button variant="destructive" onClick={() => setDeleteStep(2)}>
                Continuar
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={confirmDeleteContract}
                disabled={deleting || deleteConfirmText.trim().toUpperCase() !== "EXCLUIR"}
              >
                {deleting ? "Excluindo..." : "Excluir definitivamente"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
