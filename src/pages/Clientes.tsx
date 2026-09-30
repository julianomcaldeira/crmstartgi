import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Phone, Mail, ExternalLink, Calendar, Send, TrendingUp, Wallet, Target, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { SwipeableCard } from "@/components/SwipeableCard";
import { formatPhone } from "@/components/ui/masked-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ZohoEmailComposer from "@/components/ZohoEmailComposer";

const Clientes = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [filterSeller, setFilterSeller] = useState<string>("all");
  const [initialFilterApplied, setInitialFilterApplied] = useState(false);
  const [todosClientes, setTodosClientes] = useState<any[]>([]);
  // Mês selecionado na linha do tempo. null = mês vigente.
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  // Quick filters
  const [quickRatingFilter, setQuickRatingFilter] = useState<number | null>(null);
  const [quickRegionFilter, setQuickRegionFilter] = useState("all");
  const [emailComposer, setEmailComposer] = useState<{ open: boolean; to: string; name: string }>({ open: false, to: "", name: "" });

  useEffect(() => {
    checkUserRoleAndFetch();
  }, []);

  // Apply initial filter for vendedor role
  // Regra de ouro: vendedores agora enxergam clientes de todos por padrão.
  useEffect(() => {
    if (currentUserId && !initialFilterApplied) {
      setInitialFilterApplied(true);
    }
  }, [currentUserId, initialFilterApplied]);


  const checkUserRoleAndFetch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setUserRole(roleData?.role || null);
      
      await fetchClientes();
    } catch (error) {
      console.error("Error checking user role:", error);
    }
  };

  const fetchClientes = async () => {
    try {
      // Buscar TODAS as contas. Usamos LEFT JOIN (sem "!inner") para que
      // empresas sem oportunidade ganha também apareçam — antes o "!inner"
      // com status='won' ocultava contas sem negócio ganho.
      const { data, error } = await supabase
        .from("clients")
        .select(`
          *,
          opportunities(id, status, value, created_at),
          profiles:created_by(id, full_name, email)
        `)
        .order("company_name");

      if (error) throw error;

      // Data real de fechamento: quando a oportunidade mudou para "Ganho",
      // registrada em opportunity_activities.
      //
      // NÃO usar updated_at como fallback: existe o trigger
      // update_opportunities_updated_at (BEFORE UPDATE) que reescreve
      // updated_at = NOW() em qualquer update, e há Various migrations que
      // fazem UPDATE em opportunities. Isso fazia todos os fechamentos caírem
      // nos meses em que as migrations rodaram, colapsando a linha do tempo.
      // created_at é estável (nunca é reescrito) e serve de último recurso.
      const wonOpportunityIds = (data || [])
        .flatMap((c: any) => ((c.opportunities || []) as any[]))
        .filter((o) => o.status === "won")
        .map((o) => o.id);

      const wonAtByOpp = new Map<string, string>();
      if (wonOpportunityIds.length > 0) {
        const CHUNK = 200;
        for (let i = 0; i < wonOpportunityIds.length; i += CHUNK) {
          const chunk = wonOpportunityIds.slice(i, i + CHUNK);
          const { data: acts } = await supabase
            .from("opportunity_activities")
            .select("opportunity_id, created_at")
            .in("opportunity_id", chunk)
            .eq("new_value", "Ganho")
            .order("created_at", { ascending: true });

          (acts || []).forEach((a: any) => {
            if (!wonAtByOpp.has(a.opportunity_id)) {
              wonAtByOpp.set(a.opportunity_id, a.created_at);
            }
          });
        }
      }

      // Normalizar: separa ganhas (won) de todas e calcula o resumo
      const clientesNormalizados = (data || []).map((client: any) => {
        const opps = (client.opportunities || []) as any[];
        const wonOpps = opps.filter((o) => o.status === "won");

        const resolved = wonOpps.map((o) => ({
          ...o,
          wonAt: wonAtByOpp.get(o.id) || o.created_at,
        }));

        const totalValue = resolved.reduce((sum, o) => sum + (Number(o.value) || 0), 0);

        // Cliente aparece no mês do fechamento mais recente
        const lastWonAt = resolved
          .map((o) => o.wonAt)
          .filter(Boolean)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

        return {
          ...client,
          wonOpportunitiesCount: resolved.length,
          totalValue,
          lastWonAt: lastWonAt || null,
          wonOpportunities: resolved,
        };
      });

      setTodosClientes(clientesNormalizados);
    } catch (error) {
      console.error("Error fetching clientes:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Clientes = empresas que FECHARAM contrato (têm ao menos uma oportunidade
  // ganha). Empresas ainda em negociação não são clientes e não aparecem aqui.
  const clientesFechados = todosClientes.filter((c) => (c.wonOpportunitiesCount ?? 0) > 0);

  const filteredClientes = clientesFechados.filter((cliente) => {
    const matchesQuickRating = quickRatingFilter === null || cliente.rating === quickRatingFilter;
    const matchesQuickRegion = quickRegionFilter === "all" || cliente.region === quickRegionFilter;
    const matchesSeller = filterSeller === "all" || cliente.profiles?.id === filterSeller;
    return matchesQuickRating && matchesQuickRegion && matchesSeller;
  });

  const currency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value || 0);

  // Linha do tempo: um grupo por mês em que houve fechamento de contrato.
  // Como a lista já é só de clientes fechados, todo grupo tem lastWonAt.
  const monthGroups = useMemo(() => {
    const byMonth = new Map<string, any[]>();
    filteredClientes.forEach((cliente) => {
      if (!cliente.lastWonAt) return;
      const d = new Date(cliente.lastWonAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const list = byMonth.get(key) || [];
      list.push(cliente);
      byMonth.set(key, list);
    });

    if (byMonth.size === 0) return [];

    const buildGroup = (key: string, clientes: any[]) => {
      const [year, month] = key.split("-").map(Number);
      const label = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });
      return {
        key,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        shortMonth: new Date(year, month - 1, 1)
          .toLocaleDateString("pt-BR", { month: "short" })
          .replace(".", ""),
        monthIndex: month - 1,
        year,
        clients: (clientes || []).sort(
          (a, b) => new Date(b.lastWonAt).getTime() - new Date(a.lastWonAt).getTime(),
        ),
        totalValue: (clientes || []).reduce(
          (sum, c) => sum + (Number(c.totalValue) || 0),
          0,
        ),
      };
    };

    // Sequência cronológica crescente: janeiro -> dezembro, do ano mais antigo
    // para o mais recente. Todos os meses do intervalo aparecem, mesmo os que
    // não tiveram fechamento, para a linha do tempo não ter buracos.
    const keys = Array.from(byMonth.keys()).sort((a, b) => a.localeCompare(b));
    const [startYear, startMonth] = keys[0].split("-").map(Number);
    const [endYear, endMonth] = keys[keys.length - 1].split("-").map(Number);

    const timeline: string[] = [];
    let y = startYear;
    let m = startMonth;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      timeline.push(`${y}-${String(m).padStart(2, "0")}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }

    return timeline.map((key) => buildGroup(key, byMonth.get(key) || []));
  }, [filteredClientes]);

  const maxMonthValue = Math.max(...monthGroups.map((g) => g.totalValue), 0);
  const totalGeral = filteredClientes.reduce((s, c) => s + (Number(c.totalValue) || 0), 0);
  const ticketMedio = filteredClientes.length > 0 ? totalGeral / filteredClientes.length : 0;

  const currentMonthKey = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  })();

  // Mês vigente sempre em destaque. A linha do tempo é crescente (jan->dez),
  // então o fallback é o último mês COM fechamento, não o primeiro da lista.
  const lastMonthWithClients = [...monthGroups]
    .reverse()
    .find((g) => g.clients.length > 0);

  const activeKey =
    selectedMonthKey ||
    (monthGroups.some((g) => g.key === currentMonthKey)
      ? currentMonthKey
      : lastMonthWithClients?.key || null);

  const activeGroup = monthGroups.find((g) => g.key === activeKey) || null;

  // Cartão reutilizável de um cliente
  const renderClienteCard = (cliente: any) => (
    <SwipeableCard key={cliente.id}>
    <Card
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => navigate(`/prospects/${cliente.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg truncate">
                  {cliente.company_name || cliente.trade_name}
                </CardTitle>
                {cliente.trade_name && (
                  <p className="text-sm text-muted-foreground truncate">
                    {cliente.company_name}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary text-primary-foreground hover:bg-primary-dark">
                <TrendingUp className="h-3 w-3 mr-1" />
                {cliente.wonOpportunitiesCount} negócio
                {cliente.wonOpportunitiesCount !== 1 ? "s" : ""} ganho
                {cliente.wonOpportunitiesCount !== 1 ? "s" : ""}
              </Badge>
              {cliente.totalValue > 0 && (
                <Badge variant="secondary" className="font-semibold tabular-nums">
                  {currency(cliente.totalValue)}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">
                {[cliente.city, cliente.state].filter(Boolean).join(" - ") ||
                  "Não informado"}
              </span>
            </div>

            {cliente.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{formatPhone(cliente.phone)}</span>
              </div>
            )}

            {cliente.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{cliente.email}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {cliente.segment && (
              <div className="text-sm">
                <span className="text-muted-foreground">Segmento: </span>
                <span className="font-medium">{cliente.segment}</span>
              </div>
            )}

            {cliente.company_size && (
              <div className="text-sm">
                <span className="text-muted-foreground">Porte: </span>
                <span className="font-medium">{cliente.company_size}</span>
              </div>
            )}

            {cliente.lastWonAt && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Fechado em: </span>
                <span className="font-medium">
                  {new Date(cliente.lastWonAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-muted-foreground shrink-0">Responsável:</span>
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-lg border border-primary/20 min-w-0">
              <span className="font-medium truncate">
                {cliente.profiles?.full_name || "Não atribuído"}
              </span>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {cliente.email && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setEmailComposer({ open: true, to: cliente.email, name: cliente.company_name });
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                E-mail
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/prospects/${cliente.id}`);
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver Detalhes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    </SwipeableCard>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Clientes</h1>
          <p className="text-muted-foreground">
            Empresas que fecharam contrato com a StartGI —{" "}
            {filteredClientes.length} cliente{filteredClientes.length !== 1 ? "s" : ""}
            {monthGroups.length > 0 && (
              <>
                {" "}
                em {monthGroups.length} meses de linha do tempo
              </>
            )}
          </p>
          {filterSeller !== "all" && userRole === "vendedor" && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                Exibindo apenas suas oportunidades
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setFilterSeller("all")}
              >
                Ver todos
              </Button>
            </div>
          )}
        </div>
        
        {clientesFechados.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
                <Select value={quickRatingFilter?.toString() || "all"} onValueChange={(v) => setQuickRatingFilter(v === "all" ? null : parseInt(v))}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Todos Ratings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Ratings</SelectItem>
                    <SelectItem value="5">⭐⭐⭐⭐⭐</SelectItem>
                    <SelectItem value="4">⭐⭐⭐⭐</SelectItem>
                    <SelectItem value="3">⭐⭐⭐</SelectItem>
                    <SelectItem value="2">⭐⭐</SelectItem>
                    <SelectItem value="1">⭐</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={quickRegionFilter} onValueChange={setQuickRegionFilter}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Todas Regiões" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Regiões</SelectItem>
                    <SelectItem value="Norte">Norte</SelectItem>
                    <SelectItem value="Nordeste">Nordeste</SelectItem>
                    <SelectItem value="Centro-Oeste">Centro-Oeste</SelectItem>
                    <SelectItem value="Sudeste">Sudeste</SelectItem>
                    <SelectItem value="Sul">Sul</SelectItem>
                  </SelectContent>
                </Select>
              </div>
          </div>
        )}
      </div>

      {/* Resumo geral */}
      {todosClientes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/15">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Receita total
                  </p>
                  <p className="text-2xl font-bold text-foreground tabular-nums truncate">
                    {currency(totalGeral)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-muted">
                  <Layers className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Clientes
                  </p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {filteredClientes.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-muted">
                  <Target className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Ticket médio
                  </p>
                  <p className="text-2xl font-bold text-foreground tabular-nums truncate">
                    {currency(ticketMedio)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <p className="text-center text-muted-foreground">Carregando...</p>
      ) : todosClientes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="mx-auto mb-4 text-muted-foreground" size={48} />
            <p className="text-muted-foreground">
              Nenhuma empresa cadastrada no sistema ainda.
            </p>
          </CardContent>
        </Card>
      ) : clientesFechados.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="mx-auto mb-4 text-muted-foreground" size={48} />
            <p className="text-muted-foreground">
              Nenhuma empresa fechou contrato ainda. Aqui aparecem apenas as
              empresas com negócio ganho — as que estão em negociação ficam no
              módulo de Prospects.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* LINHA DO TEMPO: um item por mês, em ordem cronológica */}
          {monthGroups.length > 0 && (
            <div className="relative">
              <div className="absolute left-0 right-0 top-[30px] h-0.5 bg-border" />
              <div className="relative flex gap-2 overflow-x-auto pb-3">
                {monthGroups.map((group) => {
                  const isActive = group.key === activeKey;
                  const isCurrent = group.key === currentMonthKey;
                  const isEmpty = group.clients.length === 0;
                  const share =
                    maxMonthValue > 0 ? (group.totalValue / maxMonthValue) * 100 : 0;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => setSelectedMonthKey(group.key)}
                      className={`relative shrink-0 w-[104px] rounded-xl border p-2.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isActive
                          ? "border-primary bg-primary text-primary-foreground shadow-md -translate-y-0.5"
                          : isEmpty
                            ? "border-dashed border-border bg-muted/30 hover:border-primary/40"
                            : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-wide ${
                            isActive ? "opacity-90" : "text-muted-foreground"
                          }`}
                        >
                          {group.shortMonth}
                        </span>
                        {isCurrent && (
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                              isActive
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : "bg-primary/15 text-primary"
                            }`}
                          >
                            hoje
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-lg font-bold leading-tight ${
                          isActive ? "" : "text-foreground"
                        }`}
                      >
                        {group.year}
                      </p>
                      <p
                        className={`text-[11px] ${
                          isActive ? "opacity-90" : "text-muted-foreground"
                        }`}
                      >
                        {isEmpty
                          ? "sem fechamento"
                          : `${group.clients.length} cliente${
                              group.clients.length !== 1 ? "s" : ""
                            }`}
                      </p>
                      {!isEmpty && group.totalValue > 0 && (
                        <p
                          className={`text-[11px] font-semibold tabular-nums truncate ${
                            isActive ? "" : "text-primary"
                          }`}
                        >
                          {currency(group.totalValue)}
                        </p>
                      )}
                      <div
                        className={`mt-1.5 h-1 w-full rounded-full overflow-hidden ${
                          isActive ? "bg-primary-foreground/25" : "bg-muted"
                        }`}
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isActive ? "bg-primary-foreground" : "bg-primary"
                          }`}
                          style={{ width: isEmpty ? "0%" : `${Math.max(share, 6)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empresa(s) que fecharam no mês selecionado */}
          {activeGroup ? (
            <section key={activeGroup.key} className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-primary text-primary-foreground shadow-sm shrink-0">
                    <span className="text-[10px] uppercase leading-none opacity-90">
                      {activeGroup.shortMonth}
                    </span>
                    <span className="text-lg font-bold leading-tight">
                      {activeGroup.year}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground leading-tight">
                      {activeGroup.label}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {activeGroup.clients.length === 0
                        ? "Nenhuma empresa fechou contrato neste mês"
                        : `${activeGroup.clients.length} empresa${
                            activeGroup.clients.length !== 1 ? "s" : ""
                          } fechou${activeGroup.clients.length !== 1 ? "am" : ""} contrato com a StartGI${
                            activeGroup.clients.length > 1 && activeGroup.totalValue > 0
                              ? " · soma dos fechamentos do mês"
                              : ""
                          }`}
                    </p>
                  </div>
                </div>

                {activeGroup.totalValue > 0 && (
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Receita do mês
                    </p>
                    <p className="text-2xl font-bold text-primary tabular-nums">
                      {currency(activeGroup.totalValue)}
                    </p>
                  </div>
                )}
              </div>

              {activeGroup.clients.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {activeGroup.clients.map((cliente: any) => renderClienteCard(cliente))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="p-10 text-center">
                    <p className="text-muted-foreground">
                      Sem fechamentos em {activeGroup.label.toLowerCase()}.
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Building2 className="mx-auto mb-4 text-muted-foreground" size={48} />
                <p className="text-muted-foreground">
                  Nenhuma empresa com contrato fechado no período selecionado.
                </p>
              </CardContent>
            </Card>
          )}

        </>
      )}

      <ZohoEmailComposer
        open={emailComposer.open}
        onOpenChange={(o) => setEmailComposer((prev) => ({ ...prev, open: o }))}
        defaultTo={emailComposer.to}
        defaultSubject={emailComposer.name ? `Contato - ${emailComposer.name}` : ""}
      />
    </div>
  );
};

export default Clientes;