import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, Target, CheckCircle, Trophy } from "lucide-react";
import { checkGoalAchievements } from "@/hooks/useGoalProgress";

const NOTIFICATION_STORAGE_KEY = "crm_notified_items";
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface NotifiedItems {
  tasks: string[];
  opportunities: string[];
  goals: string[];
  lastCleared: string;
}

const getNotifiedItems = (): NotifiedItems => {
  try {
    const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Clear old notifications daily
      const lastCleared = new Date(parsed.lastCleared);
      const now = new Date();
      if (now.getTime() - lastCleared.getTime() > 24 * 60 * 60 * 1000) {
        return { tasks: [], opportunities: [], goals: [], lastCleared: now.toISOString() };
      }
      return parsed;
    }
  } catch (e) {
    console.error("Error reading notification storage:", e);
  }
  return { tasks: [], opportunities: [], goals: [], lastCleared: new Date().toISOString() };
};

const saveNotifiedItems = (items: NotifiedItems) => {
  try {
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Error saving notification storage:", e);
  }
};

export const NotificationSystem = () => {
  const initialCheckDone = useRef(false);

  const checkNotifications = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const notifiedItems = getNotifiedItems();
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      let hasNewNotifications = false;

      // Check overdue tasks - only notify once per task
      const { data: overdueTasks } = await supabase
        .from("tasks")
        .select("id, title, due_date")
        .eq("assigned_to", user.id)
        .eq("status", "pending")
        .lt("due_date", now.toISOString());

      if (overdueTasks && overdueTasks.length > 0) {
        const newOverdueTasks = overdueTasks.filter(
          task => !notifiedItems.tasks.includes(task.id)
        );
        
        if (newOverdueTasks.length > 0) {
          hasNewNotifications = true;
          toast.error(`${newOverdueTasks.length} tarefa(s) vencida(s)`, {
            description: newOverdueTasks[0].title,
            icon: <AlertCircle className="h-5 w-5" />,
            duration: 6000,
          });
          
          // Mark these tasks as notified
          notifiedItems.tasks.push(...newOverdueTasks.map(t => t.id));
        }
      }

      // Check opportunities closing soon (only notify once per opportunity)
      const { data: closingOpportunities } = await supabase
        .from("opportunities")
        .select("id, title, expected_close_date, clients(company_name)")
        .eq("assigned_to", user.id)
        .in("status", ["proposal", "negotiation"])
        .lte("expected_close_date", threeDaysFromNow.toISOString())
        .gte("expected_close_date", now.toISOString());

      if (closingOpportunities && closingOpportunities.length > 0) {
        const newClosingOpps = closingOpportunities.filter(
          opp => !notifiedItems.opportunities.includes(opp.id)
        );
        
        if (newClosingOpps.length > 0 && newClosingOpps.length <= 3) {
          hasNewNotifications = true;
          newClosingOpps.forEach((opp: any) => {
            toast.warning("Oportunidade próxima do fechamento", {
              description: `${opp.clients?.company_name} - ${new Date(opp.expected_close_date).toLocaleDateString("pt-BR")}`,
              icon: <Target className="h-5 w-5" />,
              duration: 6000,
            });
          });
          
          // Mark these opportunities as notified
          notifiedItems.opportunities.push(...newClosingOpps.map(o => o.id));
        }
      }

      // Check goals achieved using real progress calculation
      const goalProgress = await checkGoalAchievements(user.id);
      const achievedGoals = goalProgress.filter(g => g.isAchieved);

      if (achievedGoals.length > 0) {
        const newAchievedGoals = achievedGoals.filter(
          goal => !notifiedItems.goals.includes(goal.goalId)
        );

        if (newAchievedGoals.length > 0) {
          hasNewNotifications = true;
          newAchievedGoals.forEach((goal) => {
            toast.success("Meta atingida!", {
              description: `${goal.title} - ${goal.currentValue.toLocaleString("pt-BR")} de ${goal.targetValue.toLocaleString("pt-BR")}`,
              icon: <Trophy className="h-5 w-5" />,
              duration: 8000,
            });
          });

          // Mark these goals as notified
          notifiedItems.goals.push(...newAchievedGoals.map(g => g.goalId));
        }
      }

      if (hasNewNotifications) {
        saveNotifiedItems(notifiedItems);
      }
    } catch (error) {
      console.error("Error checking notifications:", error);
    }
  }, []);

  useEffect(() => {
    // Only check once on mount to avoid spam
    if (!initialCheckDone.current) {
      initialCheckDone.current = true;
      // Delay initial check to avoid showing notifications on page load
      const initialTimeout = setTimeout(checkNotifications, 3000);
      return () => clearTimeout(initialTimeout);
    }
    
    // Check periodically
    const interval = setInterval(checkNotifications, CHECK_INTERVAL);
    
    return () => clearInterval(interval);
  }, [checkNotifications]);

  return null;
};
