import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Target, 
  Building2, 
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  Calendar as CalendarIcon,
  MapPin
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const Relatorios = () => {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  
  // Sales Data
  const [totalClients, setTotalClients] = useState(0);
  const [totalOpportunities, setTotalOpportunities] = useState(0);
  const [wonOpportunities, setWonOpportunities] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  
  // Tasks Data
  const [totalTasks, setTotalTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [tasksByType, setTasksByType] = useState<any[]>([]);
  
  // Products Data
  const [topProducts, setTopProducts] = useState<any[]>([]);
  
  // Sellers Performance
  const [sellersPerformance, setSellersPerformance] = useState<any[]>([]);

  // Feiras Data
  const [feirasReport, setFeirasReport] = useState<any[]>([]);

  useEffect(() => {
    fetchAllReports();
  }, [startDate, endDate]);

  const fetchAllReports = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSalesMetrics(),
        fetchTasksMetrics(),
        fetchProductsRanking(),
        fetchSellersPerformance(),
        fetchFeirasReport(),
      ]);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesMetrics = async () => {
    try {
      // Total clients
      const { count: clientsCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      // Opportunities metrics
      const { data: oppsData } = await supabase
        .from("opportunities")
        .select("status, value")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      const totalOpps = oppsData?.length || 0;
      const wonOpps = oppsData?.filter(o => o.status === "won").length || 0;
      const totalVal = oppsData?.reduce((sum, o) => sum + (Number(o.value) || 0), 0) || 0;
      const convRate = totalOpps > 0 ? (wonOpps / totalOpps) * 100 : 0;

      setTotalClients(clientsCount || 0);
      setTotalOpportunities(totalOpps);
      setWonOpportunities(wonOpps);
      setTotalValue(totalVal);
      setConversionRate(convRate);
    } catch (error) {
      console.error("Error fetching sales metrics:", error);
    }
  };

  const fetchTasksMetrics = async () => {
    try {
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("status, due_date, task_type")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      const total = tasksData?.length || 0;
      const completed = tasksData?.filter(t => t.status === "completed").length || 0;
      const pending = tasksData?.filter(t => t.status === "pending").length || 0;
      
      const now = new Date();
      const overdue = tasksData?.filter(t => 
        t.status === "pending" && t.due_date && new Date(t.due_date) < now
      ).length || 0;

      // Group by task type
      const typeMap = new Map();
      tasksData?.forEach(task => {
        if (task.task_type) {
          const existing = typeMap.get(task.task_type) || 0;
          typeMap.set(task.task_type, existing + 1);
        }
      });

      const typesList = Array.from(typeMap.entries()).map(([type, count]) => ({
        type,
        count,
        label: getTaskTypeLabel(type)
      })).sort((a, b) => b.count - a.count);

      setTotalTasks(total);
      setCompletedTasks(completed);
      setPendingTasks(pending);
      setOverdueTasks(overdue);
      setTasksByType(typesList);
    } catch (error) {
      console.error("Error fetching tasks metrics:", error);
    }
  };

  const fetchProductsRanking = async () => {
    try {
      const { data: oppsData } = await supabase
        .from("opportunities")
        .select(`
          product_id,
          status,
          value,
          product:products(name, logo_url)
        `)
        .eq("status", "won")
        .not("product_id", "is", null)
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      const productMap = new Map();
      oppsData?.forEach((opp) => {
        if (!opp.product_id || !opp.product) return;
        
        const existing = productMap.get(opp.product_id) || {
          productId: opp.product_id,
          productName: opp.product.name,
          logoUrl: opp.product.logo_url,
          quantity: 0,
          totalValue: 0,
        };

        existing.quantity += 1;
        existing.totalValue += Number(opp.value) || 0;

        productMap.set(opp.product_id, existing);
      });

      const ranking = Array.from(productMap.values())
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 5);
      
      setTopProducts(ranking);
    } catch (error) {
      console.error("Error fetching products ranking:", error);
    }
  };

  const fetchSellersPerformance = async () => {
    try {
      const { data: usersData } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles!inner(role)
        `)
        .in("user_roles.role", ["vendedor", "gestor"]);

      const performancePromises = usersData?.map(async (user) => {
        const [clientsRes, oppsRes, wonOppsRes, tasksRes] = await Promise.all([
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .eq("created_by", user.id)
            .gte("created_at", startDate)
            .lte("created_at", endDate),
          
          supabase
            .from("opportunities")
            .select("id, value", { count: "exact" })
            .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
            .gte("created_at", startDate)
            .lte("created_at", endDate),
          
          supabase
            .from("opportunities")
            .select("id, value", { count: "exact" })
            .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
            .eq("status", "won")
            .gte("created_at", startDate)
            .lte("created_at", endDate),

          supabase
            .from("tasks")
            .select("status", { count: "exact" })
            .eq("assigned_to", user.id)
            .gte("created_at", startDate)
            .lte("created_at", endDate),
        ]);

        const wonValue = wonOppsRes.data?.reduce((sum, opp) => sum + (Number(opp.value) || 0), 0) || 0;
        const convRate = oppsRes.count ? ((wonOppsRes.count || 0) / oppsRes.count) * 100 : 0;
        const completedTasks = tasksRes.data?.filter(t => t.status === "completed").length || 0;

        return {
          ...user,
          clientsCount: clientsRes.count || 0,
          opportunitiesCount: oppsRes.count || 0,
          wonOpportunitiesCount: wonOppsRes.count || 0,
          wonValue,
          conversionRate: convRate.toFixed(1),
          totalTasks: tasksRes.count || 0,
          completedTasksCount: completedTasks,
        };
      }) || [];

      const performance = await Promise.all(performancePromises);
      setSellersPerformance(performance.sort((a, b) => b.wonValue - a.wonValue));
    } catch (error) {
      console.error("Error fetching sellers performance:", error);
    }
  };

  const fetchFeirasReport = async () => {
    try {
      const { data: feirasData } = await supabase
        .from("feiras")
        .select("*")
        .order("start_date", { ascending: false });

      const feirasWithClients = await Promise.all(
        (feirasData || []).map(async (feira) => {
          const { data: clientFeirasData } = await (supabase as any)
            .from("client_feiras")
            .select(`
              *,
              client:clients(
                id,
                company_name,
                trade_name,
                created_at,
                created_by_profile:profiles!clients_created_by_fkey(full_name)
              )
            `)
            .eq("feira_id", feira.id)
            .gte("created_at", startDate)
            .lte("created_at", endDate);

          return {
            ...feira,
            clients: clientFeirasData || [],
            clientsCount: clientFeirasData?.length || 0,
          };
        })
      );

      setFeirasReport(feirasWithClients.filter(f => f.clientsCount > 0));
    } catch (error) {
      console.error("Error fetching feiras report:", error);
    }
  };

  const getTaskTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ligacao: "Ligação",
      email: "E-mail",
      whatsapp: "WhatsApp",
      linkedin: "LinkedIn",
      visita_presencial: "Visita Presencial",
      reuniao_online: "Reunião Online",
      visita_feira: "Visita a Feira",
      visita_evento: "Visita a Evento",
    };
    return labels[type] || type;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-2">
          Relatórios
        </h1>
        <p className="text-muted-foreground">
          Analise o desempenho da sua equipe comercial
        </p>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Período de Análise</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Inicial</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Final</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sales">Vendas</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="feiras">Feiras</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalClients}</div>
                <p className="text-xs text-muted-foreground">No período selecionado</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Oportunidades</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOpportunities}</div>
                <p className="text-xs text-muted-foreground">{wonOpportunities} ganhas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{formatCurrency(totalValue)}</div>
                <p className="text-xs text-muted-foreground">Em vendas ganhas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{conversionRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Oportunidades convertidas</p>
              </CardContent>
            </Card>
          </div>

          {topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Top 5 Produtos Mais Vendidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topProducts.map((product, index) => (
                    <div 
                      key={product.productId}
                      className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                          index === 0 ? "bg-yellow-500/20 text-yellow-700" :
                          index === 1 ? "bg-gray-400/20 text-gray-700" :
                          index === 2 ? "bg-amber-700/20 text-amber-800" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {index + 1}
                        </div>
                        {product.logoUrl && (
                          <img 
                            src={product.logoUrl} 
                            alt={product.productName}
                            className="h-8 w-8 object-contain bg-white rounded p-1"
                          />
                        )}
                        <div>
                          <p className="font-semibold">{product.productName}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.quantity} venda{product.quantity !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          {formatCurrency(product.totalValue)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total de Tarefas</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalTasks}</div>
                <p className="text-xs text-muted-foreground">No período selecionado</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{completedTasks}</div>
                <p className="text-xs text-muted-foreground">
                  {totalTasks > 0 ? `${((completedTasks / totalTasks) * 100).toFixed(1)}% do total` : "0%"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                <Clock className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{pendingTasks}</div>
                <p className="text-xs text-muted-foreground">Aguardando conclusão</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
                <Clock className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{overdueTasks}</div>
                <p className="text-xs text-muted-foreground">Passaram do prazo</p>
              </CardContent>
            </Card>
          </div>

          {tasksByType.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tarefas por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tasksByType.map((item) => (
                    <div key={item.type} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{item.label}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{item.count}</p>
                        <p className="text-xs text-muted-foreground">
                          {((item.count / totalTasks) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <div className="space-y-4">
            {sellersPerformance.map((seller) => (
              <Card key={seller.id} className="hover:shadow-lg transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">{seller.full_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{seller.email}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <Building2 className="h-4 w-4 mx-auto mb-1 text-primary" />
                      <p className="text-xl font-bold">{seller.clientsCount}</p>
                      <p className="text-xs text-muted-foreground">Clientes</p>
                    </div>

                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <Target className="h-4 w-4 mx-auto mb-1 text-info" />
                      <p className="text-xl font-bold">{seller.opportunitiesCount}</p>
                      <p className="text-xs text-muted-foreground">Oportunidades</p>
                    </div>

                    <div className="text-center p-3 bg-success/10 rounded-lg border border-success/20">
                      <TrendingUp className="h-4 w-4 mx-auto mb-1 text-success" />
                      <p className="text-xl font-bold text-success">{seller.wonOpportunitiesCount}</p>
                      <p className="text-xs text-muted-foreground">Ganhas</p>
                    </div>

                    <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <DollarSign className="h-4 w-4 mx-auto mb-1 text-primary" />
                      <p className="text-sm font-bold text-primary">{formatCurrency(seller.wonValue)}</p>
                      <p className="text-xs text-muted-foreground">Vendido</p>
                    </div>

                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-success" />
                      <p className="text-xl font-bold">{seller.completedTasksCount}/{seller.totalTasks}</p>
                      <p className="text-xs text-muted-foreground">Tarefas</p>
                    </div>

                    <div className="text-center p-3 bg-warning/10 rounded-lg border border-warning/20">
                      <div className="text-xl font-bold text-warning mb-1">{seller.conversionRate}%</div>
                      <p className="text-xs text-muted-foreground">Conversão</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {sellersPerformance.length === 0 && (
              <Card className="p-12 text-center">
                <Users className="mx-auto mb-4 text-muted-foreground" size={48} />
                <p className="text-muted-foreground">Nenhum dado de vendedor encontrado</p>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="feiras" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Leads Captados por Feira
              </CardTitle>
            </CardHeader>
            <CardContent>
              {feirasReport.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="mx-auto mb-4 text-muted-foreground" size={48} />
                  <p className="text-muted-foreground">Nenhum lead captado em feiras no período</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {feirasReport.map((feira) => (
                    <Card key={feira.id} className="border-l-4 border-l-primary">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{feira.name}</CardTitle>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              {feira.city && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  {feira.city}{feira.state && ` - ${feira.state}`}
                                </span>
                              )}
                              {feira.start_date && (
                                <span className="flex items-center gap-1">
                                  <CalendarIcon className="h-4 w-4" />
                                  {new Date(feira.start_date).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">{feira.clientsCount}</div>
                            <p className="text-xs text-muted-foreground">Leads captados</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {feira.clients.map((clientFeira: any) => (
                            <div 
                              key={clientFeira.id}
                              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                            >
                              <div>
                                <p className="font-medium text-foreground">
                                  {clientFeira.client?.company_name || clientFeira.client?.trade_name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Cadastrado em {new Date(clientFeira.created_at).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Por: {clientFeira.client?.created_by_profile?.full_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;