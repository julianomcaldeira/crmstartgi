import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, TrendingUp, DollarSign, Briefcase, CheckCircle2, ChevronDown, ChevronUp, Trophy, Activity, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { calculateGoalProgress } from "@/hooks/useGoalProgress";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface SellerGoals {
  seller_id: string;
  goals: GoalWithProgress[];
}

const MetricasEquipe = () => {
  const [metrics, setMetrics] = useState<SellerMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSellers, setExpandedSellers] = useState<Record<string, boolean>>({});
  const [sellerGoals, setSellerGoals] = useState<Record<string, GoalWithProgress[]>>({});
  const [loadingGoals, setLoadingGoals] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchTeamMetrics();
  }, []);

  const fetchTeamMetrics = async () => {
    try {
      // Fetch all sellers
      const { data: sellers, error: sellersError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");

      if (sellersError) throw sellersError;

      const metricsPromises = sellers.map(async (seller) => {
        // Count clients
        const { count: clientsCount } = await supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .eq("created_by", seller.id);

        // Count opportunities
        const { data: opportunities } = await supabase
          .from("opportunities")
          .select("status, value")
          .or(`created_by.eq.${seller.id},assigned_to.eq.${seller.id}`);

        const totalOpportunities = opportunities?.length || 0;
        const wonOpportunities = opportunities?.filter(o => o.status === "won").length || 0;
        const totalRevenue = opportunities
          ?.filter(o => o.status === "won")
          .reduce((sum, o) => sum + (Number(o.value) || 0), 0) || 0;
        const conversionRate = totalOpportunities > 0 
          ? (wonOpportunities / totalOpportunities) * 100 
          : 0;

        // Count tasks
        const { data: tasks } = await supabase
          .from("tasks")
          .select("status")
          .or(`created_by.eq.${seller.id},assigned_to.eq.${seller.id}`);

        const totalTasks = tasks?.length || 0;
        const completedTasks = tasks?.filter(t => t.status === "completed").length || 0;

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
      // Fetch active goals for this seller
      const today = format(new Date(), "yyyy-MM-dd");
      
      const { data: goals, error } = await supabase
        .from("goals")
        .select("*")
        .eq("assigned_to", sellerId)
        .lte("start_date", today)
        .gte("end_date", today);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-2">
          Métricas de Equipe
        </h1>
        <p className="text-muted-foreground">
          Visão geral do desempenho de toda a equipe de vendas
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-lg border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalClients}</div>
            <p className="text-xs text-muted-foreground">Toda a base</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-l-4 border-l-success">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oportunidades Totais</CardTitle>
            <Target className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{totalOpportunities}</div>
            <p className="text-xs text-muted-foreground">Em pipeline</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-l-4 border-l-warning">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Ganhos fechados</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-l-4 border-l-accent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão Média</CardTitle>
            <TrendingUp className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{avgConversion.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Da equipe</p>
          </CardContent>
        </Card>
      </div>

      {/* Individual Seller Metrics */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Desempenho Individual dos Vendedores
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Clique em "Ver Metas" para visualizar o progresso das metas de cada vendedor
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando métricas...</p>
          ) : metrics.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum vendedor encontrado</p>
          ) : (
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
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Users size={16} />
                              <span className="text-xs">Clientes</span>
                            </div>
                            <p className="text-xl font-semibold text-foreground">{metric.total_clients}</p>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Target size={16} />
                              <span className="text-xs">Oportunidades</span>
                            </div>
                            <p className="text-xl font-semibold text-foreground">{metric.total_opportunities}</p>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <TrendingUp size={16} />
                              <span className="text-xs">Ganhos</span>
                            </div>
                            <p className="text-xl font-semibold text-success">{metric.won_opportunities}</p>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <DollarSign size={16} />
                              <span className="text-xs">Receita</span>
                            </div>
                            <p className="text-lg font-semibold text-warning">
                              {formatCurrency(metric.total_revenue)}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Briefcase size={16} />
                              <span className="text-xs">Tarefas</span>
                            </div>
                            <p className="text-xl font-semibold text-foreground">{metric.total_tasks}</p>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <CheckCircle2 size={16} />
                              <span className="text-xs">Concluídas</span>
                            </div>
                            <p className="text-xl font-semibold text-success">{metric.completed_tasks}</p>
                          </div>
                        </div>

                        {/* Goals Section - Collapsible */}
                        <CollapsibleContent className="pt-4 border-t mt-4">
                          <div className="space-y-4">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                              <Trophy className="h-4 w-4 text-warning" />
                              Metas Ativas
                            </h4>

                            {loadingGoals[metric.seller_id] ? (
                              <p className="text-sm text-muted-foreground">Carregando metas...</p>
                            ) : !sellerGoals[metric.seller_id] || sellerGoals[metric.seller_id].length === 0 ? (
                              <p className="text-sm text-muted-foreground italic">
                                Nenhuma meta ativa para este período
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
