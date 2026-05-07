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
import { format, isSameDay, startOfDay, endOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Lock, Globe, MapPin, Link as LinkIcon, Trash2, Pencil, ChevronLeft, ChevronRight } from "lucide-react";

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
  const isPreVendas = role === "pre_vendas";
  const isAdmin = role === "admin";
  const canCreate = isPreVendas || isAdmin;

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    start_datetime: "",
    end_datetime: "",
    is_private: false,
    pre_vendas_user_id: "",
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
    });
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
    });
    setOpen(true);
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
    };
    if (editing) {
      const { error } = await supabase
        .from("pre_vendas_agenda")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error("Erro: " + error.message);
      toast.success("Compromisso atualizado");
    } else {
      payload.created_by = userId;
      const { error } = await supabase.from("pre_vendas_agenda").insert(payload);
      if (error) return toast.error("Erro: " + error.message);
      toast.success("Compromisso criado");
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
        {canCreate && (
          <Button onClick={() => openNew()} className="gap-2">
            <Plus className="h-4 w-4" /> Novo compromisso
          </Button>
        )}
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
                  onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="font-semibold capitalize">
                  {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
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

            {dayEvents.length === 0 ? (
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
