import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [loading, setLoading] = useState(true);

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
    await loadAll();
    setLoading(false);
  };

  const loadAll = async () => {
    const [{ data: tpls }, { data: cs }, { data: opps }] = await Promise.all([
      supabase.from("contract_templates").select("*").order("created_at", { ascending: false }),
      supabase
        .from("contracts")
        .select("*, clients!inner(company_name), profiles!contracts_created_by_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("opportunities")
        .select("id, title, client_id, value, monthly_value, clients!inner(company_name)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setTemplates(tpls || []);
    setContracts(cs || []);
    setOpportunities(opps || []);
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
                  <Button size="sm" variant="ghost"><Eye size={14} /></Button>
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
    </div>
  );
}
