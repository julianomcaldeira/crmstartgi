import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, isSameDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Lock, Globe, MapPin, Link as LinkIcon, Trash2, Pencil,
  ChevronLeft, ChevronRight, X, RefreshCcw, Loader2, AlertTriangle, ListTodo, CalendarClock,
} from "lucide-react";
import { Link } from "react-router-dom";

type AgendaEvent = {
  id: string;
  pre_vendas_user_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_datetime: string;
  end_datetime: string;
  is_private: boolean;
  color: string | null;
  created_by: string;
  attendees?: string[] | null;
  zoho_event_id?: string | null;
  sync_status?: string | null;
  last_synced_at?: string | null;
};

type TaskItem = {
  id: string;
  title: string;
  due_date: string | null;
  priority: string | null;
  status: string;
  task_type: string | null;
  assigned_to: string | null;
};

interface Props {
  userId: string;
  role: string; // 'admin' | 'gestor' | 'vendedor' | 'pre_vendas'
  sellers?: { id: string; full_name: string }[]; // for admin/gestor view filter
}

export default function SalesAgenda({ userId, role, sellers = [] }: Props) {
  const isAdmin = role === "admin";
  const isGestor = role === "gestor";
  const isViewerOnly = isAdmin || isGestor; // não conecta nem cria
  const canConnect = !isViewerOnly; // vendedor / pre_vendas

  const [tokens, setTokens] = useState<any>(null);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewSeller, setViewSeller] = useState<string>(isViewerOnly ? "all" : userId);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaEvent | null>(null);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    start_datetime: "",
    end_datetime: "",
    is_private: false,
    attendees: [] as string[],
    send_invite: true,
  });

  // ---------- Load tokens (Zoho connection status) ----------
  const loadTokens = useCallback(async () => {
    setLoadingTokens(true);
    if (isViewerOnly) {
      setTokens(null);
      setLoadingTokens(false);
      return;
    }
    const { data } = await (supabase as any)
      .from("zoho_user_tokens")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    setTokens(data);
    setLoadingTokens(false);
  }, [userId, isViewerOnly]);

  // ---------- Load events ----------
  const loadEvents = useCallback(async () => {
    let q = supabase.from("pre_vendas_agenda").select("*").order("start_datetime", { ascending: true });
    if (!isViewerOnly) {
      // vendedor/pre_vendas vê apenas seus próprios
      q = q.eq("pre_vendas_user_id", userId);
    } else if (viewSeller !== "all") {
      q = q.eq("pre_vendas_user_id", viewSeller);
    }
    const { data, error } = await q;
    if (error) {
      toast.error("Erro ao carregar agenda: " + error.message);
      return;
    }
    setEvents((data as any) || []);
  }, [userId, isViewerOnly, viewSeller]);

  // ---------- Load tasks (com due_date) ----------
  const loadTasks = useCallback(async () => {
    let q = supabase
      .from("tasks")
      .select("id, title, due_date, priority, status, task_type, assigned_to")
      .not("due_date", "is", null);
    if (!isViewerOnly) {
      q = q.eq("assigned_to", userId);
    } else if (viewSeller !== "all") {
      q = q.eq("assigned_to", viewSeller);
    }
    const { data, error } = await q;
    if (error) {
      console.warn("tasks load err", error);
      return;
    }
    setTasks((data as any) || []);
  }, [userId, isViewerOnly, viewSeller]);

  useEffect(() => { loadTokens(); }, [loadTokens]);
  useEffect(() => { loadEvents(); loadTasks(); }, [loadEvents, loadTasks]);

  // postMessage from oauth popup
  useEffect(() => {
    function handler(e: MessageEvent) {
      if (e.data?.type === "zoho-oauth") {
        if (e.data.ok) toast.success("Zoho conectado!");
        else toast.error("Falha ao conectar Zoho");
        loadTokens();
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [loadTokens]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("zoho-oauth-init", { body: { dc: "com" } });
      if (error) throw error;
      const popup = window.open(data.url, "zoho_oauth", "width=600,height=700");
      if (!popup) toast.error("Permita pop-ups para conectar.");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("zoho-pull-events");
      if (error) throw error;
      toast.success("Sincronização concluída");
      await Promise.all([loadEvents(), loadTokens()]);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSyncing(false);
    }
  }

  // ---------- Event form ----------
  function openNew(date?: Date) {
    const base = date || selectedDate;
    const start = new Date(base); start.setHours(9, 0, 0, 0);
    const end = new Date(base); end.setHours(10, 0, 0, 0);
    setEditing(null);
    setForm({
      title: "",
      description: "",
      location: "",
      start_datetime: format(start, "yyyy-MM-dd'T'HH:mm"),
      end_datetime: format(end, "yyyy-MM-dd'T'HH:mm"),
      is_private: false,
      attendees: [],
      send_invite: true,
    });
    setAttendeeInput("");
    setOpen(true);
  }

  function openEdit(ev: AgendaEvent) {
    setEditing(ev);
    setForm({
      title: ev.title,
      description: ev.description || "",
      location: ev.location || "",
      start_datetime: format(new Date(ev.start_datetime), "yyyy-MM-dd'T'HH:mm"),
      end_datetime: format(new Date(ev.end_datetime), "yyyy-MM-dd'T'HH:mm"),
      is_private: ev.is_private,
      attendees: ev.attendees || [],
      send_invite: false,
    });
    setAttendeeInput("");
    setOpen(true);
  }

  function addAttendee() {
    const email = attendeeInput.trim();
    if (!email || !email.includes("@")) { toast.error("E-mail inválido"); return; }
    if (form.attendees.includes(email)) return;
    setForm({ ...form, attendees: [...form.attendees, email] });
    setAttendeeInput("");
  }

  async function handleSave() {
    if (!form.title || !form.start_datetime || !form.end_datetime) {
      toast.error("Preencha título e horários"); return;
    }
    if (new Date(form.end_datetime) <= new Date(form.start_datetime)) {
      toast.error("Horário final deve ser após o inicial"); return;
    }
    const payload: any = {
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      start_datetime: new Date(form.start_datetime).toISOString(),
      end_datetime: new Date(form.end_datetime).toISOString(),
      is_private: form.is_private,
      pre_vendas_user_id: userId,
      attendees: form.attendees,
    };
    let savedId: string | null = null;
    if (editing) {
      const { error } = await supabase.from("pre_vendas_agenda").update(payload).eq("id", editing.id);
      if (error) return toast.error("Erro: " + error.message);
      savedId = editing.id;
      toast.success("Compromisso atualizado");
    } else {
      payload.created_by = userId;
      const { data, error } = await supabase.from("pre_vendas_agenda").insert(payload).select().single();
      if (error) return toast.error("Erro: " + error.message);
      savedId = (data as any)?.id;
      toast.success("Compromisso criado");
    }

    // Sincroniza com Zoho (cria/atualiza no Zoho Calendar do vendedor)
    if (savedId && tokens) {
      try {
        const { data, error } = await supabase.functions.invoke("zoho-sync-event", {
          body: { eventId: savedId, sendInvite: form.send_invite && form.attendees.length > 0 },
        });
        if (error) toast.error("Falha ao sincronizar com Zoho: " + error.message);
        else if (data?.invitation?.status === "sent") toast.success(`Convite enviado para ${form.attendees.length} convidado(s)`);
      } catch (e: any) {
        toast.error("Erro Zoho: " + e.message);
      }
    }

    setOpen(false);
    loadEvents();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este compromisso? (também removerá do seu Zoho Calendar na próxima sincronização)")) return;
    const { error } = await supabase.from("pre_vendas_agenda").delete().eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Excluído");
    loadEvents();
  }

  // ---------- Derived ----------
  const dayEvents = useMemo(
    () => events
      .filter(e => isSameDay(new Date(e.start_datetime), selectedDate))
      .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()),
    [events, selectedDate]
  );
  const dayTasks = useMemo(
    () => tasks
      .filter(t => t.due_date && isSameDay(new Date(t.due_date), selectedDate))
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()),
    [tasks, selectedDate]
  );

  const busyDays = useMemo(() => {
    const set = new Set<string>();
    events.forEach(e => set.add(format(new Date(e.start_datetime), "yyyy-MM-dd")));
    tasks.forEach(t => t.due_date && set.add(format(new Date(t.due_date), "yyyy-MM-dd")));
    return set;
  }, [events, tasks]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return events.filter(e => new Date(e.end_datetime) >= now).slice(0, 6);
  }, [events]);

  // ---------- Render ----------
  if (loadingTokens) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando agenda...
      </div>
    );
  }

  // Vendedor não conectado: mostra CTA
  if (canConnect && !tokens) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" /> Conecte sua agenda Zoho
          </CardTitle>
          <CardDescription>
            Sincronize o seu Zoho Calendar com o CRM para ver eventos e prazos juntos.
            Eventos criados aqui também serão enviados ao seu Zoho.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleConnect} disabled={connecting} className="gap-2">
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
            Conectar com Zoho
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {isViewerOnly && (
            <>
              <Label className="text-sm">Vendedor:</Label>
              <Select value={viewSeller} onValueChange={setViewSeller}>
                <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {sellers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          {!isViewerOnly && tokens && (
            <Badge variant="outline" className="gap-1">
              <CalendarClock className="h-3 w-3" /> Zoho: {tokens.zoho_email}
            </Badge>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isViewerOnly && tokens && (
            <Button variant="outline" size="sm" onClick={handleSyncNow} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-1" />}
              Sincronizar Zoho
            </Button>
          )}
          {!isViewerOnly && (
            <Button onClick={() => openNew()} className="gap-2">
              <Plus className="h-4 w-4" /> Novo compromisso
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_300px] gap-4">
        <Card>
          <CardContent className="p-2">
            <CalendarUI
              mode="single"
              locale={ptBR}
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              modifiers={{ busy: (d) => busyDays.has(format(d, "yyyy-MM-dd")) }}
              modifiersClassNames={{ busy: "relative font-bold text-primary" }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="font-semibold capitalize">
                  {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>Hoje</Button>
            </div>

            {dayEvents.length === 0 && dayTasks.length === 0 ? (
              <div className="text-center text-muted-foreground py-12 text-sm">
                Sem compromissos ou prazos para este dia.
                {!isViewerOnly && (
                  <div className="mt-3">
                    <Button variant="outline" size="sm" onClick={() => openNew()}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {dayEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="border rounded-lg p-3 flex gap-3 hover:bg-accent/40 transition-colors"
                    style={{ borderLeftColor: ev.color || "hsl(var(--primary))", borderLeftWidth: 4 }}
                  >
                    <div className="text-sm font-mono w-20 text-muted-foreground">
                      {format(new Date(ev.start_datetime), "HH:mm")}<br />
                      <span className="text-xs">{format(new Date(ev.end_datetime), "HH:mm")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{ev.title}</span>
                        {ev.is_private ? (
                          <Badge variant="outline" className="gap-1 text-xs"><Lock className="h-3 w-3" /> Privado</Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 text-xs"><Globe className="h-3 w-3" /> Público</Badge>
                        )}
                        {ev.zoho_event_id && (
                          <Badge variant="outline" className="text-xs">Zoho</Badge>
                        )}
                      </div>
                      {ev.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ev.description}</p>}
                      {ev.location && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          {ev.location.startsWith("http") ? <LinkIcon className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                          {ev.location.startsWith("http")
                            ? <a href={ev.location} target="_blank" rel="noreferrer" className="underline truncate">{ev.location}</a>
                            : ev.location}
                        </p>
                      )}
                    </div>
                    {!isViewerOnly && (ev.created_by === userId || ev.pre_vendas_user_id === userId) && (
                      <div className="flex flex-col gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(ev)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(ev.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {dayTasks.map((t) => (
                  <Link
                    key={t.id}
                    to="/tarefas"
                    className="border rounded-lg p-3 flex gap-3 hover:bg-accent/40 transition-colors block"
                    style={{ borderLeftColor: "hsl(var(--muted-foreground))", borderLeftWidth: 4 }}
                  >
                    <div className="text-sm font-mono w-20 text-muted-foreground">
                      {format(new Date(t.due_date!), "HH:mm")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{t.title}</span>
                        <Badge variant="outline" className="text-xs">Tarefa</Badge>
                        {t.task_type && <Badge variant="secondary" className="text-xs">{t.task_type}</Badge>}
                        {t.priority === "alta" && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertTriangle className="h-3 w-3" /> Alta
                          </Badge>
                        )}
                        {t.status === "completed" && <Badge variant="outline" className="text-xs">Concluída</Badge>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <h4 className="font-semibold text-sm mb-2">Próximos compromissos</h4>
            {upcoming.length === 0 && <p className="text-xs text-muted-foreground">Nada agendado.</p>}
            {upcoming.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setSelectedDate(new Date(ev.start_datetime))}
                className="w-full text-left text-xs border rounded-md p-2 hover:bg-accent/50"
              >
                <div className="font-medium truncate">{ev.title}</div>
                <div className="text-muted-foreground">
                  {format(new Date(ev.start_datetime), "dd/MM HH:mm", { locale: ptBR })}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar compromisso" : "Novo compromisso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Início *</Label>
                <Input type="datetime-local" value={form.start_datetime}
                  onChange={(e) => setForm({ ...form, start_datetime: e.target.value })} />
              </div>
              <div>
                <Label>Fim *</Label>
                <Input type="datetime-local" value={form.end_datetime}
                  onChange={(e) => setForm({ ...form, end_datetime: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Local / link</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Endereço ou URL da reunião" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Convidados (e-mail)</Label>
              <div className="flex gap-2">
                <Input value={attendeeInput}
                  onChange={(e) => setAttendeeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAttendee(); } }}
                  placeholder="email@dominio.com" />
                <Button type="button" variant="outline" onClick={addAttendee}>Adicionar</Button>
              </div>
              {form.attendees.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {form.attendees.map((em) => (
                    <Badge key={em} variant="secondary" className="gap-1">
                      {em}
                      <button onClick={() => setForm({ ...form, attendees: form.attendees.filter(a => a !== em) })}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Switch checked={form.is_private}
                  onCheckedChange={(c) => setForm({ ...form, is_private: c })} />
                Privado (só você vê)
              </Label>
              {form.attendees.length > 0 && tokens && (
                <Label className="flex items-center gap-2">
                  <Switch checked={form.send_invite}
                    onCheckedChange={(c) => setForm({ ...form, send_invite: c })} />
                  Enviar convite
                </Label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
