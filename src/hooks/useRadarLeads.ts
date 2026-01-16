import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 50;

export type SortColumn = "company_name" | "cnpj" | "city" | "created_at";
export type SortDirection = "asc" | "desc";

export function useRadarLeads(
  sourceFilter: string = "all",
  statusFilter: string = "all",
  searchTerm: string = "",
  page: number = 1,
  sortColumn: SortColumn = "created_at",
  sortDirection: SortDirection = "desc",
  stateFilter: string = "all",
  cityFilter: string = "all"
) {
  return useQuery({
    queryKey: ["radar-leads", sourceFilter, statusFilter, searchTerm, page, sortColumn, sortDirection, stateFilter, cityFilter],
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
      if (stateFilter !== "all") {
        countQuery = countQuery.eq("state", stateFilter);
      }
      if (cityFilter !== "all") {
        countQuery = countQuery.eq("city", cityFilter);
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
        .order(sortColumn, { ascending: sortDirection === "asc" })
        .range(from, to);

      if (sourceFilter !== "all") {
        dataQuery = dataQuery.eq("source", sourceFilter);
      }
      if (statusFilter !== "all") {
        dataQuery = dataQuery.eq("status", statusFilter);
      }
      if (stateFilter !== "all") {
        dataQuery = dataQuery.eq("state", stateFilter);
      }
      if (cityFilter !== "all") {
        dataQuery = dataQuery.eq("city", cityFilter);
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

      // Estados únicos
      const { data: statesData } = await supabase
        .from("radar_leads")
        .select("state")
        .not("state", "is", null);

      const uniqueStates = [...new Set(statesData?.map(s => s.state) || [])].sort();

      // Cidades únicas
      const { data: citiesData } = await supabase
        .from("radar_leads")
        .select("city")
        .not("city", "is", null);

      const uniqueCities = [...new Set(citiesData?.map(s => s.city) || [])].sort();

      return {
        totalCount: totalCount || 0,
        newCount: newCount || 0,
        uniqueSources,
        uniqueStates,
        uniqueCities,
      };
    },
    staleTime: 30000,
    gcTime: 60000,
  });
}

// Hook para buscar cidades por estado
export function useRadarLeadsCities(stateFilter: string) {
  return useQuery({
    queryKey: ["radar-leads-cities", stateFilter],
    queryFn: async () => {
      if (stateFilter === "all") {
        const { data } = await supabase
          .from("radar_leads")
          .select("city")
          .not("city", "is", null);

        return [...new Set(data?.map(s => s.city) || [])].sort();
      }

      const { data } = await supabase
        .from("radar_leads")
        .select("city")
        .eq("state", stateFilter)
        .not("city", "is", null);

      return [...new Set(data?.map(s => s.city) || [])].sort();
    },
    staleTime: 30000,
    gcTime: 60000,
  });
}
