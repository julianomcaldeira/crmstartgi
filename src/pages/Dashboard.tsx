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
        <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="text-primary" size={20} />
              Próximas Tarefas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Você tem <span className="font-bold text-primary">{stats.pendingTasks}</span> tarefas pendentes
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-purple-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="text-purple-600" size={20} />
              Pipeline de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              <span className="font-bold text-purple-600">{stats.opportunities}</span> oportunidades em aberto
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;