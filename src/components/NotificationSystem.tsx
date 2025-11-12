import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, CheckCircle, AlertCircle, Target } from "lucide-react";

export const NotificationSystem = () => {
  const [lastCheck, setLastCheck] = useState(new Date());

  useEffect(() => {
    checkNotifications();
    
    // Check every 5 minutes
    const interval = setInterval(checkNotifications, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const checkNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      // Check overdue tasks
      const { data: overdueTasks } = await supabase
        .from("tasks")
        .select("title, due_date")
        .eq("assigned_to", user.id)
        .eq("status", "pending")
        .lt("due_date", now.toISOString())
        .gt("due_date", lastCheck.toISOString());

      if (overdueTasks && overdueTasks.length > 0) {
        toast.error(`${overdueTasks.length} tarefa(s) vencida(s)`, {
          description: overdueTasks[0].title,
          icon: <AlertCircle className="h-5 w-5" />,
          duration: 6000,
        });
      }

      // Check opportunities closing soon
      const { data: closingOpportunities } = await supabase
        .from("opportunities")
        .select("title, expected_close_date, clients(company_name)")
        .in("status", ["proposal", "negotiation"])
        .lte("expected_close_date", threeDaysFromNow.toISOString())
        .gte("expected_close_date", now.toISOString());

      if (closingOpportunities && closingOpportunities.length > 0) {
        closingOpportunities.forEach((opp: any) => {
          toast.warning("Oportunidade próxima do fechamento", {
            description: `${opp.clients?.company_name} - ${new Date(opp.expected_close_date).toLocaleDateString("pt-BR")}`,
            icon: <Target className="h-5 w-5" />,
            duration: 6000,
          });
        });
      }

      // Check goals achieved
      const { data: goals } = await supabase
        .from("goals")
        .select("title, target_value, current_value")
        .eq("assigned_to", user.id);

      if (goals && goals.length > 0) {
        goals.forEach((goal: any) => {
          if (goal.current_value >= goal.target_value) {
            toast.success("Meta atingida!", {
              description: goal.title,
              icon: <CheckCircle className="h-5 w-5" />,
              duration: 6000,
            });
          }
        });
      }

      setLastCheck(now);
    } catch (error) {
      console.error("Error checking notifications:", error);
    }
  };

  return null;
};
