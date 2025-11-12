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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Dashboard {userRole === "gestor" || userRole === "admin" ? "- Visão Geral da Equipe" : ""}
          </h1>
          <p className="text-muted-foreground">
            {userRole === "gestor" || userRole === "admin" 
              ? "Acompanhe o desempenho de toda a equipe"
              : "Acompanhe seu desempenho e atividades"
            }
          </p>
        </div>
        
        <div className="w-full sm:w-auto">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-full sm:w-[240px]">
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
      </div>

      {/* Tarefas Pendentes Hoje */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600" />
            Tarefas Pendentes Hoje
            <Badge variant="secondary">{todayTasks.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center">Carregando...</p>
          ) : todayTasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma tarefa pendente para hoje
            </p>
          ) : (
            <div className="space-y-3">
              {todayTasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {getTaskTypeLabel(task.task_type)}
                      {task.contacts && ` - ${task.contacts.name}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {task.clients?.company_name}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {task.due_date && format(new Date(task.due_date), "HH:mm")}
                  </div>
                </div>
              ))}
              {todayTasks.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  + {todayTasks.length - 5} tarefas adicionais
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metas do Período */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Progresso das Metas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center">Carregando...</p>
            ) : !goalData || goalData.target === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma meta definida para este período
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Meta Total</p>
                    <p className="text-3xl font-bold text-primary">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(goalData.target)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Realizado</p>
                    <p className="text-3xl font-bold text-green-600">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(goalData.achieved)}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium">{goalData.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-4 bg-secondary rounded-full overflow-hidden">
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

                {goalData.goals.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-3">Metas Individuais</p>
                    <div className="space-y-2">
                      {goalData.goals.map((goal: any) => (
                        <div key={goal.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{goal.goal_type}</Badge>
                            {goal.profiles && (
                              <span className="text-muted-foreground">{goal.profiles.full_name}</span>
                            )}
                          </div>
                          <span className="font-medium">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(goal.target_value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Resumo Rápido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Tarefas Hoje</span>
                </div>
                <span className="text-lg font-bold text-blue-600">{todayTasks.length}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">No Forecast</span>
                </div>
                <span className="text-lg font-bold text-purple-600">{forecastAccounts.length}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Meta Atingida</span>
                </div>
                <span className="text-lg font-bold text-green-600">
                  {goalData ? `${goalData.percentage.toFixed(0)}%` : "0%"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Forecast do Mês */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            Forecast do Mês
            <Badge variant="secondary">{forecastAccounts.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center">Carregando...</p>
          ) : forecastAccounts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma oportunidade no forecast para este período
            </p>
          ) : (
            <div className="space-y-3">
              {forecastAccounts.map((opp) => (
                <div
                  key={opp.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">
                      {opp.clients?.trade_name || opp.clients?.company_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {opp.status === "qualified" && "Qualificado"}
                        {opp.status === "proposal" && "Proposta"}
                        {opp.status === "negotiation" && "Negociação"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Probabilidade: {opp.probability}%
                      </span>
                      {(userRole === "gestor" || userRole === "admin") && opp.profiles && (
                        <span className="text-xs text-muted-foreground">
                          • {opp.profiles.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(Number(opp.value) || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {opp.expected_close_date && 
                        format(new Date(opp.expected_close_date), "dd/MM/yyyy")
                      }
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Funil de Oportunidades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Funil de Oportunidades
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center">Carregando...</p>
          ) : funnelData.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma oportunidade encontrada
            </p>
          ) : (
            <ChartContainer
              config={{
                value: {
                  label: "Oportunidades",
                  color: "hsl(var(--primary))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;