import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Search,
} from "lucide-react";
import { fetchAllPaged } from "@/lib/fetchAllPaged";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  startDate: string;
  endDate: string;
  selectedSeller: string; // 'all' or user id
}

type AuditMetric =
  | "tasks"
  | "activities"
  | "opportunitiesCreated"
  | "opportunitiesMoved"
  | "clients"
  | "won";

type SellerStats = {
  id: string;
  name: string;
  // Esforço
  clientsCreated: number;
  opportunitiesCreated: number;
  opportunitiesMoved: number;
  tasksCompleted: number;
  activitiesLogged: number;
  effortScore: number; // composite
  // Resultado
  opportunitiesWon: number;
  revenueCash: number;
  annualizedRevenue: number;
  conversionRate: number;
  // Eficiência
  revenuePerTask: number;
  revenuePerActivity: number;
  tasksPerWin: number;
  activitiesPerWin: number;
  // Diagnóstico
  category: "champion" | "efficient" | "wrong_focus" | "low_effort";
  // Auditoria — registros brutos
  audit: {
    tasks: any[];
    activities: any[];
    opportunitiesCreated: any[];
    opportunitiesMoved: any[];
    clients: any[];
    won: any[];
  };
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

const METRIC_LABEL: Record<AuditMetric, string> = {
  tasks: "Tarefas concluídas",
  activities: "Atividades registradas",
  opportunitiesCreated: "Oportunidades criadas",
  opportunitiesMoved: "Oportunidades movimentadas",
  clients: "Clientes criados",
  won: "Oportunidades ganhas",
};

const formatDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
};

export const ProductivityTab = ({ startDate, endDate, selectedSeller }: Props) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SellerStats[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditSeller, setAuditSeller] = useState<SellerStats | null>(null);
  const [auditMetric, setAuditMetric] = useState<AuditMetric | null>(null);

  const openAudit = (seller: SellerStats, metric: AuditMetric) => {
    setAuditSeller(seller);
    setAuditMetric(metric);
    setAuditOpen(true);
  };

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
      // Determine which sellers to compute — apenas vendedores
      const { data: vendedorRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "vendedor");

      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "gestor"]);

      const adminIds = new Set((adminRoles || []).map((r: any) => r.user_id));
      let sellerIds = Array.from(
        new Set((vendedorRoles || []).map((r: any) => r.user_id))
      ).filter((id) => !adminIds.has(id));

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
      const wonOpps = await fetchAllPaged<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("opportunities")
          .select("id, title, assigned_to, created_by, implementation_value, monthly_value, value, billing_type, updated_at, close_cycle_days, client_id, clients(company_name, trade_name)")
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

      // Filter won opps that fell within window — attach won_at for display
      const wonInWindow = wonOpps
        .filter((o) => {
          const wonAt = wonAtMap.get(o.id) ?? o.updated_at;
          return wonAt >= startTs && wonAt <= endTs;
        })
        .map((o) => ({ ...o, won_at: wonAtMap.get(o.id) ?? o.updated_at }));

      // Fetch all opportunities created in window (per seller)
      const oppsCreated = await fetchAllPaged<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("opportunities")
          .select("id, title, assigned_to, created_by, status, value, monthly_value, created_at, client_id, clients(company_name, trade_name)")
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
          .select("id, company_name, trade_name, cnpj, created_by, created_at")
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
          .select("id, title, task_type, assigned_to, completed_at, updated_at, client_id, clients(company_name, trade_name)")
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
          .select("id, activity_type, description, created_by, created_at, opportunity_id, opportunities(title, clients(company_name, trade_name))")
          .gte("created_at", startTs)
          .lte("created_at", endTs)
          .in("created_by", sellerIds)
          .range(from, to);
        if (error) throw error;
        return data || [];
      });

      // Opportunities moved in window — status changes recorded in opportunity_history
      const oppMovements = await fetchAllPaged<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("opportunity_history")
          .select("id, opportunity_id, changed_by, changed_at, old_data, new_data, opportunities(title, clients(company_name, trade_name))")
          .gte("changed_at", startTs)
          .lte("changed_at", endTs)
          .in("changed_by", sellerIds)
          .range(from, to);
        if (error) throw error;
        // Keep only entries that represent a real status change
        return (data || []).filter(
          (h: any) => (h.old_data?.status ?? null) !== (h.new_data?.status ?? null),
        );
      });

      // Compute per seller
      const computed: SellerStats[] = (profiles || []).map((p: any) => {
        const sellerWon = wonInWindow.filter((o) => o.assigned_to === p.id);
        const sellerOppsCreated = oppsCreated.filter((o) => o.assigned_to === p.id);
        const sellerClientsArr = clientsCreated.filter((c) => c.created_by === p.id);
        const sellerTasksArr = tasksCompleted.filter((t) => t.assigned_to === p.id);
        const sellerActsArr = activities.filter((a) => a.created_by === p.id);
        const sellerMovedArr = oppMovements.filter((m) => m.changed_by === p.id);

        const sellerClients = sellerClientsArr.length;
        const sellerTasks = sellerTasksArr.length;
        const sellerActs = sellerActsArr.length;
        const sellerMoved = sellerMovedArr.length;

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

        const effortScore =
          sellerTasks + sellerActs + sellerOppsCreated.length + sellerClients + sellerMoved;

        const revenuePerTask = sellerTasks > 0 ? revenueCash / sellerTasks : 0;
        const revenuePerActivity = sellerActs > 0 ? revenueCash / sellerActs : 0;
        const tasksPerWin = won > 0 ? sellerTasks / won : 0;
        const activitiesPerWin = won > 0 ? sellerActs / won : 0;

        return {
          id: p.id,
          name: p.full_name,
          clientsCreated: sellerClients,
          opportunitiesCreated: sellerOppsCreated.length,
          opportunitiesMoved: sellerMoved,
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
          category: "low_effort" as const,
          audit: {
            tasks: sellerTasksArr,
            activities: sellerActsArr,
            opportunitiesCreated: sellerOppsCreated,
            opportunitiesMoved: sellerMovedArr,
            clients: sellerClientsArr,
            won: sellerWon,
          },
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
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground flex items-center gap-1">
                      <Search className="h-3 w-3" /> Clique para auditar
                    </span>
                  </p>
                  <div className="grid grid-cols-5 gap-2 text-center">
                    <button
                      type="button"
                      onClick={() => openAudit(s, "tasks")}
                      className="p-2 bg-muted/40 rounded hover:bg-muted/70 transition-colors cursor-pointer"
                    >
                      <p className="text-lg font-bold">{s.tasksCompleted}</p>
                      <p className="text-[10px] text-muted-foreground">Tarefas</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => openAudit(s, "activities")}
                      className="p-2 bg-muted/40 rounded hover:bg-muted/70 transition-colors cursor-pointer"
                    >
                      <p className="text-lg font-bold">{s.activitiesLogged}</p>
                      <p className="text-[10px] text-muted-foreground">Atividades</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => openAudit(s, "opportunitiesCreated")}
                      className="p-2 bg-muted/40 rounded hover:bg-muted/70 transition-colors cursor-pointer"
                    >
                      <p className="text-lg font-bold">{s.opportunitiesCreated}</p>
                      <p className="text-[10px] text-muted-foreground">Opp criadas</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => openAudit(s, "opportunitiesMoved")}
                      className="p-2 bg-muted/40 rounded hover:bg-muted/70 transition-colors cursor-pointer"
                    >
                      <p className="text-lg font-bold">{s.opportunitiesMoved}</p>
                      <p className="text-[10px] text-muted-foreground">Opp movidas</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => openAudit(s, "clients")}
                      className="p-2 bg-muted/40 rounded hover:bg-muted/70 transition-colors cursor-pointer"
                    >
                      <p className="text-lg font-bold">{s.clientsCreated}</p>
                      <p className="text-[10px] text-muted-foreground">Clientes</p>
                    </button>
                  </div>
                </div>

                {/* Resultado */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5" /> RESULTADO
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <button
                      type="button"
                      onClick={() => openAudit(s, "won")}
                      className="p-2 bg-success/10 rounded hover:bg-success/20 transition-colors cursor-pointer"
                    >
                      <p className="text-lg font-bold text-success">{s.opportunitiesWon}</p>
                      <p className="text-[10px] text-muted-foreground">Ganhas</p>
                    </button>
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

      {/* Audit Dialog */}
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Auditoria — {auditSeller?.name}
            </DialogTitle>
            <DialogDescription>
              {auditMetric ? METRIC_LABEL[auditMetric] : ""} no período de{" "}
              {format(new Date(startDate), "dd/MM/yyyy", { locale: ptBR })} a{" "}
              {format(new Date(endDate), "dd/MM/yyyy", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            {auditSeller && auditMetric && (
              <AuditList seller={auditSeller} metric={auditMetric} />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============================================================
// AuditList — renders the records that compose a metric
// ============================================================
const AuditList = ({ seller, metric }: { seller: SellerStats; metric: AuditMetric }) => {
  const records: any[] = seller.audit[metric] || [];

  if (records.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhum registro encontrado para este indicador no período.
      </p>
    );
  }

  if (metric === "tasks") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Concluída em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.title || "—"}</TableCell>
              <TableCell>{t.task_type || "—"}</TableCell>
              <TableCell>{t.clients?.trade_name || t.clients?.company_name || "—"}</TableCell>
              <TableCell>{formatDate(t.completed_at || t.updated_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (metric === "activities") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Oportunidade</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <Badge variant="outline">{a.activity_type || "—"}</Badge>
              </TableCell>
              <TableCell className="max-w-xs truncate">{a.description || "—"}</TableCell>
              <TableCell>
                {a.opportunities?.title || "—"}
                {a.opportunities?.clients && (
                  <span className="block text-xs text-muted-foreground">
                    {a.opportunities.clients.trade_name || a.opportunities.clients.company_name}
                  </span>
                )}
              </TableCell>
              <TableCell>{formatDate(a.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (metric === "clients") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Nome fantasia</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Criado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.company_name || "—"}</TableCell>
              <TableCell>{c.trade_name || "—"}</TableCell>
              <TableCell className="font-mono text-xs">{c.cnpj || "—"}</TableCell>
              <TableCell>{formatDate(c.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // opportunitiesCreated / won
  const isWon = metric === "won";
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead>{isWon ? "Ganha em" : "Criada em"}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((o) => {
          const total =
            o.billing_type === "pontual"
              ? Number(o.value) || Number(o.implementation_value) || 0
              : (Number(o.implementation_value) || 0) + (Number(o.monthly_value) || 0) * 12;
          return (
            <TableRow key={o.id}>
              <TableCell className="font-medium">{o.title || "—"}</TableCell>
              <TableCell>{o.clients?.trade_name || o.clients?.company_name || "—"}</TableCell>
              <TableCell className="text-right font-semibold text-primary">
                {formatCurrency(isWon ? total : Number(o.value) || (Number(o.monthly_value) || 0) * 12)}
              </TableCell>
              <TableCell>{formatDate(isWon ? o.won_at : o.created_at)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
