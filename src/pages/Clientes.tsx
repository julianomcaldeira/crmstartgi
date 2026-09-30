import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Phone, Mail, ExternalLink, Calendar, ChevronLeft, ChevronRight, LayoutGrid, List, Send, TrendingUp, Wallet, Target, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { SwipeableCard } from "@/components/SwipeableCard";
import { useViewMode } from "@/hooks/useViewMode";
import { formatPhone } from "@/components/ui/masked-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ZohoEmailComposer from "@/components/ZohoEmailComposer";

const Clientes = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [viewMode, setViewMode] = useViewMode("clientes-view-mode", "cards");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [filterSeller, setFilterSeller] = useState<string>("all");
  const [initialFilterApplied, setInitialFilterApplied] = useState(false);
  const [todosClientes, setTodosClientes] = useState<any[]>([]);
  const [somenteGanhos, setSomenteGanhos] = useState(false);
  
  // Quick filters for compact view
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

  // Volta para a primeira página quando os filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [somenteGanhos, quickRatingFilter, quickRegionFilter, filterSeller]);

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
          opportunities(id, status, value, created_at, updated_at),
          profiles:created_by(id, full_name, email)
        `)
        .order("company_name");

      if (error) throw error;

      // Data real de fechamento: quando a oportunidade mudou para "Ganho".
      // created_at é a data de CRIAÇÃO da oportunidade, não do fechamento —
      // usá-la colocava o cliente no mês errado.
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
          wonAt: wonAtByOpp.get(o.id) || o.updated_at || o.created_at,
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
  
  const filteredClientes = todosClientes.filter((cliente) => {
    const matchesQuickRating = quickRatingFilter === null || cliente.rating === quickRatingFilter;
    const matchesQuickRegion = quickRegionFilter === "all" || cliente.region === quickRegionFilter;
    const matchesSeller = filterSeller === "all" || cliente.profiles?.id === filterSeller;
    const matchesWon = !somenteGanhos || (cliente.wonOpportunitiesCount ?? 0) > 0;
    return matchesQuickRating && matchesQuickRegion && matchesSeller && matchesWon;
  });

  const currency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value || 0);

  // Agrupamento por mês de fechamento. Clientes sem negócio ganho (sem
  // lastWonAt) vão para um grupo separado no fim.
  const monthGroups = useMemo(() => {
    const withDate = filteredClientes.filter((c) => c.lastWonAt);
    const withoutDate = filteredClientes.filter((c) => !c.lastWonAt);

    const byMonth = new Map<string, any[]>();
    withDate.forEach((cliente) => {
      const d = new Date(cliente.lastWonAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const list = byMonth.get(key) || [];
      list.push(cliente);
      byMonth.set(key, list);
    });

    const groups = Array.from(byMonth.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, clientes]) => {
        const [year, month] = key.split("-").map(Number);
        const label = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        });
        return {
          key,
          label: label.charAt(0).toUpperCase() + label.slice(1),
          monthIndex: month - 1,
          year,
          clients: clientes.sort(
            (a, b) => new Date(b.lastWonAt).getTime() - new Date(a.lastWonAt).getTime(),
          ),
          totalValue: clientes.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0),
        };
      });

    if (withoutDate.length > 0) {
      groups.push({
        key: "sem-fechamento",
        label: "Sem negócio ganho",
        monthIndex: -1,
        year: 0,
        clients: withoutDate,
        totalValue: 0,
      });
    }

    return groups;
  }, [filteredClientes]);

  const maxMonthValue = Math.max(...monthGroups.map((g) => g.totalValue), 0);
  const totalGeral = filteredClientes.reduce((s, c) => s + (Number(c.totalValue) || 0), 0);
  const ticketMedio =
    filteredClientes.filter((c) => (c.wonOpportunitiesCount ?? 0) > 0).length > 0
      ? totalGeral /
        filteredClientes.filter((c) => (c.wonOpportunitiesCount ?? 0) > 0).length
      : 0;

  const paginatedGroups = monthGroups.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Sem agrupamento: lista plana (comportamento original)
  const flatPage = filteredClientes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

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
              {(cliente.wonOpportunitiesCount ?? 0) > 0 ? (
                <Badge className="bg-primary text-primary-foreground hover:bg-primary-dark">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {cliente.wonOpportunitiesCount} negócio
                  {cliente.wonOpportunitiesCount !== 1 ? "s" : ""} ganho
                  {cliente.wonOpportunitiesCount !== 1 ? "s" : ""}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Em negociação
                </Badge>
              )}
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
            {somenteGanhos
              ? "Empresas com oportunidades ganhas"
              : "Todas as empresas cadastradas"}{" "}
            — {filteredClientes.length} cliente{filteredClientes.length !== 1 ? "s" : ""}
            {monthGroups.length > 0 && (
              <> em {monthGroups.length} mês{monthGroups.length !== 1 ? "es" : ""} de fechamento</>
            )}
          </p>
          <div className="mt-2">
            <Button
              variant={somenteGanhos ? "default" : "outline"}
              size="sm"
              onClick={() => setSomenteGanhos((v) => !v)}
            >
              {somenteGanhos ? "Ver todas" : "Somente com negócio ganho"}
            </Button>
          </div>
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
        
        {todosClientes.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {viewMode === 'compact' && (
              <div className="flex items-center gap-2 animate-fade-in">
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
            )}

            <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
              <Button
                size="sm"
                variant={viewMode === "cards" ? "secondary" : "ghost"}
                onClick={() => setViewMode("cards")}
                className="h-8 px-3"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">Por mês</span>
              </Button>
              <Button
                size="sm"
                variant={viewMode === "compact" ? "secondary" : "ghost"}
                onClick={() => setViewMode("compact")}
                className="h-8 px-3"
              >
                <List className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">Lista</span>
              </Button>
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
              Nenhum cliente cadastrado ainda. Clientes aparecem aqui quando são
              cadastrados no sistema.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === "cards" ? (
            /* agrupado por mês */
            <div key="mes" className="space-y-8 animate-fade-in">
              {paginatedGroups.map((group) => {
                const share = maxMonthValue > 0 ? (group.totalValue / maxMonthValue) * 100 : 0;
                return (
                  <section key={group.key} className="space-y-4">
                    <div className="sticky top-0 z-10 -mx-1 px-1 py-3 bg-background/85 backdrop-blur-sm">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-primary text-primary-foreground shadow-sm shrink-0">
                            <span className="text-[10px] uppercase leading-none opacity-90">
                              {group.monthIndex >= 0
                                ? new Date(group.year, group.monthIndex, 1)
                                    .toLocaleDateString("pt-BR", { month: "short" })
                                    .replace(".", "")
                                    .toUpperCase()
                                : "—"}
                            </span>
                            <span className="text-lg font-bold leading-tight">
                              {group.monthIndex >= 0 ? group.year : "•"}
                            </span>
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-foreground leading-tight">
                              {group.label}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                              {group.clients.length} cliente
                              {group.clients.length !== 1 ? "s" : ""}
                              {group.clients.length > 1 && group.totalValue > 0
                                ? " · soma dos fechamentos do mês"
                                : ""}
                            </p>
                          </div>
                        </div>

                        {group.totalValue > 0 && (
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Receita do mês
                            </p>
                            <p className="text-2xl font-bold text-primary tabular-nums">
                              {currency(group.totalValue)}
                            </p>
                          </div>
                        )}
                      </div>

                      {maxMonthValue > 0 && group.totalValue > 0 && (
                        <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-primary-light transition-all duration-500"
                            style={{ width: `${Math.max(share, 4)}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {group.clients.map((cliente: any) => renderClienteCard(cliente))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            /* lista plana */
            <div key="lista" className="space-y-3 animate-fade-in">
              {flatPage.map((cliente) => renderClienteCard(cliente))}
            </div>
          )}

          {/* Paginação */}
          {(() => {
            const totalPages = Math.ceil(
              (viewMode === "cards" ? monthGroups.length : filteredClientes.length) /
                itemsPerPage,
            );
            if (totalPages <= 1) return null;
            const first = (currentPage - 1) * itemsPerPage + 1;
            const last = Math.min(currentPage * itemsPerPage,
              viewMode === "cards" ? monthGroups.length : filteredClientes.length);
            const unit = viewMode === "cards" ? "mês" : "cliente";
            return (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Mostrando {first} a {last} de{" "}
                {viewMode === "cards" ? monthGroups.length : filteredClientes.length}{" "}
                {unit}
                {totalPages > 1 && `s`}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
            );
          })()}
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