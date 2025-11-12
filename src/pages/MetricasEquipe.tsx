import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, TrendingUp, DollarSign, Briefcase, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

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

const MetricasEquipe = () => {
  const [metrics, setMetrics] = useState<SellerMetrics[]>([]);
  const [loading, setLoading] = useState(true);

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
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
          <CardTitle className="text-xl">Desempenho Individual dos Vendedores</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando métricas...</p>
          ) : metrics.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum vendedor encontrado</p>
          ) : (
            <div className="space-y-4">
              {metrics.map((metric) => (
                <Card key={metric.seller_id} className="border-l-4 border-l-primary/50">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Seller Info */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{metric.seller_name}</h3>
                          <p className="text-sm text-muted-foreground">{metric.seller_email}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {metric.conversion_rate.toFixed(1)}%
                          </div>
                          <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
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
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MetricasEquipe;
