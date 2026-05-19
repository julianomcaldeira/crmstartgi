import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Copy, Eye, Plus, Save, Trash2, ExternalLink, Link2, Printer, Download, FilePlus, GitBranch, Pencil } from "lucide-react";
import { CommercialProposalRenderer } from "@/components/proposal/commercial/CommercialProposalRenderer";
import { CommercialSection, CommercialTheme, DEFAULT_THEME, ProposalVars, STATUS_LABELS, resolveVariables } from "@/lib/commercialProposal";
import { proposalPublicUrl } from "@/lib/publicUrls";

const STATUS_OPTIONS = ["draft","em_edicao","sent","viewed","em_negociacao","aprovada","reprovada","expirada"];

export default function PropostasComerciais() {
  const { id } = useParams<{ id?: string }>();
  const [access, setAccess] = useState<boolean | null>(null);

  useEffect(() => { (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setAccess(false);
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (data || []).map((r) => r.role);
    setAccess(roles.includes("pre_vendas") || roles.includes("admin") || roles.includes("gestor"));
  })(); }, []);

  if (access === null) return <div className="p-6">Carregando…</div>;
  if (!access) return (
    <div className="p-6 max-w-md mx-auto text-center">
      <h2 className="text-xl font-semibold mb-2">Acesso restrito</h2>
      <p className="text-muted-foreground">Módulo Propostas Comerciais (Beta) disponível apenas para Pré-Vendas.</p>
    </div>
  );

  return id ? <EditorView id={id} /> : <ListView />;
}

/* ---------------- LIST ---------------- */
function ListView() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("proposals").select("id, title, status, created_at, share_token, client_id, created_by, total_value, monthly_value, implementation_value, template_key, opportunity_id, version")
      .like("template_key", "iganhei%").order("created_at", { ascending: false }).order("id", { ascending: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [statusFilter]);

  const duplicate = async (row: any) => {
    const { data: full } = await supabase.from("proposals").select("*").eq("id", row.id).single();
    if (!full) return;
    const { id: _id, share_token: _st, view_count: _vc, sent_at: _sa, viewed_at: _va, accepted_at: _aa, rejected_at: _ra, created_at: _ca, updated_at: _ua, unique_visitors: _uv, total_time_ms: _tt, engagement_score: _es, ...rest } = full as any;
    const { data, error } = await supabase.from("proposals").insert({ ...rest, title: full.title + " (cópia)", status: "draft", version: (full.version || 1) + 1 } as any).select("id").single();
    if (error) { toast.error(error.message); return; }
    toast.success("Duplicada"); navigate(`/propostas/comerciais/${data.id}`);
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta proposta?")) return;
    const { error } = await supabase.from("proposals").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluída"); load(); }
  };

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(proposalPublicUrl(token));
    toast.success("Link copiado");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Propostas Comerciais <Badge className="ml-2 bg-purple-100 text-purple-800">Beta · Pré-Vendas</Badge></h1>
          <p className="text-sm text-muted-foreground">Propostas premium i-Ganhei com tracking e variáveis dinâmicas.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]?.label || s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setPickerOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova proposta</Button>
        </div>
      </div>

      <OpportunityPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onCreated={() => { setPickerOpen(false); load(); }} />


      {loading ? <div className="text-muted-foreground">Carregando…</div> :
        rows.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma proposta criada ainda.</CardContent></Card> :
        <div className="grid gap-3">
          {rows.map((r) => {
            const st = STATUS_LABELS[r.status] || { label: r.status, cls: "bg-slate-200" };
            return (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-semibold">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${st.cls}`}>{st.label}</span>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/propostas/comerciais/${r.id}`)}><Eye className="h-4 w-4 mr-1" />Editar</Button>
                  <Button size="sm" variant="outline" onClick={() => copyLink(r.share_token)}><Link2 className="h-4 w-4 mr-1" />Link</Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(proposalPublicUrl(r.share_token), "_blank")}><ExternalLink className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => duplicate(r)}><Copy className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      }
    </div>
  );
}

/* ---------------- EDITOR ---------------- */
function EditorView({ id }: { id: string }) {
  const navigate = useNavigate();
  const [proposal, setProposal] = useState<any>(null);
  const [sections, setSections] = useState<CommercialSection[]>([]);
  const [theme, setTheme] = useState<CommercialTheme>(DEFAULT_THEME);
  const [tracking, setTracking] = useState<{ ga4_id?: string; clarity_id?: string }>({});
  const [variables, setVariables] = useState<ProposalVars>({});
  const [clients, setClients] = useState<any[]>([]);
  const [previewVars, setPreviewVars] = useState<ProposalVars>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => {
    const { data, error } = await supabase.from("proposals").select("*").eq("id", id).single();
    if (error) { toast.error(error.message); return; }
    setProposal(data);
    setSections((data.sections as any) || []);
    setTheme({ ...DEFAULT_THEME, ...((data.theme as any) || {}) });
    setTracking((data.tracking as any) || {});
    setVariables(((data.variables as any) || {}) as ProposalVars);
    const { data: cls } = await supabase.from("clients").select("id, company_name, trade_name").order("company_name").limit(500);
    setClients(cls || []);
    const resolved = await resolveVariables({ ...data, variables: data.variables || {} });
    setPreviewVars(resolved);
  })(); }, [id]);

  // re-resolve preview when client/vars/seller change
  useEffect(() => { if (proposal) (async () => {
    const r = await resolveVariables({ ...proposal, variables });
    setPreviewVars(r);
  })(); }, [proposal?.client_id, variables, proposal]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("proposals").update({
      title: proposal.title,
      status: proposal.status === "draft" ? "em_edicao" : proposal.status,
      client_id: proposal.client_id || null,
      sections: sections as any,
      theme: theme as any,
      tracking: tracking as any,
      variables: variables as any,
      implementation_value: Number(variables.valor_implantacao_raw) || proposal.implementation_value,
      monthly_value: Number(variables.valor_mensalidade_raw) || proposal.monthly_value,
      validity_days: Number(variables.validade_proposta) || proposal.validity_days,
    }).eq("id", id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Proposta salva");
  };

  const setSection = (sid: string, patch: Partial<CommercialSection>) =>
    setSections((arr) => arr.map((s) => s.id === sid ? { ...s, ...patch } : s));
  const setContent = (sid: string, patch: any) =>
    setSections((arr) => arr.map((s) => s.id === sid ? { ...s, content: { ...s.content, ...patch } } : s));
  const move = (sid: string, dir: -1 | 1) =>
    setSections((arr) => {
      const i = arr.findIndex((s) => s.id === sid);
      if (i < 0) return arr;
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const cp = arr.slice(); [cp[i], cp[j]] = [cp[j], cp[i]]; return cp;
    });

  const setVar = (k: string, v: string) => setVariables((x) => ({ ...x, [k]: v }));

  if (!proposal) return <div className="p-6">Carregando…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" onClick={() => navigate("/propostas/comerciais")}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open(proposalPublicUrl(proposal.share_token), "_blank")}><ExternalLink className="h-4 w-4 mr-1" /> Visualizar pública</Button>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Salvando…" : "Salvar"}</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-4">
        {/* Side editor */}
        <div className="space-y-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Geral</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Título interno</Label><Input value={proposal.title || ""} onChange={(e) => setProposal({ ...proposal, title: e.target.value })} /></div>
              <div><Label>Status</Label>
                <Select value={proposal.status} onValueChange={(v) => setProposal({ ...proposal, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]?.label || s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Cliente</Label>
                <Select value={proposal.client_id || ""} onValueChange={(v) => setProposal({ ...proposal, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name || c.trade_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Variáveis</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Var k="valor_implantacao" label="Valor implantação (R$)" v={variables} on={setVar} />
              <Var k="valor_mensalidade" label="Valor mensalidade (R$)" v={variables} on={setVar} />
              <Var k="validade_proposta" label="Validade (dias)" v={variables} on={setVar} />
              <Var k="vigencia_inicial" label="Vigência inicial" v={variables} on={setVar} />
              <Var k="forma_pagamento" label="Forma de pagamento" v={variables} on={setVar} />
              <Var k="data_proposta" label="Data da proposta" v={variables} on={setVar} />
              <p className="text-xs text-muted-foreground pt-2">Nome, e-mail, telefone e foto do vendedor são preenchidos automaticamente a partir do seu perfil.</p>
            </CardContent>
          </Card>

          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Tema</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {(["primary","primaryDark","accent","surface"] as const).map((k) => (
                <div key={k}>
                  <Label className="text-xs">{k}</Label>
                  <Input type="color" value={(theme as any)[k]} onChange={(e) => setTheme({ ...theme, [k]: e.target.value })} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Tracking</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div><Label>GA4 Measurement ID</Label><Input placeholder="G-XXXXXXX" value={tracking.ga4_id || ""} onChange={(e) => setTracking({ ...tracking, ga4_id: e.target.value })} /></div>
              <div><Label>Microsoft Clarity ID</Label><Input value={tracking.clarity_id || ""} onChange={(e) => setTracking({ ...tracking, clarity_id: e.target.value })} /></div>
            </CardContent>
          </Card>

          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Seções ({sections.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {sections.map((s, i) => (
                <details key={s.id} className="border rounded p-2">
                  <summary className="cursor-pointer text-sm flex items-center gap-2">
                    <input type="checkbox" checked={s.enabled !== false} onChange={(e) => setSection(s.id, { enabled: e.target.checked })} />
                    <span className="flex-1 font-medium">{i + 1}. {s.title}</span>
                    <button className="text-xs px-1" onClick={(e) => { e.preventDefault(); move(s.id, -1); }}>↑</button>
                    <button className="text-xs px-1" onClick={(e) => { e.preventDefault(); move(s.id, 1); }}>↓</button>
                  </summary>
                  <SectionEditor section={s} onTitle={(v) => setSection(s.id, { title: v })} onContent={(p) => setContent(s.id, p)} />
                </details>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="border rounded-lg overflow-hidden bg-gray-100 max-h-[80vh] overflow-y-auto">
          <CommercialProposalRenderer sections={sections} variables={previewVars} theme={theme} />
        </div>
      </div>
    </div>
  );
}

function Var({ k, label, v, on }: { k: string; label: string; v: ProposalVars; on: (k: string, v: string) => void }) {
  return (
    <div><Label className="text-xs">{label}</Label>
      <Input value={v[k] || ""} onChange={(e) => on(k, e.target.value)} /></div>
  );
}

function SectionEditor({ section, onTitle, onContent }: {
  section: CommercialSection;
  onTitle: (v: string) => void;
  onContent: (patch: any) => void;
}) {
  const c = section.content || {};
  const updateItem = (key: "cards" | "items" | "steps", idx: number, patch: any) => {
    const arr = (c[key] || []).slice();
    arr[idx] = { ...arr[idx], ...patch };
    onContent({ [key]: arr });
  };
  return (
    <div className="space-y-2 pt-2 text-sm">
      <div><Label className="text-xs">Título</Label><Input value={section.title} onChange={(e) => onTitle(e.target.value)} /></div>
      {("eyebrow" in c || section.type === "capa") && <div><Label className="text-xs">Eyebrow</Label><Input value={c.eyebrow || ""} onChange={(e) => onContent({ eyebrow: e.target.value })} /></div>}
      {("headline" in c || section.type === "capa" || section.type === "final") && <div><Label className="text-xs">Headline</Label><Input value={c.headline || ""} onChange={(e) => onContent({ headline: e.target.value })} /></div>}
      {("subheadline" in c || section.type === "capa") && <div><Label className="text-xs">Subheadline</Label><Textarea rows={2} value={c.subheadline || ""} onChange={(e) => onContent({ subheadline: e.target.value })} /></div>}
      {("intro" in c) && <div><Label className="text-xs">Intro</Label><Textarea rows={2} value={c.intro || ""} onChange={(e) => onContent({ intro: e.target.value })} /></div>}
      {("body" in c) && <div><Label className="text-xs">Corpo</Label><Textarea rows={4} value={c.body || ""} onChange={(e) => onContent({ body: e.target.value })} /></div>}
      {Array.isArray(c.cards) && c.cards.map((card: any, i: number) => (
        <div key={i} className="border rounded p-2 space-y-1">
          <div className="text-xs font-medium">Card {i + 1}</div>
          {section.type !== "pricing" && <Input placeholder="Ícone (lucide)" value={card.icon || ""} onChange={(e) => updateItem("cards", i, { icon: e.target.value })} />}
          <Input placeholder={section.type === "pricing" ? "Rótulo" : "Título"} value={card.title || card.label || ""} onChange={(e) => updateItem("cards", i, section.type === "pricing" ? { label: e.target.value } : { title: e.target.value })} />
          {section.type === "pricing" ? (
            <>
              <Input placeholder="Chave da variável (ex: valor_implantacao)" value={card.value_key || ""} onChange={(e) => updateItem("cards", i, { value_key: e.target.value })} />
              <Input placeholder="Observação" value={card.note || ""} onChange={(e) => updateItem("cards", i, { note: e.target.value })} />
            </>
          ) : (
            <Textarea rows={2} placeholder="Texto" value={card.text || ""} onChange={(e) => updateItem("cards", i, { text: e.target.value })} />
          )}
        </div>
      ))}
      {Array.isArray(c.items) && c.items.map((it: any, i: number) => (
        <div key={i} className="border rounded p-2 space-y-1">
          <div className="text-xs font-medium">Item {i + 1}</div>
          {section.type === "list" && <Input placeholder="Ícone" value={it.icon || ""} onChange={(e) => updateItem("items", i, { icon: e.target.value })} />}
          <Input placeholder="Título" value={it.title || ""} onChange={(e) => updateItem("items", i, { title: e.target.value })} />
          <Textarea rows={2} placeholder="Texto" value={it.text || ""} onChange={(e) => updateItem("items", i, { text: e.target.value })} />
        </div>
      ))}
      {Array.isArray(c.steps) && c.steps.map((st: any, i: number) => (
        <div key={i} className="border rounded p-2 space-y-1">
          <div className="text-xs font-medium">Etapa {i + 1}</div>
          <Input placeholder="Título" value={st.title || ""} onChange={(e) => updateItem("steps", i, { title: e.target.value })} />
          <Textarea rows={2} placeholder="Texto" value={st.text || ""} onChange={(e) => updateItem("steps", i, { text: e.target.value })} />
        </div>
      ))}
      {Array.isArray(c.next_steps) && (
        <div><Label className="text-xs">Próximos passos (1 por linha)</Label>
          <Textarea rows={4} value={(c.next_steps || []).join("\n")} onChange={(e) => onContent({ next_steps: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} /></div>
      )}
    </div>
  );
}

/* ---------------- OPPORTUNITY PICKER ---------------- */
function OpportunityPickerDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const navigate = useNavigate();
  const [opps, setOpps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<any>(null);
  const [existing, setExisting] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) { setSelectedOpp(null); setExisting([]); setSearch(""); return; } (async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("opportunities")
      .select("id, title, value, client_id, created_at, clients:client_id(company_name, trade_name)")
      .eq("status", "proposal")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setOpps(data || []);
    setLoading(false);
  })(); }, [open]);

  const selectOpp = async (opp: any) => {
    setSelectedOpp(opp);
    const { data } = await supabase.from("proposals")
      .select("id, title, status, version, created_at, share_token")
      .eq("opportunity_id", opp.id)
      .like("template_key", "iganhei%")
      .order("version", { ascending: false })
      .order("created_at", { ascending: false });
    setExisting(data || []);
  };

  const createNew = async (basedOn?: any) => {
    if (!selectedOpp) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    let payload: any;
    if (basedOn) {
      const { data: full } = await supabase.from("proposals").select("*").eq("id", basedOn.id).single();
      if (!full) { setBusy(false); return; }
      const { id: _i, share_token: _s, view_count: _vc, sent_at: _sa, viewed_at: _va, accepted_at: _aa, rejected_at: _ra, created_at: _ca, updated_at: _ua, unique_visitors: _uv, total_time_ms: _tt, engagement_score: _es, ...rest } = full as any;
      payload = { ...rest, title: `${full.title} v${(full.version || 1) + 1}`, status: "draft", version: (full.version || 1) + 1 };
    } else {
      const { data: tpl } = await supabase.from("commercial_proposal_templates").select("*").eq("key", "iganhei_v1").maybeSingle();
      if (!tpl) { toast.error("Template i-Ganhei não encontrado"); setBusy(false); return; }
      const clientName = selectedOpp.clients?.company_name || selectedOpp.clients?.trade_name || "Cliente";
      payload = {
        title: `Proposta i-Ganhei — ${clientName}`,
        created_by: user.id,
        status: "draft",
        template_key: tpl.key,
        sections: tpl.sections,
        theme: tpl.theme,
        tracking: {},
        blocks: [],
        validity_days: 30,
        client_id: selectedOpp.client_id,
        opportunity_id: selectedOpp.id,
        implementation_value: selectedOpp.implementation_value || null,
        monthly_value: selectedOpp.monthly_value || null,
        total_value: selectedOpp.value || null,
      };
    }
    payload.client_id = selectedOpp.client_id;
    payload.opportunity_id = selectedOpp.id;
    const { data, error } = await supabase.from("proposals").insert(payload).select("id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(basedOn ? "Nova versão criada" : "Proposta criada");
    onCreated();
    navigate(`/propostas/comerciais/${data.id}`);
  };

  const filtered = opps.filter((o) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (o.title || "").toLowerCase().includes(s)
      || (o.clients?.company_name || "").toLowerCase().includes(s)
      || (o.clients?.trade_name || "").toLowerCase().includes(s);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova proposta a partir de oportunidade</DialogTitle>
          <DialogDescription>
            Selecione uma oportunidade em status <strong>Proposta</strong> para criar uma nova proposta ou uma nova versão de uma já existente.
          </DialogDescription>
        </DialogHeader>

        {!selectedOpp ? (
          <div className="space-y-3">
            <Input placeholder="Buscar por prospect ou título…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-[400px] overflow-y-auto border rounded">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">Carregando oportunidades…</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Nenhuma oportunidade em status Proposta encontrada.</div>
              ) : filtered.map((o) => (
                <button key={o.id} onClick={() => selectOpp(o)} className="w-full text-left p-3 hover:bg-muted border-b last:border-b-0">
                  <div className="font-medium text-sm">{o.clients?.company_name || o.clients?.trade_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{o.title} {o.value ? `· R$ ${Number(o.value).toLocaleString("pt-BR")}` : ""}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border rounded p-3 bg-muted/40">
              <div className="text-xs text-muted-foreground">Oportunidade selecionada</div>
              <div className="font-semibold">{selectedOpp.clients?.company_name || selectedOpp.clients?.trade_name}</div>
              <div className="text-sm text-muted-foreground">{selectedOpp.title}</div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Propostas existentes para esta oportunidade</div>
              {existing.length === 0 ? (
                <div className="text-sm text-muted-foreground p-3 border rounded">Nenhuma proposta criada ainda para esta oportunidade.</div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto">
                  {existing.map((p) => {
                    const st = STATUS_LABELS[p.status] || { label: p.status, cls: "bg-slate-200" };
                    return (
                      <div key={p.id} className="border rounded p-2 flex items-center gap-2 flex-wrap">
                        <div className="flex-1 min-w-[160px]">
                          <div className="text-sm font-medium">{p.title} <span className="text-xs text-muted-foreground">· v{p.version || 1}</span></div>
                          <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR")}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs ${st.cls}`}>{st.label}</span>
                        <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); navigate(`/propostas/comerciais/${p.id}`); }}>
                          <Pencil className="h-3 w-3 mr-1" />Editar
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => createNew(p)}>
                          <GitBranch className="h-3 w-3 mr-1" />Nova versão
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between gap-2 pt-2 border-t">
              <Button variant="ghost" onClick={() => setSelectedOpp(null)}><ArrowLeft className="h-4 w-4 mr-1" />Trocar oportunidade</Button>
              <Button onClick={() => createNew()} disabled={busy}>
                <FilePlus className="h-4 w-4 mr-1" />Criar proposta nova (do template)
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
