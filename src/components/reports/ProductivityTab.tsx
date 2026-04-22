import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Activity,
  Trophy,
  Gem,
  AlertTriangle,
  Moon,
  TrendingUp,
  Target,
  CheckSquare,
  DollarSign,
  Zap,
  Users,
} from "lucide-react";
import { fetchAllPaged } from "@/lib/fetchAllPaged";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, Legend, Cell } from "recharts";

interface Props {
  startDate: string;
  endDate: string;
  selectedSeller: string; // 'all' or user id
}

type SellerStats = {
  id: string;
  name: string;
  // Esforço
  clientsCreated: number;
  opportunitiesCreated: number;
  tasksCompleted: number;
  activitiesLogged: number;
  effortScore: number; // composite
  // Resultado
  opportunitiesWon: number;
  revenueCash: number; // implementation + monthly*12 (or value if pontual)
  annualizedRevenue: number; // monthly*12 + implementation (skip pontual)
  conversionRate: number;
  // Eficiência
  revenuePerTask: number;
  revenuePerActivity: number;
  tasksPerWin: number;
  activitiesPerWin: number;
  // Diagnóstico
  category: "champion" | "efficient" | "wrong_focus" | "low_effort";
};

const CATEGORY_META: Record<SellerStats["category"], { label: string; icon: any; color: string; description: string }> = {
  champion: {
    label: "Trabalha muito e converte",
    icon: Trophy,
    color: "text-yellow-600 bg-yellow-500/10 border-yellow-500/30",
    description: "Alto esforço + alto resultado. Referência da equipe.",
  },
  efficient: {
    label: "Eficiente",
    icon: Gem,
    color: "text-blue-600 bg-blue-500/10 border-blue-500/30",
    description: "Resultado expressivo com esforço moderado. Trabalha de forma inteligente.",
  },
  wrong_focus: {
    label: "Trabalha errado",
    icon: AlertTriangle,
    color: "text-orange-600 bg-orange-500/10 border-orange-500/30",
    description: "Alto esforço, baixo resultado. Está gastando energia no lugar errado.",
  },
  low_effort: {
    label: "Baixo esforço",
    icon: Moon,
    color: "text-muted-foreground bg-muted/30 border-border",
    description: "Pouco esforço e pouco resultado. Precisa engajar mais.",
  },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

export const ProductivityTab = ({ startDate, endDate, selectedSeller }: Props) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SellerStats[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isPrivileged, setIsPrivileged] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const list = (roles || []).map((r: any) => r.role);
      setIsPrivileged(list.includes("admin") || list.includes("gestor"));
    };
    init();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    loadProductivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, isPrivileged, startDate, endDate, selectedSeller]);

  const loadProductivity = async () => {
    setLoading(true);
    try {
      // Determine which sellers to compute
      const { data: vendedorRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["vendedor", "gestor", "admin"]);

      let sellerIds = Array.from(new Set((vendedorRoles || []).map((r: any) => r.user_id)));

      // Restrict to current user if not privileged
      if (!isPrivileged) {
        sellerIds = sellerIds.filter((id) => id === currentUserId);
      } else if (selectedSeller !== "all") {
        sellerIds = sellerIds.filter((id) => id === selectedSeller);
      }

      if (sellerIds.length === 0) {
        setStats([]);
        setLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", sellerIds)
        .or("is_deleted.is.null,is_deleted.eq.false");

      const startTs = `${startDate}T00:00:00`;
      const endTs = `${endDate}T23:59:59`;

      // Won opportunities — using first 'Ganho' activity timestamp
      // 1. Fetch ALL won opps for these sellers (we'll filter by won-date later)
      const wonOpps = await fetchAllPaged<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("opportunities")
          .select("id, assigned_to, created_by, implementation_value, monthly_value, value, billing_type, updated_at, close_cycle_days")
          .eq("status", "won")
          .or(sellerIds.map((id) => `assigned_to.eq.${id}`).join(","))
          .range(from, to);
        if (error) throw error;
        return data || [];
      });

      // Get first 'Ganho' activity timestamps in chunks
      const wonAtMap = new Map<string, string>();
      const oppIds = wonOpps.map((o) => o.id);
      const chunkSize = 100;
      for (let i = 0; i < oppIds.length; i += chunkSize) {
        const chunk = oppIds.slice(i, i + chunkSize);
        if (chunk.length === 0) continue;
        const { data: acts } = await supabase
          .from("opportunity_activities")
          .select("opportunity_id, created_at, new_value")
          .in("opportunity_id", chunk)
          .eq("new_value", "Ganho")
          .order("created_at", { ascending: true });
        (acts || []).forEach((a: any) => {
          if (!wonAtMap.has(a.opportunity_id)) {
            wonAtMap.set(a.opportunity_id, a.created_at);
          }
        });
      }

      // Filter won opps that fell within window
      const wonInWindow = wonOpps.filter((o) => {
        const wonAt = wonAtMap.get(o.id) ?? o.updated_at;
        return wonAt >= startTs && wonAt <= endTs;
      });

      // Fetch all opportunities created in window (per seller)
      const oppsCreated = await fetchAllPaged<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("opportunities")
          .select("id, assigned_to, created_by, status")
          .gte("created_at", startTs)
          .lte("created_at", endTs)
          .or(sellerIds.map((id) => `assigned_to.eq.${id}`).join(","))
          .range(from, to);
        if (error) throw error;
        return data || [];
      });

      // Clients created
      const clientsCreated = await fetchAllPaged<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("clients")
          .select("id, created_by")
          .gte("created_at", startTs)
          .lte("created_at", endTs)
          .in("created_by", sellerIds)
          .range(from, to);
        if (error) throw error;
        return data || [];
      });

      // Tasks completed in window
      const tasksCompleted = await fetchAllPaged<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("tasks")
          .select("id, assigned_to, completed_at, updated_at")
          .eq("status", "completed")
          .in("assigned_to", sellerIds)
          .or(`and(completed_at.gte.${startTs},completed_at.lte.${endTs}),and(completed_at.is.null,updated_at.gte.${startTs},updated_at.lte.${endTs})`)
          .range(from, to);
        if (error) throw error;
        return data || [];
      });

      // Activities logged in window
      const activities = await fetchAllPaged<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("opportunity_activities")
          .select("id, created_by")
          .gte("created_at", startTs)
          .lte("created_at", endTs)
          .in("created_by", sellerIds)
          .range(from, to);
        if (error) throw error;
        return data || [];
      });

      // Compute per seller
      const computed: SellerStats[] = (profiles || []).map((p: any) => {
        const sellerWon = wonInWindow.filter((o) => o.assigned_to === p.id);
        const sellerOppsCreated = oppsCreated.filter((o) => o.assigned_to === p.id);
        const sellerClients = clientsCreated.filter((c) => c.created_by === p.id).length;
        const sellerTasks = tasksCompleted.filter((t) => t.assigned_to === p.id).length;
        const sellerActs = activities.filter((a) => a.created_by === p.id).length;

        let revenueCash = 0;
        let annualizedRevenue = 0;
        sellerWon.forEach((o) => {
          const isPontual = o.billing_type === "pontual";
          const impl = Number(o.implementation_value) || 0;
          const monthly = Number(o.monthly_value) || 0;
          const value = Number(o.value) || 0;
          if (isPontual) {
            revenueCash += value || impl;
          } else {
            revenueCash += impl + monthly * 12;
            annualizedRevenue += impl + monthly * 12;
          }
        });

        const won = sellerWon.length;
        const totalOpps = sellerOppsCreated.length;
        const conversionRate = totalOpps > 0 ? (won / totalOpps) * 100 : 0;

        const effortScore = sellerTasks + sellerActs + sellerOppsCreated.length + sellerClients;

        const revenuePerTask = sellerTasks > 0 ? revenueCash / sellerTasks : 0;
        const revenuePerActivity = sellerActs > 0 ? revenueCash / sellerActs : 0;
        const tasksPerWin = won > 0 ? sellerTasks / won : 0;
        const activitiesPerWin = won > 0 ? sellerActs / won : 0;

        return {
          id: p.id,
          name: p.full_name,
          clientsCreated: sellerClients,
          opportunitiesCreated: sellerOppsCreated.length,
          tasksCompleted: sellerTasks,
          activitiesLogged: sellerActs,
          effortScore,
          opportunitiesWon: won,
          revenueCash,
          annualizedRevenue,
          conversionRate,
          revenuePerTask,
          revenuePerActivity,
          tasksPerWin,
          activitiesPerWin,
          category: "low_effort", // placeholder, set below
        };
      });

      // Classify based on team medians
      const efforts = computed.map((s) => s.effortScore).sort((a, b) => a - b);
      const results = computed.map((s) => s.revenueCash).sort((a, b) => a - b);
      const medianEffort = efforts.length ? efforts[Math.floor(efforts.length / 2)] : 0;
      const medianResult = results.length ? results[Math.floor(results.length / 2)] : 0;

      computed.forEach((s) => {
        const highEffort = s.effortScore >= medianEffort && s.effortScore > 0;
        const highResult = s.revenueCash >= medianResult && s.revenueCash > 0;
        if (highEffort && highResult) s.category = "champion";
        else if (!highEffort && highResult) s.category = "efficient";
        else if (highEffort && !highResult) s.category = "wrong_focus";
        else s.category = "low_effort";
      });

      // Sort by revenueCash desc
      computed.sort((a, b) => b.revenueCash - a.revenueCash);

      setStats(computed);
    } catch (err) {
      console.error("Error loading productivity:", err);
    } finally {
      setLoading(false);
    }
  };

  const scatterData = useMemo(
    () =>
      stats.map((s) => ({
        name: s.name,
        x: s.effortScore,
        y: s.revenueCash,
        z: s.opportunitiesWon || 1,
        category: s.category,
      })),
    [stats]
  );

  const categoryColors: Record<SellerStats["category"], string> = {
    champion: "hsl(45 93% 47%)",
    efficient: "hsl(217 91% 60%)",
    wrong_focus: "hsl(25 95% 53%)",
    low_effort: "hsl(var(--muted-foreground))",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Activity className="mx-auto mb-4 text-muted-foreground" size={48} />
          <p className="text-muted-foreground">Nenhum dado de produtividade no período selecionado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hipótese */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <p className="text-sm text-foreground">
            <strong>Hipótese:</strong> "Quem mais trabalha atinge mais resultado." Cruzamos o esforço (tarefas, atividades, oportunidades e
            clientes criados) com o resultado (receita ganha) para revelar quem trabalha muito e bem, quem é eficiente, quem está gastando
            energia no lugar errado, e quem precisa engajar mais.
          </p>
        </CardContent>
      </Card>

      {/* Scatter Chart */}
      {isPrivileged && stats.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Esforço x Resultado
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Eixo X: esforço total · Eixo Y: receita ganha · Tamanho: oportunidades ganhas
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Esforço"
                  label={{ value: "Esforço (tarefas + atividades + opp + clientes)", position: "bottom", offset: 20, fill: "hsl(var(--muted-foreground))" }}
                  tick={{ fill: "hsl(var(--foreground))" }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Receita"
                  tickFormatter={(v) => formatCurrency(v)}
                  label={{ value: "Receita ganha", angle: -90, position: "left", offset: 40, fill: "hsl(var(--muted-foreground))" }}
                  tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="z" range={[80, 400]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === "Receita") return formatCurrency(Number(value));
                    return value;
                  }}
                  labelFormatter={(_, payload) => (payload?.[0]?.payload?.name as string) || ""}
                />
                <Scatter data={scatterData}>
                  {scatterData.map((entry, idx) => (
                    <Cell key={idx} fill={categoryColors[entry.category as SellerStats["category"]]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-4 justify-center">
              {(Object.keys(CATEGORY_META) as SellerStats["category"][]).map((k) => {
                const meta = CATEGORY_META[k];
                const Icon = meta.icon;
                return (
                  <div key={k} className="flex items-center gap-1.5 text-xs">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: categoryColors[k] }} />
                    <Icon className="h-3.5 w-3.5" />
                    <span>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-seller cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {stats.map((s) => {
          const meta = CATEGORY_META[s.category];
          const Icon = meta.icon;
          return (
            <Card key={s.id} className={`border ${meta.color.split(" ").filter(c => c.startsWith("border-")).join(" ")}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{s.name}</CardTitle>
                    <Badge className={`mt-2 ${meta.color}`} variant="outline">
                      <Icon className="h-3.5 w-3.5 mr-1" />
                      {meta.label}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{formatCurrency(s.revenueCash)}</p>
                    <p className="text-xs text-muted-foreground">Receita ganha</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{meta.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Esforço */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" /> ESFORÇO
                  </p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 bg-muted/40 rounded">
                      <p className="text-lg font-bold">{s.tasksCompleted}</p>
                      <p className="text-[10px] text-muted-foreground">Tarefas</p>
                    </div>
                    <div className="p-2 bg-muted/40 rounded">
                      <p className="text-lg font-bold">{s.activitiesLogged}</p>
                      <p className="text-[10px] text-muted-foreground">Atividades</p>
                    </div>
                    <div className="p-2 bg-muted/40 rounded">
                      <p className="text-lg font-bold">{s.opportunitiesCreated}</p>
                      <p className="text-[10px] text-muted-foreground">Opp criadas</p>
                    </div>
                    <div className="p-2 bg-muted/40 rounded">
                      <p className="text-lg font-bold">{s.clientsCreated}</p>
                      <p className="text-[10px] text-muted-foreground">Clientes</p>
                    </div>
                  </div>
                </div>

                {/* Resultado */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5" /> RESULTADO
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-success/10 rounded">
                      <p className="text-lg font-bold text-success">{s.opportunitiesWon}</p>
                      <p className="text-[10px] text-muted-foreground">Ganhas</p>
                    </div>
                    <div className="p-2 bg-primary/10 rounded">
                      <p className="text-sm font-bold text-primary">{formatCurrency(s.annualizedRevenue)}</p>
                      <p className="text-[10px] text-muted-foreground">Anualizada</p>
                    </div>
                    <div className="p-2 bg-warning/10 rounded">
                      <p className="text-lg font-bold text-warning">{s.conversionRate.toFixed(1)}%</p>
                      <p className="text-[10px] text-muted-foreground">Conversão</p>
                    </div>
                  </div>
                </div>

                {/* Eficiência */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Gem className="h-3.5 w-3.5" /> EFICIÊNCIA
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Receita por tarefa</span>
                      <span className="font-semibold">{formatCurrency(s.revenuePerTask)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Receita por atividade</span>
                      <span className="font-semibold">{formatCurrency(s.revenuePerActivity)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tarefas por venda ganha</span>
                      <span className="font-semibold">{s.tasksPerWin > 0 ? s.tasksPerWin.toFixed(1) : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Atividades por venda ganha</span>
                      <span className="font-semibold">{s.activitiesPerWin > 0 ? s.activitiesPerWin.toFixed(1) : "—"}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Comparative table */}
      {isPrivileged && stats.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Tabela Comparativa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Esforço</TableHead>
                    <TableHead className="text-right">Tarefas</TableHead>
                    <TableHead className="text-right">Atividades</TableHead>
                    <TableHead className="text-right">Opp criadas</TableHead>
                    <TableHead className="text-right">Ganhas</TableHead>
                    <TableHead className="text-right">Conv. %</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">R$/tarefa</TableHead>
                    <TableHead className="text-right">Tarefas/ganha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((s) => {
                    const meta = CATEGORY_META[s.category];
                    const Icon = meta.icon;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={meta.color}>
                            <Icon className="h-3 w-3 mr-1" />
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold">{s.effortScore}</TableCell>
                        <TableCell className="text-right">{s.tasksCompleted}</TableCell>
                        <TableCell className="text-right">{s.activitiesLogged}</TableCell>
                        <TableCell className="text-right">{s.opportunitiesCreated}</TableCell>
                        <TableCell className="text-right text-success font-bold">{s.opportunitiesWon}</TableCell>
                        <TableCell className="text-right">{s.conversionRate.toFixed(1)}%</TableCell>
                        <TableCell className="text-right font-bold text-primary">{formatCurrency(s.revenueCash)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.revenuePerTask)}</TableCell>
                        <TableCell className="text-right">{s.tasksPerWin > 0 ? s.tasksPerWin.toFixed(1) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
