import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  Target,
  DollarSign,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  Package,
  MapPin,
  FileDown,
  Printer,
  Share2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PieChart,
  AlertTriangle,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ReportConfig } from "./ReportBuilder";

interface ReportData {
  // Sales
  totalClients?: number;
  totalOpportunities?: number;
  wonOpportunities?: number;
  lostOpportunities?: number;
  totalValue?: number;
  conversionRate?: number;
  avgDealSize?: number;
  avgCloseCycle?: number;
  
  // Tasks
  totalTasks?: number;
  completedTasks?: number;
  pendingTasks?: number;
  overdueTasks?: number;
  tasksByType?: Array<{ type: string; label: string; count: number }>;
  
  // Products
  topProducts?: Array<{ name: string; quantity: number; value: number }>;
  
  // Team
  sellersPerformance?: Array<{
    id: string;
    name: string;
    clients: number;
    opportunities: number;
    won: number;
    value: number;
    conversionRate: number;
    tasks: number;
    completedTasks: number;
  }>;
  
  // Feiras
  feirasReport?: Array<{
    id: string;
    name: string;
    city?: string;
    state?: string;
    clientsCount: number;
    clients: Array<{ id: string; companyName: string; createdAt: string }>;
  }>;
  
  // Opportunities by status
  opportunitiesByStatus?: Array<{ status: string; count: number; value: number }>;
  
  // Clients by segment
  clientsBySegment?: Array<{ segment: string; count: number }>;
  clientsByRegion?: Array<{ region: string; count: number }>;
  
  // AI Analysis
  aiAnalysis?: string;
  
  // Period
  startDate?: string;
  endDate?: string;
}

interface ReportViewerProps {
  config: ReportConfig;
  data: ReportData;
  loading?: boolean;
  onExport?: (format: 'pdf' | 'excel' | 'csv') => void;
  onPrint?: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR');
};

export function ReportViewer({ config, data, loading, onExport, onPrint }: ReportViewerProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sales: true,
    tasks: true,
    team: true,
    products: true,
    opportunities: true,
    clients: true,
    feiras: true,
    ai: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Gerando relatório...</p>
        </div>
      </div>
    );
  }

  const showSection = (sectionId: string) => {
    return config.sections.includes(sectionId) || config.type === 'completo';
  };

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg">
        <div>
          <h2 className="text-xl font-bold">Relatório Gerado</h2>
          <p className="text-sm text-muted-foreground">
            Período: {data.startDate && formatDate(data.startDate)} até {data.endDate && formatDate(data.endDate)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onPrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport?.('excel')}>
            <FileDown className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport?.('pdf')}>
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-350px)]">
        <div className="space-y-6 pr-4">
          {/* Sales KPIs Section */}
          {(showSection('kpis_vendas') || showSection('funil_vendas') || showSection('tendencias')) && (
            <Collapsible open={expandedSections.sales} onOpenChange={() => toggleSection('sales')}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Métricas de Vendas
                      </CardTitle>
                      {expandedSections.sales ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Clientes</span>
                        </div>
                        <p className="text-2xl font-bold">{data.totalClients || 0}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Oportunidades</span>
                        </div>
                        <p className="text-2xl font-bold">{data.totalOpportunities || 0}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {data.wonOpportunities || 0} ganhas / {data.lostOpportunities || 0} perdidas
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4 text-success" />
                          <span className="text-sm text-muted-foreground">Valor Total</span>
                        </div>
                        <p className="text-2xl font-bold text-success">{formatCurrency(data.totalValue || 0)}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <span className="text-sm text-muted-foreground">Conversão</span>
                        </div>
                        <p className="text-2xl font-bold text-primary">{(data.conversionRate || 0).toFixed(1)}%</p>
                      </div>
                    </div>

                    {data.avgDealSize !== undefined && (
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="p-4 rounded-lg border">
                          <p className="text-sm text-muted-foreground">Ticket Médio</p>
                          <p className="text-xl font-bold">{formatCurrency(data.avgDealSize)}</p>
                        </div>
                        <div className="p-4 rounded-lg border">
                          <p className="text-sm text-muted-foreground">Ciclo Médio de Fechamento</p>
                          <p className="text-xl font-bold">{data.avgCloseCycle || 0} dias</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Opportunities by Status */}
          {showSection('oportunidades_status') && data.opportunitiesByStatus && (
            <Collapsible open={expandedSections.opportunities} onOpenChange={() => toggleSection('opportunities')}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-primary" />
                        Oportunidades por Status
                      </CardTitle>
                      {expandedSections.opportunities ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-3">
                      {data.opportunitiesByStatus.map((item) => (
                        <div key={item.status} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="capitalize">{item.status}</Badge>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{item.count}</p>
                            <p className="text-sm text-muted-foreground">{formatCurrency(item.value)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Tasks Section */}
          {(showSection('kpis_tarefas') || showSection('tarefas_tipo') || showSection('tarefas_atrasadas')) && (
            <Collapsible open={expandedSections.tasks} onOpenChange={() => toggleSection('tasks')}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        Métricas de Tarefas
                      </CardTitle>
                      {expandedSections.tasks ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground mb-1">Total</p>
                        <p className="text-2xl font-bold">{data.totalTasks || 0}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                        <p className="text-sm text-muted-foreground mb-1">Concluídas</p>
                        <p className="text-2xl font-bold text-success">{data.completedTasks || 0}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                        <p className="text-sm text-muted-foreground mb-1">Pendentes</p>
                        <p className="text-2xl font-bold text-warning">{data.pendingTasks || 0}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-sm text-muted-foreground mb-1">Atrasadas</p>
                        <p className="text-2xl font-bold text-destructive">{data.overdueTasks || 0}</p>
                      </div>
                    </div>

                    {data.tasksByType && data.tasksByType.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-muted-foreground">Por Tipo</h4>
                        {data.tasksByType.map((item) => (
                          <div key={item.type} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{item.label}</span>
                              <span className="font-medium">{item.count}</span>
                            </div>
                            <Progress value={(item.count / (data.totalTasks || 1)) * 100} className="h-2" />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Top Products Section */}
          {showSection('top_produtos') && data.topProducts && data.topProducts.length > 0 && (
            <Collapsible open={expandedSections.products} onOpenChange={() => toggleSection('products')}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Top Produtos
                      </CardTitle>
                      {expandedSections.products ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-3">
                      {data.topProducts.map((product, index) => (
                        <div key={product.name} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                          <div className="flex items-center gap-4">
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                              index === 0 ? "bg-yellow-500/20 text-yellow-700" :
                              index === 1 ? "bg-gray-400/20 text-gray-700" :
                              index === 2 ? "bg-amber-700/20 text-amber-800" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-semibold">{product.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {product.quantity} venda{product.quantity !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                          <p className="text-lg font-bold text-primary">{formatCurrency(product.value)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Team Performance Section */}
          {(showSection('ranking_equipe') || showSection('performance_individual')) && data.sellersPerformance && (
            <Collapsible open={expandedSections.team} onOpenChange={() => toggleSection('team')}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Performance da Equipe
                      </CardTitle>
                      {expandedSections.team ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-4">
                      {data.sellersPerformance.map((seller, index) => (
                        <div key={seller.id} className="p-4 rounded-lg border bg-muted/30">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                index === 0 ? "bg-yellow-500/20 text-yellow-700" :
                                index === 1 ? "bg-gray-400/20 text-gray-700" :
                                index === 2 ? "bg-amber-700/20 text-amber-800" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-semibold">{seller.name}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-primary">
                              {seller.conversionRate.toFixed(1)}% conversão
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                            <div className="p-2 bg-background rounded">
                              <p className="text-lg font-bold">{seller.clients}</p>
                              <p className="text-xs text-muted-foreground">Clientes</p>
                            </div>
                            <div className="p-2 bg-background rounded">
                              <p className="text-lg font-bold">{seller.opportunities}</p>
                              <p className="text-xs text-muted-foreground">Oportunidades</p>
                            </div>
                            <div className="p-2 bg-background rounded">
                              <p className="text-lg font-bold text-success">{seller.won}</p>
                              <p className="text-xs text-muted-foreground">Ganhas</p>
                            </div>
                            <div className="p-2 bg-background rounded">
                              <p className="text-sm font-bold text-primary">{formatCurrency(seller.value)}</p>
                              <p className="text-xs text-muted-foreground">Vendido</p>
                            </div>
                            <div className="p-2 bg-background rounded">
                              <p className="text-lg font-bold">{seller.completedTasks}/{seller.tasks}</p>
                              <p className="text-xs text-muted-foreground">Tarefas</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Feiras Section */}
          {(showSection('leads_feira') || showSection('visitas_feira')) && data.feirasReport && data.feirasReport.length > 0 && (
            <Collapsible open={expandedSections.feiras} onOpenChange={() => toggleSection('feiras')}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        Leads por Feira
                      </CardTitle>
                      {expandedSections.feiras ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-4">
                      {data.feirasReport.map((feira) => (
                        <div key={feira.id} className="p-4 rounded-lg border-l-4 border-l-primary bg-muted/30">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-semibold">{feira.name}</p>
                              {feira.city && (
                                <p className="text-sm text-muted-foreground">
                                  {feira.city}{feira.state && ` - ${feira.state}`}
                                </p>
                              )}
                            </div>
                            <Badge className="bg-primary/10 text-primary border-primary/20">
                              {feira.clientsCount} leads
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {feira.clients.slice(0, 5).map((client) => (
                              <div key={client.id} className="flex items-center justify-between text-sm p-2 bg-background rounded">
                                <span>{client.companyName}</span>
                                <span className="text-muted-foreground">{formatDate(client.createdAt)}</span>
                              </div>
                            ))}
                            {feira.clients.length > 5 && (
                              <p className="text-sm text-muted-foreground text-center">
                                + {feira.clients.length - 5} mais...
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* AI Analysis Section */}
          {config.includeAIAnalysis && data.aiAnalysis && (
            <Collapsible open={expandedSections.ai} onOpenChange={() => toggleSection('ai')}>
              <Card className="border-2 border-primary/20">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors bg-gradient-to-r from-primary/10 to-primary/5">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Análise Inteligente (IA)
                      </CardTitle>
                      {expandedSections.ai ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {data.aiAnalysis}
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
