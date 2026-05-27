import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Eye, Users, Clock, Activity, Flame, Snowflake, Thermometer,
  ExternalLink, Copy, Loader2, History, Save, RotateCcw, Trash2,
  UserPlus, Mail, Link2, Send,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { proposalPublicUrl } from "@/lib/publicUrls";

function classify(score: number): { label: string; color: string; Icon: any } {
  if (score >= 60) return { label: "Quente", color: "bg-red-500 text-white", Icon: Flame };
  if (score >= 30) return { label: "Morno", color: "bg-amber-500 text-white", Icon: Thermometer };
  return { label: "Frio", color: "bg-slate-400 text-white", Icon: Snowflake };
}

function formatDuration(ms: number): string {
  const s = Math.floor((ms || 0) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}m ${r}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const EVENT_LABELS: Record<string, string> = {
  open: "Abertura",
  section_view: "Visualizou seção",
  cta_click: "Clicou em CTA",
  pricing_view: "Viu pricing",
  download: "Baixou/Imprimiu",
  share: "Compartilhou",
  heartbeat: "Permanência",
  invite_sent: "Convite enviado",
};

export default function PropostaInsights() {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [views, setViews] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [snapshotReason, setSnapshotReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<any | null>(null);
  const [rName, setRName] = useState("");
  const [rEmail, setREmail] = useState("");
  const [rRole, setRRole] = useState("");
  const [rNotes, setRNotes] = useState("");

  const loadRecipients = async (pid: string) => {
    const { data } = await supabase
      .from("proposal_recipients")
      .select("*")
      .eq("proposal_id", pid)
      .order("created_at", { ascending: true });
    setRecipients(data || []);
  };

  const openNewRecipient = () => {
    setEditingRecipient(null);
    setRName(""); setREmail(""); setRRole(""); setRNotes("");
    setRecipientOpen(true);
  };
  const openEditRecipient = (r: any) => {
    setEditingRecipient(r);
    setRName(r.name || ""); setREmail(r.email || ""); setRRole(r.role || ""); setRNotes(r.notes || "");
    setRecipientOpen(true);
  };
  const saveRecipient = async () => {
    if (!proposal) return;
    if (!rName.trim()) { toast.error("Informe um nome"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      if (editingRecipient) {
        const r = await supabase.from("proposal_recipients").update({
          name: rName, email: rEmail || null, role: rRole || null, notes: rNotes || null,
        }).eq("id", editingRecipient.id);
        if (r.error) throw r.error;
      } else {
        const r = await supabase.from("proposal_recipients").insert({
          proposal_id: proposal.id, name: rName, email: rEmail || null,
          role: rRole || null, notes: rNotes || null, created_by: user.id,
        });
        if (r.error) throw r.error;
      }
      toast.success("Destinatário salvo");
      setRecipientOpen(false);
      await loadRecipients(proposal.id);
    } catch (e: any) { toast.error(e.message); }
  };
  const deleteRecipient = async (r: any) => {
    if (!confirm(`Remover ${r.name}?`)) return;
    const { error } = await supabase.from("proposal_recipients").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    if (proposal?.id) loadRecipients(proposal.id);
  };
  const recipientLink = (r: any) => proposalPublicUrl(proposal?.share_token, r.id);
  const copyRecipientLink = async (r: any) => {
    await navigator.clipboard.writeText(recipientLink(r));
    toast.success(`Link de ${r.name} copiado`);
  };

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRecipient, setInviteRecipient] = useState<any | null>(null);
  const [inviteMessage, setInviteMessage] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

  const openInvite = (r: any) => {
    if (!r.email) { toast.error("Adicione um e-mail ao destinatário antes de enviar o convite."); return; }
    setInviteRecipient(r);
    setInviteMessage("");
    setInviteOpen(true);
  };

  const sendInvite = async () => {
    if (!inviteRecipient) return;
    setSendingInvite(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-proposal-invite", {
        body: {
          recipientId: inviteRecipient.id,
          customMessage: inviteMessage.trim() || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Convite enviado para ${inviteRecipient.email}`);
      setInviteOpen(false);
      if (proposal?.id) {
        await Promise.all([loadRecipients(proposal.id), load()]);
      }
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar convite");
    } finally {
      setSendingInvite(false);
    }
  };

  const loadVersions = async (pid: string) => {
    const { data } = await supabase
      .from("proposal_versions")
      .select("*")
      .eq("proposal_id", pid)
      .order("version", { ascending: false });
    const rows = data || [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.created_by).filter(Boolean)));
    let profMap = new Map<string, any>();
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      profMap = new Map((profs || []).map((p: any) => [p.id, p]));
    }
    setVersions(rows.map((r: any) => ({ ...r, profiles: profMap.get(r.created_by) || null })));
  };

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const [pRes, eRes, vRes] = await Promise.all([
      supabase.from("proposals").select("*").eq("id", id).maybeSingle(),
      supabase.from("proposal_events").select("*").eq("proposal_id", id).order("created_at", { ascending: false }).limit(500),
      supabase.from("proposal_views").select("*").eq("proposal_id", id).order("last_view_at", { ascending: false }),
    ]);
    if (pRes.error) setError(pRes.error.message);
    let proposalData: any = pRes.data;
    if (proposalData) {
      const [cRes, oRes] = await Promise.all([
        proposalData.client_id
          ? supabase.from("clients").select("company_name").eq("id", proposalData.client_id).maybeSingle()
          : Promise.resolve({ data: null }),
        proposalData.opportunity_id
          ? supabase.from("opportunities").select("title").eq("id", proposalData.opportunity_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      proposalData = { ...proposalData, clients: cRes.data, opportunities: oRes.data };
    }
    setProposal(proposalData);
    setEvents(eRes.data || []);
    setViews(vRes.data || []);
    if (pRes.data?.id) {
      await Promise.all([loadVersions(pRes.data.id), loadRecipients(pRes.data.id)]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const saveNewVersion = async () => {
    if (!proposal) return;
    const reason = snapshotReason.trim();
    if (reason.length < 3) {
      toast.error("Informe o motivo da mudança (mínimo 3 caracteres).");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      // Snapshot current state as the *current* version, then bump proposal.version
      const currentVersion = proposal.version || 1;
      const snap = {
        proposal_id: proposal.id,
        version: currentVersion,
        title: proposal.title,
        blocks: proposal.blocks,
        variables: proposal.variables,
        total_value: proposal.total_value,
        monthly_value: proposal.monthly_value,
        implementation_value: proposal.implementation_value,
        validity_days: proposal.validity_days,
        snapshot_reason: reason,
        created_by: user.id,
      };
      const ins = await supabase.from("proposal_versions").upsert(snap, { onConflict: "proposal_id,version" });
      if (ins.error) throw ins.error;
      const upd = await supabase.from("proposals").update({ version: currentVersion + 1 }).eq("id", proposal.id);
      if (upd.error) throw upd.error;
      toast.success(`Versão v${currentVersion} salva. Editando v${currentVersion + 1}.`);
      setSaveOpen(false);
      setSnapshotReason("");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const restoreVersion = async (v: any) => {
    if (!proposal) return;
    if (!confirm(`Restaurar conteúdo da v${v.version}? O conteúdo atual será perdido a menos que você salve uma nova versão antes.`)) return;
    const { error } = await supabase.from("proposals").update({
      title: v.title,
      blocks: v.blocks,
      variables: v.variables,
      total_value: v.total_value,
      monthly_value: v.monthly_value,
      implementation_value: v.implementation_value,
      validity_days: v.validity_days,
    }).eq("id", proposal.id);
    if (error) return toast.error(error.message);
    toast.success(`v${v.version} restaurada como conteúdo atual`);
    await load();
  };

  const deleteVersion = async (v: any) => {
    if (!confirm(`Excluir versão v${v.version}?`)) return;
    const { error } = await supabase.from("proposal_versions").delete().eq("id", v.id);
    if (error) return toast.error(error.message);
    toast.success("Versão excluída");
    if (proposal?.id) loadVersions(proposal.id);
  };

  // Realtime subscription for new events
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`prop-events-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "proposal_events", filter: `proposal_id=eq.${id}` }, (payload) => {
        const ev: any = payload.new;
        setEvents((prev) => [ev, ...prev].slice(0, 500));
        const lbl = EVENT_LABELS[ev.event_type] || ev.event_type;
        toast.info(`Novo evento: ${lbl}`, { description: ev.city ? `${ev.city}, ${ev.country || ""}` : undefined });
        // refresh aggregates lazily
        supabase.from("proposals").select("engagement_score, unique_visitors, total_time_ms, view_count, viewed_at, status").eq("id", id).maybeSingle().then((r) => {
          if (r.data) setProposal((p: any) => ({ ...p, ...r.data }));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  const sectionTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    const extractTitle = (item: any): string => {
      const direct = item?.title || item?.name || item?.heading;
      if (direct) return String(direct);
      const html: string = item?.html || item?.content?.html || item?.content || "";
      if (typeof html === "string" && html) {
        const h = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
        const raw = (h?.[1] || html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (raw) return raw.slice(0, 60);
      }
      return "";
    };
    const secs = Array.isArray(proposal?.sections) && proposal.sections.length
      ? proposal.sections
      : (Array.isArray(proposal?.blocks) ? proposal.blocks : []);
    secs.forEach((s: any, idx: number) => {
      if (!s?.id) return;
      const title = extractTitle(s);
      map.set(s.id, title ? `Slide ${idx + 1} · ${title}` : `Slide ${idx + 1}`);
    });
    return map;
  }, [proposal?.sections, proposal?.blocks]);

  const sectionLabel = (sid?: string | null) =>
    sid ? (sectionTitleMap.get(sid) || sid) : "";

  const sectionStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      if (e.event_type !== "section_view" || !e.section_id) continue;
      map.set(e.section_id, (map.get(e.section_id) || 0) + 1);
    }
    const arr = Array.from(map.entries()).map(([id, count]) => ({ id, count, label: sectionLabel(id) || id }));
    arr.sort((a, b) => b.count - a.count);
    return arr.slice(0, 8);
  }, [events, sectionTitleMap]);

  const lastEvent = events[0];
  const score = proposal?.engagement_score || 0;
  const cls = classify(score);

  const copyLink = async () => {
    if (!proposal?.share_token) return;
    await navigator.clipboard.writeText(proposalPublicUrl(proposal.share_token));
    toast.success("Link copiado");
  };

  if (loading) return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;
  if (error || !proposal) return <div className="p-6 text-destructive">{error || "Proposta não encontrada"}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link to="/propostas?tab=proposals"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {proposal.title}
              <Badge className={cls.color}><cls.Icon className="h-3 w-3 mr-1" />{cls.label}</Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              {proposal.clients?.company_name || "—"} · {proposal.opportunities?.title || ""} · v{proposal.version || 1} · {proposal.status}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={copyLink}><Copy className="h-3 w-3 mr-1" /> Copiar link</Button>
          <Button variant="outline" size="sm" onClick={() => window.open(proposalPublicUrl(proposal.share_token), "_blank")}><ExternalLink className="h-3 w-3 mr-1" /> Abrir</Button>
          <Button variant="default" size="sm" onClick={() => setSaveOpen(true)}><Save className="h-3 w-3 mr-1" /> Salvar nova versão</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={<Activity className="h-4 w-4" />} label="Score" value={String(score)} sub={cls.label} />
        <KpiCard icon={<Eye className="h-4 w-4" />} label="Aberturas" value={String(proposal.view_count || 0)} />
        <KpiCard icon={<Users className="h-4 w-4" />} label="Visitantes únicos" value={String(proposal.unique_visitors || 0)} />
        <KpiCard icon={<Clock className="h-4 w-4" />} label="Tempo total" value={formatDuration(proposal.total_time_ms || 0)} />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Última atividade"
          value={lastEvent ? formatDistanceToNow(parseISO(lastEvent.created_at), { addSuffix: true, locale: ptBR }) : (proposal.viewed_at ? formatDistanceToNow(parseISO(proposal.viewed_at), { addSuffix: true, locale: ptBR }) : "—")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top seções visualizadas</CardTitle></CardHeader>
          <CardContent>
            {sectionStats.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem visualizações de seção registradas ainda.</div>
            ) : (
              <div className="space-y-2">
                {sectionStats.map((s) => {
                  const max = sectionStats[0].count || 1;
                  const pct = Math.round((s.count / max) * 100);
                  return (
                    <div key={s.id}>
                      <div className="flex justify-between text-xs mb-1"><span className="truncate max-w-[70%]" title={s.id}>{s.label}</span><span className="text-muted-foreground">{s.count} views</span></div>
                      <div className="h-2 bg-muted rounded"><div className="h-2 bg-primary rounded" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Visitantes ({views.length})</CardTitle></CardHeader>
          <CardContent>
            {views.length === 0 ? (
              <div className="text-sm text-muted-foreground">Ninguém abriu ainda.</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Visitante</TableHead><TableHead>Local</TableHead><TableHead>Acessos</TableHead><TableHead>Tempo</TableHead><TableHead>Última</TableHead></TableRow></TableHeader>
                <TableBody>
                  {views.slice(0, 20).map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">{v.visitor_id.slice(0, 8)}…</TableCell>
                      <TableCell className="text-xs">{[v.city, v.country].filter(Boolean).join(", ") || "—"}</TableCell>
                      <TableCell>{v.view_count}</TableCell>
                      <TableCell>{formatDuration(v.total_time_ms)}</TableCell>
                      <TableCell className="text-xs">{format(parseISO(v.last_view_at), "dd/MM HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Timeline de eventos ({events.length})</CardTitle></CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Evento</TableHead><TableHead>Detalhe</TableHead><TableHead>Visitante</TableHead><TableHead>Origem</TableHead></TableRow></TableHeader>
              <TableBody>
                {events.slice(0, 100).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(parseISO(e.created_at), "dd/MM HH:mm:ss")}</TableCell>
                    <TableCell><Badge variant="outline">{EVENT_LABELS[e.event_type] || e.event_type}</Badge></TableCell>
                    <TableCell className="text-xs max-w-[280px] truncate" title={e.section_id || ""}>{sectionLabel(e.section_id) || (e.metadata?.href ?? "")}</TableCell>
                    <TableCell className="font-mono text-xs">{e.visitor_id?.slice(0, 8)}…</TableCell>
                    <TableCell className="text-xs">{[e.city, e.country].filter(Boolean).join(", ")} {e.device ? `· ${e.device}` : ""} {e.browser ? `· ${e.browser}` : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Destinatários da Deal Room ({recipients.length})</CardTitle>
          <Button size="sm" onClick={openNewRecipient}><UserPlus className="h-3 w-3 mr-1" /> Adicionar destinatário</Button>
        </CardHeader>
        <CardContent>
          {recipients.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhum destinatário cadastrado. Adicione pessoas para gerar links únicos e rastrear o engajamento individual.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Aberturas</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>Última visita</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map((r) => {
                  const rcls = classify(r.engagement_score || 0);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{r.name}</div>
                        {r.email && <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</div>}
                      </TableCell>
                      <TableCell className="text-xs">{r.role || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      <TableCell><Badge className={rcls.color}><rcls.Icon className="h-3 w-3 mr-1" />{r.engagement_score || 0}</Badge></TableCell>
                      <TableCell className="text-xs">{r.view_count || 0}</TableCell>
                      <TableCell className="text-xs">{formatDuration(r.total_time_ms || 0)}</TableCell>
                      <TableCell className="text-xs">
                        {r.last_viewed_at ? formatDistanceToNow(parseISO(r.last_viewed_at), { addSuffix: true, locale: ptBR }) : "—"}
                        {r.invited_at && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            Convite: {formatDistanceToNow(parseISO(r.invited_at), { addSuffix: true, locale: ptBR })}
                            {r.invite_count > 1 ? ` (${r.invite_count}x)` : ""}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="default" onClick={() => openInvite(r)} title={r.invited_at ? "Reenviar convite" : "Enviar convite por e-mail"} disabled={!r.email}>
                          <Send className="h-3 w-3 mr-1" />{r.invited_at ? "Reenviar" : "Enviar"}
                        </Button>
                        <Button size="sm" variant="outline" className="ml-1" onClick={() => copyRecipientLink(r)} title="Copiar link único"><Link2 className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" className="ml-1" onClick={() => window.open(recipientLink(r), "_blank")} title="Abrir como destinatário"><ExternalLink className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="ml-1" onClick={() => openEditRecipient(r)} title="Editar">✎</Button>
                        <Button size="sm" variant="ghost" className="text-destructive ml-1" onClick={() => deleteRecipient(r)}><Trash2 className="h-3 w-3" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={recipientOpen} onOpenChange={setRecipientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRecipient ? "Editar destinatário" : "Novo destinatário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nome *</Label><Input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="Ex.: Maria Souza" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">E-mail</Label><Input type="email" value={rEmail} onChange={(e) => setREmail(e.target.value)} /></div>
              <div><Label className="text-xs">Cargo</Label><Input value={rRole} onChange={(e) => setRRole(e.target.value)} placeholder="Ex.: Diretora Comercial" /></div>
            </div>
            <div><Label className="text-xs">Notas</Label><Textarea value={rNotes} onChange={(e) => setRNotes(e.target.value)} rows={2} /></div>
            {editingRecipient && (
              <div className="text-xs text-muted-foreground break-all p-2 bg-muted rounded">
                Link único: {recipientLink(editingRecipient)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecipientOpen(false)}>Cancelar</Button>
            <Button onClick={saveRecipient}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar convite por e-mail</DialogTitle>
          </DialogHeader>
          {inviteRecipient && (
            <div className="space-y-3">
              <div className="text-sm">
                Para: <strong>{inviteRecipient.name}</strong>{" "}
                <span className="text-muted-foreground">&lt;{inviteRecipient.email}&gt;</span>
              </div>
              <div className="text-xs text-muted-foreground break-all p-2 bg-muted rounded">
                Link único: {recipientLink(inviteRecipient)}
              </div>
              <div>
                <Label className="text-xs">Mensagem personalizada (opcional)</Label>
                <Textarea
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Ex.: Conforme conversamos, segue a proposta para sua avaliação."
                  rows={4}
                  maxLength={1000}
                />
              </div>
              {inviteRecipient.invited_at && (
                <p className="text-xs text-amber-600">
                  Este destinatário já recebeu {inviteRecipient.invite_count || 1} convite(s). Será enviado novamente.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={sendingInvite}>Cancelar</Button>
            <Button onClick={sendInvite} disabled={sendingInvite}>
              {sendingInvite ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
              Enviar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Histórico de versões ({versions.length})</CardTitle>
          <Badge variant="outline">Versão atual: v{proposal.version || 1}</Badge>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma versão anterior salva. Use "Salvar nova versão" para criar um snapshot do conteúdo atual antes de editar.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Versão</TableHead><TableHead>Salva em</TableHead><TableHead>Por</TableHead><TableHead>Motivo</TableHead><TableHead>Valor</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {versions.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell><Badge>v{v.version}</Badge></TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{format(parseISO(v.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell className="text-xs">{v.profiles?.full_name || "—"}</TableCell>
                    <TableCell className="text-xs max-w-[280px] truncate">{v.snapshot_reason || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-xs">{Number(v.total_value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => restoreVersion(v)}><RotateCcw className="h-3 w-3 mr-1" /> Restaurar</Button>
                      <Button size="sm" variant="ghost" className="text-destructive ml-1" onClick={() => deleteVersion(v)}><Trash2 className="h-3 w-3" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar nova versão</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Será criado um snapshot do conteúdo atual como <strong>v{proposal.version || 1}</strong>. A proposta passará a ser editada como <strong>v{(proposal.version || 1) + 1}</strong>.
            </p>
            <div>
              <Label className="text-xs">Motivo da mudança <span className="text-destructive">*</span></Label>
              <Textarea
                value={snapshotReason}
                onChange={(e) => setSnapshotReason(e.target.value)}
                placeholder="Ex.: ajuste de preço após reunião com o cliente"
                rows={3}
                required
              />
              <p className="text-[11px] text-muted-foreground mt-1">Obrigatório. O autor da versão será registrado automaticamente.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveNewVersion} disabled={saving || snapshotReason.trim().length < 3}>{saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Salvar versão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
