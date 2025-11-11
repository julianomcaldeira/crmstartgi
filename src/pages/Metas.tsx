import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TrendingUp, Target, DollarSign, CheckSquare } from "lucide-react";

const Metas = () => {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .or(`assigned_to.eq.${user.id},assigned_to.is.null`)
        .order("end_date", { ascending: true });

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error("Error fetching goals:", error);
      toast.error("Erro ao carregar metas");
    } finally {
      setLoading(false);
    }
  };

  const getGoalIcon = (type: string) => {
    switch (type) {
      case "revenue": return DollarSign;
      case "annualized_sales": return TrendingUp;
      case "tasks": return CheckSquare;
      case "activities": return Target;
      default: return Target;
    }
  };

  const getGoalTypeLabel = (type: string) => {
    switch (type) {
      case "revenue": return "Receita Caixa";
      case "annualized_sales": return "Venda Anualizada";
      case "tasks": return "Tarefas";
      case "activities": return "Atividades";
      default: return type;
    }
  };

  const formatValue = (value: number, type: string) => {
    if (type === "revenue" || type === "annualized_sales") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
    }
    return value.toString();
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-success";
    if (percentage >= 75) return "bg-primary";
    if (percentage >= 50) return "bg-warning";
    return "bg-destructive";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Metas</h1>
        <p className="text-muted-foreground">
          Acompanhe seu progresso e objetivos
        </p>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Carregando...</p>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Target className="mx-auto mb-4 text-muted-foreground" size={48} />
            <p className="text-muted-foreground">
              Nenhuma meta definida ainda
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map((goal) => {
            const Icon = getGoalIcon(goal.goal_type);
            const progress = getProgressPercentage(
              Number(goal.current_value),
              Number(goal.target_value)
            );

            return (
              <Card key={goal.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="text-primary" size={24} />
                      </div>
                      <div>
                        <CardTitle className="text-lg mb-1">
                          {goal.title}
                        </CardTitle>
                        <Badge variant="outline">
                          {getGoalTypeLabel(goal.goal_type)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {goal.description && (
                    <p className="text-sm text-muted-foreground">
                      {goal.description}
                    </p>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Progresso</span>
                      <span className="text-muted-foreground">
                        {formatValue(goal.current_value, goal.goal_type)} /{" "}
                        {formatValue(goal.target_value, goal.goal_type)}
                      </span>
                    </div>
                    <Progress
                      value={progress}
                      className="h-2"
                    />
                    <p className="text-xs text-right text-muted-foreground">
                      {progress.toFixed(1)}% concluído
                    </p>
                  </div>

                  <div className="flex justify-between text-sm text-muted-foreground pt-2 border-t">
                    <span>Início: {new Date(goal.start_date).toLocaleDateString("pt-BR")}</span>
                    <span>Fim: {new Date(goal.end_date).toLocaleDateString("pt-BR")}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Metas;