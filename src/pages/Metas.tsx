import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { TrendingUp, Target, DollarSign, CheckSquare, Plus, Pencil, Trash2 } from "lucide-react";
import { CurrencyInput } from "@/components/ui/masked-input";

const Metas = () => {
  const [goals, setGoals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    goal_type: "revenue",
    target_value: "",
    current_value: "0",
    start_date: "",
    end_date: "",
    assigned_to: "none",
  });

  useEffect(() => {
    checkAdminStatus();
    fetchGoals();
    fetchUsers();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setIsAdmin(data?.role === "admin");
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
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

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const isUserAdmin = roleData?.role === "admin";

      let query = supabase
        .from("goals")
        .select(`
          *,
          profiles:assigned_to(full_name, email)
        `)
        .order("end_date", { ascending: true });

      // If not admin, only show their goals
      if (!isUserAdmin) {
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

  const handleCreateOrUpdateGoal = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const goalData = {
        title: formData.title,
        description: formData.description,
        goal_type: formData.goal_type as "revenue" | "annualized_sales" | "tasks" | "activities",
        target_value: parseFloat(formData.target_value),
        current_value: parseFloat(formData.current_value),
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
      current_value: goal.current_value.toString(),
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
      current_value: "0",
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

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-success";
    if (percentage >= 75) return "bg-primary";
    if (percentage >= 50) return "bg-warning";
    return "bg-destructive";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Metas</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Gerencie as metas da equipe" : "Acompanhe seu progresso e objetivos"}
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
                    <Label htmlFor="current_value">Valor Atual</Label>
                    {(formData.goal_type === "revenue" || formData.goal_type === "annualized_sales") ? (
                      <CurrencyInput
                        id="current_value"
                        value={formData.current_value}
                        onValueChange={(value) => setFormData({ ...formData, current_value: value })}
                        placeholder="R$ 0,00"
                      />
                    ) : (
                      <Input
                        id="current_value"
                        type="number"
                        value={formData.current_value}
                        onChange={(e) => setFormData({ ...formData, current_value: e.target.value })}
                        placeholder="Ex: 25"
                      />
                    )}
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

      {loading ? (
        <p className="text-center text-muted-foreground">Carregando...</p>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Target className="mx-auto mb-4 text-muted-foreground" size={48} />
            <p className="text-muted-foreground">
              Nenhuma meta definida ainda
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map((goal) => {
            const Icon = getGoalIcon(goal.goal_type);
            const progress = getProgressPercentage(
              Number(goal.current_value),
              Number(goal.target_value)
            );

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
                      <span className="font-medium">Progresso</span>
                      <span className="text-muted-foreground">
                        {formatValue(goal.current_value, goal.goal_type)} /{" "}
                        {formatValue(goal.target_value, goal.goal_type)}
                      </span>
                    </div>
                    <Progress
                      value={progress}
                      className="h-2"
                    />
                    <p className="text-xs text-right text-muted-foreground">
                      {progress.toFixed(1)}% concluído
                    </p>
                  </div>

                  <div className="flex justify-between text-sm text-muted-foreground pt-2 border-t">
                    <span>Início: {new Date(goal.start_date).toLocaleDateString("pt-BR")}</span>
                    <span>Fim: {new Date(goal.end_date).toLocaleDateString("pt-BR")}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Metas;