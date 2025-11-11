import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, CheckSquare, DollarSign, TrendingUp, Clock } from "lucide-react";

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
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total de Clientes",
      value: stats.clients,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Oportunidades Ativas",
      value: stats.opportunities,
      icon: Target,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Tarefas Pendentes",
      value: stats.pendingTasks,
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Total de Tarefas",
      value: stats.tasks,
      icon: CheckSquare,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Negócios Ganhos",
      value: stats.wonDeals,
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Receita Total",
      value: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(stats.revenue),
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do seu desempenho comercial
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? "..." : stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Próximas Tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Você tem {stats.pendingTasks} tarefas pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              {stats.opportunities} oportunidades em aberto
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;