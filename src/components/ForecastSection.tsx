import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  addMonths,
  addQuarters,
  addYears,
  subMonths,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { TrendingUp, Target, Shield, Rocket, Zap } from "lucide-react";

interface Props {
  opportunities: any[];
  formatCurrency: (n: number) => string;
}

type Granularity = "month" | "quarter" | "year";

const oppValue = (opp: any): number => {
  if (opp.billing_type === "pontual") {
    return Number(opp.value) || Number(opp.implementation_value) || 0;
  }
  const impl = Number(opp.implementation_value) || 0;
  const monthly = Number(opp.monthly_value) || 0;
  const v = Number(opp.value) || 0;
  return v || impl + monthly * 12;
};

export default function ForecastSection({ opportunities, formatCurrency }: Props) {
  const [granularity, setGranularity] = useState<Granularity>("month");

  // Histórico: taxa de conversão dos últimos 6 meses (won / total criado)
  const historicalWinRate = useMemo(() => {
    const now = new Date();
    const cutoff = subMonths(now, 6);
    const recent = opportunities.filter((o) => {
      const d = o.created_at ? new Date(o.created_at) : null;
      return d && d >= cutoff;
    });
    const won = recent.filter((o) => o.status === "won").length;
    const closed = recent.filter((o) => o.status === "won" || o.status === "lost").length;
    if (closed === 0) return 0.3; // fallback 30%
    return won / closed;
  }, [opportunities]);

  // Receita média mensal histórica (últimos 6 meses ganhos)
  const avgHistoricalMonthly = useMemo(() => {
    const now = new Date();
    const months: number[] = [];
    for (let i = 1; i <= 6; i++) {
      const ref = subMonths(now, i);
      const start = startOfMonth(ref);
      const end = endOfMonth(ref);
      const total = opportunities
        .filter((o) => o.status === "won")
        .filter((o) => {
          const d = o.updated_at ? new Date(o.updated_at) : new Date(o.created_at);
          return d >= start && d <= end;
        })
        .reduce((s, o) => s + oppValue(o), 0);
      months.push(total);
    }
    const sum = months.reduce((a, b) => a + b, 0);
    return months.length ? sum / months.length : 0;
  }, [opportunities]);

  // Periodos para projeção
  const periods = useMemo(() => {
    const now = new Date();
    const list: { key: string; label: string; start: Date; end: Date }[] = [];

    if (granularity === "month") {
      for (let i = 0; i < 12; i++) {
        const ref = addMonths(now, i);
        list.push({
          key: format(ref, "yyyy-MM"),
          label: format(ref, "MMM/yy", { locale: ptBR }),
          start: startOfMonth(ref),
          end: endOfMonth(ref),
        });
      }
    } else if (granularity === "quarter") {
      for (let i = 0; i < 4; i++) {
        const ref = addQuarters(now, i);
        list.push({
          key: `Q${Math.floor(ref.getMonth() / 3) + 1}-${ref.getFullYear()}`,
          label: `Q${Math.floor(ref.getMonth() / 3) + 1}/${format(ref, "yy")}`,
          start: startOfQuarter(ref),
          end: endOfQuarter(ref),
        });
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const ref = addYears(now, i);
        list.push({
          key: format(ref, "yyyy"),
          label: format(ref, "yyyy"),
          start: startOfYear(ref),
          end: endOfYear(ref),
        });
      }
    }
    return list;
  }, [granularity]);

  // Cenários: conservador / realista / agressivo
  // - Conservador: apenas opps com prob >= 70% e usa probabilidade real * 0.85
  // - Realista: pondera todas opps abertas pela probabilidade
  // - Agressivo: usa max(probabilidade, winRate histórico) * 1.15 (limitado em 100%)
  const projections = useMemo(() => {
    const open = opportunities.filter((o) => o.status !== "won" && o.status !== "lost");

    return periods.map((p) => {
      const inPeriod = open.filter((o) => {
        if (!o.expected_close_date) return false;
        const d = parseISO(o.expected_close_date);
        return isWithinInterval(d, { start: p.start, end: p.end });
      });

      let conservative = 0;
      let realistic = 0;
      let aggressive = 0;

      for (const o of inPeriod) {
        const v = oppValue(o);
        const prob = (Number(o.probability) || 0) / 100;

        if (prob >= 0.7) conservative += v * prob * 0.85;
        realistic += v * prob;
        const aggProb = Math.min(1, Math.max(prob, historicalWinRate) * 1.15);
        aggressive += v * aggProb;
      }

      // Adiciona baseline histórico para período sem opps suficientes (apenas mensal)
      if (granularity === "month" && inPeriod.length === 0 && avgHistoricalMonthly > 0) {
        conservative = avgHistoricalMonthly * 0.7;
        realistic = avgHistoricalMonthly;
        aggressive = avgHistoricalMonthly * 1.3;
      }

      return {
        period: p.label,
        count: inPeriod.length,
        conservative: Math.round(conservative),
        realistic: Math.round(realistic),
        aggressive: Math.round(aggressive),
      };
    });
  }, [periods, opportunities, historicalWinRate, avgHistoricalMonthly, granularity]);

  // Totais
  const totals = useMemo(() => {
    return projections.reduce(
      (acc, p) => ({
        conservative: acc.conservative + p.conservative,
        realistic: acc.realistic + p.realistic,
        aggressive: acc.aggressive + p.aggressive,
        count: acc.count + p.count,
      }),
      { conservative: 0, realistic: 0, aggressive: 0, count: 0 }
    );
  }, [projections]);

  const granularityLabel =
    granularity === "month" ? "12 meses" : granularity === "quarter" ? "4 trimestres" : "3 anos";

  return (
    <div className="space-y-4">
      {/* Header com info de tempo real */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Forecast de Vendas
          </h2>
          <p className="text-sm text-muted-foreground">
            Projeção em tempo real • baseada em pipeline + histórico ({(historicalWinRate * 100).toFixed(0)}% win rate)
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Atualizado em tempo real
        </Badge>
      </div>

      {/* Seletor de granularidade */}
      <Tabs value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="month">Mensal</TabsTrigger>
          <TabsTrigger value="quarter">Trimestral</TabsTrigger>
          <TabsTrigger value="year">Anual</TabsTrigger>
        </TabsList>

        <TabsContent value={granularity} className="space-y-4 mt-4">
          {/* Cards totais por cenário */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  Conservador ({granularityLabel})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totals.conservative)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Apenas oportunidades com alta probabilidade (≥70%)
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Realista ({granularityLabel})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(totals.realistic)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Pipeline ponderado pela probabilidade de cada oportunidade
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-orange-600" />
                  Agressivo ({granularityLabel})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(totals.aggressive)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Considera melhor histórico de conversão + 15% de upside
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico comparativo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Projeção {granularity === "month" ? "Mensal" : granularity === "quarter" ? "Trimestral" : "Anual"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={projections}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="conservative" name="Conservador" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="realistic" name="Realista" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="aggressive" name="Agressivo" fill="hsl(25 95% 53%)" radius={[4, 4, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="realistic"
                    stroke="hsl(var(--foreground))"
                    strokeWidth={2}
                    dot={false}
                    name="Tendência"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tabela detalhada */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhamento por Período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-2">Período</th>
                      <th className="text-right py-2 px-2">Oportunidades</th>
                      <th className="text-right py-2 px-2 text-blue-600">Conservador</th>
                      <th className="text-right py-2 px-2 text-primary">Realista</th>
                      <th className="text-right py-2 px-2 text-orange-600">Agressivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projections.map((p) => (
                      <tr key={p.period} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2 font-medium">{p.period}</td>
                        <td className="text-right py-2 px-2">{p.count}</td>
                        <td className="text-right py-2 px-2 text-blue-600">
                          {formatCurrency(p.conservative)}
                        </td>
                        <td className="text-right py-2 px-2 text-primary font-semibold">
                          {formatCurrency(p.realistic)}
                        </td>
                        <td className="text-right py-2 px-2 text-orange-600">
                          {formatCurrency(p.aggressive)}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-muted/30">
                      <td className="py-2 px-2">Total</td>
                      <td className="text-right py-2 px-2">{totals.count}</td>
                      <td className="text-right py-2 px-2 text-blue-600">
                        {formatCurrency(totals.conservative)}
                      </td>
                      <td className="text-right py-2 px-2 text-primary">
                        {formatCurrency(totals.realistic)}
                      </td>
                      <td className="text-right py-2 px-2 text-orange-600">
                        {formatCurrency(totals.aggressive)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
