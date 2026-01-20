import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

export const useUserRole = (userId: string | null) => {
  return useQuery({
    queryKey: ["userRole", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();
      return data?.role || "vendedor";
    },
    enabled: !!userId,
  });
};

export const useTasks = (userId: string | null, userRole: string | null) => {
  return useQuery({
    queryKey: ["tasks", userId, userRole],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(`
          *,
          clients(company_name, trade_name),
          contacts(name, email, phone),
          opportunities(title)
        `)
        .order("due_date", { ascending: false });

      if (userRole === "vendedor" && userId) {
        query = query.or(`assigned_to.eq.${userId},created_by.eq.${userId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !!userRole,
  });
};

export const useTodayTasks = (userId: string | null, userRole: string | null) => {
  return useQuery({
    queryKey: ["todayTasks", userId, userRole],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      
      let query = supabase
        .from("tasks")
        .select(`
          *,
          clients(company_name),
          contacts(name)
        `)
        .eq("status", "pending")
        .gte("due_date", `${today}T00:00:00`)
        .lte("due_date", `${today}T23:59:59`)
        .order("due_date");

      if (userRole === "vendedor" && userId) {
        query = query.eq("assigned_to", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !!userRole,
  });
};

export const useOpportunities = (userId: string | null, userRole: string | null) => {
  return useQuery({
    queryKey: ["opportunities", userId, userRole],
    queryFn: async () => {
      let query = supabase
        .from("opportunities")
        .select(`
          *,
          clients(id, company_name, trade_name, cnpj),
          products(name, description),
          assigned_user:profiles!opportunities_assigned_to_fkey(full_name)
        `)
        .order("created_at", { ascending: false });

      if (userRole === "vendedor" && userId) {
        query = query.or(`assigned_to.eq.${userId},created_by.eq.${userId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !!userRole,
  });
};

export const useClients = () => {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(`
          *,
          contacts(*),
          created_by_profile:profiles!clients_created_by_fkey(full_name, email),
          client_feiras(feira_id)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useProspects = () => {
  return useQuery({
    queryKey: ["prospects"],
    queryFn: async () => {
      const pageSize = 1000;
      let from = 0;
      let allProspects: any[] = [];

      while (true) {
        const { data, error } = await supabase
          .from("clients")
          .select(`
          *,
          contacts(*),
          created_by_profile:profiles!clients_created_by_fkey(full_name, email),
          client_feiras(feira_id)
        `)
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) {
          console.error("Error fetching prospects page:", error);
          throw error;
        }

        if (!data || data.length === 0) {
          break;
        }

        allProspects = allProspects.concat(data);

        if (data.length < pageSize) {
          break;
        }

        from += pageSize;
      }

      return allProspects;
    },
  });
};

export const useProducts = () => {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });
};

export const useUsers = () => {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or("is_deleted.is.null,is_deleted.eq.false")
        .order("full_name");

      if (error) throw error;
      return data || [];
    },
  });
};

export const useGoals = (userId: string | null, userRole: string | null, selectedPeriod: string) => {
  return useQuery({
    queryKey: ["goals", userId, userRole, selectedPeriod],
    queryFn: async () => {
      const [year, month] = selectedPeriod.split("-");
      const startDate = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      const endDate = endOfMonth(startDate);

      let query = supabase
        .from("goals")
        .select("*, assigned_user:profiles!goals_assigned_to_fkey(full_name)")
        .lte("start_date", format(endDate, "yyyy-MM-dd"))
        .gte("end_date", format(startDate, "yyyy-MM-dd"));

      if (userRole === "vendedor" && userId) {
        query = query.eq("assigned_to", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !!userRole && !!selectedPeriod,
  });
};

export const useFeiras = () => {
  return useQuery({
    queryKey: ["feiras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feiras")
        .select("*")
        .order("start_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useContacts = (clientId?: string) => {
  return useQuery({
    queryKey: ["contacts", clientId],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select("*")
        .order("name");

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
};
