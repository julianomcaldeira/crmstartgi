import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trophy,
  Target,
  DollarSign,
  TrendingUp,
  ListTodo,
  Activity,
  CheckCircle2,
  Calendar,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { ptBR } from "date-fns/locale";
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
        firstWonAtByOpportunity.set(activity.opportunity_id, activity.created_at);
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

const MetricasEquipe = () => {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [goalsBySeller, setGoalsBySeller] = useState<Record<string, GoalWithMonths[]>>({});
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
      // 1. Get only vendedores (exclude admins/gestores)
      const { data: vendedorRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "vendedor");

      if (rolesError) throw rolesError;

      const vendedorIds = (vendedorRoles || []).map((r) => r.user_id);
      if (vendedorIds.length === 0) {
        setSellers([]);
        setGoalsBySeller({});
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", vendedorIds)
        .or("is_deleted.is.null,is_deleted.eq.false")
        .order("full_name");

      if (profilesError) throw profilesError;

      const sellerList = profiles || [];
      setSellers(sellerList);

      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const { bySeller: sellerMonetaryAchieved, nonSeller } =
        await loadWonAchievementBucketsForYear(year, vendedorIds);

      setNonSellerAchieved(nonSeller);

      // 2. Fetch goals overlapping the selected year
      const { data: goals, error: goalsError } = await supabase
        .from("goals")
        .select("*")
        .in("assigned_to", vendedorIds)
        .lte("start_date", yearEnd)
        .gte("end_date", yearStart);

      if (goalsError) throw goalsError;

      // 3. For each goal, compute month-by-month progress
      const computed: Record<string, GoalWithMonths[]> = {};
      const today = new Date();

      await Promise.all(
        (goals || []).map(async (goal: any) => {
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

          // Target per month rules:
          // - revenue / annualized_sales: target_value is treated as a total for the
          //   covered period, so distribute across the covered months in the year
          // - other goals with period mensal: target_value is already monthly
          // - other goals with period anual / semestral: distribute by 12 / 6
          const isMonetaryGoal =
            goal.goal_type === "revenue" || goal.goal_type === "annualized_sales";
          const perMonthTarget = isMonetaryGoal
            ? targetValue / coveredCount
            : period === "anual"
            ? targetValue / 12
            : period === "semestral"
            ? targetValue / 6
            : targetValue;

          for (let m = 0; m < 12; m++) {
            if (!monthsCovered[m]) {
              months.push({ target: 0, achieved: 0, percentage: 0 });
              continue;
            }

            const mStart = new Date(year, m, 1);
            const mEnd = new Date(year, m + 1, 0);
            const startStr = format(mStart, "yyyy-MM-dd");
            const endStr = format(mEnd, "yyyy-MM-dd");

            // Only compute achieved up to end of current month (future stays 0)
            let achieved = 0;
            if (mStart <= today) {
              if (monetaryAchieved) {
                achieved = monetaryAchieved[m] || 0;
              } else {
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

          // Year-to-Date totals: only sum target/achieved up to the current
          // month for the current year. Past years sum the full 12 months;
          // future years sum nothing.
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

          if (!computed[goal.assigned_to]) computed[goal.assigned_to] = [];
          computed[goal.assigned_to].push(item);
        })
      );

      // Sort goals per seller by type then title
      Object.keys(computed).forEach((sid) => {
        computed[sid].sort((a, b) =>
          a.goal_type === b.goal_type
            ? a.title.localeCompare(b.title)
            : a.goal_type.localeCompare(b.goal_type)
        );
      });

      setGoalsBySeller(computed);
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

  const getCellClass = (pct: number, target: number, isFuture: boolean) => {
    if (target === 0) return "bg-muted/30 text-muted-foreground";
    if (isFuture) return "bg-muted/20 text-muted-foreground";
    if (pct >= 100) return "bg-success/15 text-success font-semibold";
    if (pct >= 70) return "bg-warning/15 text-warning font-medium";
    if (pct > 0) return "bg-destructive/10 text-destructive";
    return "bg-muted/30 text-muted-foreground";
  };

  const currentMonthIdx =
    new Date().getFullYear() === year ? new Date().getMonth() : -1;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-2">
              Métricas de Equipe
            </h1>
            <p className="text-muted-foreground">
              Acompanhamento mês a mês das metas de cada vendedor
            </p>
          </div>

          <Select
            value={String(year)}
            onValueChange={(v) => setYear(parseInt(v))}
          >
            <SelectTrigger className="w-[160px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Carregando métricas...
            </CardContent>
          </Card>
        ) : sellers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum vendedor encontrado.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Company-wide aggregated summary */}
            {(() => {
              // Group goals across all sellers by a stable key:
              // goal_type + task/activity filter so we don't mix Ligações with Propostas.
              const aggregated = new Map<
                string,
                {
                  key: string;
                  goal_type: string;
                  title: string;
                  months: MonthCell[];
                  totalTarget: number;
                  totalAchieved: number;
                  totalPercentage: number;
                }
              >();

              Object.values(goalsBySeller).flat().forEach((g) => {
                const subKey =
                  g.goal_type === "tasks"
                    ? g.task_type_filter || "all"
                    : g.goal_type === "activities"
                    ? g.activity_type_filter || "all"
                    : "all";
                const key = `${g.goal_type}::${subKey}`;
                let label = getGoalTypeLabel(g.goal_type);
                if (g.goal_type === "tasks" && g.task_type_filter) {
                  label = `Tarefas — ${g.task_type_filter}`;
                } else if (g.goal_type === "activities" && g.activity_type_filter) {
                  label = `Atividades — ${g.activity_type_filter}`;
                }

                const existing = aggregated.get(key);
                if (!existing) {
                  aggregated.set(key, {
                    key,
                    goal_type: g.goal_type,
                    title: label,
                    months: g.months.map((c) => ({ ...c })),
                    totalTarget: g.totalTarget,
                    totalAchieved: g.totalAchieved,
                    totalPercentage: 0,
                  });
                } else {
                  existing.months = existing.months.map((c, i) => ({
                    target: c.target + g.months[i].target,
                    achieved: c.achieved + g.months[i].achieved,
                    percentage: 0,
                  }));
                  existing.totalTarget += g.totalTarget;
                  existing.totalAchieved += g.totalAchieved;
                }
              });

              // Inject achieved-only contributions from admins/gestores
              // for revenue and annualized_sales. They add to "Realizado"
              // but NEVER add to "Meta".
              const injectNonSeller = (
                goalType: "revenue" | "annualized_sales",
                monthly: number[]
              ) => {
                const totalAchieved = monthly.reduce((s, v) => s + v, 0);
                if (totalAchieved === 0) return;
                const key = `${goalType}::all`;
                const label = getGoalTypeLabel(goalType);
                const existing = aggregated.get(key);

                // YTD slice for total
                const todayYear = new Date().getFullYear();
                const todayMonth = new Date().getMonth();
                const ytdLastIdx =
                  year < todayYear ? 11 : year > todayYear ? -1 : todayMonth;
                const ytdAchieved =
                  ytdLastIdx >= 0
                    ? monthly.slice(0, ytdLastIdx + 1).reduce((s, v) => s + v, 0)
                    : 0;

                if (!existing) {
                  aggregated.set(key, {
                    key,
                    goal_type: goalType,
                    title: label,
                    months: monthly.map((v) => ({
                      target: 0,
                      achieved: v,
                      percentage: 0,
                    })),
                    totalTarget: 0,
                    totalAchieved: ytdAchieved,
                    totalPercentage: 0,
                  });
                } else {
                  existing.months = existing.months.map((c, i) => ({
                    target: c.target,
                    achieved: c.achieved + monthly[i],
                    percentage: 0,
                  }));
                  existing.totalAchieved += ytdAchieved;
                }
              };

              injectNonSeller("revenue", nonSellerAchieved.revenue);
              injectNonSeller("annualized_sales", nonSellerAchieved.annualized_sales);

              // Recompute percentages
              const companyGoals = Array.from(aggregated.values()).map((g) => ({
                ...g,
                months: g.months.map((c) => ({
                  ...c,
                  percentage:
                    c.target > 0 ? Math.min((c.achieved / c.target) * 100, 999) : 0,
                })),
                totalPercentage:
                  g.totalTarget > 0 ? (g.totalAchieved / g.totalTarget) * 100 : 0,
              }));

              companyGoals.sort((a, b) => a.title.localeCompare(b.title));

              if (companyGoals.length === 0) return null;

              return (
                <Card className="shadow-xl border-l-4 border-l-success bg-gradient-to-br from-success/5 to-transparent">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-success" />
                          Total da Empresa
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Soma das metas de todos os vendedores
                        </p>
                      </div>
                      <Badge variant="outline" className="self-start sm:self-auto border-success/40 text-success">
                        {companyGoals.length} meta{companyGoals.length !== 1 ? "s" : ""} agregada{companyGoals.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px] sticky left-0 bg-background z-10">
                              Meta
                            </TableHead>
                            {MONTH_LABELS.map((m, idx) => (
                              <TableHead
                                key={m}
                                className={cn(
                                  "text-center min-w-[110px]",
                                  idx === currentMonthIdx &&
                                    "bg-primary/10 text-primary font-bold"
                                )}
                              >
                                {m}
                              </TableHead>
                            ))}
                            <TableHead className="text-center min-w-[140px] bg-muted/50 font-bold">
                              Total YTD
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {companyGoals.map((goal) => (
                            <Fragment key={goal.key}>
                              <TableRow className="border-t-2">
                                <TableCell
                                  rowSpan={3}
                                  className="align-top sticky left-0 bg-background z-10 border-r"
                                >
                                  <div className="flex items-start gap-2">
                                    <span className="text-muted-foreground mt-0.5">
                                      {getGoalTypeIcon(goal.goal_type)}
                                    </span>
                                    <div>
                                      <p className="font-semibold text-foreground leading-tight">
                                        {goal.title}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Empresa
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                                {goal.months.map((cell, idx) => (
                                  <TableCell
                                    key={`ct-${idx}`}
                                    className={cn(
                                      "text-center text-xs text-muted-foreground",
                                      idx === currentMonthIdx && "bg-primary/5"
                                    )}
                                  >
                                    {cell.target > 0 ? (
                                      <>
                                        Meta:{" "}
                                        <span className="font-medium text-foreground">
                                          {formatGoalValue(goal.goal_type, cell.target)}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="opacity-40">—</span>
                                    )}
                                  </TableCell>
                                ))}
                                <TableCell className="text-center text-xs bg-muted/30">
                                  Meta:{" "}
                                  <span className="font-bold text-foreground">
                                    {formatGoalValue(goal.goal_type, goal.totalTarget)}
                                  </span>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                {goal.months.map((cell, idx) => {
                                  const isFuture = idx > currentMonthIdx && currentMonthIdx >= 0;
                                  return (
                                    <TableCell
                                      key={`ca-${idx}`}
                                      className={cn(
                                        "text-center text-sm",
                                        idx === currentMonthIdx && "bg-primary/5"
                                      )}
                                    >
                                      {cell.target > 0 ? (
                                        <span
                                          className={cn(
                                            isFuture
                                              ? "text-muted-foreground"
                                              : "text-foreground font-medium"
                                          )}
                                        >
                                          {formatGoalValue(goal.goal_type, cell.achieved)}
                                        </span>
                                      ) : (
                                        <span className="opacity-40">—</span>
                                      )}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-center text-sm bg-muted/30 font-semibold">
                                  {formatGoalValue(goal.goal_type, goal.totalAchieved)}
                                </TableCell>
                              </TableRow>
                              <TableRow className="border-b-2">
                                {goal.months.map((cell, idx) => {
                                  const isFuture = idx > currentMonthIdx && currentMonthIdx >= 0;
                                  return (
                                    <TableCell
                                      key={`cp-${idx}`}
                                      className={cn(
                                        "text-center text-xs px-1",
                                        idx === currentMonthIdx && "ring-2 ring-primary/30"
                                      )}
                                    >
                                      {cell.target > 0 ? (
                                        <div
                                          className={cn(
                                            "rounded px-2 py-1 inline-flex items-center gap-1",
                                            getCellClass(cell.percentage, cell.target, isFuture)
                                          )}
                                        >
                                          {cell.percentage >= 100 && (
                                            <CheckCircle2 className="h-3 w-3" />
                                          )}
                                          {cell.percentage.toFixed(0)}%
                                        </div>
                                      ) : (
                                        <span className="opacity-40">—</span>
                                      )}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-center bg-muted/40">
                                  <div
                                    className={cn(
                                      "rounded px-2 py-1 inline-flex items-center gap-1 font-bold",
                                      getCellClass(goal.totalPercentage, goal.totalTarget, false)
                                    )}
                                  >
                                    {goal.totalPercentage >= 100 && (
                                      <CheckCircle2 className="h-3 w-3" />
                                    )}
                                    {goal.totalPercentage.toFixed(0)}%
                                  </div>
                                </TableCell>
                              </TableRow>
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {sellers.map((seller) => {
            const goals = goalsBySeller[seller.id] || [];
            return (
              <Card key={seller.id} className="shadow-lg border-l-4 border-l-primary">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-primary" />
                        {seller.full_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {seller.email}
                      </p>
                    </div>
                    <Badge variant="outline" className="self-start sm:self-auto">
                      {goals.length} meta{goals.length !== 1 ? "s" : ""} em {year}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {goals.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4">
                      Nenhuma meta cadastrada para este vendedor em {year}.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px] sticky left-0 bg-background z-10">
                              Meta
                            </TableHead>
                            {MONTH_LABELS.map((m, idx) => (
                              <TableHead
                                key={m}
                                className={cn(
                                  "text-center min-w-[110px]",
                                  idx === currentMonthIdx &&
                                    "bg-primary/10 text-primary font-bold"
                                )}
                              >
                                {m}
                              </TableHead>
                            ))}
                            <TableHead className="text-center min-w-[140px] bg-muted/50 font-bold">
                              Total YTD
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {goals.map((goal) => (
                            <Fragment key={goal.id}>

                              {/* Target row */}
                              <TableRow key={`${goal.id}-target`} className="border-t-2">
                                <TableCell
                                  rowSpan={3}
                                  className="align-top sticky left-0 bg-background z-10 border-r"
                                >
                                  <div className="flex items-start gap-2">
                                    <span className="text-muted-foreground mt-0.5">
                                      {getGoalTypeIcon(goal.goal_type)}
                                    </span>
                                    <div>
                                      <p className="font-semibold text-foreground leading-tight">
                                        {goal.title}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {getGoalTypeLabel(goal.goal_type)}
                                      </p>
                                      <Badge
                                        variant="secondary"
                                        className="mt-2 text-[10px]"
                                      >
                                        {goal.period === "mensal"
                                          ? "Mensal"
                                          : goal.period === "anual"
                                          ? "Anual"
                                          : "Semestral"}
                                      </Badge>
                                    </div>
                                  </div>
                                </TableCell>
                                {goal.months.map((cell, idx) => (
                                  <TableCell
                                    key={`t-${idx}`}
                                    className={cn(
                                      "text-center text-xs text-muted-foreground",
                                      idx === currentMonthIdx && "bg-primary/5"
                                    )}
                                  >
                                    {cell.target > 0 ? (
                                      <Tooltip>
                                        <TooltipTrigger className="cursor-help">
                                          Meta:{" "}
                                          <span className="font-medium text-foreground">
                                            {formatGoalValue(
                                              goal.goal_type,
                                              cell.target
                                            )}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="text-xs">
                                            Meta para {MONTH_LABELS[idx]}/{year}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <span className="opacity-40">—</span>
                                    )}
                                  </TableCell>
                                ))}
                                <TableCell className="text-center text-xs bg-muted/30">
                                  Meta:{" "}
                                  <span className="font-bold text-foreground">
                                    {formatGoalValue(
                                      goal.goal_type,
                                      goal.totalTarget
                                    )}
                                  </span>
                                </TableCell>
                              </TableRow>

                              {/* Achieved row */}
                              <TableRow key={`${goal.id}-achieved`}>
                                {goal.months.map((cell, idx) => {
                                  const isFuture = idx > currentMonthIdx && currentMonthIdx >= 0;
                                  return (
                                    <TableCell
                                      key={`a-${idx}`}
                                      className={cn(
                                        "text-center text-sm",
                                        idx === currentMonthIdx && "bg-primary/5"
                                      )}
                                    >
                                      {cell.target > 0 ? (
                                        <span
                                          className={cn(
                                            isFuture
                                              ? "text-muted-foreground"
                                              : "text-foreground font-medium"
                                          )}
                                        >
                                          {formatGoalValue(
                                            goal.goal_type,
                                            cell.achieved
                                          )}
                                        </span>
                                      ) : (
                                        <span className="opacity-40">—</span>
                                      )}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-center text-sm bg-muted/30 font-semibold">
                                  {formatGoalValue(
                                    goal.goal_type,
                                    goal.totalAchieved
                                  )}
                                </TableCell>
                              </TableRow>

                              {/* Percentage row */}
                              <TableRow
                                key={`${goal.id}-pct`}
                                className="border-b-2"
                              >
                                {goal.months.map((cell, idx) => {
                                  const isFuture =
                                    idx > currentMonthIdx && currentMonthIdx >= 0;
                                  return (
                                    <TableCell
                                      key={`p-${idx}`}
                                      className={cn(
                                        "text-center text-xs px-1",
                                        idx === currentMonthIdx && "ring-2 ring-primary/30"
                                      )}
                                    >
                                      {cell.target > 0 ? (
                                        <div
                                          className={cn(
                                            "rounded px-2 py-1 inline-flex items-center gap-1",
                                            getCellClass(
                                              cell.percentage,
                                              cell.target,
                                              isFuture
                                            )
                                          )}
                                        >
                                          {cell.percentage >= 100 && (
                                            <CheckCircle2 className="h-3 w-3" />
                                          )}
                                          {cell.percentage.toFixed(0)}%
                                        </div>
                                      ) : (
                                        <span className="opacity-40">—</span>
                                      )}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-center bg-muted/40">
                                  <div
                                    className={cn(
                                      "rounded px-2 py-1 inline-flex items-center gap-1 font-bold",
                                      getCellClass(
                                        goal.totalPercentage,
                                        goal.totalTarget,
                                        false
                                      )
                                    )}
                                  >
                                    {goal.totalPercentage >= 100 && (
                                      <CheckCircle2 className="h-3 w-3" />
                                    )}
                                    {goal.totalPercentage.toFixed(0)}%
                                  </div>
                                </TableCell>
                              </TableRow>
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>

                      {/* Legend */}
                      <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <HelpCircle className="h-3 w-3" />
                          <span>Legenda:</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="inline-block w-3 h-3 rounded bg-success/15 border border-success/30" />
                          ≥ 100% atingido
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="inline-block w-3 h-3 rounded bg-warning/15 border border-warning/30" />
                          70–99%
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="inline-block w-3 h-3 rounded bg-destructive/10 border border-destructive/30" />
                          1–69%
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="inline-block w-3 h-3 rounded bg-muted/30 border border-border" />
                          Sem registro / fora do período
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              );
            })}
          </>
        )}
      </div>
    </TooltipProvider>
  );
};

export default MetricasEquipe;
