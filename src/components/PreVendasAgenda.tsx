import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format, isSameDay, startOfDay, endOfDay, addDays, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Lock, Globe, MapPin, Link as LinkIcon, Trash2, Pencil, ChevronLeft, ChevronRight, Send, Mail, X } from "lucide-react";
import { Badge as BadgeUI } from "@/components/ui/badge";

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
  opportunity_id?: string | null;
  zoho_event_id?: string | null;
  sync_status?: string | null;
  last_synced_at?: string | null;
};

interface Props {
  userId: string;
  role: string;
  preVendasUsers: { id: string; full_name: string }[];
}

export default function PreVendasAgenda({ userId, role, preVendasUsers }: Props) {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaEvent | null>(null);
  const [filterPv, setFilterPv] = useState<string>("all");
  const [sending, setSending] = useState(false);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const isPreVendas = role === "pre_vendas";
  const isAdmin = role === "admin";
  const canCreate = isPreVendas || isAdmin || role === "vendedor" || role === "gestor";

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    start_datetime: "",
    end_datetime: "",
    is_private: false,
    pre_vendas_user_id: "",
    attendees: [] as string[],
    send_invite: true,
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("pre_vendas_agenda")
      .select("*")
      .order("start_datetime", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar agenda: " + error.message);
      return;
    }
    setEvents((data as any) || []);
  }

  function openNew(date?: Date) {
    const base = date || selectedDate;
    const start = new Date(base);
    start.setHours(9, 0, 0, 0);
    const end = new Date(base);
    end.setHours(10, 0, 0, 0);
    setEditing(null);
    setForm({
      title: "",
      description: "",
      location: "",
      start_datetime: format(start, "yyyy-MM-dd'T'HH:mm"),
      end_datetime: format(end, "yyyy-MM-dd'T'HH:mm"),
      is_private: false,
      pre_vendas_user_id: isPreVendas ? userId : preVendasUsers[0]?.id || "",
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
      pre_vendas_user_id: ev.pre_vendas_user_id,
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
  function removeAttendee(em: string) {
    setForm({ ...form, attendees: form.attendees.filter(a => a !== em) });
  }

  async function handleSave() {
    if (!form.title || !form.start_datetime || !form.end_datetime) {
      toast.error("Preencha título e horários");
      return;
    }
    if (new Date(form.end_datetime) <= new Date(form.start_datetime)) {
      toast.error("Horário final deve ser após o inicial");
      return;
    }
    const payload: any = {
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      start_datetime: new Date(form.start_datetime).toISOString(),
      end_datetime: new Date(form.end_datetime).toISOString(),
      is_private: form.is_private,
      pre_vendas_user_id: form.pre_vendas_user_id || userId,
      attendees: form.attendees,
    };
    let savedId: string | null = null;
    if (editing) {
      const { error } = await supabase
        .from("pre_vendas_agenda")
        .update(payload)
        .eq("id", editing.id);
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

    // Sincroniza com Zoho (cria/atualiza evento + envia convite se houver convidados)
    if (savedId && form.send_invite && form.attendees.length > 0) {
      setSending(true);
      try {
        const { data, error } = await supabase.functions.invoke("zoho-sync-event", {
          body: { eventId: savedId, sendInvite: true },
        });
        if (error) toast.error("Falha ao enviar convite: " + error.message);
        else if (data?.invitation?.status === "sent") toast.success(`Convite enviado para ${form.attendees.length} convidado(s)`);
        else if (data?.invitation?.status === "failed") toast.error("Convite falhou: " + (data.invitation.error_message || "erro desconhecido"));
      } catch (e: any) {
        toast.error("Erro Zoho: " + e.message);
      } finally {
        setSending(false);
      }
    }

    setOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este compromisso?")) return;
    const { error } = await supabase.from("pre_vendas_agenda").delete().eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Excluído");
    load();
  }

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((e) =>
      filterPv === "all" ? true : e.pre_vendas_user_id === filterPv
    );
  }, [events, filterPv]);

  const dayEvents = useMemo(() => {
    return filteredEvents
      .filter((e) => {
        const s = new Date(e.start_datetime);
        return isSameDay(s, selectedDate);
      })
      .sort(
        (a, b) =>
          new Date(a.start_datetime).getTime() -
          new Date(b.start_datetime).getTime()
      );
  }, [filteredEvents, selectedDate]);

  // Week view (Mon-Sun)
  const weekStart = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEventsByDay = useMemo(() => {
    return weekDays.map((d) =>
      filteredEvents
        .filter((e) => isSameDay(new Date(e.start_datetime), d))
        .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
    );
  }, [weekDays, filteredEvents]);

  // Days with events for calendar dots
  const busyDays = useMemo(() => {
    const set = new Set<string>();
    filteredEvents.forEach((e) =>
      set.add(format(new Date(e.start_datetime), "yyyy-MM-dd"))
    );
    return set;
  }, [filteredEvents]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return filteredEvents
      .filter((e) => new Date(e.end_datetime) >= now)
      .slice(0, 8);
  }, [filteredEvents]);

  function pvName(id: string) {
    return preVendasUsers.find((p) => p.id === id)?.full_name || "—";
  }

  function canEdit(ev: AgendaEvent) {
    return isAdmin || ev.created_by === userId || ev.pre_vendas_user_id === userId;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Label className="text-sm">Pré-Vendas:</Label>
          <Select value={filterPv} onValueChange={setFilterPv}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {preVendasUsers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Globe className="h-3.5 w-3.5" /> Público
            <Lock className="h-3.5 w-3.5 ml-2" /> Privado (só você)
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border p-0.5">
            <Button
              size="sm"
              variant={viewMode === "day" ? "default" : "ghost"}
              className="h-7 px-3 text-xs"
              onClick={() => setViewMode("day")}
            >
              Dia
            </Button>
            <Button
              size="sm"
              variant={viewMode === "week" ? "default" : "ghost"}
              className="h-7 px-3 text-xs"
              onClick={() => setViewMode("week")}
            >
              Semana
            </Button>
          </div>
          {canCreate && (
            <Button onClick={() => openNew()} className="gap-2">
              <Plus className="h-4 w-4" /> Novo compromisso
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_300px] gap-4">
        <Card>
          <CardContent className="p-2">
            <Calendar
              mode="single"
              locale={ptBR}
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              modifiers={{
                busy: (d) => busyDays.has(format(d, "yyyy-MM-dd")),
              }}
              modifiersClassNames={{
                busy: "relative font-bold text-primary",
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDate(viewMode === "week" ? addWeeks(selectedDate, -1) : addDays(selectedDate, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="font-semibold capitalize">
                  {viewMode === "week"
                    ? `${format(weekStart, "dd MMM", { locale: ptBR })} – ${format(addDays(weekStart, 6), "dd MMM yyyy", { locale: ptBR })}`
                    : format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDate(viewMode === "week" ? addWeeks(selectedDate, 1) : addDays(selectedDate, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
              >
                Hoje
              </Button>
            </div>

            {viewMode === "week" ? (
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((d, i) => {
                  const evs = weekEventsByDay[i];
                  const isToday = isSameDay(d, new Date());
                  const isSelected = isSameDay(d, selectedDate);
                  return (
                    <div
                      key={d.toISOString()}
                      className={`border rounded-lg p-2 min-h-[160px] flex flex-col gap-1 cursor-pointer transition-colors ${isSelected ? "border-primary bg-accent/30" : "hover:bg-accent/20"}`}
                      onClick={() => setSelectedDate(d)}
                    >
                      <div className={`text-xs font-medium capitalize ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                        {format(d, "EEE dd", { locale: ptBR })}
                      </div>
                      {evs.length === 0 && (
                        <div className="text-[10px] text-muted-foreground/60 mt-1">—</div>
                      )}
                      {evs.map((ev) => (
                        <button
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); if (canEdit(ev)) openEdit(ev); else setSelectedDate(d); }}
                          className="text-left text-[11px] rounded px-1.5 py-1 bg-accent/40 hover:bg-accent/70 truncate"
                          style={{ borderLeft: `3px solid ${ev.color || "#22c55e"}` }}
                          title={ev.title}
                        >
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {format(new Date(ev.start_datetime), "HH:mm")}
                          </div>
                          <div className="truncate font-medium flex items-center gap-1">
                            {ev.is_private && <Lock className="h-2.5 w-2.5" />}
                            {ev.title}
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : dayEvents.length === 0 ? (
              <div className="text-center text-muted-foreground py-12 text-sm">
                Sem compromissos para este dia.
                {canCreate && (
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
                    style={{ borderLeftColor: ev.color || "#22c55e", borderLeftWidth: 4 }}
                  >
                    <div className="text-sm font-mono w-24 text-muted-foreground">
                      {format(new Date(ev.start_datetime), "HH:mm")}
                      <br />
                      <span className="text-xs">
                        {format(new Date(ev.end_datetime), "HH:mm")}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{ev.title}</span>
                        {ev.is_private ? (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Lock className="h-3 w-3" /> Privado
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Globe className="h-3 w-3" /> Público
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {pvName(ev.pre_vendas_user_id)}
                        </Badge>
                      </div>
                      {ev.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {ev.description}
                        </p>
                      )}
                      {ev.location && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          {ev.location.startsWith("http") ? (
                            <LinkIcon className="h-3 w-3" />
                          ) : (
                            <MapPin className="h-3 w-3" />
                          )}
                          {ev.location.startsWith("http") ? (
                            <a
                              href={ev.location}
                              target="_blank"
                              rel="noreferrer"
                              className="underline truncate"
                            >
                              {ev.location}
                            </a>
                          ) : (
                            ev.location
                          )}
                        </p>
                      )}
                    </div>
                    {canEdit(ev) && (
                      <div className="flex flex-col gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEdit(ev)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(ev.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <h4 className="font-semibold text-sm mb-2">Próximos compromissos</h4>
            {upcoming.length === 0 && (
              <p className="text-xs text-muted-foreground">Nada agendado.</p>
            )}
            {upcoming.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setSelectedDate(new Date(ev.start_datetime))}
                className="w-full text-left border rounded p-2 hover:bg-accent/40 transition-colors"
              >
                <div className="text-xs text-muted-foreground">
                  {format(new Date(ev.start_datetime), "dd/MM HH:mm", { locale: ptBR })}
                </div>
                <div className="text-sm font-medium truncate flex items-center gap-1">
                  {ev.is_private && <Lock className="h-3 w-3" />}
                  {ev.title}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {pvName(ev.pre_vendas_user_id)}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar compromisso" : "Novo compromisso"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            {(isAdmin || preVendasUsers.length > 1) && (
              <div>
                <Label>Pré-Vendas</Label>
                <Select
                  value={form.pre_vendas_user_id}
                  onValueChange={(v) => setForm({ ...form, pre_vendas_user_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {preVendasUsers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Início *</Label>
                <Input
                  type="datetime-local"
                  value={form.start_datetime}
                  onChange={(e) =>
                    setForm({ ...form, start_datetime: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Fim *</Label>
                <Input
                  type="datetime-local"
                  value={form.end_datetime}
                  onChange={(e) =>
                    setForm({ ...form, end_datetime: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Local / Link</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="https://meet... ou endereço"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="flex items-center justify-between border rounded p-3">
              <div>
                <Label className="text-sm">Compromisso privado</Label>
                <p className="text-xs text-muted-foreground">
                  Só você verá os detalhes. Outros não verão este horário.
                </p>
              </div>
              <Switch
                checked={form.is_private}
                onCheckedChange={(v) => setForm({ ...form, is_private: v })}
              />
            </div>

            <div className="space-y-2 border rounded p-3">
              <Label className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4" /> Convidados (e-mail)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={attendeeInput}
                  onChange={(e) => setAttendeeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAttendee(); } }}
                  placeholder="email@exemplo.com"
                  type="email"
                />
                <Button type="button" variant="outline" onClick={addAttendee}>Adicionar</Button>
              </div>
              {form.attendees.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {form.attendees.map((em) => (
                    <BadgeUI key={em} variant="secondary" className="gap-1">
                      {em}
                      <button onClick={() => removeAttendee(em)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </BadgeUI>
                  ))}
                </div>
              )}
              {form.attendees.length > 0 && (
                <div className="flex items-center justify-between pt-2">
                  <Label className="text-xs text-muted-foreground">Enviar convite por e-mail (Zoho Mail) ao salvar</Label>
                  <Switch
                    checked={form.send_invite}
                    onCheckedChange={(v) => setForm({ ...form, send_invite: v })}
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={sending}>
              {sending ? "Enviando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
