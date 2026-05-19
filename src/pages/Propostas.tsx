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
import { Plus, FileText, Pencil, Trash2, Eye, Sparkles, AlertCircle, RefreshCw, Inbox, BarChart3, Flame, Thermometer, Snowflake, Users, DollarSign, Activity } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ProposalBlock, buildVariableContext, newBlock } from "@/lib/proposalTypes";
import { ProposalBuilder } from "@/components/proposal/ProposalBuilder";
import { proposalPublicUrl } from "@/lib/publicUrls";
import { ProposalRenderer } from "@/components/proposal/ProposalRenderer";
import { format, parseISO } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";

const PAGE_SIZE = 20;

export default function Propostas() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-driven state (initial values come from query params)
  const [tab, setTab] = useState(() => searchParams.get("tab") || "templates");
  const [proposalsPage, setProposalsPage] = useState(() => Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1));
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get("status") || "all");
  const [sellerFilter, setSellerFilter] = useState<string>(() => searchParams.get("seller") || "all");
  const [sellers, setSellers] = useState<{ id: string; full_name: string }[]>([]);
  const [aggregates, setAggregates] = useState<{ total: number; sent: number; viewed: number; accepted: number; rejected: number; totalValue: number; avgScore: number; uniqueVisitors: number } | null>(null);
  const [aggregatesLoading, setAggregatesLoading] = useState(false);
  const [aggregatesError, setAggregatesError] = useState<string | null>(null);

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [proposalsTotal, setProposalsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [proposalsError, setProposalsError] = useState<string | null>(null);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#22c55e");
  const [blocks, setBlocks] = useState<ProposalBlock[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (hasAccess) loadProposals(proposalsPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalsPage, hasAccess, statusFilter, sellerFilter]);

  useEffect(() => {
    if (hasAccess) loadAggregates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, statusFilter, sellerFilter]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    if (hasAccess && proposalsPage !== 1) setProposalsPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, sellerFilter]);

  // Persist tab/page/status/seller filter into the URL so reload/back keeps state
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (tab !== "templates") next.set("tab", tab); else next.delete("tab");
    if (proposalsPage > 1) next.set("page", String(proposalsPage)); else next.delete("page");
    if (statusFilter !== "all") next.set("status", statusFilter); else next.delete("status");
    if (sellerFilter !== "all") next.set("seller", sellerFilter); else next.delete("seller");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, proposalsPage, statusFilter, sellerFilter]);

  const checkAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setHasAccess(false);
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (data || []).map((r) => r.role);
    const ok = roles.includes("admin") || roles.includes("pre_vendas") || roles.includes("gestor");
    setHasAccess(ok);
    if (ok) loadAll();
  };

  const loadSellers = async () => {
    // Distinct created_by from proposals + their full_name
    const { data: props } = await supabase.from("proposals").select("created_by");
    const ids = Array.from(new Set((props || []).map((p: any) => p.created_by).filter(Boolean))) as string[];
    if (!ids.length) { setSellers([]); return; }
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    setSellers(((profs || []) as any[])
      .map((p) => ({ id: p.id, full_name: p.full_name || "(sem nome)" }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name)));
  };

  const loadAggregates = async () => {
    setAggregatesLoading(true);
    setAggregatesError(null);
    try {
      let q = supabase.from("proposals").select("status, total_value, engagement_score, unique_visitors, view_count");
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (sellerFilter !== "all") q = q.eq("created_by", sellerFilter);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as any[];
      const total = rows.length;
      const totalValue = rows.reduce((s, r) => s + (Number(r.total_value) || 0), 0);
      const uniqueVisitors = rows.reduce((s, r) => s + (Number(r.unique_visitors) || 0), 0);
      const scored = rows.filter((r) => (r.unique_visitors || 0) > 0);
      const avgScore = scored.length ? Math.round(scored.reduce((s, r) => s + (Number(r.engagement_score) || 0), 0) / scored.length) : 0;
      const count = (s: string) => rows.filter((r) => r.status === s).length;
      setAggregates({
        total,
        sent: count("sent") + count("viewed") + count("accepted") + count("rejected"),
        viewed: rows.filter((r) => (r.view_count || 0) > 0).length,
        accepted: count("accepted"),
        rejected: count("rejected"),
        totalValue,
        avgScore,
        uniqueVisitors,
      });
    } catch (e: any) {
      setAggregates(null);
      setAggregatesError(e?.message || "Não foi possível calcular as métricas.");
    } finally {
      setAggregatesLoading(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    const tplRes = await supabase.from("proposal_templates").select("*").order("created_at", { ascending: false });
    setTemplates(tplRes.data || []);
    await Promise.all([loadProposals(1), loadSellers(), loadAggregates()]);
    setProposalsPage(1);
    setLoading(false);
  };

  const loadProposals = async (page: number) => {
    setProposalsLoading(true);
    setProposalsError(null);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // Timeout guard (15s)
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Tempo esgotado ao carregar propostas. Verifique sua conexão.")), 15000)
    );

    try {
      let q = supabase
        .from("proposals")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (sellerFilter !== "all") q = q.eq("created_by", sellerFilter);
      const propRes: any = await Promise.race([q, timeout]);
      if (propRes.error) throw propRes.error;
      const props = propRes.data || [];
      const clientIds = Array.from(new Set(props.map((p: any) => p.client_id).filter(Boolean))) as string[];
      const oppIds = Array.from(new Set(props.map((p: any) => p.opportunity_id).filter(Boolean))) as string[];
      const [clientsRes, oppsRes] = await Promise.all([
        clientIds.length ? supabase.from("clients").select("id, company_name").in("id", clientIds) : Promise.resolve({ data: [] as any[] }),
        oppIds.length ? supabase.from("opportunities").select("id, title").in("id", oppIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const cMap = new Map((clientsRes.data || []).map((c: any) => [c.id, c]));
      const oMap = new Map((oppsRes.data || []).map((o: any) => [o.id, o]));
      const enriched = props.map((p: any) => ({
        ...p,
        client: p.client_id ? cMap.get(p.client_id) || null : null,
        opportunity: p.opportunity_id ? oMap.get(p.opportunity_id) || null : null,
      }));
      setProposals(enriched);
      setProposalsTotal(propRes.count || 0);
    } catch (e: any) {
      setProposals([]);
      setProposalsError(e?.message || "Erro ao carregar propostas");
    } finally {
      setProposalsLoading(false);
      setLoading(false);
    }
  };

  const openNewTemplate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setColor("#22c55e");
    setBlocks([newBlock("richtext")]);
    setEditorOpen(true);
  };
  const openEditTemplate = (t: any) => {
    setEditing(t);
    setName(t.name);
    setDescription(t.description || "");
    setColor(t.thumbnail_color || "#22c55e");
    setBlocks(t.blocks || []);
    setEditorOpen(true);
  };
  const saveTemplate = async () => {
    try {
      if (!name.trim()) { toast.error("Informe um nome"); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const payload: any = { name, description, thumbnail_color: color, blocks: blocks as any, is_active: true };
      if (editing) {
        const r = await supabase.from("proposal_templates").update(payload).eq("id", editing.id);
        if (r.error) throw r.error;
      } else {
        const r = await supabase.from("proposal_templates").insert({ ...payload, created_by: user.id });
        if (r.error) throw r.error;
      }
      toast.success("Template salvo!");
      setEditorOpen(false);
      loadAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const deleteTemplate = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    const { error } = await supabase.from("proposal_templates").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); loadAll(); }
  };
  const deleteProposal = async (id: string) => {
    if (!confirm("Excluir esta proposta?")) return;
    const { error } = await supabase.from("proposals").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Excluída"); loadProposals(proposalsPage); }
  };

  const totalPages = Math.max(1, Math.ceil(proposalsTotal / PAGE_SIZE));

  const previewVars = buildVariableContext({
    client: { company_name: "Cliente Exemplo Ltda", trade_name: "Exemplo", cnpj: "00.000.000/0001-00", city: "São Paulo", state: "SP" },
    opportunity: { title: "Oportunidade Demo", value: 50000, monthly_value: 2500 },
    seller: { full_name: "Vendedor Exemplo", email: "vendedor@startgi.com.br" },
    validity_days: 30,
  });

  if (hasAccess === null) return <div className="p-6">Carregando…</div>;
  if (!hasAccess) return (
    <div className="p-6 max-w-md mx-auto text-center">
      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
      <h2 className="text-xl font-semibold mb-2">Acesso restrito</h2>
      <p className="text-muted-foreground">Apenas usuários Admin e Pré-vendas têm acesso ao módulo de propostas.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="h-6 w-6 text-primary" /> Propostas</h1>
          <p className="text-sm text-muted-foreground">Templates e propostas geradas. Use a oportunidade para gerar uma nova proposta.</p>
        </div>
        <Button onClick={() => navigate("/propostas/comerciais")} className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:opacity-90">
          <Sparkles className="h-4 w-4 mr-1" /> Propostas Comerciais (Beta)
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="proposals">Propostas Geradas ({proposalsTotal})</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-3 mt-4">
          <Button onClick={openNewTemplate}><Plus className="h-4 w-4 mr-1" /> Novo template</Button>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((t) => (
              <Card key={t.id}>
                <div className="h-2 rounded-t" style={{ background: t.thumbnail_color || "#22c55e" }} />
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">{t.description || "Sem descrição"}</p>
                  <Badge variant="outline">{(t.blocks || []).length} blocos</Badge>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEditTemplate(t)}><Pencil className="h-3 w-3 mr-1" /> Editar</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteTemplate(t.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!loading && templates.length === 0 && <div className="col-span-full text-center text-muted-foreground py-8">Nenhum template ainda.</div>}
          </div>
        </TabsContent>

        <TabsContent value="proposals" className="space-y-3 mt-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center pb-1">
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-muted-foreground mr-1">Status:</span>
              {[
                { v: "all", label: "Todas" },
                { v: "draft", label: "Rascunho" },
                { v: "sent", label: "Enviada" },
                { v: "viewed", label: "Visualizada" },
                { v: "accepted", label: "Aprovada" },
                { v: "rejected", label: "Recusada" },
              ].map((f) => (
                <Button
                  key={f.v}
                  size="sm"
                  variant={statusFilter === f.v ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setStatusFilter(f.v)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs text-muted-foreground">Vendedor:</span>
              <Select value={sellerFilter} onValueChange={setSellerFilter}>
                <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os vendedores</SelectItem>
                  {sellers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* KPIs agregados */}
          {aggregatesLoading && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2" aria-busy="true" aria-label="Calculando métricas">
              {Array.from({ length: 7 }).map((_, i) => (
                <Card key={i} className="p-3 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-2.5 w-24" />
                </Card>
              ))}
            </div>
          )}
          {!aggregatesLoading && aggregatesError && (
            <Card className="p-3 border-destructive/40 bg-destructive/5 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-destructive">Erro ao carregar métricas</div>
                <div className="text-xs text-muted-foreground truncate">{aggregatesError}</div>
              </div>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => loadAggregates()}>
                <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
              </Button>
            </Card>
          )}
          {!aggregatesLoading && !aggregatesError && aggregates && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              <AggCard icon={<FileText className="h-4 w-4" />} label="Propostas" value={String(aggregates.total)} />
              <AggCard icon={<Activity className="h-4 w-4" />} label="Enviadas" value={String(aggregates.sent)} />
              <AggCard icon={<Eye className="h-4 w-4" />} label="Visualizadas" value={String(aggregates.viewed)} />
              <AggCard icon={<Flame className="h-4 w-4" />} label="Aprovadas" value={String(aggregates.accepted)} />
              <AggCard icon={<Snowflake className="h-4 w-4" />} label="Recusadas" value={String(aggregates.rejected)} />
              <AggCard icon={<Users className="h-4 w-4" />} label="Visitantes únicos" value={String(aggregates.uniqueVisitors)} />
              <AggCard icon={<DollarSign className="h-4 w-4" />} label="Valor total" value={aggregates.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} sub={`Score médio ${aggregates.avgScore}`} />
            </div>
          )}

          {/* Skeleton de carregamento */}
          {proposalsLoading && (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="p-3 flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded" />
                </Card>
              ))}
            </div>
          )}

          {/* Erro / timeout */}
          {!proposalsLoading && proposalsError && (
            <Card className="p-6 border-destructive/40 bg-destructive/5">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-sm text-destructive">Não foi possível carregar as propostas</div>
                  <div className="text-xs text-muted-foreground mt-1">{proposalsError}</div>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => loadProposals(proposalsPage)}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Lista */}
          {!proposalsLoading && !proposalsError && proposals.map((p) => {
            const score = p.engagement_score || 0;
            const cls = score >= 60
              ? { label: "Quente", color: "bg-red-500 text-white", Icon: Flame }
              : score >= 30
              ? { label: "Morno", color: "bg-amber-500 text-white", Icon: Thermometer }
              : { label: "Frio", color: "bg-slate-400 text-white", Icon: Snowflake };
            return (
            <Card key={p.id} className="p-3 flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{p.title}</div>
                <div className="text-xs text-muted-foreground">
                  {p.client?.company_name || "—"} · {p.opportunity?.title || ""} · {format(parseISO(p.created_at), "dd/MM/yyyy HH:mm")}
                </div>
              </div>
              <Badge variant={p.status === "sent" ? "default" : p.status === "accepted" ? "default" : "outline"}>{p.status}</Badge>
              {p.view_count > 0 && <Badge variant="secondary"><Eye className="h-3 w-3 mr-1" />{p.view_count}</Badge>}
              {p.unique_visitors > 0 && (
                <Badge className={cls.color} title={`Score ${score} · ${cls.label}`}>
                  <cls.Icon className="h-3 w-3 mr-1" />{score}
                </Badge>
              )}
              <Button size="sm" variant="outline" onClick={() => navigate(`/propostas/${p.id}/insights`)}><BarChart3 className="h-3 w-3 mr-1" /> Insights</Button>
              <Button size="sm" variant="outline" onClick={() => window.open(proposalPublicUrl(p.share_token), "_blank")}>Abrir link</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteProposal(p.id)}><Trash2 className="h-3 w-3" /></Button>
            </Card>
          );})}

          {/* Vazio */}
          {!proposalsLoading && !proposalsError && proposals.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <div className="font-medium">Nenhuma proposta gerada {proposalsPage > 1 ? "nesta página" : "ainda"}.</div>
              <div className="text-xs mt-1">
                {proposalsPage > 1
                  ? "Volte para a primeira página ou gere uma nova proposta a partir de uma oportunidade."
                  : "Gere a primeira proposta a partir de uma oportunidade."}
              </div>
              {proposalsPage > 1 && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setProposalsPage(1)}>Voltar para página 1</Button>
              )}
            </div>
          )}

          {!proposalsError && proposalsTotal > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-3 border-t">
              <div className="text-xs text-muted-foreground">
                Página {proposalsPage} de {totalPages} · {proposalsTotal} propostas
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={proposalsPage <= 1 || proposalsLoading} onClick={() => setProposalsPage(1)}>«</Button>
                <Button size="sm" variant="outline" disabled={proposalsPage <= 1 || proposalsLoading} onClick={() => setProposalsPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={proposalsPage >= totalPages || proposalsLoading} onClick={() => setProposalsPage((p) => Math.min(totalPages, p + 1))}>Próxima</Button>
                <Button size="sm" variant="outline" disabled={proposalsPage >= totalPages || proposalsLoading} onClick={() => setProposalsPage(totalPages)}>»</Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Editor de Template */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-[1200px] w-[95vw] h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>{editing ? "Editar template" : "Novo template"}</DialogTitle>
          </DialogHeader>
          <div className="p-3 border-b grid grid-cols-12 gap-2 items-end bg-muted/30">
            <div className="col-span-5"><Label className="text-xs">Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="col-span-5"><Label className="text-xs">Descrição</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="col-span-1"><Label className="text-xs">Cor</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></div>
            <div className="col-span-1 flex flex-col gap-1">
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}><Eye className="h-3 w-3 mr-1" /> Preview</Button>
              <Button size="sm" onClick={saveTemplate}>Salvar</Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden p-3">
            <ProposalBuilder blocks={blocks} onChange={setBlocks} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[900px] w-[95vw] h-[92vh] overflow-y-auto p-0 bg-gray-100">
          <div className="mx-auto shadow-lg my-4" style={{ width: 794 }}>
            <ProposalRenderer blocks={blocks} variables={previewVars} brandColor={color} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AggCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] uppercase tracking-wide">
        {icon}<span>{label}</span>
      </div>
      <div className="text-lg font-semibold mt-1 leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}
