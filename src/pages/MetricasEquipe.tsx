import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Trophy,
  Target,
  DollarSign,
  TrendingUp,
  ListTodo,
  Activity,
  Calendar,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { fetchAllPaged } from "@/lib/fetchAllPaged";

type MonetaryGoalType = "revenue" | "annualized_sales";

interface MonetaryBuckets {
  revenue: number[];
  annualized_sales: number[];
}

const createEmptyMonetaryBuckets = (): MonetaryBuckets => ({
  revenue: Array(12).fill(0),
  annualized_sales: Array(12).fill(0),
});

const calculateMonetaryAchieved = (goalType: MonetaryGoalType, opp: any) => {
  const billingType = opp?.billing_type ?? null;
  const isPontual = billingType === "pontual";
  const impl = Number(opp?.implementation_value) || 0;
  const monthly = Number(opp?.monthly_value) || 0;
  const value = Number(opp?.value) || 0;

  if (goalType === "annualized_sales") {
    return isPontual ? 0 : impl + monthly * 12;
  }

  return isPontual ? value || impl : impl + monthly * 12;
};

async function loadWonAchievementBucketsForYear(
  year: number,
  sellerIds: string[]
): Promise<{
  bySeller: Record<string, MonetaryBuckets>;
  nonSeller: MonetaryBuckets;
}> {
  const bySeller = Object.fromEntries(
    sellerIds.map((sellerId) => [sellerId, createEmptyMonetaryBuckets()])
  ) as Record<string, MonetaryBuckets>;
  const nonSeller = createEmptyMonetaryBuckets();

  const wonOpportunities = await fetchAllPaged<any>(async (from, to) => {
    const { data, error } = await supabase
      .from("opportunities")
      .select("id, assigned_to, implementation_value, monthly_value, billing_type, value, updated_at")
      .eq("status", "won")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return data || [];
  });

  if (wonOpportunities.length === 0) {
    return { bySeller, nonSeller };
  }

  const firstWonAtByOpportunity = new Map<string, string>();
  const opportunityIds = wonOpportunities.map((opp) => opp.id);

  for (let i = 0; i < opportunityIds.length; i += 200) {
    const chunk = opportunityIds.slice(i, i + 200);
    const { data, error } = await supabase
      .from("opportunity_activities")
      .select("opportunity_id, created_at, new_value")
      .in("opportunity_id", chunk)
      .eq("new_value", "Ganho")
      .order("created_at", { ascending: true });

    if (error) throw error;

    (data || []).forEach((activity) => {
      if (!firstWonAtByOpportunity.has(activity.opportunity_id)) {
        firstWonAtByOpportunity.set(activity.opportunity_id, activity.created_at ?? "");
      }
    });
  }

  const sellerSet = new Set(sellerIds);

  wonOpportunities.forEach((opp) => {
    const wonAt = firstWonAtByOpportunity.get(opp.id) ?? opp.updated_at;
    if (!wonAt) return;

    const wonDate = new Date(wonAt);
    if (wonDate.getFullYear() !== year) return;

    const monthIndex = wonDate.getMonth();
    const buckets = sellerSet.has(opp.assigned_to)
      ? bySeller[opp.assigned_to]
      : nonSeller;

    buckets.revenue[monthIndex] += calculateMonetaryAchieved("revenue", opp);
    buckets.annualized_sales[monthIndex] += calculateMonetaryAchieved("annualized_sales", opp);
  });

  return { bySeller, nonSeller };
}

// Local month-bounded progress calc for non-monetary goals.
async function fetchAchievedForMonth(
  goalType: string,
  assignedTo: string,
  startStr: string,
  endStr: string,
  taskTypeFilter: string | null,
  activityTypeFilter: string | null
): Promise<number> {
  const startTs = `${startStr}T00:00:00`;
  const endTs = `${endStr}T23:59:59`;

  if (goalType === "tasks") {
    let q = supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("assigned_to", assignedTo)
      .eq("status", "completed");
    if (taskTypeFilter) q = q.eq("task_type", taskTypeFilter as any);
    q = q.or(
      `and(completed_at.gte.${startTs},completed_at.lte.${endTs}),and(completed_at.is.null,updated_at.gte.${startTs},updated_at.lte.${endTs})`
    );
    const { count, error } = await q;
    if (error) {
      console.error("tasks fetch error", error);
      return 0;
    }
    return count || 0;
  }

  if (goalType === "activities") {
    let q = supabase
      .from("opportunity_activities")
      .select("*", { count: "exact", head: true })
      .eq("created_by", assignedTo)
      .gte("created_at", startTs)
      .lte("created_at", endTs);
    if (activityTypeFilter) q = q.eq("activity_type", activityTypeFilter);
    const { count, error } = await q;
    if (error) {
      console.error("activities fetch error", error);
      return 0;
    }
    return count || 0;
  }

  return 0;
}

interface Seller {
  id: string;
  full_name: string;
  email: string;
}

interface GoalRow {
  id: string;
  title: string;
  goal_type: string;
  period: string; // mensal | anual | semestral
  target_value: number;
  start_date: string;
  end_date: string;
  assigned_to: string;
  task_type_filter: string | null;
  activity_type_filter: string | null;
}

interface MonthCell {
  target: number;
  achieved: number;
  percentage: number;
}

interface GoalWithMonths extends GoalRow {
  months: MonthCell[]; // length 12, index = month - 1
  totalTarget: number;
  totalAchieved: number;
  totalPercentage: number;
}

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const MONETARY_TYPES = new Set(["revenue", "annualized_sales"]);
const isMonetary = (t: string) => MONETARY_TYPES.has(t);

type Status = "done" | "ahead" | "on" | "late" | "none";

const STATUS_META: Record<
  Status,
  { label: string; bar: string; chip: string; text: string; edge: string }
> = {
  done:  { label: "Meta batida", bar: "bg-success",            chip: "bg-success/15 text-success border-success/30",            text: "text-success",            edge: "border-l-success" },
  ahead: { label: "À frente",   bar: "bg-success/70",        chip: "bg-success/10 text-success border-success/25",            text: "text-success",            edge: "border-l-success/70" },
  on:    { label: "No ritmo",    bar: "bg-primary",          chip: "bg-primary/10 text-primary border-primary/25",            text: "text-primary",            edge: "border-l-primary" },
  late:  { label: "Atrasado",    bar: "bg-destructive",      chip: "bg-destructive/10 text-destructive border-destructive/30", text: "text-destructive",        edge: "border-l-destructive" },
  none:  { label: "Sem meta",    bar: "bg-muted-foreground/30", chip: "bg-muted/50 text-muted-foreground border-border",         text: "text-muted-foreground",   edge: "border-l-border" },
};

const heatClass = (pct: number, target: number, achieved: number, isFuture: boolean) => {
  if (target === 0) return achieved > 0 ? "bg-primary/25" : "bg-muted/40";
  if (isFuture) return "bg-muted/15 border border-dashed border-border";
  if (pct >= 100) return "bg-success text-white";
  if (pct >= 80) return "bg-success/45";
  if (pct >= 60) return "bg-primary/55";
  if (pct >= 40) return "bg-primary/30";
  if (pct > 0) return "bg-destructive/45";
  return "bg-destructive";
};

const MetricasEquipe = () => {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [goalsBySeller, setGoalsBySeller] = useState<Record<string, GoalWithMonths[]>>({});
  const [companyGoalsBySeller, setCompanyGoalsBySeller] = useState<Record<string, GoalWithMonths[]>>({});
  const [nonSellerAchieved, setNonSellerAchieved] = useState<MonetaryBuckets>(createEmptyMonetaryBuckets);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Get current user and role
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setSellers([]);
        setGoalsBySeller({});
        return;
      }

      const { data: currentUserRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id);

      const roles = (currentUserRoles || []).map((r) => r.role);
      const isPrivileged = roles.includes("admin") || roles.includes("gestor");

      // 1. Get vendedores. Always load ALL vendedores for company-wide
      // aggregation, then filter to current user only (when not privileged)
      // for the per-seller table view.
      const { data: vendedorRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "vendedor");

      if (rolesError) throw rolesError;

      const allVendedorIds = (vendedorRoles || []).map((r) => r.user_id);
      const vendedorIds = isPrivileged
        ? allVendedorIds
        : allVendedorIds.filter((id) => id === currentUser.id);

      if (allVendedorIds.length === 0) {
        setSellers([]);
        setGoalsBySeller({});
        setCompanyGoalsBySeller({});
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", vendedorIds.length > 0 ? vendedorIds : allVendedorIds)
        .or("is_deleted.is.null,is_deleted.eq.false")
        .order("full_name");

      if (profilesError) throw profilesError;

      const sellerList = profiles || [];
      setSellers(sellerList);

      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      // Always compute monetary achieved across ALL vendedores so the
      // company total is consistent regardless of the viewer's role.
      const { bySeller: sellerMonetaryAchieved, nonSeller } =
        await loadWonAchievementBucketsForYear(year, allVendedorIds);

      setNonSellerAchieved(nonSeller);

      // 2. Fetch goals overlapping the selected year for ALL vendedores.
      // Uses a SECURITY DEFINER RPC so vendedores can also see other
      // vendedores' goals (only fields needed for aggregation) without
      // changing the goals table RLS.
      const { data: allGoals, error: goalsError } = await supabase
        .rpc("get_company_goals", { _year: year });

      if (goalsError) throw goalsError;

      // 3. For each goal, compute month-by-month progress
      const computedAll: Record<string, GoalWithMonths[]> = {};
      const today = new Date();

      await Promise.all(
        (allGoals || []).map(async (goal: any) => {
          const months: MonthCell[] = [];
          const goalStart = new Date(goal.start_date + "T12:00:00");
          const goalEnd = new Date(goal.end_date + "T12:00:00");

          const monetaryAchieved =
            goal.goal_type === "revenue" || goal.goal_type === "annualized_sales"
              ? sellerMonetaryAchieved[goal.assigned_to]?.[goal.goal_type as MonetaryGoalType] ?? Array(12).fill(0)
              : null;

          // Determine per-month target depending on period
          const period = goal.period || "mensal";
          const targetValue = Number(goal.target_value) || 0;

          // Number of months the goal covers in this year
          const monthsCovered: boolean[] = Array.from({ length: 12 }, (_, m) => {
            const monthStart = new Date(year, m, 1);
            const monthEnd = new Date(year, m + 1, 0);
            return monthEnd >= goalStart && monthStart <= goalEnd;
          });

          const coveredCount = monthsCovered.filter(Boolean).length || 1;

          const isMonetaryGoal =
            goal.goal_type === "revenue" || goal.goal_type === "annualized_sales";
          const perMonthTarget = isMonetaryGoal
            ? targetValue / coveredCount
            : period === "anual"
            ? targetValue / 12
            : period === "semestral"
            ? targetValue / 6
            : targetValue;

          // For non-monetary goals belonging to OTHER vendedores when the
          // viewer is not privileged, skip the per-month achieved query
          // (RLS may hide rows and it would be expensive). Targets still
          // count toward the company aggregate.
          const skipNonMonetaryAchieved =
            !isMonetaryGoal && !isPrivileged && goal.assigned_to !== currentUser.id;

          for (let m = 0; m < 12; m++) {
            if (!monthsCovered[m]) {
              months.push({ target: 0, achieved: 0, percentage: 0 });
              continue;
            }

            const mStart = new Date(year, m, 1);
            const mEnd = new Date(year, m + 1, 0);
            const startStr = format(mStart, "yyyy-MM-dd");
            const endStr = format(mEnd, "yyyy-MM-dd");

            let achieved = 0;
            if (mStart <= today) {
              if (monetaryAchieved) {
                achieved = monetaryAchieved[m] || 0;
              } else if (!skipNonMonetaryAchieved) {
                achieved = await fetchAchievedForMonth(
                  goal.goal_type,
                  goal.assigned_to,
                  startStr,
                  endStr,
                  goal.task_type_filter ?? null,
                  goal.activity_type_filter ?? null
                );
              }
            }

            const pct =
              perMonthTarget > 0
                ? Math.min((achieved / perMonthTarget) * 100, 999)
                : 0;

            months.push({
              target: perMonthTarget,
              achieved,
              percentage: pct,
            });
          }

          const todayYear = today.getFullYear();
          const ytdLastIdx =
            year < todayYear ? 11 : year > todayYear ? -1 : today.getMonth();
          const ytdMonths = ytdLastIdx >= 0 ? months.slice(0, ytdLastIdx + 1) : [];
          const totalTarget = ytdMonths.reduce((s, c) => s + c.target, 0);
          const totalAchieved = ytdMonths.reduce((s, c) => s + c.achieved, 0);
          const totalPercentage =
            totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

          const item: GoalWithMonths = {
            id: goal.id,
            title: goal.title,
            goal_type: goal.goal_type,
            period,
            target_value: targetValue,
            start_date: goal.start_date,
            end_date: goal.end_date,
            assigned_to: goal.assigned_to,
            task_type_filter: goal.task_type_filter ?? null,
            activity_type_filter: goal.activity_type_filter ?? null,
            months,
            totalTarget,
            totalAchieved,
            totalPercentage,
          };

          if (!computedAll[goal.assigned_to]) computedAll[goal.assigned_to] = [];
          computedAll[goal.assigned_to].push(item);
        })
      );

      // Sort goals per seller by type then title
      Object.keys(computedAll).forEach((sid) => {
        computedAll[sid].sort((a, b) =>
          a.goal_type === b.goal_type
            ? a.title.localeCompare(b.title)
            : a.goal_type.localeCompare(b.goal_type)
        );
      });

      // Per-seller table view: only includes vendedores the viewer can see
      const visibleSellerSet = new Set(vendedorIds);
      const computed: Record<string, GoalWithMonths[]> = {};
      Object.entries(computedAll).forEach(([sid, gs]) => {
        if (visibleSellerSet.has(sid)) computed[sid] = gs;
      });

      setGoalsBySeller(computed);
      setCompanyGoalsBySeller(computedAll);
    } catch (err) {
      console.error("Error loading team metrics:", err);
      toast.error("Erro ao carregar métricas da equipe");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);

  const formatGoalValue = (type: string, value: number) => {
    if (type === "revenue" || type === "annualized_sales") {
      return formatCurrency(value);
    }
    return Math.round(value).toString();
  };

  const getGoalTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      revenue: "Receita",
      annualized_sales: "Venda Anualizada",
      tasks: "Tarefas",
      activities: "Atividades",
    };
    return labels[type] || type;
  };

  const getGoalTypeIcon = (type: string) => {
    switch (type) {
      case "revenue":
        return <DollarSign className="h-4 w-4" />;
      case "annualized_sales":
        return <TrendingUp className="h-4 w-4" />;
      case "tasks":
        return <ListTodo className="h-4 w-4" />;
      case "activities":
        return <Activity className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  const currentMonthIdx =
    new Date().getFullYear() === year ? new Date().getMonth() : -1;

  const [expanded, setExpanded] = useState<string | null>(null);
  const [view, setView] = useState<"ranking" | "grade">("ranking");

  // ── Ritmo ────────────────────────────────────────────────────────────────
  // O "% atingido" isolado não diz nada: 84% em março está atrasado, 84% em
  // novembro está excelente. Todo status da tela vem do DESVIO para o ritmo
  // linear do ano, não do percentual bruto.
  const paceFraction = useMemo(() => {
    const nowYear = new Date().getFullYear();
    if (year < nowYear) return 1;
    if (year > nowYear) return 0;
    return (new Date().getMonth() + 1) / 12;
  }, [year]);
  const pacePct = paceFraction * 100;

  const statusOf = (pct: number, hasTarget: boolean): Status => {
    if (!hasTarget) return "none";
    if (pct >= 100) return "done";
    const gap = pct - pacePct;
    if (gap >= 5) return "ahead";
    if (gap > -5) return "on";
    return "late";
  };

  const compact = (v: number) => {
    if (Math.abs(v) >= 1000000)
      return `R$ ${(v / 1000000).toFixed(1).replace(".", ",")}M`;
    if (Math.abs(v) >= 1000) return `R$ ${Math.round(v / 1000)}k`;
    return formatCurrency(v);
  };

  // Fechamentos sem vendedor vinculado não pertencem a nenhum cartão individual,
  // mas precisam aparecer no total da empresa.
  const nonSellerGoals = useMemo(() => {
    const build = (type: string, buckets: number[]): GoalWithMonths => {
      const months: MonthCell[] = buckets.map((achieved) => ({
        target: 0,
        achieved,
        percentage: 0,
      }));
      return {
        id: `nao-vendedor-${type}`,
        title: type === "revenue" ? "Receita sem vendedor" : "Venda anualizada sem vendedor",
        goal_type: type,
        period: "mensal",
        target_value: 0,
        start_date: "",
        end_date: "",
        assigned_to: "",
        task_type_filter: null,
        activity_type_filter: null,
        months,
        totalTarget: 0,
        totalAchieved: buckets.reduce((a, b) => a + b, 0),
        totalPercentage: 0,
      };
    };
    return [
      build("revenue", nonSellerAchieved.revenue),
      build("annualized_sales", nonSellerAchieved.annualized_sales),
    ].filter((g) => g.totalAchieved > 0);
  }, [nonSellerAchieved]);

  // Só metas monetárias entram no ranking: somar R$ com "nº de tarefas" produz
  // um número que não significa nada. Contadores ficam em um cartão separado.
  const team = useMemo(() => {
    return sellers
      .map((seller) => {
        // Metas da empresa (goal sem assigned_to) contam para todo vendedor.
        const goals = [
          ...(goalsBySeller[seller.id] || []),
          ...(companyGoalsBySeller[seller.id] || []),
        ];
        const money = goals.filter((g) => isMonetary(g.goal_type));
        const counters = goals.filter((g) => !isMonetary(g.goal_type));
        const moneyTarget = money.reduce((a, g) => a + g.totalTarget, 0);
        const moneyAchieved = money.reduce((a, g) => a + g.totalAchieved, 0);
        return {
          seller,
          goals,
          moneyTarget,
          moneyAchieved,
          pct: moneyTarget > 0 ? (moneyAchieved / moneyTarget) * 100 : 0,
          hasMoney: moneyTarget > 0,
          counterAchieved: counters.reduce((a, g) => a + g.totalAchieved, 0),
          counterTarget: counters.reduce((a, g) => a + g.totalTarget, 0),
        };
      })
      .sort((a, b) => {
        if (a.hasMoney !== b.hasMoney) return a.hasMoney ? -1 : 1;
        return b.pct - a.pct;
      });
  }, [sellers, goalsBySeller, companyGoalsBySeller]);

  const company = useMemo(() => {
    const target = team.reduce((a, m) => a + m.moneyTarget, 0);
    const achieved =
      team.reduce((a, m) => a + m.moneyAchieved, 0) +
      nonSellerGoals.reduce((a, g) => a + g.totalAchieved, 0);
    return {
      target,
      achieved,
      pct: target > 0 ? (achieved / target) * 100 : 0,
      hasTarget: target > 0,
    };
  }, [team, nonSellerGoals]);

  const companyStatus = statusOf(company.pct, company.hasTarget);
  const counts = {
    done: team.filter((m) => statusOf(m.pct, m.hasMoney) === "done").length,
    ahead: team.filter((m) => statusOf(m.pct, m.hasMoney) === "ahead").length,
    on: team.filter((m) => statusOf(m.pct, m.hasMoney) === "on").length,
    late: team.filter((m) => statusOf(m.pct, m.hasMoney) === "late").length,
  };

  const isPastYear = year < new Date().getFullYear();

  const renderHeat = (goal: GoalWithMonths) => (
    <div className="min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground shrink-0">{getGoalTypeIcon(goal.goal_type)}</span>
        <span className="text-sm font-medium truncate" title={goal.title}>{goal.title}</span>
        <span className="text-[10px] uppercase text-muted-foreground shrink-0">
          {getGoalTypeLabel(goal.goal_type)}
        </span>
      </div>
      <div className="grid grid-cols-12 gap-1">
        {goal.months.map((cell, idx) => {
          const isFuture = currentMonthIdx >= 0 && idx > currentMonthIdx;
          return (
            <Tooltip key={idx}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "h-7 rounded cursor-help transition-colors",
                    heatClass(cell.percentage, cell.target, cell.achieved, isFuture),
                    idx === currentMonthIdx && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                  )}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs font-semibold">{MONTH_LABELS[idx]}/{year}</p>
                {cell.target > 0 ? (
                  <>
                    <p className="text-xs">Meta: {formatGoalValue(goal.goal_type, cell.target)}</p>
                    <p className="text-xs">Realizado: {formatGoalValue(goal.goal_type, cell.achieved)}</p>
                    <p className="text-xs font-semibold">{cell.percentage.toFixed(0)}% da meta</p>
                  </>
                ) : (
                  <p className="text-xs">
                    {cell.achieved > 0
                      ? `${formatGoalValue(goal.goal_type, cell.achieved)} (sem meta definida)`
                      : "Sem registro"}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-xs text-muted-foreground">
          {goal.totalTarget > 0
            ? `${formatGoalValue(goal.goal_type, goal.totalAchieved)} de ${formatGoalValue(goal.goal_type, goal.totalTarget)}`
            : formatGoalValue(goal.goal_type, goal.totalAchieved)}
        </p>
        {goal.totalTarget > 0 && (
          <p className={cn("text-xs font-semibold tabular-nums", STATUS_META[statusOf(goal.totalPercentage, true)].text)}>
            {goal.totalPercentage.toFixed(0)}%
          </p>
        )}
      </div>
    </div>
  );

  const monthHeader = (
    <div className="grid grid-cols-12 gap-1 mb-1">
      {MONTH_LABELS.map((m, idx) => (
        <p
          key={m}
          className={cn(
            "text-center text-[10px] font-medium",
            idx === currentMonthIdx ? "text-primary" : "text-muted-foreground"
          )}
        >
          {m}
        </p>
      ))}
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-2">
              Métricas de Equipe
            </h1>
            <p className="text-muted-foreground">
              Quem está no ritmo, quem está à frente e quem precisa de ajuda
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border p-0.5">
              {(["ranking", "grade"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                    view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {v === "ranking" ? "Ranking" : "Grade"}
                </button>
              ))}
            </div>
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="w-[120px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando métricas...</CardContent></Card>
        ) : sellers.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum vendedor encontrado.</CardContent></Card>
        ) : (
          <>
            {/* Faixa da empresa: o número que o gerente procura primeiro */}
            <Card className={cn("border-l-4", STATUS_META[companyStatus].edge)}>
              <CardContent className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="p-3 rounded-xl bg-primary/15 shrink-0">
                      <Trophy className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Empresa {year}</p>
                      <p className="text-3xl font-bold tabular-nums leading-tight">
                        {compact(company.achieved)}
                        <span className="text-base font-normal text-muted-foreground">
                          {" "}de {compact(company.target)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className={cn("font-semibold", STATUS_META[companyStatus].text)}>
                        {company.pct.toFixed(0)}% da meta YTD
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        ritmo ideal {pacePct.toFixed(0)}% ·{" "}
                        <span className={cn("font-medium", STATUS_META[companyStatus].text)}>
                          {company.pct - pacePct >= 0 ? "+" : ""}
                          {(company.pct - pacePct).toFixed(0)} p.p.
                        </span>
                      </span>
                    </div>
                    <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", STATUS_META[companyStatus].bar)}
                        style={{ width: `${Math.min(company.pct, 100)}%` }}
                      />
                      <div
                        className="absolute inset-y-0 w-0.5 bg-foreground/70"
                        style={{ left: `${pacePct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {([["done", counts.done], ["ahead", counts.ahead], ["on", counts.on], ["late", counts.late]] as const).map(
                      ([key, n]) => (
                        <div key={key} className={cn("rounded-lg border px-3 py-2 text-center", STATUS_META[key].chip)}>
                          <p className="text-lg font-bold tabular-nums leading-none">{n}</p>
                          <p className="text-[10px] uppercase mt-1 leading-tight">{STATUS_META[key].label}</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Legenda de ritmo */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5" /> Ritmo
              </span>
              {(["done", "ahead", "on", "late"] as const).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={cn("w-3 h-3 rounded", STATUS_META[k].bar)} />
                  {STATUS_META[k].label}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="w-0.5 h-3.5 bg-foreground/70" />
                ritmo ideal {pacePct.toFixed(0)}%
              </span>
              {isPastYear && <span className="italic">ano encerrado —ritmo=100%</span>}
            </div>

            {view === "ranking" ? (
              <div className="space-y-2">
                {team.map((m, idx) => {
                  const st = statusOf(m.pct, m.hasMoney);
                  const open = expanded === m.seller.id;
                  return (
                    <Card key={m.seller.id} className={cn("transition-shadow", open && "shadow-md border-primary/30")}>
                      <button
                        onClick={() => setExpanded(open ? null : m.seller.id)}
                        className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <p className="w-6 text-sm font-bold text-muted-foreground tabular-nums shrink-0">{idx + 1}º</p>
                          <div className="min-w-0 w-40 shrink-0">
                            <p className="font-semibold truncate">{m.seller.full_name}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", STATUS_META[st].bar)}
                                style={{ width: `${Math.min(m.pct, 100)}%` }}
                              />
                              <div className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${pacePct}%` }} />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                              {m.hasMoney ? (
                                <>
                                  {compact(m.moneyAchieved)} de {compact(m.moneyTarget)}
                                  {m.counterTarget > 0 && (
                                    <> · {Math.round(m.counterAchieved)}/{Math.round(m.counterTarget)} em tarefas/atividades</>
                                  )}
                                </>
                              ) : (
                                <>sem meta monetária em {year}</>
                              )}
                            </p>
                          </div>
                          <div className="text-right shrink-0 w-28">
                            <p className={cn("text-lg font-bold tabular-nums leading-tight", STATUS_META[st].text)}>
                              {m.hasMoney ? `${m.pct.toFixed(0)}%` : "—"}
                            </p>
                            <span className={cn("inline-block text-[10px] uppercase border rounded px-1.5 py-0.5", STATUS_META[st].chip)}>
                              {STATUS_META[st].label}
                            </span>
                          </div>
                          <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
                        </div>
                      </button>

                      {open && (
                        <CardContent className="pt-0 space-y-5">
                          {m.goals.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">Nenhuma meta em {year}.</p>
                          ) : (
                            <div className="space-y-4">
                              {monthHeader}
                              {m.goals.map((g) => (
                                <div key={g.id} className="p-3 rounded-lg border bg-muted/20">
                                  {renderHeat(g)}
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="space-y-6">
                  {monthHeader}
                  {team.map((m) => {
                    if (m.goals.length === 0) return null;
                    return (
                      <div key={m.seller.id} className="space-y-3 pb-4 border-b last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{m.seller.full_name}</p>
                          <p className={cn("text-sm font-semibold tabular-nums", STATUS_META[statusOf(m.pct, m.hasMoney)].text)}>
                            {m.hasMoney ? `${m.pct.toFixed(0)}%` : "—"}
                          </p>
                        </div>
                        {m.goals.map((g) => (
                          <div key={g.id} className="p-3 rounded-lg border bg-muted/20">
                            {renderHeat(g)}
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {nonSellerGoals.length > 0 && (
                    <div className="space-y-3 pt-4 border-t">
                      <p className="font-semibold text-muted-foreground">Fechamentos sem vendedor vinculado</p>
                      {monthHeader}
                      {nonSellerGoals.map((g) => (
                        <div key={g.id} className="p-3 rounded-lg border bg-muted/20">
                          {renderHeat(g)}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {nonSellerGoals.length > 0 && view === "ranking" && (
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {compact(nonSellerGoals.reduce((a, g) => a + g.totalAchieved, 0))}
                    </span>{" "}
                    em fechamentos sem vendedor vinculado entram no total da empresa mas não no ranking.
                    <button onClick={() => setView("grade")} className="ml-1 underline text-primary">
                      ver na grade
                    </button>
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </TooltipProvider>
  );
};

export default MetricasEquipe;
