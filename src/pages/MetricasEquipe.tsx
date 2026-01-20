import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Target, TrendingUp, DollarSign, Briefcase, CheckCircle2, ChevronDown, ChevronUp, Trophy, Activity, ListTodo, Calendar, LayoutGrid, List, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateGoalProgress } from "@/hooks/useGoalProgress";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SellerMetrics {
  seller_id: string;
  seller_name: string;
  seller_email: string;
  total_clients: number;
  total_opportunities: number;
  won_opportunities: number;
  total_revenue: number;
  conversion_rate: number;
  total_tasks: number;
  completed_tasks: number;
}

interface GoalWithProgress {
  id: string;
  title: string;
  goal_type: string;
  target_value: number;
  current_value: number;
  percentage: number;
  start_date: string;
  end_date: string;
  is_achieved: boolean;
}

const MetricasEquipe = () => {
  const [metrics, setMetrics] = useState<SellerMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSellers, setExpandedSellers] = useState<Record<string, boolean>>({});
  const [sellerGoals, setSellerGoals] = useState<Record<string, GoalWithProgress[]>>({});
  const [loadingGoals, setLoadingGoals] = useState<Record<string, boolean>>({});
  const [selectedPeriod, setSelectedPeriod] = useState(format(new Date(), "yyyy-MM"));
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  useEffect(() => {
    fetchTeamMetrics();
  }, [selectedPeriod]);

  const getPeriodDates = () => {
    const [year, month] = selectedPeriod.split("-");
    const startDate = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
    const endDate = endOfMonth(startDate);
    return { startDate, endDate };
  };

  const getPeriodOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = subMonths(currentDate, i);
      const value = format(date, "yyyy-MM");
      const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    
    return options;
  };

  const fetchTeamMetrics = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getPeriodDates();
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      // Fetch all sellers (excluding deleted users)
      const { data: sellers, error: sellersError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .or("is_deleted.is.null,is_deleted.eq.false")
        .order("full_name");

      if (sellersError) throw sellersError;

      const metricsPromises = sellers.map(async (seller) => {
        // Count clients created in period
        const { count: clientsCount } = await supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .eq("created_by", seller.id)
          .gte("created_at", `${startDateStr}T00:00:00`)
          .lte("created_at", `${endDateStr}T23:59:59`);

        // Count opportunities in period
        const { data: opportunities } = await supabase
          .from("opportunities")
          .select("status, value, updated_at")
          .or(`created_by.eq.${seller.id},assigned_to.eq.${seller.id}`)
          .gte("created_at", `${startDateStr}T00:00:00`)
          .lte("created_at", `${endDateStr}T23:59:59`);

        const totalOpportunities = opportunities?.length || 0;
        const wonOpportunities = opportunities?.filter(o => o.status === "won").length || 0;
        const totalRevenue = opportunities
          ?.filter(o => o.status === "won")
          .reduce((sum, o) => sum + (Number(o.value) || 0), 0) || 0;
        const conversionRate = totalOpportunities > 0 
          ? (wonOpportunities / totalOpportunities) * 100 
          : 0;

        // Count tasks in period - using consistent logic with goals (completed_at for completed tasks)
        const { data: tasks } = await supabase
          .from("tasks")
          .select("status, completed_at")
          .eq("assigned_to", seller.id);

        // Filter tasks created in period OR completed in period
        const tasksCreatedInPeriod = tasks?.filter(t => {
          // For this metric we count all tasks assigned to the seller in the period
          return true;
        }) || [];
        
        // Count completed tasks that were completed within the period
        const completedTasksInPeriod = tasks?.filter(t => {
          if (t.status !== "completed" || !t.completed_at) return false;
          const completedDate = new Date(t.completed_at);
          return completedDate >= new Date(`${startDateStr}T00:00:00`) && 
                 completedDate <= new Date(`${endDateStr}T23:59:59`);
        }) || [];
        
        // For total tasks, count those created in period
        const { count: totalTasksCount } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("assigned_to", seller.id)
          .gte("created_at", `${startDateStr}T00:00:00`)
          .lte("created_at", `${endDateStr}T23:59:59`);

        const totalTasks = totalTasksCount || 0;
        const completedTasks = completedTasksInPeriod.length;

        return {
          seller_id: seller.id,
          seller_name: seller.full_name,
          seller_email: seller.email,
          total_clients: clientsCount || 0,
          total_opportunities: totalOpportunities,
          won_opportunities: wonOpportunities,
          total_revenue: totalRevenue,
          conversion_rate: conversionRate,
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
        };
      });

      const metricsData = await Promise.all(metricsPromises);
      setMetrics(metricsData);
      // Reset goals when period changes
      setSellerGoals({});
      setExpandedSellers({});
    } catch (error) {
      console.error("Error fetching team metrics:", error);
      toast.error("Erro ao carregar métricas da equipe");
    } finally {
      setLoading(false);
    }
  };

  const fetchSellerGoals = async (sellerId: string) => {
    if (sellerGoals[sellerId]) return; // Already loaded
    
    setLoadingGoals(prev => ({ ...prev, [sellerId]: true }));
    
    try {
      const { startDate, endDate } = getPeriodDates();
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");
      
      const { data: goals, error } = await supabase
        .from("goals")
        .select("*")
        .eq("assigned_to", sellerId)
        .lte("start_date", endDateStr)
        .gte("end_date", startDateStr);

      if (error) throw error;

      if (!goals || goals.length === 0) {
        setSellerGoals(prev => ({ ...prev, [sellerId]: [] }));
        return;
      }

      // Calculate progress for each goal
      const goalsWithProgress = await Promise.all(
        goals.map(async (goal) => {
          const currentValue = await calculateGoalProgress(
            goal.id,
            goal.goal_type,
            Number(goal.target_value),
            goal.assigned_to,
            goal.start_date,
            goal.end_date
          );

          const targetValue = Number(goal.target_value);
          const percentage = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;

          return {
            id: goal.id,
            title: goal.title,
            goal_type: goal.goal_type,
            target_value: targetValue,
            current_value: currentValue,
            percentage,
            start_date: goal.start_date,
            end_date: goal.end_date,
            is_achieved: currentValue >= targetValue,
          };
        })
      );

      setSellerGoals(prev => ({ ...prev, [sellerId]: goalsWithProgress }));
    } catch (error) {
      console.error("Error fetching seller goals:", error);
      toast.error("Erro ao carregar metas");
    } finally {
      setLoadingGoals(prev => ({ ...prev, [sellerId]: false }));
    }
  };

  const toggleSellerExpanded = (sellerId: string) => {
    const isExpanding = !expandedSellers[sellerId];
    setExpandedSellers(prev => ({ ...prev, [sellerId]: isExpanding }));
    
    if (isExpanding) {
      fetchSellerGoals(sellerId);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getGoalTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      revenue: "Receita",
      annualized_sales: "Venda Anualizada",
      tasks: "Tarefas",
      activities: "Atividades",
    };
    return labels[type] || type;
  };

  const getGoalTypeIcon = (type: string) => {
    switch (type) {
      case "revenue":
        return <DollarSign className="h-4 w-4" />;
      case "annualized_sales":
        return <TrendingUp className="h-4 w-4" />;
      case "tasks":
        return <ListTodo className="h-4 w-4" />;
      case "activities":
        return <Activity className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  const formatGoalValue = (type: string, value: number) => {
    if (type === "revenue" || type === "annualized_sales") {
      return formatCurrency(value);
    }
    return value.toString();
  };

  const totalClients = metrics.reduce((sum, m) => sum + m.total_clients, 0);
  const totalOpportunities = metrics.reduce((sum, m) => sum + m.total_opportunities, 0);
  const totalRevenue = metrics.reduce((sum, m) => sum + m.total_revenue, 0);
  const avgConversion = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.conversion_rate, 0) / metrics.length
    : 0;

  const selectedPeriodLabel = getPeriodOptions().find(o => o.value === selectedPeriod)?.label || selectedPeriod;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-2">
            Métricas de Equipe
          </h1>
          <p className="text-muted-foreground">
            Visão geral do desempenho de toda a equipe de vendas
          </p>
        </div>

        <div className="flex items-center gap-3">
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

          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("cards")}
              className="rounded-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <TooltipProvider>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-lg border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Novos Clientes</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-medium mb-1">Cálculo: Novos Clientes</p>
                    <p className="text-xs">Soma de todos os clientes cadastrados (created_at) no período selecionado por cada vendedor.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{totalClients}</div>
              <p className="text-xs text-muted-foreground">No período</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-l-4 border-l-success">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Oportunidades</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-medium mb-1">Cálculo: Oportunidades</p>
                    <p className="text-xs">Soma de todas as oportunidades criadas (created_at) no período selecionado, onde o vendedor é criador ou responsável.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Target className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{totalOpportunities}</div>
              <p className="text-xs text-muted-foreground">No período</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-l-4 border-l-warning">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Receita</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-medium mb-1">Cálculo: Receita</p>
                    <p className="text-xs">Soma do valor de todas as oportunidades com status "Ganha" criadas no período selecionado.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <DollarSign className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{formatCurrency(totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">No período</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-l-4 border-l-accent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-medium mb-1">Cálculo: Taxa de Conversão</p>
                    <p className="text-xs">Média da taxa de conversão de cada vendedor. Taxa individual = (Oportunidades Ganhas ÷ Total de Oportunidades) × 100.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <TrendingUp className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{avgConversion.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Média da equipe</p>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>

      {/* Individual Seller Metrics */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Desempenho Individual - {selectedPeriodLabel}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {viewMode === "cards" 
              ? 'Clique em "Ver Metas" para visualizar o progresso das metas de cada vendedor'
              : "Visualização em lista do desempenho de cada vendedor"}
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando métricas...</p>
          ) : metrics.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum vendedor encontrado</p>
          ) : viewMode === "list" ? (
            /* List View */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 mx-auto">
                            Clientes
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Clientes cadastrados no período</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 mx-auto">
                            Oportunidades
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Oportunidades criadas no período</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 mx-auto">
                            Ganhos
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Oportunidades com status "Ganha"</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-right">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 ml-auto">
                            Receita
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Soma do valor das oportunidades ganhas</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 mx-auto">
                            Conversão
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">(Ganhas ÷ Total) × 100</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 mx-auto">
                            Tarefas
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Tarefas criadas no período</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 mx-auto">
                            Concluídas
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Tarefas concluídas (completed_at) no período</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-center">Metas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((metric) => (
                    <TableRow key={metric.seller_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{metric.seller_name}</p>
                          <p className="text-xs text-muted-foreground">{metric.seller_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{metric.total_clients}</TableCell>
                      <TableCell className="text-center">{metric.total_opportunities}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-success font-medium">{metric.won_opportunities}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-warning font-medium">{formatCurrency(metric.total_revenue)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={metric.conversion_rate >= 30 ? "default" : "secondary"}>
                          {metric.conversion_rate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{metric.total_tasks}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-success">{metric.completed_tasks}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setViewMode("cards");
                            toggleSellerExpanded(metric.seller_id);
                          }}
                        >
                          <Target className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Cards View */
            <div className="space-y-4">
              {metrics.map((metric) => (
                <Collapsible
                  key={metric.seller_id}
                  open={expandedSellers[metric.seller_id]}
                  onOpenChange={() => toggleSellerExpanded(metric.seller_id)}
                >
                  <Card className="border-l-4 border-l-primary/50">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {/* Seller Info */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-foreground">{metric.seller_name}</h3>
                            <p className="text-sm text-muted-foreground">{metric.seller_email}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-2xl font-bold text-primary">
                                {metric.conversion_rate.toFixed(1)}%
                              </div>
                              <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
                            </div>
                            <CollapsibleTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-2">
                                <Target className="h-4 w-4" />
                                Ver Metas
                                {expandedSellers[metric.seller_id] ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </div>

                        {/* Metrics Grid */}
                        <TooltipProvider>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t">
                            <div className="space-y-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 text-muted-foreground cursor-help">
                                    <Users size={16} />
                                    <span className="text-xs">Clientes</span>
                                    <HelpCircle className="h-3 w-3" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Clientes cadastrados no período</p>
                                </TooltipContent>
                              </Tooltip>
                              <p className="text-xl font-semibold text-foreground">{metric.total_clients}</p>
                            </div>

                            <div className="space-y-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 text-muted-foreground cursor-help">
                                    <Target size={16} />
                                    <span className="text-xs">Oportunidades</span>
                                    <HelpCircle className="h-3 w-3" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Oportunidades criadas no período</p>
                                </TooltipContent>
                              </Tooltip>
                              <p className="text-xl font-semibold text-foreground">{metric.total_opportunities}</p>
                            </div>

                            <div className="space-y-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 text-muted-foreground cursor-help">
                                    <TrendingUp size={16} />
                                    <span className="text-xs">Ganhos</span>
                                    <HelpCircle className="h-3 w-3" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Oportunidades com status "Ganha"</p>
                                </TooltipContent>
                              </Tooltip>
                              <p className="text-xl font-semibold text-success">{metric.won_opportunities}</p>
                            </div>

                            <div className="space-y-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 text-muted-foreground cursor-help">
                                    <DollarSign size={16} />
                                    <span className="text-xs">Receita</span>
                                    <HelpCircle className="h-3 w-3" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Soma do valor das oportunidades ganhas</p>
                                </TooltipContent>
                              </Tooltip>
                              <p className="text-lg font-semibold text-warning">
                                {formatCurrency(metric.total_revenue)}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 text-muted-foreground cursor-help">
                                    <Briefcase size={16} />
                                    <span className="text-xs">Tarefas</span>
                                    <HelpCircle className="h-3 w-3" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Tarefas criadas (created_at) no período</p>
                                </TooltipContent>
                              </Tooltip>
                              <p className="text-xl font-semibold text-foreground">{metric.total_tasks}</p>
                            </div>

                            <div className="space-y-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 text-muted-foreground cursor-help">
                                    <CheckCircle2 size={16} />
                                    <span className="text-xs">Concluídas</span>
                                    <HelpCircle className="h-3 w-3" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Tarefas concluídas (completed_at) no período</p>
                                </TooltipContent>
                              </Tooltip>
                              <p className="text-xl font-semibold text-success">{metric.completed_tasks}</p>
                            </div>
                          </div>
                        </TooltipProvider>

                        {/* Goals Section - Collapsible */}
                        <CollapsibleContent className="pt-4 border-t mt-4">
                          <div className="space-y-4">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                              <Trophy className="h-4 w-4 text-warning" />
                              Metas do Período
                            </h4>

                            {loadingGoals[metric.seller_id] ? (
                              <p className="text-sm text-muted-foreground">Carregando metas...</p>
                            ) : !sellerGoals[metric.seller_id] || sellerGoals[metric.seller_id].length === 0 ? (
                              <p className="text-sm text-muted-foreground italic">
                                Nenhuma meta para este período
                              </p>
                            ) : (
                              <div className="grid gap-3 md:grid-cols-2">
                                {sellerGoals[metric.seller_id].map((goal) => (
                                  <Card key={goal.id} className={`border ${goal.is_achieved ? 'border-success bg-success/5' : 'border-border'}`}>
                                    <CardContent className="p-4">
                                      <div className="space-y-3">
                                        <div className="flex items-start justify-between">
                                          <div className="flex items-center gap-2">
                                            {getGoalTypeIcon(goal.goal_type)}
                                            <span className="font-medium text-sm">{goal.title}</span>
                                          </div>
                                          {goal.is_achieved && (
                                            <Badge variant="default" className="bg-success text-success-foreground">
                                              <CheckCircle2 className="h-3 w-3 mr-1" />
                                              Atingida
                                            </Badge>
                                          )}
                                        </div>

                                        <div className="space-y-2">
                                          <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">
                                              {getGoalTypeLabel(goal.goal_type)}
                                            </span>
                                            <span className="font-semibold">
                                              {goal.percentage.toFixed(0)}%
                                            </span>
                                          </div>
                                          <Progress 
                                            value={goal.percentage} 
                                            className={`h-2 ${goal.is_achieved ? '[&>div]:bg-success' : ''}`}
                                          />
                                          <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>
                                              Atual: {formatGoalValue(goal.goal_type, goal.current_value)}
                                            </span>
                                            <span>
                                              Meta: {formatGoalValue(goal.goal_type, goal.target_value)}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="text-xs text-muted-foreground">
                                          {format(new Date(goal.start_date), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(goal.end_date), "dd/MM/yyyy", { locale: ptBR })}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </CardContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MetricasEquipe;