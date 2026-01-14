import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 50;

export function useRadarLeads(
  sourceFilter: string = "all",
  statusFilter: string = "all",
  searchTerm: string = "",
  page: number = 1
) {
  return useQuery({
    queryKey: ["radar-leads", sourceFilter, statusFilter, searchTerm, page],
    queryFn: async () => {
      // Build base query for counting
      let countQuery = supabase
        .from("radar_leads")
        .select("*", { count: "exact", head: true });

      if (sourceFilter !== "all") {
        countQuery = countQuery.eq("source", sourceFilter);
      }
      if (statusFilter !== "all") {
        countQuery = countQuery.eq("status", statusFilter);
      }
      if (searchTerm) {
        countQuery = countQuery.or(`company_name.ilike.%${searchTerm}%,cnpj.ilike.%${searchTerm}%`);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      // Build query for data with pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let dataQuery = supabase
        .from("radar_leads")
        .select(`
          *,
          assigned_user:profiles!radar_leads_assigned_to_fkey(full_name)
        `)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (sourceFilter !== "all") {
        dataQuery = dataQuery.eq("source", sourceFilter);
      }
      if (statusFilter !== "all") {
        dataQuery = dataQuery.eq("status", statusFilter);
      }
      if (searchTerm) {
        dataQuery = dataQuery.or(`company_name.ilike.%${searchTerm}%,cnpj.ilike.%${searchTerm}%`);
      }

      const { data, error } = await dataQuery;
      if (error) throw error;

      return {
        leads: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / PAGE_SIZE),
        currentPage: page,
        pageSize: PAGE_SIZE,
      };
    },
    staleTime: 30000,
    gcTime: 60000,
  });
}

// Hook separado para estatísticas globais (sem filtros de página)
export function useRadarLeadsStats() {
  return useQuery({
    queryKey: ["radar-leads-stats"],
    queryFn: async () => {
      // Total count
      const { count: totalCount } = await supabase
        .from("radar_leads")
        .select("*", { count: "exact", head: true });

      // Count por status "novo"
      const { count: newCount } = await supabase
        .from("radar_leads")
        .select("*", { count: "exact", head: true })
        .eq("status", "novo");

      // Sources únicas
      const { data: sourcesData } = await supabase
        .from("radar_leads")
        .select("source")
        .not("source", "is", null);

      const uniqueSources = [...new Set(sourcesData?.map(s => s.source) || [])];

      return {
        totalCount: totalCount || 0,
        newCount: newCount || 0,
        uniqueSources,
      };
    },
    staleTime: 30000,
    gcTime: 60000,
  });
}
