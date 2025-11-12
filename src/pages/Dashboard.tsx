import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Target, CheckSquare, DollarSign, TrendingUp, Clock, Calendar } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState(format(new Date(), "yyyy-MM"));
  
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [goalData, setGoalData] = useState<any>(null);
  const [forecastAccounts, setForecastAccounts] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);

  useEffect(() => {
    initializeDashboard();
  }, []);

  useEffect(() => {
    if (userId && userRole) {
      fetchDashboardData();
    }
  }, [selectedPeriod, userId, userRole]);

  const initializeDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setUserRole(roleData?.role || "vendedor");
    } catch (error) {
      console.error("Error initializing dashboard:", error);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTodayTasks(),
        fetchGoalProgress(),
        fetchForecastAccounts(),
        fetchFunnelData(),
      ]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayTasks = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    
    let query = supabase
      .from("tasks")
      .select(`
        *,
        clients(company_name),
        contacts(name)
      `)
      .eq("status", "pending")
      .gte("due_date", `${today}T00:00:00`)
      .lte("due_date", `${today}T23:59:59`)
      .order("due_date");

    if (userRole === "vendedor") {
      query = query.eq("assigned_to", userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    setTodayTasks(data || []);
  };

  const fetchGoalProgress = async () => {
    const [year, month] = selectedPeriod.split("-");
    const startDate = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
    const endDate = endOfMonth(startDate);

    let goalsQuery = supabase
      .from("goals")
      .select("*, profiles(full_name)")
      .gte("start_date", format(startDate, "yyyy-MM-dd"))
      .lte("end_date", format(endDate, "yyyy-MM-dd"));

    if (userRole === "vendedor") {
      goalsQuery = goalsQuery.eq("assigned_to", userId);
    }

    const { data: goals } = await goalsQuery;

    // Buscar oportunidades ganhas no período para calcular progresso
    let oppsQuery = supabase
      .from("opportunities")
      .select("value, assigned_to, created_at")
      .eq("status", "won")
      .gte("created_at", format(startDate, "yyyy-MM-dd"))
      .lte("created_at", format(endDate, "yyyy-MM-dd"));

    if (userRole === "vendedor") {
      oppsQuery = oppsQuery.eq("assigned_to", userId);
    }

    const { data: wonOpps } = await oppsQuery;

    const totalGoal = goals?.reduce((sum, g) => sum + Number(g.target_value), 0) || 0;
    const totalAchieved = wonOpps?.reduce((sum, o) => sum + (Number(o.value) || 0), 0) || 0;

    setGoalData({
      target: totalGoal,
      achieved: totalAchieved,
      percentage: totalGoal > 0 ? (totalAchieved / totalGoal) * 100 : 0,
      goals: goals || [],
    });
  };

  const fetchForecastAccounts = async () => {
    const [year, month] = selectedPeriod.split("-");
    const startDate = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
    const endDate = endOfMonth(startDate);

    let query = supabase
      .from("opportunities")
      .select(`
        *,
        clients(company_name, trade_name),
        profiles(full_name)
      `)
      .in("status", ["qualified", "proposal", "negotiation"])
      .gte("expected_close_date", format(startDate, "yyyy-MM-dd"))
      .lte("expected_close_date", format(endDate, "yyyy-MM-dd"))
      .order("probability", { ascending: false });

    if (userRole === "vendedor") {
      query = query.eq("assigned_to", userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    setForecastAccounts(data || []);
  };

  const fetchFunnelData = async () => {
    let query = supabase
      .from("opportunities")
      .select("status");

    if (userRole === "vendedor") {
      query = query.eq("assigned_to", userId);
    }

    const { data } = await query;

    const statusLabels: Record<string, string> = {
      lead: "Lead",
      qualified: "Qualificado",
      proposal: "Proposta",
      negotiation: "Negociação",
      won: "Ganho",
      lost: "Perdido",
    };

    const statusCounts = data?.reduce((acc: any, opp) => {
      const label = statusLabels[opp.status] || opp.status;
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

    const chartData = Object.entries(statusCounts || {}).map(([name, value]) => ({
      name,
      value,
    }));

    setFunnelData(chartData);
  };

  const getTaskTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ligacao: "Ligação",
      email: "E-mail",
      whatsapp: "WhatsApp",
      visita_presencial: "Visita Presencial",
      reuniao_online: "Reunião Online",
      visita_feira: "Visita a Feira",
      visita_evento: "Visita a Evento",
    };
    return labels[type] || type;
  };

  const getPeriodOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const value = format(date, "yyyy-MM");
      const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    
    return options;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Dashboard {userRole === "gestor" || userRole === "admin" ? "- Equipe" : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {userRole === "gestor" || userRole === "admin" ? "Visão geral" : "Seu desempenho"}
          </p>
        </div>
        
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[200px]">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getPeriodOptions().map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid Principal Compacto */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Resumo Rápido Cards */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Tarefas Hoje</p>
                <p className="text-2xl font-bold text-blue-600">{todayTasks.length}</p>
              </div>
              <CheckSquare className="h-8 w-8 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">No Forecast</p>
                <p className="text-2xl font-bold text-purple-600">{forecastAccounts.length}</p>
              </div>
              <Target className="h-8 w-8 text-purple-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Meta Atingida</p>
                <p className="text-2xl font-bold text-green-600">
                  {goalData ? `${goalData.percentage.toFixed(0)}%` : "0%"}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Meta Total</p>
                <p className="text-lg font-bold text-primary">
                  {goalData ? new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    notation: "compact",
                  }).format(goalData.target) : "R$ 0"}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tarefas Pendentes - Compacto */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Tarefas Hoje
              <Badge variant="secondary" className="text-xs">{todayTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
            ) : todayTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhuma tarefa para hoje
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {todayTasks.slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-2 border rounded hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">
                        {getTaskTypeLabel(task.task_type)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {task.clients?.company_name}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground ml-2">
                      {task.due_date && format(new Date(task.due_date), "HH:mm")}
                    </div>
                  </div>
                ))}
                {todayTasks.length > 4 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{todayTasks.length - 4} mais
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progresso das Metas - Compacto */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Progresso das Metas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
            ) : !goalData || goalData.target === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Sem metas definidas
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Meta</p>
                    <p className="text-lg font-bold text-primary">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        notation: "compact",
                      }).format(goalData.target)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Realizado</p>
                    <p className="text-lg font-bold text-green-600">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        notation: "compact",
                      }).format(goalData.achieved)}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium">{goalData.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        goalData.percentage >= 100
                          ? "bg-green-600"
                          : goalData.percentage >= 75
                          ? "bg-primary"
                          : goalData.percentage >= 50
                          ? "bg-yellow-500"
                          : "bg-orange-500"
                      }`}
                      style={{ width: `${Math.min(goalData.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Funil - Compacto */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-chart-1" />
              Funil de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
            ) : funnelData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Sem dados
              </p>
            ) : (
              <ChartContainer
                config={{
                  value: {
                    label: "Oportunidades",
                    color: "hsl(var(--chart-1))",
                  },
                }}
                className="h-40"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Forecast do Mês - Compacto */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-500" />
            Forecast do Mês
            <Badge variant="secondary" className="text-xs">{forecastAccounts.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
          ) : forecastAccounts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Sem oportunidades no forecast
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {forecastAccounts.slice(0, 5).map((opp) => (
                <div
                  key={opp.id}
                  className="flex items-center justify-between p-2 border rounded hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs truncate">
                      {opp.clients?.trade_name || opp.clients?.company_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        {opp.status === "qualified" && "Qual."}
                        {opp.status === "proposal" && "Prop."}
                        {opp.status === "negotiation" && "Negoc."}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {opp.probability}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-bold text-sm">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        notation: "compact",
                      }).format(Number(opp.value) || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {opp.expected_close_date && 
                        format(new Date(opp.expected_close_date), "dd/MM")
                      }
                    </p>
                  </div>
                </div>
              ))}
              {forecastAccounts.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{forecastAccounts.length - 5} mais
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;