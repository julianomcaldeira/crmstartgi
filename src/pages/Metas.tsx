import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TrendingUp, Target, DollarSign, CheckSquare, Plus, Pencil, Trash2, Users, Filter, BarChart3, LineChart, TrendingDown, List } from "lucide-react";
import { CurrencyInput } from "@/components/ui/masked-input";
import { Switch } from "@/components/ui/switch";
import { BarChart, Bar, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Metas = () => {
  const [goals, setGoals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGestor, setIsGestor] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [goalsProgress, setGoalsProgress] = useState<any[]>([]);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  
  // Filter states
  const [filterSeller, setFilterSeller] = useState<string>("all");
  const [filterGoalType, setFilterGoalType] = useState<string>("all");
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [groupBySeller, setGroupBySeller] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    goal_type: "revenue",
    target_value: "",
    period: "mensal",
    start_date: "",
    end_date: "",
    assigned_to: "none",
  });

  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        checkAdminStatus(),
        fetchUsers(),
      ]);
      await fetchGoals();
    };
    initializeData();
  }, []);

  useEffect(() => {
    if (goals.length > 0) {
      fetchGoalsProgress();
      fetchHistoricalData();
    }
  }, [goals]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setIsAdmin(data?.role === "admin");
      setIsGestor(data?.role === "gestor");
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .or("is_deleted.is.null,is_deleted.eq.false")
        .order("full_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchGoals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is admin or gestor
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const canViewAll = roleData?.role === "admin" || roleData?.role === "gestor";

      // Optimized query with JOIN
      let query = supabase
        .from("goals")
        .select(`
          *,
          assigned_user:profiles!goals_assigned_to_fkey(id, full_name, email)
        `)
        .order("end_date", { ascending: false });

      // If not admin/gestor, only show their own goals
      if (!canViewAll) {
        query = query.or(`assigned_to.eq.${user.id},assigned_to.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error("Error fetching goals:", error);
      toast.error("Erro ao carregar metas");
    } finally {
      setLoading(false);
    }
  };

  const fetchGoalsProgress = async () => {
    try {
      const progressData = await Promise.all(
        goals.map(async (goal) => {
          let currentValue = 0;

          if (goal.goal_type === "revenue" || goal.goal_type === "annualized_sales") {
            // Fetch won opportunities in the goal period
            let query = supabase
              .from("opportunities")
              .select("value, monthly_value, created_at")
              .eq("status", "won")
              .gte("created_at", goal.start_date)
              .lte("created_at", goal.end_date);

            if (goal.assigned_to) {
              query = query.eq("assigned_to", goal.assigned_to);
            }

            const { data: opportunities } = await query;

            if (opportunities) {
              currentValue = opportunities.reduce((sum, opp) => {
                if (goal.goal_type === "revenue") {
                  return sum + (opp.value || 0);
                } else {
                  return sum + ((opp.monthly_value || 0) * 12);
                }
              }, 0);
            }
          } else if (goal.goal_type === "tasks") {
            // Fetch completed tasks in the goal period
            let query = supabase
              .from("tasks")
              .select("id")
              .eq("status", "completed")
              .gte("completed_at", goal.start_date)
              .lte("completed_at", goal.end_date);

            if (goal.assigned_to) {
              query = query.eq("assigned_to", goal.assigned_to);
            }

            const { data: tasks, count } = await query;
            currentValue = count || 0;
          } else if (goal.goal_type === "activities") {
            // Fetch all completed tasks as activities
            let query = supabase
              .from("tasks")
              .select("id")
              .eq("status", "completed")
              .gte("completed_at", goal.start_date)
              .lte("completed_at", goal.end_date);

            if (goal.assigned_to) {
              query = query.eq("assigned_to", goal.assigned_to);
            }

            const { data: tasks, count } = await query;
            currentValue = count || 0;
          }

          const progress = (currentValue / goal.target_value) * 100;
          const daysInPeriod = Math.ceil(
            (new Date(goal.end_date).getTime() - new Date(goal.start_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          const daysPassed = Math.ceil(
            (new Date().getTime() - new Date(goal.start_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          const expectedProgress = Math.min(100, (daysPassed / daysInPeriod) * 100);
          const projection = daysPassed > 0 ? (currentValue / daysPassed) * daysInPeriod : 0;

          return {
            ...goal,
            currentValue,
            progress: Math.min(100, progress),
            expectedProgress: Math.max(0, expectedProgress),
            projection,
            isOnTrack: progress >= expectedProgress,
          };
        })
      );

      setGoalsProgress(progressData);
    } catch (error) {
      console.error("Error fetching goals progress:", error);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is admin or gestor
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const canViewAll = roleData?.role === "admin" || roleData?.role === "gestor";

      let query = supabase
        .from("goals")
        .select(`
          *,
          profiles:assigned_to(id, full_name, email)
        `)
        .gte("end_date", twelveMonthsAgo.toISOString())
        .order("end_date", { ascending: true });

      if (!canViewAll) {
        query = query.or(`assigned_to.eq.${user.id},assigned_to.is.null`);
      }

      const { data: historicalGoals } = await query;

      if (historicalGoals) {
        const historyWithProgress = await Promise.all(
          historicalGoals.map(async (goal) => {
            let currentValue = 0;

            if (goal.goal_type === "revenue" || goal.goal_type === "annualized_sales") {
              let query = supabase
                .from("opportunities")
                .select("value, monthly_value, created_at")
                .eq("status", "won")
                .gte("created_at", goal.start_date)
                .lte("created_at", goal.end_date);

              if (goal.assigned_to) {
                query = query.eq("assigned_to", goal.assigned_to);
              }

              const { data: opportunities } = await query;

              if (opportunities) {
                currentValue = opportunities.reduce((sum, opp) => {
                  if (goal.goal_type === "revenue") {
                    return sum + (opp.value || 0);
                  } else {
                    return sum + ((opp.monthly_value || 0) * 12);
                  }
                }, 0);
              }
            } else if (goal.goal_type === "tasks" || goal.goal_type === "activities") {
              let query = supabase
                .from("tasks")
                .select("id")
                .eq("status", "completed")
                .gte("completed_at", goal.start_date)
                .lte("completed_at", goal.end_date);

              if (goal.assigned_to) {
                query = query.eq("assigned_to", goal.assigned_to);
              }

              const { data: tasks, count } = await query;
              currentValue = count || 0;
            }

            const achievement = (currentValue / goal.target_value) * 100;

            return {
              ...goal,
              currentValue,
              achievement: Math.min(100, achievement),
            };
          })
        );

        setHistoricalData(historyWithProgress);
      }
    } catch (error) {
      console.error("Error fetching historical data:", error);
    }
  };

  const handleCreateOrUpdateGoal = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const goalData = {
        title: formData.title,
        description: formData.description,
        goal_type: formData.goal_type as "revenue" | "annualized_sales" | "tasks" | "activities",
        target_value: parseFloat(formData.target_value),
        period: formData.period,
        start_date: formData.start_date,
        end_date: formData.end_date,
        assigned_to: formData.assigned_to || null,
        created_by: user.id,
      };

      if (editingGoal) {
        const { error } = await supabase
          .from("goals")
          .update(goalData)
          .eq("id", editingGoal.id);

        if (error) throw error;
        toast.success("Meta atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("goals")
          .insert([goalData]);

        if (error) throw error;
        toast.success("Meta criada com sucesso!");
      }

      setDialogOpen(false);
      resetForm();
      fetchGoals();
    } catch (error) {
      console.error("Error saving goal:", error);
      toast.error("Erro ao salvar meta");
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta meta?")) return;

    try {
      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", goalId);

      if (error) throw error;
      toast.success("Meta excluída com sucesso!");
      fetchGoals();
    } catch (error) {
      console.error("Error deleting goal:", error);
      toast.error("Erro ao excluir meta");
    }
  };

  const openEditDialog = (goal: any) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      description: goal.description || "",
      goal_type: goal.goal_type,
      target_value: goal.target_value.toString(),
      period: goal.period || "mensal",
      start_date: goal.start_date,
      end_date: goal.end_date,
      assigned_to: goal.assigned_to || "none",
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingGoal(null);
    setFormData({
      title: "",
      description: "",
      goal_type: "revenue",
      target_value: "",
      period: "mensal",
      start_date: "",
      end_date: "",
      assigned_to: "none",
    });
  };

  const getGoalIcon = (type: string) => {
    switch (type) {
      case "revenue": return DollarSign;
      case "annualized_sales": return TrendingUp;
      case "tasks": return CheckSquare;
      case "activities": return Target;
      default: return Target;
    }
  };

  const getGoalTypeLabel = (type: string) => {
    switch (type) {
      case "revenue": return "Receita Caixa";
      case "annualized_sales": return "Venda Anualizada";
      case "tasks": return "Tarefas";
      case "activities": return "Atividades";
      default: return type;
    }
  };

  const formatValue = (value: number, type: string) => {
    if (type === "revenue" || type === "annualized_sales") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
    }
    return value.toString();
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "mensal": return "Mensal";
      case "semestral": return "Semestral";
      case "anual": return "Anual";
      default: return period;
    }
  };

  // Memoized filtered goals
  const filteredGoals = useMemo(() => {
    let filtered = [...goals];

    // Filter by seller
    if (filterSeller !== "all") {
      if (filterSeller === "unassigned") {
        filtered = filtered.filter(g => !g.assigned_to);
      } else {
        filtered = filtered.filter(g => g.assigned_to === filterSeller);
      }
    }

    // Filter by goal type
    if (filterGoalType !== "all") {
      filtered = filtered.filter(g => g.goal_type === filterGoalType);
    }

    // Filter by period
    if (filterPeriod !== "all") {
      filtered = filtered.filter(g => g.period === filterPeriod);
    }

    return filtered;
  }, [goals, filterSeller, filterGoalType, filterPeriod]);

  // Group goals by seller
  const groupedGoals = useMemo(() => {
    if (!groupBySeller) return null;

    const grouped = new Map<string, any[]>();
    
    filteredGoals.forEach(goal => {
      const key = goal.assigned_to || "unassigned";
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(goal);
    });

    return grouped;
  }, [filteredGoals, groupBySeller]);

  // Chart data for seller comparison
  const sellerComparisonData = useMemo(() => {
    if (!goalsProgress.length) return [];

    const sellerMap = new Map<string, { name: string; meta: number; atual: number; previsao: number }>();

    goalsProgress.forEach((goal) => {
      const sellerId = goal.assigned_to || "unassigned";
      const sellerName = goal.profiles?.full_name || "Não atribuído";

      if (!sellerMap.has(sellerId)) {
        sellerMap.set(sellerId, { name: sellerName, meta: 0, atual: 0, previsao: 0 });
      }

      const seller = sellerMap.get(sellerId)!;
      seller.meta += goal.target_value;
      seller.atual += goal.currentValue;
      seller.previsao += goal.projection;
    });

    return Array.from(sellerMap.values());
  }, [goalsProgress]);

  // Monthly evolution data
  const monthlyEvolutionData = useMemo(() => {
    if (!goalsProgress.length) return [];

    // Group by month
    const monthlyData = new Map<string, { month: string; meta: number; realizado: number }>();

    goalsProgress.forEach((goal) => {
      const startDate = new Date(goal.start_date);
      const endDate = new Date(goal.end_date);
      const monthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = startDate.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { month: monthLabel, meta: 0, realizado: 0 });
      }

      const data = monthlyData.get(monthKey)!;
      data.meta += goal.target_value;
      data.realizado += goal.currentValue;
    });

    return Array.from(monthlyData.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [goalsProgress]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Metas</h1>
          <p className="text-muted-foreground">
            {isAdmin || isGestor ? "Gerencie as metas da equipe" : "Acompanhe seu progresso e objetivos"}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Meta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingGoal ? "Editar Meta" : "Criar Nova Meta"}</DialogTitle>
                <DialogDescription>
                  {editingGoal ? "Atualize as informações da meta" : "Defina uma nova meta para a equipe"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título da Meta *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Ex: Meta de Vendas Q1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal_type">Tipo de Meta *</Label>
                    <Select
                      value={formData.goal_type}
                      onValueChange={(value) => setFormData({ ...formData, goal_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue">Receita Caixa</SelectItem>
                        <SelectItem value="annualized_sales">Venda Anualizada</SelectItem>
                        <SelectItem value="tasks">Tarefas</SelectItem>
                        <SelectItem value="activities">Atividades</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva a meta..."
                    rows={3}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="target_value">Valor Alvo *</Label>
                    {(formData.goal_type === "revenue" || formData.goal_type === "annualized_sales") ? (
                      <CurrencyInput
                        id="target_value"
                        value={formData.target_value}
                        onValueChange={(value) => setFormData({ ...formData, target_value: value })}
                        placeholder="R$ 0,00"
                      />
                    ) : (
                      <Input
                        id="target_value"
                        type="number"
                        value={formData.target_value}
                        onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                        placeholder="Ex: 100"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period">Período *</Label>
                    <Select
                      value={formData.period}
                      onValueChange={(value) => setFormData({ ...formData, period: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="semestral">Semestral</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Data Início *</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">Data Fim *</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assigned_to">Atribuir a</Label>
                  <Select
                    value={formData.assigned_to || "none"}
                    onValueChange={(value) => setFormData({ ...formData, assigned_to: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um usuário (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum usuário específico</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateOrUpdateGoal}>
                    {editingGoal ? "Atualizar" : "Criar"} Meta
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Vendedor
            </Label>
            <Select value={filterSeller} onValueChange={setFilterSeller}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(isAdmin || isGestor) && (
                  <>
                    <SelectItem value="unassigned">Não atribuído</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </>
                )}
                {!isAdmin && !isGestor && currentUserId && (
                  <SelectItem value={currentUserId}>Minhas metas</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Meta</Label>
            <Select value={filterGoalType} onValueChange={setFilterGoalType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="revenue">Receita Caixa</SelectItem>
                <SelectItem value="annualized_sales">Venda Anualizada</SelectItem>
                <SelectItem value="tasks">Tarefas</SelectItem>
                <SelectItem value="activities">Atividades</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="semestral">Semestral</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(isAdmin || isGestor) && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Agrupar por vendedor
              </Label>
              <div className="flex items-center space-x-2 h-10">
                <Switch
                  checked={groupBySeller}
                  onCheckedChange={setGroupBySeller}
                />
                <span className="text-sm text-muted-foreground">
                  {groupBySeller ? "Ativado" : "Desativado"}
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Tabs defaultValue="lista" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="lista" className="gap-2">
            <Target className="h-4 w-4" />
            Cards
          </TabsTrigger>
          <TabsTrigger value="tabela" className="gap-2">
            <List className="h-4 w-4" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-6">
          {loading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : filteredGoals.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Target className="mx-auto mb-4 text-muted-foreground" size={48} />
            <p className="text-muted-foreground">
              Nenhuma meta definida ainda
            </p>
          </CardContent>
        </Card>
      ) : groupBySeller && groupedGoals ? (
        <div className="space-y-6">
          {Array.from(groupedGoals.entries()).map(([sellerId, sellerGoals]) => {
            const seller = sellerId === "unassigned" 
              ? { full_name: "Não atribuído", email: "" }
              : users.find(u => u.id === sellerId);

            return (
              <Card key={sellerId} className="border-2">
                <CardHeader className="bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Users className="text-primary" size={20} />
                    </div>
                    <div>
                      <CardTitle className="text-xl">
                        {seller?.full_name || "Vendedor desconhecido"}
                      </CardTitle>
                      {seller?.email && (
                        <p className="text-sm text-muted-foreground">{seller.email}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="ml-auto">
                      {sellerGoals.length} {sellerGoals.length === 1 ? "meta" : "metas"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sellerGoals.map((goal) => {
                      const Icon = getGoalIcon(goal.goal_type);
                      return (
                        <Card key={goal.id} className="hover:shadow-md transition-shadow">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                  <Icon className="text-primary" size={20} />
                                </div>
                                <div className="flex-1">
                                  <CardTitle className="text-base mb-1">
                                    {goal.title}
                                  </CardTitle>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {getGoalTypeLabel(goal.goal_type)}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {getPeriodLabel(goal.period)}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              {isAdmin && (
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditDialog(goal)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleDeleteGoal(goal.id)}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {goal.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {goal.description}
                              </p>
                            )}
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="font-medium">Meta</span>
                                <span className="text-base font-bold text-primary">
                                  {formatValue(goal.target_value, goal.goal_type)}
                                </span>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-border">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Período</span>
                                <span className="font-medium">
                                  {new Date(goal.start_date).toLocaleDateString("pt-BR")} - {new Date(goal.end_date).toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
          {filteredGoals.map((goal) => {
            const Icon = getGoalIcon(goal.goal_type);

            return (
              <Card key={goal.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="text-primary" size={24} />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">
                          {goal.title}
                        </CardTitle>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {getGoalTypeLabel(goal.goal_type)}
                          </Badge>
                          <Badge variant="secondary">
                            {getPeriodLabel(goal.period)}
                          </Badge>
                          {goal.profiles && (
                            <Badge variant="secondary">
                              {goal.profiles.full_name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(goal)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteGoal(goal.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {goal.description && (
                    <p className="text-sm text-muted-foreground">
                      {goal.description}
                    </p>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Meta</span>
                      <span className="text-lg font-bold text-primary">
                        {formatValue(goal.target_value, goal.goal_type)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Período</span>
                      <span className="font-medium">
                        {new Date(goal.start_date).toLocaleDateString("pt-BR")} -{" "}
                        {new Date(goal.end_date).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
        </TabsContent>

        {/* Nova aba de Lista/Tabela */}
        <TabsContent value="tabela" className="space-y-6">
          {loading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : goalsProgress.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Target className="mx-auto mb-4 text-muted-foreground" size={48} />
                <p className="text-muted-foreground">
                  Nenhuma meta definida ainda
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <List className="h-5 w-5" />
                  Visão em Lista
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Todas as metas com progresso atual e projeção
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Meta</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Valor Alvo</TableHead>
                        <TableHead className="text-right">Atual</TableHead>
                        <TableHead className="text-right">Progresso</TableHead>
                        <TableHead className="text-right">Projeção</TableHead>
                        <TableHead>Status</TableHead>
                        {isAdmin && <TableHead className="text-center">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {goalsProgress
                        .filter(goal => {
                          if (filterSeller !== "all") {
                            if (filterSeller === "unassigned") return !goal.assigned_to;
                            return goal.assigned_to === filterSeller;
                          }
                          if (filterGoalType !== "all") return goal.goal_type === filterGoalType;
                          if (filterPeriod !== "all") return goal.period === filterPeriod;
                          return true;
                        })
                        .map((goal) => {
                          const Icon = getGoalIcon(goal.goal_type);
                          return (
                            <TableRow key={goal.id} className="hover:bg-muted/50">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 bg-primary/10 rounded">
                                    <Icon className="h-4 w-4 text-primary" />
                                  </div>
                                  <span className="font-medium">{goal.title}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {getGoalTypeLabel(goal.goal_type)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {goal.profiles?.full_name || goal.assigned_user?.full_name || "Não atribuído"}
                              </TableCell>
                              <TableCell>
                                <span className="text-xs">
                                  {new Date(goal.start_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} - {new Date(goal.end_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatValue(goal.target_value, goal.goal_type)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatValue(goal.currentValue, goal.goal_type)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Progress value={goal.progress} className="w-16 h-2" />
                                  <span className="text-xs font-medium w-10">{goal.progress.toFixed(0)}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatValue(goal.projection, goal.goal_type)}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={goal.isOnTrack ? "default" : "destructive"}
                                  className="text-xs"
                                >
                                  {goal.isOnTrack ? (
                                    <><TrendingUp className="h-3 w-3 mr-1" /> No caminho</>
                                  ) : (
                                    <><TrendingDown className="h-3 w-3 mr-1" /> Atenção</>
                                  )}
                                </Badge>
                              </TableCell>
                              {isAdmin && (
                                <TableCell className="text-center">
                                  <div className="flex justify-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => openEditDialog(goal)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleDeleteGoal(goal.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-6">
          {loading || goalsProgress.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <BarChart3 className="mx-auto mb-4 text-muted-foreground" size={48} />
                <p className="text-muted-foreground">
                  {loading ? "Carregando dados..." : "Nenhum dado disponível para visualização"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Total de Metas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{filteredGoals.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ativas no período selecionado
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      No Caminho Certo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {goalsProgress.filter(g => g.isOnTrack).length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Acima do esperado
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-orange-600" />
                      Precisam Atenção
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {goalsProgress.filter(g => !g.isOnTrack).length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Abaixo do esperado
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Seller Comparison Chart */}
              {(isAdmin || isGestor) && sellerComparisonData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Comparação por Vendedor
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Meta, progresso atual e projeção de atingimento
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={sellerComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="name" 
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--foreground))' }}
                        />
                        <YAxis 
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--foreground))' }}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: any) => 
                            new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(value)
                          }
                        />
                        <Legend />
                        <Bar dataKey="meta" fill="hsl(var(--muted))" name="Meta" />
                        <Bar dataKey="atual" fill="hsl(var(--primary))" name="Atual" />
                        <Bar dataKey="previsao" fill="hsl(var(--chart-2))" name="Projeção" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Monthly Evolution Chart */}
              {monthlyEvolutionData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LineChart className="h-5 w-5" />
                      Evolução Mensal
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Acompanhamento do desempenho ao longo do tempo
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsLineChart data={monthlyEvolutionData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="month" 
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--foreground))' }}
                        />
                        <YAxis 
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--foreground))' }}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: any) => 
                            new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(value)
                          }
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="meta" 
                          stroke="hsl(var(--muted-foreground))" 
                          strokeWidth={2}
                          name="Meta"
                          strokeDasharray="5 5"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="realizado" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          name="Realizado"
                        />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Individual Goals Progress */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Progresso Individual das Metas
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Status detalhado de cada meta com projeções
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {goalsProgress
                    .filter(goal => {
                      if (filterSeller !== "all") {
                        if (filterSeller === "unassigned") return !goal.assigned_to;
                        return goal.assigned_to === filterSeller;
                      }
                      if (filterGoalType !== "all") return goal.goal_type === filterGoalType;
                      if (filterPeriod !== "all") return goal.period === filterPeriod;
                      return true;
                    })
                    .map((goal) => {
                      const Icon = getGoalIcon(goal.goal_type);
                      return (
                        <div key={goal.id} className="space-y-3 p-4 border rounded-lg hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <Icon className="text-primary" size={20} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-base mb-1">{goal.title}</h4>
                                <div className="flex flex-wrap gap-2 mb-2">
                                  <Badge variant="outline" className="text-xs">
                                    {getGoalTypeLabel(goal.goal_type)}
                                  </Badge>
                                  {goal.profiles && (
                                    <Badge variant="secondary" className="text-xs">
                                      {goal.profiles.full_name}
                                    </Badge>
                                  )}
                                  <Badge 
                                    variant={goal.isOnTrack ? "default" : "destructive"}
                                    className="text-xs"
                                  >
                                    {goal.isOnTrack ? "No caminho" : "Atenção"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground mb-1">Meta</p>
                              <p className="font-bold text-primary">
                                {formatValue(goal.target_value, goal.goal_type)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Atual</p>
                              <p className="font-bold">
                                {formatValue(goal.currentValue, goal.goal_type)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Projeção</p>
                              <p className="font-bold text-chart-2">
                                {formatValue(goal.projection, goal.goal_type)}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Progresso Real</span>
                              <span className="font-medium">{goal.progress.toFixed(1)}%</span>
                            </div>
                            <Progress value={goal.progress} className="h-2" />
                            
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Esperado para a data</span>
                              <span className="font-medium text-muted-foreground">
                                {goal.expectedProgress.toFixed(1)}%
                              </span>
                            </div>
                            <Progress value={goal.expectedProgress} className="h-1 opacity-50" />
                          </div>

                          {goal.projection > goal.target_value ? (
                            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/20 p-2 rounded">
                              <TrendingUp className="h-4 w-4" />
                              <span>
                                Projeção: {((goal.projection / goal.target_value) * 100).toFixed(0)}% da meta
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-950/20 p-2 rounded">
                              <TrendingDown className="h-4 w-4" />
                              <span>
                                Projeção: {((goal.projection / goal.target_value) * 100).toFixed(0)}% da meta
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Metas;