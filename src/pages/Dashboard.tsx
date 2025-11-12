import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, CheckSquare, DollarSign, TrendingUp, Clock } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";

const Dashboard = () => {
  const [stats, setStats] = useState({
    clients: 0,
    opportunities: 0,
    tasks: 0,
    revenue: 0,
    pendingTasks: 0,
    wonDeals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [productData, setProductData] = useState<any[]>([]);
  const [evolutionData, setEvolutionData] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Fetch clients count
      const { count: clientsCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true });

      // Fetch opportunities count
      const { count: opportunitiesCount } = await supabase
        .from("opportunities")
        .select("*", { count: "exact", head: true });

      // Fetch tasks count
      const { count: tasksCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", user.id);

      // Fetch pending tasks
      const { count: pendingCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", user.id)
        .eq("status", "pending");

      // Fetch won opportunities and revenue
      const { data: wonOpps } = await supabase
        .from("opportunities")
        .select("value")
        .eq("status", "won");

      const revenue = wonOpps?.reduce((sum, opp) => sum + (Number(opp.value) || 0), 0) || 0;

      setStats({
        clients: clientsCount || 0,
        opportunities: opportunitiesCount || 0,
        tasks: tasksCount || 0,
        revenue,
        pendingTasks: pendingCount || 0,
        wonDeals: wonOpps?.length || 0,
      });

      // Fetch funnel data
      await fetchFunnelData();
      await fetchProductData();
      await fetchEvolutionData();
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFunnelData = async () => {
    const { data: opportunities } = await supabase
      .from("opportunities")
      .select("status");

    const statusLabels: Record<string, string> = {
      lead: "Lead",
      qualified: "Qualificado",
      proposal: "Proposta",
      negotiation: "Negociação",
      won: "Ganho",
      lost: "Perdido",
    };

    const statusCounts = opportunities?.reduce((acc: any, opp) => {
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

  const fetchProductData = async () => {
    const { data: opportunities } = await supabase
      .from("opportunities")
      .select("product_id, value, products(name)")
      .eq("status", "won");

    const productStats = opportunities?.reduce((acc: any, opp: any) => {
      const productName = opp.products?.name || "Sem Produto";
      if (!acc[productName]) {
        acc[productName] = { name: productName, revenue: 0, count: 0 };
      }
      acc[productName].revenue += Number(opp.value) || 0;
      acc[productName].count += 1;
      return acc;
    }, {});

    const chartData = Object.values(productStats || {}).sort((a: any, b: any) => b.revenue - a.revenue);
    setProductData(chartData);
  };

  const fetchEvolutionData = async () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: opportunities } = await supabase
      .from("opportunities")
      .select("created_at, value, status")
      .gte("created_at", sixMonthsAgo.toISOString());

    const monthlyData = opportunities?.reduce((acc: any, opp) => {
      const month = new Date(opp.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
      if (!acc[month]) {
        acc[month] = { month, oportunidades: 0, receita: 0 };
      }
      acc[month].oportunidades += 1;
      if (opp.status === "won") {
        acc[month].receita += Number(opp.value) || 0;
      }
      return acc;
    }, {});

    const chartData = Object.values(monthlyData || {});
    setEvolutionData(chartData);
  };

  const statCards = [
    {
      title: "Total de Clientes",
      value: stats.clients,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-gradient-to-br from-blue-500/10 to-blue-600/10",
      borderColor: "border-l-blue-500",
    },
    {
      title: "Oportunidades Ativas",
      value: stats.opportunities,
      icon: Target,
      color: "text-purple-600",
      bgColor: "bg-gradient-to-br from-purple-500/10 to-purple-600/10",
      borderColor: "border-l-purple-500",
    },
    {
      title: "Tarefas Pendentes",
      value: stats.pendingTasks,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-gradient-to-br from-orange-500/10 to-orange-600/10",
      borderColor: "border-l-orange-500",
    },
    {
      title: "Total de Tarefas",
      value: stats.tasks,
      icon: CheckSquare,
      color: "text-primary",
      bgColor: "bg-gradient-to-br from-primary/10 to-primary-light/10",
      borderColor: "border-l-primary",
    },
    {
      title: "Negócios Ganhos",
      value: stats.wonDeals,
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-gradient-to-br from-emerald-500/10 to-emerald-600/10",
      borderColor: "border-l-emerald-500",
    },
    {
      title: "Receita Total",
      value: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(stats.revenue),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-gradient-to-br from-green-500/10 to-green-600/10",
      borderColor: "border-l-green-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-2">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Visão geral do seu desempenho comercial
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={stat.title} 
              className={`hover:shadow-xl transition-all duration-300 border-l-4 ${stat.borderColor} ${stat.bgColor}`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${stat.color}`}>
                  {loading ? "..." : stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Funil de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Evolução de Métricas</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                oportunidades: {
                  label: "Oportunidades",
                  color: "hsl(var(--primary))",
                },
                receita: {
                  label: "Receita",
                  color: "hsl(142, 76%, 36%)",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="oportunidades" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="receita" stroke="hsl(142, 76%, 36%)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow lg:col-span-2">
          <CardHeader>
            <CardTitle>Comparativo entre Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                revenue: {
                  label: "Receita",
                  color: "hsl(var(--primary))",
                },
                count: {
                  label: "Quantidade",
                  color: "hsl(221, 83%, 53%)",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Receita (R$)" />
                  <Bar dataKey="count" fill="hsl(221, 83%, 53%)" name="Quantidade" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;