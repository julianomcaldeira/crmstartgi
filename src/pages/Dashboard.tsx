import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Target, CheckSquare, DollarSign, TrendingUp, Clock, Calendar, TrendingDown, Activity } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, Tooltip, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, addDays, subMonths, differenceInDays, startOfQuarter, endOfQuarter, addMonths, addQuarters, startOfYear, endOfYear, addYears } from "date-fns";
import { ptBR } from "date-fns/locale";

import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { formatDateBR } from "@/lib/dateUtils";
import ForecastSection from "@/components/ForecastSection";

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState(format(new Date(), "yyyy-MM"));
  
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [goalData, setGoalData] = useState<any>(null);
  const [forecastAccounts, setForecastAccounts] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [avgCloseCycle, setAvgCloseCycle] = useState<number>(0);
  const [upcomingFeiras, setUpcomingFeiras] = useState<any[]>([]);

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
      if (import.meta.env.DEV) console.error("Error initializing dashboard:", error);
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
        fetchAvgCloseCycle(),
        fetchUpcomingFeiras(),
      ]);
    } catch (error) {
      if (import.meta.env.DEV) console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayTasks = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    
    // Buscar tarefas pendentes de hoje E tarefas atrasadas (data passada)
    let query = supabase
      .from("tasks")
      .select(`
        *,
        clients(company_name),
        contacts(name)
      `)
      .eq("status", "pending")
      .lte("due_date", `${today}T23:59:59`)
      .order("due_date", { ascending: true });

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
    const startStr = format(startDate, "yyyy-MM-dd");
    const endStr = format(endDate, "yyyy-MM-dd");

    // Only revenue goals overlapping the selected month
    let goalsQuery = supabase
      .from("goals")
      .select("*, assigned_user:profiles!goals_assigned_to_fkey(full_name)")
      .eq("goal_type", "revenue")
      .lte("start_date", endStr)
      .gte("end_date", startStr);

    if (userRole === "vendedor") {
      goalsQuery = goalsQuery.eq("assigned_to", userId);
    }

    const { data: goals, error: goalsError } = await goalsQuery;
    if (goalsError && import.meta.env.DEV) console.error("Error fetching goals:", goalsError);

    // Pro-rate each goal across the months it covers, then take the slice for the selected month
    const totalGoal = (goals || []).reduce((sum: number, g: any) => {
      const gStart = new Date(g.start_date + "T12:00:00");
      const gEnd = new Date(g.end_date + "T12:00:00");
      const monthsCovered =
        (gEnd.getFullYear() - gStart.getFullYear()) * 12 +
        (gEnd.getMonth() - gStart.getMonth()) +
        1;
      const safeMonths = Math.max(monthsCovered, 1);
      return sum + Number(g.target_value || 0) / safeMonths;
    }, 0);

    // Won opportunities — find them via the actual "Ganho" event date in the month
    const { data: wonActivities } = await supabase
      .from("opportunity_activities")
      .select("opportunity_id, created_at, new_value")
      .eq("new_value", "Ganho")
      .gte("created_at", `${startStr}T00:00:00`)
      .lte("created_at", `${endStr}T23:59:59`);

    const oppIds = Array.from(
      new Set((wonActivities || []).map((a: any) => a.opportunity_id))
    );

    let totalAchieved = 0;
    if (oppIds.length > 0) {
      let oppsQuery = supabase
        .from("opportunities")
        .select("id, status, billing_type, value, monthly_value, implementation_value, assigned_to")
        .in("id", oppIds)
        .eq("status", "won");

      if (userRole === "vendedor") {
        oppsQuery = oppsQuery.eq("assigned_to", userId);
      }

      const { data: wonOpps } = await oppsQuery;
      totalAchieved = (wonOpps || []).reduce((sum: number, o: any) => {
        const isPontual = o.billing_type === "pontual";
        const impl = Number(o.implementation_value) || 0;
        const monthly = Number(o.monthly_value) || 0;
        const value = Number(o.value) || 0;
        return sum + (isPontual ? value || impl : impl + monthly * 12);
      }, 0);
    }

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
        products(name),
        assigned_user:profiles!opportunities_assigned_to_fkey(full_name)
      `)
      .in("status", ["qualified", "proposal", "negotiation"])
      .gte("expected_close_date", format(startDate, "yyyy-MM-dd"))
      .lte("expected_close_date", format(endDate, "yyyy-MM-dd"))
      .order("probability", { ascending: false });

    // Only admin and pre_vendas see all forecasts; everyone else sees only their own
    if (userRole !== "admin" && userRole !== "pre_vendas") {
      query = query.eq("assigned_to", userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    setForecastAccounts(data || []);
  };

  const fetchFunnelData = async () => {
    // Show only OPEN pipeline (exclude won/lost — closed deals aren't in the funnel)
    let query = supabase
      .from("opportunities")
      .select("status")
      .not("status", "in", "(won,lost)");

    if (userRole === "vendedor") {
      query = query.eq("assigned_to", userId);
    }

    const { data } = await query;

    const statusLabels: Record<string, string> = {
      lead: "Lead",
      contacted: "Contatado",
      qualified: "Qualificado",
      apresentacao: "Apresentação",
      proposal: "Proposta",
      negotiation: "Negociação",
    };

    const order = ["lead", "contacted", "qualified", "apresentacao", "proposal", "negotiation"];

    const statusCounts = data?.reduce((acc: any, opp) => {
      const label = statusLabels[opp.status ?? ""] || opp.status;
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

    const chartData = order
      .filter((s) => statusLabels[s])
      .map((s) => ({
        name: statusLabels[s],
        value: (statusCounts || {})[statusLabels[s]] || 0,
      }));

    setFunnelData(chartData);
  };

  const fetchAvgCloseCycle = async () => {
    try {
      const [year, month] = selectedPeriod.split("-");
      const startDate = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      const endDate = endOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      // Find opportunities that became "Ganho" in the selected month (real close date)
      const { data: wonActivities } = await supabase
        .from("opportunity_activities")
        .select("opportunity_id")
        .eq("new_value", "Ganho")
        .gte("created_at", `${startStr}T00:00:00`)
        .lte("created_at", `${endStr}T23:59:59`);

      const oppIds = Array.from(
        new Set((wonActivities || []).map((a: any) => a.opportunity_id))
      );

      if (oppIds.length === 0) {
        setAvgCloseCycle(0);
        return;
      }

      let query = supabase
        .from("opportunities")
        .select("close_cycle_days, assigned_to")
        .eq("status", "won")
        .in("id", oppIds)
        .not("close_cycle_days", "is", null);

      if (userRole !== "gestor" && userRole !== "admin") {
        query = query.eq("assigned_to", userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        const sum = (data as any[]).reduce((acc: number, opp: any) => acc + (opp.close_cycle_days || 0), 0);
        setAvgCloseCycle(Math.round(sum / data.length));
      } else {
        setAvgCloseCycle(0);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error("Error fetching average close cycle:", error);
    }
  };

  const fetchUpcomingFeiras = async () => {
    try {
      const [year, month] = selectedPeriod.split("-");
      const startDate = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      const endDate = endOfMonth(new Date(parseInt(year), parseInt(month) - 1));

      const { data, error } = await supabase
        .from("feiras")
        .select("*")
        .gte("start_date", format(startDate, "yyyy-MM-dd"))
        .lte("start_date", format(endDate, "yyyy-MM-dd"))
        .order("start_date", { ascending: true });

      if (error) throw error;
      setUpcomingFeiras(data || []);
    } catch (error) {
      if (import.meta.env.DEV) console.error("Error fetching upcoming feiras:", error);
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
      proposta: "Proposta",
      pesquisa_inicial: "Pesquisa Inicial",
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

  // Funções de Previsão de Vendas
  const calculateWeightedRevenue = (opps: any[]) => {
    return opps.reduce((sum, opp) => {
      if (opp.status === "won" || opp.status === "lost") return sum;
      const value = Number(opp.value) || 0;
      const probability = Number(opp.probability) || 0;
      return sum + (value * probability / 100);
    }, 0);
  };

  const calculateRealRevenue = (opps: any[]) => {
    return opps
      .filter(opp => opp.status === "won")
      .reduce((sum, opp) => sum + (Number(opp.value) || 0), 0);
  };

  const calculateProjection = (days: number, allOpps: any[]) => {
    const today = new Date();
    const targetDate = addDays(today, days);
    
    const projectedOpps = allOpps.filter(opp => {
      if (opp.status === "won" || opp.status === "lost" || !opp.expected_close_date) return false;
      const closeDate = new Date(opp.expected_close_date);
      return closeDate <= targetDate;
    });

    return calculateWeightedRevenue(projectedOpps);
  };

  const getMonthlyComparison = (allOpps: any[]) => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthOpps = allOpps.filter(opp => {
        if (opp.status !== "won") return false;
        const oppDate = new Date(opp.created_at);
        return oppDate >= monthStart && oppDate <= monthEnd;
      });

      const revenue = calculateRealRevenue(monthOpps);
      
      months.push({
        month: format(monthDate, "MMM/yy", { locale: ptBR }),
        revenue: revenue,
        count: monthOpps.length,
      });
    }
    return months;
  };

  const getConversionTrend = (allOpps: any[]) => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthOpps = allOpps.filter(opp => {
        const oppDate = new Date(opp.created_at);
        return oppDate >= monthStart && oppDate <= monthEnd;
      });

      const won = monthOpps.filter(opp => opp.status === "won").length;
      const total = monthOpps.length;
      const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;

      months.push({
        month: format(monthDate, "MMM/yy", { locale: ptBR }),
        conversionRate,
        won,
        total,
      });
    }
    return months;
  };

  const getPipelineVelocity = (allOpps: any[]) => {
    const wonOpps = allOpps.filter(opp => opp.status === "won");
    
    if (wonOpps.length === 0) return 0;

    const totalDays = wonOpps.reduce((sum, opp) => {
      const created = new Date(opp.created_at);
      const now = new Date();
      return sum + differenceInDays(now, created);
    }, 0);

    return Math.round(totalDays / wonOpps.length);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Dados para previsão de vendas
  const [allOpportunities, setAllOpportunities] = useState<any[]>([]);
  const [forecastTab, setForecastTab] = useState<30 | 60 | 90>(30);

  useEffect(() => {
    fetchAllOpportunities();

    // Realtime: refetch on any opportunity change
    const channel = supabase
      .channel("dashboard-opportunities-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "opportunities" },
        () => {
          fetchAllOpportunities();
          if (userId && userRole) fetchForecastAccounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userRole]);

  const fetchAllOpportunities = async () => {
    try {
      const { data, error } = await supabase
        .from("opportunities")
        .select(`
          *,
          client:clients(company_name, trade_name),
          assigned:profiles!opportunities_assigned_to_fkey(full_name),
          product:products(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAllOpportunities(data || []);
    } catch (error) {
      if (import.meta.env.DEV) console.error("Error fetching all opportunities:", error);
    }
  };

  const monthlyData = getMonthlyComparison(allOpportunities);
  const conversionData = getConversionTrend(allOpportunities);
  const projection30 = calculateProjection(30, allOpportunities);
  const projection60 = calculateProjection(60, allOpportunities);
  const projection90 = calculateProjection(90, allOpportunities);
  const pipelineValue = calculateWeightedRevenue(allOpportunities);
  const currentMonthRevenue = monthlyData[monthlyData.length - 1]?.revenue || 0;
  const previousMonthRevenue = monthlyData[monthlyData.length - 2]?.revenue || 0;
  const growthRate = previousMonthRevenue > 0 
    ? Math.round(((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100)
    : 0;
  const avgPipelineVelocity = getPipelineVelocity(allOpportunities);
  const currentConversionRate = conversionData[conversionData.length - 1]?.conversionRate || 0;

  return (
    <div className="space-y-4">
      {loading && <DashboardSkeleton />}
      
      {!loading && (
        <>
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

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="previsao">Forecast</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4">

      {/* KPIs — grid único, todos os cards com a mesma altura e alinhamento */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 auto-rows-fr">
        <Card className="border-l-4 border-l-[hsl(var(--badge-blue-bg))] h-full">
          <CardContent className="p-4 h-full flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Tarefas Pendentes</p>
              <p className="text-2xl font-bold text-[hsl(var(--badge-blue-text))]">{todayTasks.length}</p>
            </div>
            <CheckSquare className="h-8 w-8 text-[hsl(var(--badge-blue-bg)/0.3)] shrink-0" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[hsl(var(--badge-purple-bg))] h-full">
          <CardContent className="p-4 h-full flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">No Forecast</p>
              <p className="text-2xl font-bold text-[hsl(var(--badge-purple-text))]">{forecastAccounts.length}</p>
            </div>
            <Target className="h-8 w-8 text-[hsl(var(--badge-purple-bg)/0.3)] shrink-0" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[hsl(var(--badge-green-bg))] h-full">
          <CardContent className="p-4 h-full flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Meta Atingida</p>
              <p className="text-2xl font-bold text-[hsl(var(--badge-green-text))]">
                {goalData ? `${goalData.percentage.toFixed(0)}%` : "0%"}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-[hsl(var(--badge-green-bg)/0.3)] shrink-0" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary h-full">
          <CardContent className="p-4 h-full flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Meta Total</p>
              <p className="text-2xl font-bold text-primary">
                {goalData ? new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  notation: "compact",
                }).format(goalData.target) : "R$ 0"}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-primary/30 shrink-0" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[hsl(var(--badge-orange-bg))] h-full">
          <CardContent className="p-4 h-full flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Ciclo Médio</p>
              <p className="text-2xl font-bold text-[hsl(var(--badge-orange-text))]">
                {avgCloseCycle}
                <span className="text-sm font-medium ml-1">{avgCloseCycle === 1 ? 'dia' : 'dias'}</span>
              </p>
            </div>
            <Clock className="h-8 w-8 text-[hsl(var(--badge-orange-bg)/0.3)] shrink-0" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[hsl(var(--badge-cyan-bg))] h-full">
          <CardContent className="p-4 h-full flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Feiras no Mês</p>
              <p className="text-2xl font-bold text-[hsl(var(--badge-cyan-text))]">{upcomingFeiras.length}</p>
              {upcomingFeiras.length > 0 && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {formatDateBR(upcomingFeiras[0].start_date, "dd/MM")}
                  {upcomingFeiras[0].end_date && ` – ${formatDateBR(upcomingFeiras[0].end_date, "dd/MM")}`}
                </p>
              )}
            </div>
            <Calendar className="h-8 w-8 text-[hsl(var(--badge-cyan-bg)/0.3)] shrink-0" />
          </CardContent>
        </Card>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 auto-rows-fr [&>*]:h-full">
        {/* Tarefas Pendentes - Compacto */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-[hsl(var(--badge-orange-text))]" />
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
                    <p className="text-lg font-bold text-[hsl(var(--badge-green-text))]">
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
                          ? "bg-[hsl(var(--badge-green-bg))]"
                          : goalData.percentage >= 75
                          ? "bg-primary"
                          : goalData.percentage >= 50
                          ? "bg-[hsl(var(--badge-yellow-bg))]"
                          : "bg-[hsl(var(--badge-orange-bg))]"
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
              <TrendingUp className="h-4 w-4 text-[hsl(var(--badge-purple-text))]" />
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
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {forecastAccounts.map((opp) => {
                const fmt = (n: number) =>
                  new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    maximumFractionDigits: 0,
                  }).format(n || 0);
                const monthly = Number(opp.monthly_value) || 0;
                const impl = Number(opp.implementation_value) || 0;
                const pontual = opp.billing_type === "pontual";
                return (
                  <div
                    key={opp.id}
                    className="flex items-center justify-between gap-3 p-2 border rounded hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">
                        {opp.clients?.company_name || opp.clients?.trade_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          {opp.status === "qualified" && "Qual."}
                          {opp.status === "proposal" && "Prop."}
                          {opp.status === "negotiation" && "Negoc."}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{opp.probability}%</span>
                        {opp.products?.name && (
                          <span className="text-xs text-muted-foreground truncate">
                            • {opp.products.name}
                          </span>
                        )}
                        {opp.assigned_user?.full_name && (
                          <span className="text-xs text-muted-foreground truncate">
                            • {opp.assigned_user.full_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {pontual ? (
                        <p className="font-bold text-sm">{fmt(Number(opp.value) || impl)}</p>
                      ) : (
                        <div className="text-xs leading-tight">
                          <p>
                            <span className="text-muted-foreground">Mensal:</span>{" "}
                            <span className="font-semibold">{fmt(monthly)}</span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Implant.:</span>{" "}
                            <span className="font-semibold">{fmt(impl)}</span>
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {opp.expected_close_date &&
                          format(new Date(opp.expected_close_date), "dd/MM/yyyy")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      </TabsContent>

      {/* Tab Forecast */}
      <TabsContent value="previsao" className="space-y-4">
        <ForecastSection opportunities={allOpportunities} formatCurrency={formatCurrency} />
      </TabsContent>
      </Tabs>
        </>
      )}
    </div>
  );
};

export default Dashboard;