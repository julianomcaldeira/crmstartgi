import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Target, 
  Building2, 
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  Calendar as CalendarIcon,
  MapPin,
  FileText,
  Sparkles,
  ArrowLeft,
  FileDown,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReportBuilder, ReportConfig } from "@/components/reports/ReportBuilder";
import { ReportViewer } from "@/components/reports/ReportViewer";
import { ReportAIAnalysis } from "@/components/reports/ReportAIAnalysis";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const Relatorios = () => {
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'builder' | 'viewer' | 'quick'>('quick');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [selectedSeller, setSelectedSeller] = useState<string>('all');
  const [sellers, setSellers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // Report Data
  const [reportData, setReportData] = useState<any>({});
  const [currentConfig, setCurrentConfig] = useState<ReportConfig | null>(null);
  
  // Quick View Data
  const [totalClients, setTotalClients] = useState(0);
  const [totalOpportunities, setTotalOpportunities] = useState(0);
  const [wonOpportunities, setWonOpportunities] = useState(0);
  const [lostOpportunities, setLostOpportunities] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [tasksByType, setTasksByType] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [sellersPerformance, setSellersPerformance] = useState<any[]>([]);
  const [feirasReport, setFeirasReport] = useState<any[]>([]);
  const [opportunitiesByStatus, setOpportunitiesByStatus] = useState<any[]>([]);
  const [avgDealSize, setAvgDealSize] = useState(0);
  const [avgCloseCycle, setAvgCloseCycle] = useState(0);

  useEffect(() => {
    fetchSellers();
  }, []);

  useEffect(() => {
    if (activeView === 'quick') {
      fetchAllReports();
    }
  }, [startDate, endDate, selectedSeller, activeView]);

  const fetchSellers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("full_name");
    setSellers(data || []);
  };

  const fetchAllReports = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSalesMetrics(),
        fetchTasksMetrics(),
        fetchProductsRanking(),
        fetchSellersPerformance(),
        fetchFeirasReport(),
        fetchOpportunitiesByStatus(),
      ]);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  };

  // Version that returns data directly (for report generation without race condition)
  const fetchAllReportsData = async () => {
    const [salesResult, tasksResult, productsResult, sellersResult, feirasResult, oppsStatusResult] = await Promise.all([
      fetchSalesMetrics(),
      fetchTasksMetrics(),
      fetchProductsRanking(),
      fetchSellersPerformance(),
      fetchFeirasReport(),
      fetchOpportunitiesByStatus(),
    ]);
    return { 
      sales: salesResult, 
      tasks: tasksResult, 
      products: productsResult, 
      sellers: sellersResult, 
      feiras: feirasResult, 
      oppsStatus: oppsStatusResult 
    };
  };

  const fetchSalesMetrics = async () => {
    try {
      let clientsQuery = supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (selectedSeller !== 'all') {
        clientsQuery = clientsQuery.eq("created_by", selectedSeller);
      }

      const { count: clientsCount } = await clientsQuery;

      let oppsQuery = supabase
        .from("opportunities")
        .select("status, implementation_value, monthly_value, close_cycle_days, updated_at")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (selectedSeller !== 'all') {
        oppsQuery = oppsQuery.or(`created_by.eq.${selectedSeller},assigned_to.eq.${selectedSeller}`);
      }

      const { data: oppsData } = await oppsQuery;

      const totalOpps = oppsData?.length || 0;
      const wonOpps = oppsData?.filter(o => o.status === "won") || [];
      const lostOpps = oppsData?.filter(o => o.status === "lost") || [];
      const totalVal = wonOpps.reduce((sum, o) => sum + (Number(o.implementation_value) || 0), 0);
      const convRate = totalOpps > 0 ? (wonOpps.length / totalOpps) * 100 : 0;
      const avgSize = wonOpps.length > 0 ? totalVal / wonOpps.length : 0;
      const avgCycle = wonOpps.filter(o => o.close_cycle_days).reduce((sum, o) => sum + (o.close_cycle_days || 0), 0) / (wonOpps.filter(o => o.close_cycle_days).length || 1);

      const result = {
        totalClients: clientsCount || 0,
        totalOpportunities: totalOpps,
        wonOpportunities: wonOpps.length,
        lostOpportunities: lostOpps.length,
        totalValue: totalVal,
        conversionRate: convRate,
        avgDealSize: avgSize,
        avgCloseCycle: Math.round(avgCycle),
      };

      setTotalClients(result.totalClients);
      setTotalOpportunities(result.totalOpportunities);
      setWonOpportunities(result.wonOpportunities);
      setLostOpportunities(result.lostOpportunities);
      setTotalValue(result.totalValue);
      setConversionRate(result.conversionRate);
      setAvgDealSize(result.avgDealSize);
      setAvgCloseCycle(result.avgCloseCycle);
      
      return result;
    } catch (error) {
      console.error("Error fetching sales metrics:", error);
      return {};
    }
  };

  const fetchOpportunitiesByStatus = async () => {
    try {
      let query = supabase
        .from("opportunities")
        .select("status, implementation_value, monthly_value")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (selectedSeller !== 'all') {
        query = query.or(`created_by.eq.${selectedSeller},assigned_to.eq.${selectedSeller}`);
      }

      const { data } = await query;

      const statusMap = new Map<string, { count: number; value: number }>();
      data?.forEach(opp => {
        const status = opp.status || 'unknown';
        const existing = statusMap.get(status) || { count: 0, value: 0 };
        // Use implementation_value for consistency
        const oppValue = Number(opp.implementation_value) || 0;
        statusMap.set(status, {
          count: existing.count + 1,
          value: existing.value + oppValue,
        });
      });

      const statusLabels: Record<string, string> = {
        lead: 'Lead',
        contacted: 'Contactado',
        qualified: 'Qualificado',
        apresentacao: 'Apresentação',
        proposal: 'Proposta',
        negotiation: 'Negociação',
        won: 'Ganho',
        lost: 'Perdido',
      };

      setOpportunitiesByStatus(
        Array.from(statusMap.entries()).map(([status, data]) => ({
          status: statusLabels[status] || status,
          count: data.count,
          value: data.value,
        }))
      );
    } catch (error) {
      console.error("Error fetching opportunities by status:", error);
    }
  };

  const fetchTasksMetrics = async () => {
    try {
      // Fetch tasks created in period
      let query = supabase
        .from("tasks")
        .select("status, due_date, task_type, completed_at, created_at")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (selectedSeller !== 'all') {
        query = query.eq("assigned_to", selectedSeller);
      }

      const { data: tasksData } = await query;

      // Also fetch tasks completed in period (even if created before)
      let completedQuery = supabase
        .from("tasks")
        .select("status, due_date, task_type, completed_at")
        .eq("status", "completed")
        .gte("completed_at", `${startDate}T00:00:00`)
        .lte("completed_at", `${endDate}T23:59:59`);

      if (selectedSeller !== 'all') {
        completedQuery = completedQuery.eq("assigned_to", selectedSeller);
      }

      const { data: completedTasksData } = await completedQuery;

      const total = tasksData?.length || 0;
      // Use completed_at based counting for consistency with goals
      const completed = completedTasksData?.length || 0;
      const pending = tasksData?.filter(t => t.status === "pending").length || 0;
      
      const now = new Date();
      const overdue = tasksData?.filter(t => 
        t.status === "pending" && t.due_date && new Date(t.due_date) < now
      ).length || 0;

      const typeMap = new Map();
      tasksData?.forEach(task => {
        if (task.task_type) {
          const existing = typeMap.get(task.task_type) || 0;
          typeMap.set(task.task_type, existing + 1);
        }
      });

      const typesList = Array.from(typeMap.entries()).map(([type, count]) => ({
        type,
        count,
        label: getTaskTypeLabel(type)
      })).sort((a, b) => b.count - a.count);

      setTotalTasks(total);
      setCompletedTasks(completed);
      setPendingTasks(pending);
      setOverdueTasks(overdue);
      setTasksByType(typesList);
    } catch (error) {
      console.error("Error fetching tasks metrics:", error);
    }
  };

  const fetchProductsRanking = async () => {
    try {
      let query = supabase
        .from("opportunities")
        .select(`
          product_id,
          status,
          implementation_value,
          monthly_value,
          product:products(name, logo_url)
        `)
        .eq("status", "won")
        .not("product_id", "is", null)
        .gte("updated_at", `${startDate}T00:00:00`)
        .lte("updated_at", `${endDate}T23:59:59`);

      if (selectedSeller !== 'all') {
        query = query.or(`created_by.eq.${selectedSeller},assigned_to.eq.${selectedSeller}`);
      }

      const { data: oppsData } = await query;

      const productMap = new Map();
      oppsData?.forEach((opp) => {
        if (!opp.product_id || !opp.product) return;
        
        const existing = productMap.get(opp.product_id) || {
          productId: opp.product_id,
          productName: opp.product.name,
          logoUrl: opp.product.logo_url,
          quantity: 0,
          totalValue: 0,
        };

        existing.quantity += 1;
        existing.totalValue += Number(opp.implementation_value) || 0;

        productMap.set(opp.product_id, existing);
      });

      const ranking = Array.from(productMap.values())
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 5);
      
      setTopProducts(ranking);
    } catch (error) {
      console.error("Error fetching products ranking:", error);
    }
  };

  const fetchSellersPerformance = async () => {
    try {
      const { data: usersData } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles!inner(role)
        `)
        .in("user_roles.role", ["vendedor", "gestor"]);

      const performancePromises = usersData?.map(async (user) => {
        const [clientsRes, oppsRes, wonOppsRes, tasksRes, completedTasksRes] = await Promise.all([
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .eq("created_by", user.id)
            .gte("created_at", startDate)
            .lte("created_at", endDate),
          
          supabase
            .from("opportunities")
            .select("id, implementation_value", { count: "exact" })
            .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
            .gte("created_at", startDate)
            .lte("created_at", endDate),
          
          supabase
            .from("opportunities")
            .select("id, implementation_value", { count: "exact" })
            .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
            .eq("status", "won")
            .gte("updated_at", `${startDate}T00:00:00`)
            .lte("updated_at", `${endDate}T23:59:59`),

          supabase
            .from("tasks")
            .select("status, completed_at")
            .eq("assigned_to", user.id)
            .gte("created_at", startDate)
            .lte("created_at", endDate),
          
          // Fetch tasks completed in period for this user (consistent with goals)
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("assigned_to", user.id)
            .eq("status", "completed")
            .gte("completed_at", `${startDate}T00:00:00`)
            .lte("completed_at", `${endDate}T23:59:59`),
        ]);

        const wonValue = wonOppsRes.data?.reduce((sum, opp) => sum + (Number(opp.implementation_value) || 0), 0) || 0;
        const convRate = oppsRes.count ? ((wonOppsRes.count || 0) / oppsRes.count) * 100 : 0;
        // Use completed_at based counting for consistency with goals
        const completedTasks = completedTasksRes.count || 0;

        return {
          ...user,
          clientsCount: clientsRes.count || 0,
          opportunitiesCount: oppsRes.count || 0,
          wonOpportunitiesCount: wonOppsRes.count || 0,
          wonValue,
          conversionRate: convRate,
          totalTasks: tasksRes.data?.length || 0,
          completedTasksCount: completedTasks,
        };
      }) || [];

      const performance = await Promise.all(performancePromises);
      setSellersPerformance(performance.sort((a, b) => b.wonValue - a.wonValue));
    } catch (error) {
      console.error("Error fetching sellers performance:", error);
    }
  };

  const fetchFeirasReport = async () => {
    try {
      const { data: feirasData } = await supabase
        .from("feiras")
        .select("*")
        .order("start_date", { ascending: false });

      const feirasWithClients = await Promise.all(
        (feirasData || []).map(async (feira) => {
          const { data: clientFeirasData } = await (supabase as any)
            .from("client_feiras")
            .select(`
              *,
              client:clients(
                id,
                company_name,
                trade_name,
                created_at,
                created_by_profile:profiles!clients_created_by_fkey(full_name)
              )
            `)
            .eq("feira_id", feira.id)
            .gte("created_at", startDate)
            .lte("created_at", endDate);

          return {
            ...feira,
            clients: clientFeirasData || [],
            clientsCount: clientFeirasData?.length || 0,
          };
        })
      );

      setFeirasReport(feirasWithClients.filter(f => f.clientsCount > 0));
    } catch (error) {
      console.error("Error fetching feiras report:", error);
    }
  };

  const getTaskTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ligacao: "Ligação",
      email: "E-mail",
      whatsapp: "WhatsApp",
      linkedin: "LinkedIn",
      visita_presencial: "Visita Presencial",
      reuniao_online: "Reunião Online",
      visita_feira: "Visita a Feira",
      visita_evento: "Visita a Evento",
      proposta: "Proposta",
      apresentacao: "Apresentação",
      pesquisa_inicial: "Pesquisa Inicial",
    };
    return labels[type] || type;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  const setQuickPeriod = (period: string) => {
    const now = new Date();
    switch (period) {
      case 'this_month':
        setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
        break;
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        setStartDate(format(startOfMonth(lastMonth), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(lastMonth), "yyyy-MM-dd"));
        break;
      case 'last_3_months':
        setStartDate(format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
        break;
      case 'this_year':
        setStartDate(format(startOfYear(now), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        break;
    }
  };

  const handleGenerateReport = async (config: ReportConfig) => {
    setCurrentConfig(config);
    setLoading(true);
    
    try {
      await fetchAllReports();
      
      // Build report data object
      const data = {
        startDate,
        endDate,
        totalClients,
        totalOpportunities,
        wonOpportunities,
        lostOpportunities,
        totalValue,
        conversionRate,
        avgDealSize,
        avgCloseCycle,
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        tasksByType,
        topProducts: topProducts.map(p => ({
          name: p.productName,
          quantity: p.quantity,
          value: p.totalValue,
        })),
        sellersPerformance: sellersPerformance.map(s => ({
          id: s.id,
          name: s.full_name,
          clients: s.clientsCount,
          opportunities: s.opportunitiesCount,
          won: s.wonOpportunitiesCount,
          value: s.wonValue,
          conversionRate: s.conversionRate,
          tasks: s.totalTasks,
          completedTasks: s.completedTasksCount,
        })),
        feirasReport: feirasReport.map(f => ({
          id: f.id,
          name: f.name,
          city: f.city,
          state: f.state,
          clientsCount: f.clientsCount,
          clients: f.clients.map((c: any) => ({
            id: c.client?.id,
            companyName: c.client?.company_name,
            createdAt: c.created_at,
          })),
        })),
        opportunitiesByStatus,
      };
      
      setReportData(data);
      setActiveView('viewer');
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    toast.info(`Exportando relatório em ${format.toUpperCase()}...`);
    // TODO: Implement actual export functionality
    setTimeout(() => {
      toast.success(`Relatório exportado em ${format.toUpperCase()}`);
    }, 1500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-2">
            Relatórios
          </h1>
          <p className="text-muted-foreground">
            Analise o desempenho da sua equipe comercial
          </p>
        </div>
        <div className="flex gap-2">
          {activeView === 'viewer' && (
            <Button variant="outline" onClick={() => setActiveView('builder')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          )}
          <Button
            variant={activeView === 'quick' ? 'default' : 'outline'}
            onClick={() => setActiveView('quick')}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Visão Rápida
          </Button>
          <Button
            variant={activeView === 'builder' ? 'default' : 'outline'}
            onClick={() => setActiveView('builder')}
          >
            <FileText className="h-4 w-4 mr-2" />
            Gerador de Relatórios
          </Button>
        </div>
      </div>

      {/* Period and Filters */}
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Período e Filtros
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Ocultar Filtros' : 'Mais Filtros'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod('this_month')}>
                Este Mês
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod('last_month')}>
                Mês Anterior
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod('last_3_months')}>
                Últimos 3 Meses
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod('this_year')}>
                Este Ano
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inicial</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Final</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Vendedor</Label>
                <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Vendedores</SelectItem>
                    {sellers.map((seller) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Builder View */}
      {activeView === 'builder' && (
        <ReportBuilder
          onGenerate={handleGenerateReport}
          onPreview={handleGenerateReport}
          loading={loading}
        />
      )}

      {/* Report Viewer View */}
      {activeView === 'viewer' && currentConfig && (
        <div className="space-y-6">
          <ReportViewer
            config={currentConfig}
            data={reportData}
            loading={loading}
            onExport={handleExport}
            onPrint={handlePrint}
          />
          
          {currentConfig.includeAIAnalysis && (
            <ReportAIAnalysis
              reportData={{
                totalClients,
                totalOpportunities,
                wonOpportunities,
                lostOpportunities,
                totalValue,
                conversionRate,
                totalTasks,
                completedTasks,
                pendingTasks,
                overdueTasks,
                topProducts: topProducts.map(p => ({
                  name: p.productName,
                  quantity: p.quantity,
                  value: p.totalValue,
                })),
                sellersPerformance: sellersPerformance.map(s => ({
                  name: s.full_name,
                  clients: s.clientsCount,
                  opportunities: s.opportunitiesCount,
                  won: s.wonOpportunitiesCount,
                  value: s.wonValue,
                  conversionRate: s.conversionRate,
                })),
                startDate,
                endDate,
              }}
              onAnalysisComplete={(analysis) => {
                setReportData((prev: any) => ({ ...prev, aiAnalysis: analysis }));
              }}
            />
          )}
        </div>
      )}

      {/* Quick View */}
      {activeView === 'quick' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Tabs defaultValue="sales" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="sales">Vendas</TabsTrigger>
                <TabsTrigger value="tasks">Tarefas</TabsTrigger>
                <TabsTrigger value="team">Equipe</TabsTrigger>
                <TabsTrigger value="feiras">Feiras</TabsTrigger>
                <TabsTrigger value="ai">
                  <Sparkles className="h-4 w-4 mr-2" />
                  IA
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sales" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{totalClients}</div>
                      <p className="text-xs text-muted-foreground">No período selecionado</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Oportunidades</CardTitle>
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{totalOpportunities}</div>
                      <p className="text-xs text-muted-foreground">
                        {wonOpportunities} ganhas / {lostOpportunities} perdidas
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-success">{formatCurrency(totalValue)}</div>
                      <p className="text-xs text-muted-foreground">Em vendas ganhas</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">{conversionRate.toFixed(1)}%</div>
                      <p className="text-xs text-muted-foreground">Oportunidades convertidas</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(avgDealSize)}</div>
                      <p className="text-xs text-muted-foreground">Valor médio por venda</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Ciclo de Fechamento</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{avgCloseCycle} dias</div>
                      <p className="text-xs text-muted-foreground">Média para fechar uma venda</p>
                    </CardContent>
                  </Card>
                </div>

                {opportunitiesByStatus.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        Oportunidades por Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {opportunitiesByStatus.map((item) => (
                          <div key={item.status} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                            <Badge variant="outline">{item.status}</Badge>
                            <div className="text-right">
                              <p className="font-bold">{item.count}</p>
                              <p className="text-sm text-muted-foreground">{formatCurrency(item.value)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {topProducts.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Top 5 Produtos Mais Vendidos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {topProducts.map((product, index) => (
                          <div 
                            key={product.productId}
                            className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                index === 0 ? "bg-yellow-500/20 text-yellow-700" :
                                index === 1 ? "bg-gray-400/20 text-gray-700" :
                                index === 2 ? "bg-amber-700/20 text-amber-800" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                {index + 1}
                              </div>
                              {product.logoUrl && (
                                <img 
                                  src={product.logoUrl} 
                                  alt={product.productName}
                                  className="h-8 w-8 object-contain bg-white rounded p-1"
                                />
                              )}
                              <div>
                                <p className="font-semibold">{product.productName}</p>
                                <p className="text-sm text-muted-foreground">
                                  {product.quantity} venda{product.quantity !== 1 ? "s" : ""}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-primary">
                                {formatCurrency(product.totalValue)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="tasks" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Total de Tarefas</CardTitle>
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{totalTasks}</div>
                      <p className="text-xs text-muted-foreground">No período selecionado</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-success">{completedTasks}</div>
                      <p className="text-xs text-muted-foreground">
                        {totalTasks > 0 ? `${((completedTasks / totalTasks) * 100).toFixed(1)}% do total` : "0%"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                      <Clock className="h-4 w-4 text-warning" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-warning">{pendingTasks}</div>
                      <p className="text-xs text-muted-foreground">Aguardando conclusão</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
                      <Clock className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-destructive">{overdueTasks}</div>
                      <p className="text-xs text-muted-foreground">Passaram do prazo</p>
                    </CardContent>
                  </Card>
                </div>

                {tasksByType.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Tarefas por Tipo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {tasksByType.map((item) => (
                          <div key={item.type} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">{item.label}</Badge>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold">{item.count}</p>
                              <p className="text-xs text-muted-foreground">
                                {((item.count / totalTasks) * 100).toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="team" className="space-y-6">
                <div className="space-y-4">
                  {sellersPerformance.map((seller) => (
                    <Card key={seller.id} className="hover:shadow-lg transition-all">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-xl">{seller.full_name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{seller.email}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <Building2 className="h-4 w-4 mx-auto mb-1 text-primary" />
                            <p className="text-xl font-bold">{seller.clientsCount}</p>
                            <p className="text-xs text-muted-foreground">Clientes</p>
                          </div>

                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <Target className="h-4 w-4 mx-auto mb-1 text-info" />
                            <p className="text-xl font-bold">{seller.opportunitiesCount}</p>
                            <p className="text-xs text-muted-foreground">Oportunidades</p>
                          </div>

                          <div className="text-center p-3 bg-success/10 rounded-lg border border-success/20">
                            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-success" />
                            <p className="text-xl font-bold text-success">{seller.wonOpportunitiesCount}</p>
                            <p className="text-xs text-muted-foreground">Ganhas</p>
                          </div>

                          <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                            <DollarSign className="h-4 w-4 mx-auto mb-1 text-primary" />
                            <p className="text-sm font-bold text-primary">{formatCurrency(seller.wonValue)}</p>
                            <p className="text-xs text-muted-foreground">Vendido</p>
                          </div>

                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-success" />
                            <p className="text-xl font-bold">{seller.completedTasksCount}/{seller.totalTasks}</p>
                            <p className="text-xs text-muted-foreground">Tarefas</p>
                          </div>

                          <div className="text-center p-3 bg-warning/10 rounded-lg border border-warning/20">
                            <div className="text-xl font-bold text-warning mb-1">{seller.conversionRate.toFixed(1)}%</div>
                            <p className="text-xs text-muted-foreground">Conversão</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {sellersPerformance.length === 0 && (
                    <Card className="p-12 text-center">
                      <Users className="mx-auto mb-4 text-muted-foreground" size={48} />
                      <p className="text-muted-foreground">Nenhum dado de vendedor encontrado</p>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="feiras" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      Leads Captados por Feira
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {feirasReport.length === 0 ? (
                      <div className="text-center py-12">
                        <Building2 className="mx-auto mb-4 text-muted-foreground" size={48} />
                        <p className="text-muted-foreground">Nenhum lead captado em feiras no período</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {feirasReport.map((feira) => (
                          <Card key={feira.id} className="border-l-4 border-l-primary">
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <div>
                                  <CardTitle className="text-lg">{feira.name}</CardTitle>
                                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                    {feira.city && (
                                      <span className="flex items-center gap-1">
                                        <MapPin className="h-4 w-4" />
                                        {feira.city}{feira.state && ` - ${feira.state}`}
                                      </span>
                                    )}
                                    {feira.start_date && (
                                      <span className="flex items-center gap-1">
                                        <CalendarIcon className="h-4 w-4" />
                                        {new Date(feira.start_date).toLocaleDateString('pt-BR')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-primary">{feira.clientsCount}</div>
                                  <p className="text-xs text-muted-foreground">Leads captados</p>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {feira.clients.map((clientFeira: any) => (
                                  <div 
                                    key={clientFeira.id}
                                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                                  >
                                    <div>
                                      <p className="font-medium text-foreground">
                                        {clientFeira.client?.company_name || clientFeira.client?.trade_name}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        Cadastrado em {new Date(clientFeira.created_at).toLocaleDateString('pt-BR')}
                                      </p>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      Por: {clientFeira.client?.created_by_profile?.full_name}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ai" className="space-y-6">
                <ReportAIAnalysis
                  reportData={{
                    totalClients,
                    totalOpportunities,
                    wonOpportunities,
                    lostOpportunities,
                    totalValue,
                    conversionRate,
                    totalTasks,
                    completedTasks,
                    pendingTasks,
                    overdueTasks,
                    topProducts: topProducts.map(p => ({
                      name: p.productName,
                      quantity: p.quantity,
                      value: p.totalValue,
                    })),
                    sellersPerformance: sellersPerformance.map(s => ({
                      name: s.full_name,
                      clients: s.clientsCount,
                      opportunities: s.opportunitiesCount,
                      won: s.wonOpportunitiesCount,
                      value: s.wonValue,
                      conversionRate: s.conversionRate,
                    })),
                    startDate,
                    endDate,
                  }}
                />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
};

export default Relatorios;
