import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Phone, Mail, ExternalLink, Calendar, ChevronLeft, ChevronRight, LayoutGrid, List, Send } from "lucide-react";
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

      // Normalizar: separa ganhas (won) de todas e calcula o resumo
      const clientesNormalizados = (data || []).map((client: any) => {
        const opps = (client.opportunities || []) as any[];
        const wonOpps = opps.filter((o) => o.status === "won");
        const totalValue = wonOpps.reduce((sum, o) => sum + (Number(o.value) || 0), 0);
        const firstWonDate = wonOpps
          .map((o) => o.created_at)
          .filter(Boolean)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

        return {
          ...client,
          wonOpportunitiesCount: wonOpps.length,
          totalValue,
          firstWonDate: firstWonDate || null,
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
                <span className="ml-2 hidden sm:inline">Cards</span>
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
          <div 
            key={viewMode}
            className="space-y-4 animate-fade-in"
          >
            {filteredClientes
              .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
              .map((cliente) => (
            <SwipeableCard key={cliente.id}>
            <Card
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/prospects/${cliente.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="h-6 w-6 text-green-600" />
                      <div>
                        <CardTitle className="text-xl">
                          {cliente.company_name || cliente.trade_name}
                        </CardTitle>
                        {cliente.trade_name && (
                          <p className="text-sm text-muted-foreground">
                            {cliente.company_name}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="default" className="bg-green-600">
                        Cliente Ativo
                      </Badge>
                      <Badge variant="outline">
                        {cliente.wonOpportunitiesCount} oportunidade
                        {cliente.wonOpportunitiesCount !== 1 ? "s" : ""} ganha
                        {cliente.wonOpportunitiesCount !== 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="secondary">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(cliente.totalValue)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {[cliente.city, cliente.state].filter(Boolean).join(" - ") ||
                          "Não informado"}
                      </span>
                    </div>

                    {cliente.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{formatPhone(cliente.phone)}</span>
                      </div>
                    )}

                    {cliente.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{cliente.email}</span>
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

                    {cliente.firstWonDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Cliente desde: </span>
                        <span className="font-medium">
                          {new Date(cliente.firstWonDate).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Responsável:</span>
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-lg border border-green-200 dark:border-green-800">
                      <span className="font-medium">
                        {cliente.profiles?.full_name || "Não atribuído"}
                      </span>
                      {cliente.profiles?.email && (
                        <span className="text-xs">({cliente.profiles.email})</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
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
          ))}
          </div>

          {/* Paginação */}
          {filteredClientes.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a{" "}
                {Math.min(currentPage * itemsPerPage, filteredClientes.length)} de{" "}
                {filteredClientes.length} clientes
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
                    setCurrentPage((prev) =>
                      Math.min(prev + 1, Math.ceil(filteredClientes.length / itemsPerPage))
                    )
                  }
                  disabled={currentPage === Math.ceil(filteredClientes.length / itemsPerPage)}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
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