import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface GoalProgress {
  goalId: string;
  goalType: string;
  title: string;
  targetValue: number;
  currentValue: number;
  percentage: number;
  isAchieved: boolean;
  startDate: string;
  endDate: string;
  assignedTo: string | null;
}

// Helper to parse date as local (avoiding timezone shifts)
const parseDateOnly = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

// Get calculation window based on goal period
const getCalculationWindow = (goal: { period: string; start_date: string; end_date: string }) => {
  const now = new Date();
  const goalStart = parseDateOnly(goal.start_date);
  const goalEnd = parseDateOnly(goal.end_date);
  
  if (goal.period === "mensal") {
    // For monthly goals, calculate for the current month within the goal period
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    // Use goal boundaries if current month is outside goal period
    const effectiveStart = currentMonthStart < goalStart ? goalStart : currentMonthStart;
    const effectiveEnd = currentMonthEnd > goalEnd ? goalEnd : currentMonthEnd;
    
    return { start: effectiveStart, end: effectiveEnd };
  }
  
  // For semestral/anual, use full goal period
  return { start: goalStart, end: goalEnd };
};

export const calculateGoalProgress = async (
  goalId: string,
  goalType: string,
  targetValue: number,
  assignedTo: string | null,
  startDate: string,
  endDate: string,
  period: string = "mensal",
  taskTypeFilter?: string | null,
  activityTypeFilter?: string | null
): Promise<number> => {
  if (!assignedTo) return 0;

  const { start: windowStart, end: windowEnd } = getCalculationWindow({ period, start_date: startDate, end_date: endDate });
  // IMPORTANT: avoid toISOString() here (UTC shift may change the date)
  const startStr = format(windowStart, "yyyy-MM-dd");
  const endStr = format(windowEnd, "yyyy-MM-dd");

  switch (goalType) {
    case "revenue": {
      // Meta Caixa (Receita):
      // - pontual: value (fallback implementation_value)
      // - recorrente: implementation_value + (monthly_value * 12)
      const { data, error } = await supabase
        .from("opportunities")
        .select("implementation_value, monthly_value, billing_type, value")
        .eq("assigned_to", assignedTo)
        .eq("status", "won")
        .gte("updated_at", `${startStr}T00:00:00`)
        .lte("updated_at", `${endStr}T23:59:59`);

      if (error) {
        console.error("Error fetching revenue:", error);
        return 0;
      }

      return (
        data?.reduce((sum: number, opp: any) => {
          const billingType = (opp?.billing_type as string | null | undefined) ?? null;
          const isPontual = billingType === "pontual";
          const impl = Number(opp?.implementation_value) || 0;
          const monthly = Number(opp?.monthly_value) || 0;
          const value = Number(opp?.value) || 0;

          if (isPontual) return sum + (value || impl);
          return sum + impl + monthly * 12;
        }, 0) || 0
      );
    }

    case "annualized_sales": {
      // Venda Anualizada: monthly_value * 12 (ONLY when billing_type != 'pontual')
      const { data, error } = await supabase
        .from("opportunities")
        .select("monthly_value, billing_type")
        .eq("assigned_to", assignedTo)
        .eq("status", "won")
        .gte("updated_at", `${startStr}T00:00:00`)
        .lte("updated_at", `${endStr}T23:59:59`);

      if (error) {
        console.error("Error fetching annualized sales:", error);
        return 0;
      }

      return (
        data?.reduce((sum: number, opp: any) => {
          const billingType = (opp?.billing_type as string | null | undefined) ?? null;
          if (billingType === "pontual") return sum;
          return sum + (Number(opp?.monthly_value) || 0) * 12;
        }, 0) || 0
      );
    }

    case "tasks": {
      // Count of completed tasks in the period with optional type filter.
      // NOTE: many legacy tasks have completed_at = null; use updated_at as fallback.
      const startTs = `${startStr}T00:00:00`;
      const endTs = `${endStr}T23:59:59`;

      let query = supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", assignedTo)
        .eq("status", "completed");

      if (taskTypeFilter) {
        query = query.eq("task_type", taskTypeFilter as any);
      }

      query = query.or(
        `and(completed_at.gte.${startTs},completed_at.lte.${endTs}),and(completed_at.is.null,updated_at.gte.${startTs},updated_at.lte.${endTs})`
      );

      const { count, error } = await query;

      if (error) {
        console.error("Error fetching tasks:", error);
        return 0;
      }

      return count || 0;
    }

    case "activities": {
      // Count of opportunity activities in the period with optional type filter
      let query = supabase
        .from("opportunity_activities")
        .select("*", { count: "exact", head: true })
        .eq("created_by", assignedTo)
        .gte("created_at", `${startStr}T00:00:00`)
        .lte("created_at", `${endStr}T23:59:59`);

      if (activityTypeFilter) {
        query = query.eq("activity_type", activityTypeFilter);
      }

      const { count, error } = await query;

      if (error) {
        console.error("Error fetching activities:", error);
        return 0;
      }

      return count || 0;
    }

    default:
      return 0;
  }
};

export const useGoalProgress = (userId: string | null, period?: string) => {
  return useQuery({
    queryKey: ["goal-progress", userId, period],
    queryFn: async (): Promise<GoalProgress[]> => {
      if (!userId) return [];

      // Fetch goals for the user
      let query = supabase
        .from("goals")
        .select("*")
        .eq("assigned_to", userId);

      if (period) {
        query = query.eq("period", period);
      }

      const { data: goals, error } = await query;

      if (error) {
        console.error("Error fetching goals:", error);
        return [];
      }

      if (!goals || goals.length === 0) return [];

      // Calculate progress for each goal
      const progressPromises = goals.map(async (goal) => {
        const currentValue = await calculateGoalProgress(
          goal.id,
          goal.goal_type,
          Number(goal.target_value),
          goal.assigned_to,
          goal.start_date,
          goal.end_date,
          goal.period || "mensal",
          (goal as any).task_type_filter,
          (goal as any).activity_type_filter
        );

        const targetValue = Number(goal.target_value);
        const percentage = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;

        return {
          goalId: goal.id,
          goalType: goal.goal_type,
          title: goal.title,
          targetValue,
          currentValue,
          percentage,
          isAchieved: currentValue >= targetValue,
          startDate: goal.start_date,
          endDate: goal.end_date,
          assignedTo: goal.assigned_to,
        };
      });

      return Promise.all(progressPromises);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Standalone function to check goal achievements for notifications
export const checkGoalAchievements = async (userId: string): Promise<GoalProgress[]> => {
  const { data: goals, error } = await supabase
    .from("goals")
    .select("*")
    .eq("assigned_to", userId);

  if (error || !goals) return [];

  const now = new Date();
  const activeGoals = goals.filter(goal => {
    const startDate = new Date(goal.start_date);
    const endDate = new Date(goal.end_date);
    return now >= startDate && now <= endDate;
  });

  const progressPromises = activeGoals.map(async (goal) => {
    const currentValue = await calculateGoalProgress(
      goal.id,
      goal.goal_type,
      Number(goal.target_value),
      goal.assigned_to,
      goal.start_date,
      goal.end_date,
      goal.period || "mensal",
      (goal as any).task_type_filter,
      (goal as any).activity_type_filter
    );

    const targetValue = Number(goal.target_value);
    const percentage = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;

    return {
      goalId: goal.id,
      goalType: goal.goal_type,
      title: goal.title,
      targetValue,
      currentValue,
      percentage,
      isAchieved: currentValue >= targetValue,
      startDate: goal.start_date,
      endDate: goal.end_date,
      assignedTo: goal.assigned_to,
    };
  });

  return Promise.all(progressPromises);
};
