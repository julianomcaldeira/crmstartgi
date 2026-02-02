import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export const calculateGoalProgress = async (
  goalId: string,
  goalType: string,
  targetValue: number,
  assignedTo: string | null,
  startDate: string,
  endDate: string
): Promise<number> => {
  if (!assignedTo) return 0;

  const startDateTime = new Date(startDate).toISOString();
  const endDateTime = new Date(endDate + "T23:59:59").toISOString();

  switch (goalType) {
    case "revenue": {
      // Sum of implementation_value for won opportunities in the period (using updated_at)
      const { data, error } = await supabase
        .from("opportunities")
        .select("implementation_value")
        .eq("assigned_to", assignedTo)
        .eq("status", "won")
        .gte("updated_at", startDateTime)
        .lte("updated_at", endDateTime);

      if (error) {
        console.error("Error fetching revenue:", error);
        return 0;
      }

      return data?.reduce((sum, opp) => sum + (Number(opp.implementation_value) || 0), 0) || 0;
    }

    case "annualized_sales": {
      // Sum of monthly_value * 12 for won opportunities in the period (using updated_at)
      const { data, error } = await supabase
        .from("opportunities")
        .select("monthly_value")
        .eq("assigned_to", assignedTo)
        .eq("status", "won")
        .gte("updated_at", startDateTime)
        .lte("updated_at", endDateTime);

      if (error) {
        console.error("Error fetching annualized sales:", error);
        return 0;
      }

      return data?.reduce((sum, opp) => sum + (Number(opp.monthly_value) || 0) * 12, 0) || 0;
    }

    case "tasks": {
      // Count of completed tasks in the period
      const { count, error } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", assignedTo)
        .eq("status", "completed")
        .gte("completed_at", startDateTime)
        .lte("completed_at", endDateTime);

      if (error) {
        console.error("Error fetching tasks:", error);
        return 0;
      }

      return count || 0;
    }

    case "activities": {
      // Count of opportunity activities (proposals, presentations, etc.) in the period
      const { count, error } = await supabase
        .from("opportunity_activities")
        .select("*", { count: "exact", head: true })
        .eq("created_by", assignedTo)
        .gte("created_at", startDateTime)
        .lte("created_at", endDateTime);

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
          goal.end_date
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
      goal.end_date
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
