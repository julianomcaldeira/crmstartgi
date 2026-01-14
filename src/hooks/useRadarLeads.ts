import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRadarLeads(
  sourceFilter: string = "all",
  statusFilter: string = "all",
  searchTerm: string = ""
) {
  return useQuery({
    queryKey: ["radar-leads", sourceFilter, statusFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("radar_leads")
        .select(`
          *,
          assigned_user:profiles!radar_leads_assigned_to_fkey(full_name)
        `)
        .order("created_at", { ascending: false });

      if (sourceFilter !== "all") {
        query = query.eq("source", sourceFilter);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (searchTerm) {
        query = query.or(`company_name.ilike.%${searchTerm}%,cnpj.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    staleTime: 30000, // 30 segundos
    gcTime: 60000, // 1 minuto
  });
}