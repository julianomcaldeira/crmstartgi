import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableCombobox } from "@/components/SearchableCombobox";
import { Loader2, Mail, RefreshCcw, ChevronDown, ChevronUp, ShieldAlert, ChevronLeft, ChevronRight, Users, List } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { fetchAllPaged } from "@/lib/fetchAllPaged";

export default function EmailDashboard() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [clients, setClients] = useState<Record<string, string>>({});
  const [allClients, setAllClients] = useState<{ id: string; company_name: string }[]>([]);

  // filters
  const [range, setRange] = useState("7");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [groupByClient, setGroupByClient] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const GROUP_PAGE_SIZE = 15;

  const canSeeAll = role === "admin" || role === "gestor";

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setCurrentUserId(user.id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      setRole(roles?.[0]?.role || "vendedor");
      setAuthorized(true);
    })();
  }, [navigate]);

  const computeStart = () => {
    if (range === "custom") return startDate ? new Date(startDate) : null;
    const days = parseInt(range, 10);
    return subDays(new Date(), days);
  };
  const computeEnd = () => {
    if (range === "custom" && endDate) {
      const d = new Date(endDate);
      d.setHours(23, 59, 59, 999);
      return d;
    }
    return new Date();
  };

  async function load() {
    setLoading(true);
    try {
      const start = computeStart();
      const end = computeEnd();
      const data = await fetchAllPaged(async (from, to) => {
        let q: any = (supabase as any)
          .from("email_invitation_log")
          .select("*")
          .order("sent_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to);
        if (start) q = q.gte("sent_at", start.toISOString());
        if (end) q = q.lte("sent_at", end.toISOString());
        const { data: rows, error } = await q;
        if (error) throw error;
        return rows || [];
      });
      setItems(data || []);

      const userIds = Array.from(new Set((data || []).map((d: any) => d.sent_by).filter(Boolean)));
      const clientIds = Array.from(new Set((data || []).map((d: any) => d.client_id).filter(Boolean)));

      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds as string[]);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => { map[p.id] = p.full_name || p.email || "—"; });
        setUsers(map);
      }
      if (clientIds.length) {
        const { data: cs } = await supabase
          .from("clients")
          .select("id, company_name")
          .in("id", clientIds as string[]);
        const cm: Record<string, string> = {};
        (cs || []).forEach((c: any) => { cm[c.id] = c.company_name; });
        setClients(cm);
      }
    } catch (err: any) {
      toast.error("Erro ao carregar histórico: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authorized) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, range, startDate, endDate]);

  useEffect(() => {
    if (!authorized) return;
    (async () => {
      const data = await fetchAllPaged(async (from, to) => {
        const { data: rows, error } = await supabase
          .from("clients")
          .select("id, company_name")
          .order("company_name", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to);
        if (error) throw error;
        return rows || [];
      });
      setAllClients(data || []);
    })();
  }, [authorized]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, userFilter, clientFilter, search, range, startDate, endDate, groupByClient]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (statusFilter !== "all" && it.status !== statusFilter) return false;
      if (userFilter !== "all" && it.sent_by !== userFilter) return false;
      if (clientFilter && it.client_id !== clientFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const recips = (it.recipients || []).join(" ").toLowerCase();
        const subj = (it.subject || "").toLowerCase();
        const client = (clients[it.client_id] || "").toLowerCase();
        if (!recips.includes(s) && !subj.includes(s) && !client.includes(s)) return false;
      }
      return true;
    });
  }, [items, statusFilter, userFilter, clientFilter, search, clients]);

  const grouped = useMemo(() => {
    const map = new Map<string, { clientId: string; name: string; emails: any[]; lastDate: string }>();
    for (const it of filtered) {
      const key = it.client_id || "__none__";
      const name = it.client_id ? (clients[it.client_id] || "Cliente desconhecido") : "Sem cliente vinculado";
      if (!map.has(key)) map.set(key, { clientId: key, name, emails: [], lastDate: it.sent_at });
      const g = map.get(key)!;
      g.emails.push(it);
      if (it.sent_at > g.lastDate) g.lastDate = it.sent_at;
    }
    return Array.from(map.values()).sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));
  }, [filtered, clients]);

  const totalPages = Math.max(
    1,
    Math.ceil((groupByClient ? grouped.length : filtered.length) / (groupByClient ? GROUP_PAGE_SIZE : PAGE_SIZE)),
  );
  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );
  const pagedGroups = useMemo(
    () => grouped.slice((page - 1) * GROUP_PAGE_SIZE, page * GROUP_PAGE_SIZE),
    [grouped, page],
  );

  const stats = useMemo(() => {
    const total = filtered.length;
    const sent = filtered.filter((i) => i.status === "sent").length;
    const failed = filtered.filter((i) => i.status === "failed").length;
    const pending = filtered.filter((i) => i.status === "pending").length;
    return { total, sent, failed, pending };
  }, [filtered]);

  const userOptions = useMemo(() => {
    const ids = Array.from(new Set(items.map((i) => i.sent_by).filter(Boolean))) as string[];
    return ids.map((id) => ({ id, name: users[id] || id.slice(0, 8) }));
  }, [items, users]);

  const statusVariant = (s: string): any => {
    if (s === "sent") return "default";
    if (s === "failed") return "destructive";
    return "secondary";
  };
  const statusLabel = (s: string) => {
    if (s === "sent") return "Enviado";
    if (s === "failed") return "Falhou";
    if (s === "pending") return "Pendente";
    return s;
  };

  if (authorized === null) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-3">
        <ShieldAlert className="h-12 w-12 mx-auto text-destructive" />
        <h2 className="text-xl font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">
          Esta página é exclusiva para Admin e Gestor.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> Dashboard de E-mails
          </h1>
          <p className="text-sm text-muted-foreground">
            {canSeeAll
              ? "Monitoramento de e-mails enviados via Zoho Mail por todos os vendedores"
              : "Seus e-mails enviados via Zoho Mail"}
          </p>
        </div>
        <Button onClick={load} variant="outline" size="sm">
          <RefreshCcw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Período</label>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Últimas 24h</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {range === "custom" && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">De</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Até</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {canSeeAll && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vendedor</label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {userOptions.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cliente</label>
            <SearchableCombobox
              items={allClients.map((c) => ({ value: c.id, label: c.company_name }))}
              value={clientFilter}
              onValueChange={setClientFilter}
              placeholder="Todos os clientes"
              searchPlaceholder="Buscar cliente..."
              emptyText="Nenhum cliente encontrado."
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Buscar</label>
            <Input
              placeholder="Assunto, e-mail, cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Enviados</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{stats.sent}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Falharam</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{stats.failed}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Pendentes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-muted-foreground">{stats.pending}</div></CardContent></Card>
      </div>

      {/* List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {groupByClient ? `Clientes (${grouped.length})` : `E-mails (${filtered.length})`}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setGroupByClient((v) => !v)}>
            {groupByClient ? (<><List className="h-4 w-4 mr-2" /> Ver lista</>) : (<><Users className="h-4 w-4 mr-2" /> Agrupar por cliente</>)}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhum e-mail encontrado para os filtros selecionados.
            </div>
          ) : (
            <>
            {groupByClient ? (
              <div className="space-y-2">
                {pagedGroups.map((g) => {
                  const isOpen = expandedGroup === g.clientId;
                  const sentCount = g.emails.filter((e) => e.status === "sent").length;
                  const failedCount = g.emails.filter((e) => e.status === "failed").length;
                  return (
                    <div key={g.clientId} className="border rounded-lg bg-muted/20">
                      <button
                        className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
                        onClick={() => setExpandedGroup(isOpen ? null : g.clientId)}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Users className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate">{g.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Último: {format(parseISO(g.lastDate), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-xs">{g.emails.length} e-mails</Badge>
                          {sentCount > 0 && <Badge variant="default" className="text-xs">{sentCount} env.</Badge>}
                          {failedCount > 0 && <Badge variant="destructive" className="text-xs">{failedCount} falh.</Badge>}
                          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="border-t p-2 space-y-2 bg-background">
                          {g.emails.map((it) => {
                            const eOpen = expanded === it.id;
                            return (
                              <div key={it.id} className="border rounded-md">
                                <button
                                  className="w-full flex items-start justify-between gap-3 p-2 text-left hover:bg-muted/40 transition-colors"
                                  onClick={() => setExpanded(eOpen ? null : it.id)}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant={statusVariant(it.status)} className="text-xs">{statusLabel(it.status)}</Badge>
                                      <span className="text-sm font-medium truncate">{it.subject}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 truncate">
                                      Para: {(it.recipients || []).join(", ")} • {users[it.sent_by] || "—"} • {format(parseISO(it.sent_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                                    </p>
                                  </div>
                                  {eOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                </button>
                                {eOpen && (
                                  <div className="border-t p-3 space-y-2 text-sm">
                                    {it.error_message && (
                                      <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">Erro: {it.error_message}</div>
                                    )}
                                    {it.body && (
                                      <div
                                        className="text-sm border rounded p-3 bg-background prose prose-sm max-w-none dark:prose-invert"
                                        dangerouslySetInnerHTML={{ __html: it.body }}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {paged.map((it) => {
                  const isOpen = expanded === it.id;
                  return (
                    <div key={it.id} className="border rounded-lg bg-muted/20">
                      <button
                        className="w-full grid grid-cols-12 items-start gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
                        onClick={() => setExpanded(isOpen ? null : it.id)}
                      >
                        <div className="col-span-12 md:col-span-5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={statusVariant(it.status)} className="text-xs">{statusLabel(it.status)}</Badge>
                            <span className="text-sm font-medium truncate">{it.subject}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            Para: {(it.recipients || []).join(", ")}
                          </p>
                        </div>
                        <div className="col-span-6 md:col-span-3 text-xs">
                          <div className="text-muted-foreground">Vendedor</div>
                          <div className="font-medium truncate">{users[it.sent_by] || "—"}</div>
                        </div>
                        <div className="col-span-6 md:col-span-2 text-xs">
                          <div className="text-muted-foreground">Cliente</div>
                          <div className="font-medium truncate">{clients[it.client_id] || "—"}</div>
                        </div>
                        <div className="col-span-12 md:col-span-2 text-xs flex items-start justify-between">
                          <div>
                            <div className="text-muted-foreground">Data</div>
                            <div className="font-medium">{format(parseISO(it.sent_at), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
                          </div>
                          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t p-3 space-y-2 text-sm">
                          {it.error_message && (
                            <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                              Erro: {it.error_message}
                            </div>
                          )}
                          {it.body && (
                            <div
                              className="text-sm border rounded p-3 bg-background prose prose-sm max-w-none dark:prose-invert"
                              dangerouslySetInnerHTML={{ __html: it.body }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <div className="text-xs text-muted-foreground">
                {groupByClient
                  ? `Mostrando ${(page - 1) * GROUP_PAGE_SIZE + 1}-${Math.min(page * GROUP_PAGE_SIZE, grouped.length)} de ${grouped.length} clientes`
                  : `Mostrando ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, filtered.length)} de ${filtered.length}`}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs">Página {page} de {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
