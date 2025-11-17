import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, DollarSign, Calendar, TrendingDown, Activity } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, addDays, startOfMonth, endOfMonth, subMonths, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const PrevisaoVendas = () => {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<30 | 60 | 90>(30);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("opportunities")
        .select(`
          *,
          client:clients(company_name, trade_name),
          assigned:profiles!opportunities_assigned_to_fkey(full_name),
          product:products(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOpportunities(data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calcula receita ponderada baseada em probabilidade
  const calculateWeightedRevenue = (opps: any[]) => {
    return opps.reduce((sum, opp) => {
      if (opp.status === "won" || opp.status === "lost") return sum;
      const value = Number(opp.value) || 0;
      const probability = Number(opp.probability) || 0;
      return sum + (value * probability / 100);
    }, 0);
  };

  // Calcula receita real (oportunidades ganhas)
  const calculateRealRevenue = (opps: any[]) => {
    return opps
      .filter(opp => opp.status === "won")
      .reduce((sum, opp) => sum + (Number(opp.value) || 0), 0);
  };

  // Projeção para os próximos dias baseado em expected_close_date
  const calculateProjection = (days: number) => {
    const today = new Date();
    const targetDate = addDays(today, days);
    
    const projectedOpps = opportunities.filter(opp => {
      if (opp.status === "won" || opp.status === "lost" || !opp.expected_close_date) return false;
      const closeDate = new Date(opp.expected_close_date);
      return closeDate <= targetDate;
    });

    return calculateWeightedRevenue(projectedOpps);
  };

  // Análise mês a mês dos últimos 6 meses
  const getMonthlyComparison = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthOpps = opportunities.filter(opp => {
        if (opp.status !== "won") return false;
        const oppDate = new Date(opp.created_at);
        return oppDate >= monthStart && oppDate <= monthEnd;
      });

      const revenue = calculateRealRevenue(monthOpps);
      
      months.push({
        month: format(monthDate, "MMM/yy", { locale: ptBR }),
        revenue: revenue,
        count: monthOpps.length,
      });
    }
    return months;
  };

  // Evolução da taxa de conversão
  const getConversionTrend = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthOpps = opportunities.filter(opp => {
        const oppDate = new Date(opp.created_at);
        return oppDate >= monthStart && oppDate <= monthEnd;
      });

      const won = monthOpps.filter(opp => opp.status === "won").length;
      const total = monthOpps.length;
      const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;

      months.push({
        month: format(monthDate, "MMM/yy", { locale: ptBR }),
        conversionRate,
        won,
        total,
      });
    }
    return months;
  };

  // Pipeline velocity - tempo médio de fechamento
  const getPipelineVelocity = () => {
    const wonOpps = opportunities.filter(opp => opp.status === "won");
    
    if (wonOpps.length === 0) return 0;

    const totalDays = wonOpps.reduce((sum, opp) => {
      const created = new Date(opp.created_at);
      const now = new Date();
      return sum + differenceInDays(now, created);
    }, 0);

    return Math.round(totalDays / wonOpps.length);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const monthlyData = getMonthlyComparison();
  const conversionData = getConversionTrend();
  const projection30 = calculateProjection(30);
  const projection60 = calculateProjection(60);
  const projection90 = calculateProjection(90);
  const pipelineValue = calculateWeightedRevenue(opportunities);
  const currentMonthRevenue = monthlyData[monthlyData.length - 1]?.revenue || 0;
  const previousMonthRevenue = monthlyData[monthlyData.length - 2]?.revenue || 0;
  const growthRate = previousMonthRevenue > 0 
    ? Math.round(((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100)
    : 0;
  const avgVelocity = getPipelineVelocity();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando previsões...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-2">
          Previsão de Vendas
        </h1>
        <p className="text-muted-foreground">
          Análise preditiva baseada em probabilidades e histórico de conversão
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pipeline Ponderado
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(pipelineValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Receita potencial com probabilidades
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Crescimento MoM
            </CardTitle>
            {growthRate >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {growthRate >= 0 ? "+" : ""}{growthRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Comparado ao mês anterior
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Velocidade Média
            </CardTitle>
            <Activity className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgVelocity} dias</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tempo médio até fechamento
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa Conversão
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conversionData[conversionData.length - 1]?.conversionRate || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Último mês completo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projeções por Período */}
      <Card className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Projeção de Receita
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Baseado em datas previstas de fechamento e probabilidades
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedPeriod.toString()} onValueChange={(v) => setSelectedPeriod(Number(v) as 30 | 60 | 90)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="30">30 Dias</TabsTrigger>
              <TabsTrigger value="60">60 Dias</TabsTrigger>
              <TabsTrigger value="90">90 Dias</TabsTrigger>
            </TabsList>
            
            <TabsContent value="30" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-1">Próximos 30 dias</p>
                  <p className="text-3xl font-bold text-primary">{formatCurrency(projection30)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">Probabilidade Alta (&gt;70%)</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      opportunities
                        .filter(o => o.probability >= 70 && o.status !== "won" && o.status !== "lost")
                        .reduce((sum, o) => sum + (Number(o.value) || 0), 0)
                    )}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">Oportunidades Ativas</p>
                  <p className="text-2xl font-bold">
                    {opportunities.filter(o => o.status !== "won" && o.status !== "lost").length}
                  </p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="60" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 rounded-lg border border-cyan-500/20">
                  <p className="text-sm text-muted-foreground mb-1">Próximos 60 dias</p>
                  <p className="text-3xl font-bold text-cyan-600">{formatCurrency(projection60)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">Crescimento vs 30d</p>
                  <p className="text-2xl font-bold text-cyan-600">
                    +{formatCurrency(projection60 - projection30)}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">Meta Atingida</p>
                  <p className="text-2xl font-bold">
                    {Math.round((projection60 / (projection90 || 1)) * 100)}%
                  </p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="90" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-lg border border-amber-500/20">
                  <p className="text-sm text-muted-foreground mb-1">Próximos 90 dias</p>
                  <p className="text-3xl font-bold text-amber-600">{formatCurrency(projection90)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">Crescimento vs 60d</p>
                  <p className="text-2xl font-bold text-amber-600">
                    +{formatCurrency(projection90 - projection60)}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">Ticket Médio</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      projection90 / (opportunities.filter(o => o.status !== "won" && o.status !== "lost").length || 1)
                    )}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolução de Receita Mês a Mês */}
        <Card className="animate-fade-in" style={{ animationDelay: "0.5s" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Evolução de Receita
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Receita realizada nos últimos 6 meses
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Receita"
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Taxa de Conversão */}
        <Card className="animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-600" />
              Taxa de Conversão
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Percentual de oportunidades ganhas por mês
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={conversionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    if (name === "conversionRate") return [`${value}%`, "Taxa de Conversão"];
                    return [value, name];
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="conversionRate" 
                  fill="hsl(var(--cyan-600))" 
                  name="Taxa de Conversão (%)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrevisaoVendas;
