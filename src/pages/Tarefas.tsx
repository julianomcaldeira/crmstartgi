import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Calendar, CheckCircle2, Circle, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Tarefas = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("pending");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [clientId, setClientId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [tasksResponse, clientsResponse, oppsResponse, usersResponse] = await Promise.all([
        supabase
          .from("tasks")
          .select(`
            *,
            client:clients(company_name),
            opportunity:opportunities(title)
          `)
          .eq("assigned_to", user.id)
          .order("due_date", { ascending: true }),
        supabase.from("clients").select("id, company_name, trade_name"),
        supabase.from("opportunities").select("id, title"),
        supabase.from("profiles").select("id, full_name"),
      ]);

      if (tasksResponse.error) throw tasksResponse.error;
      if (clientsResponse.error) throw clientsResponse.error;
      if (oppsResponse.error) throw oppsResponse.error;
      if (usersResponse.error) throw usersResponse.error;

      setTasks(tasksResponse.data || []);
      setClients(clientsResponse.data || []);
      setOpportunities(oppsResponse.data || []);
      setUsers(usersResponse.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar tarefas");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("tasks").insert([{
        title,
        description,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        priority: priority as any,
        client_id: clientId || null,
        opportunity_id: opportunityId || null,
        assigned_to: assignedTo || user.id,
        created_by: user.id,
      }]);

      if (error) throw error;

      toast.success("Tarefa criada com sucesso!");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error creating task:", error);
      toast.error(error.message || "Erro ao criar tarefa");
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("medium");
    setClientId("");
    setOpportunityId("");
    setAssignedTo("");
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "completed" ? "pending" : "completed";
      const { error } = await supabase
        .from("tasks")
        .update({
          status: newStatus,
          completed_at: newStatus === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", taskId);

      if (error) throw error;
      
      toast.success(newStatus === "completed" ? "Tarefa concluída!" : "Tarefa reaberta");
      fetchData();
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Erro ao atualizar tarefa");
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-destructive/20 text-destructive";
      case "medium": return "bg-warning/20 text-warning";
      case "low": return "bg-success/20 text-success";
      default: return "bg-muted";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high": return "Alta";
      case "medium": return "Média";
      case "low": return "Baixa";
      default: return priority;
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === "pending") return task.status !== "completed";
    if (filter === "completed") return task.status === "completed";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-2">
            Tarefas
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas atividades diárias
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-primary">
              <Plus size={20} />
              Nova Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Nova Tarefa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Ex: Ligar para cliente"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes da tarefa..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Data de Vencimento</Label>
                  <Input
                    id="dueDate"
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridade</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Cliente (Opcional)</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.trade_name || client.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opportunity">Oportunidade (Opcional)</Label>
                  <Select value={opportunityId} onValueChange={setOpportunityId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma oportunidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {opportunities.map((opp) => (
                        <SelectItem key={opp.id} value={opp.id}>
                          {opp.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned">Atribuir Para</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Você mesmo" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Criar Tarefa</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
          size="sm"
        >
          Todas
        </Button>
        <Button
          variant={filter === "pending" ? "default" : "outline"}
          onClick={() => setFilter("pending")}
          size="sm"
        >
          Pendentes
        </Button>
        <Button
          variant={filter === "completed" ? "default" : "outline"}
          onClick={() => setFilter("completed")}
          size="sm"
        >
          Concluídas
        </Button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-center text-muted-foreground">Carregando...</p>
        ) : filteredTasks.length === 0 ? (
          <Card className="p-12 text-center">
            <ListTodo className="mx-auto mb-4 text-muted-foreground" size={48} />
            <p className="text-muted-foreground mb-4">Nenhuma tarefa encontrada</p>
            <p className="text-sm text-muted-foreground">
              {filter === "completed" 
                ? "Você ainda não concluiu nenhuma tarefa"
                : "Crie sua primeira tarefa para começar"}
            </p>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card
              key={task.id}
              className={`hover:shadow-lg transition-all duration-300 border-l-4 ${
                task.status === "completed" ? "opacity-60 border-l-success" : "border-l-primary"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      onClick={() => toggleTaskStatus(task.id, task.status)}
                      className="mt-1 hover:scale-110 transition-transform"
                    >
                      {task.status === "completed" ? (
                        <CheckCircle2 className="text-success" size={24} />
                      ) : (
                        <Circle className="text-muted-foreground hover:text-primary" size={24} />
                      )}
                    </button>
                    <div className="flex-1">
                      <CardTitle
                        className={`text-lg ${
                          task.status === "completed" ? "line-through" : ""
                        }`}
                      >
                        {task.title}
                      </CardTitle>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge className={getPriorityColor(task.priority)}>
                    {getPriorityLabel(task.priority)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {task.due_date && (
                    <div className="flex items-center gap-1">
                      <Calendar size={16} />
                      {format(new Date(task.due_date), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </div>
                  )}
                  {task.client && (
                    <span>Cliente: {task.client.company_name}</span>
                  )}
                  {task.opportunity && (
                    <span>Oportunidade: {task.opportunity.title}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Tarefas;