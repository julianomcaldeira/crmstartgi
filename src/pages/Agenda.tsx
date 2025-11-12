import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays, isSameDay, parseISO, startOfDay, isPast, isToday as isTodayFn } from "date-fns";
import { ptBR } from "date-fns/locale";
import TaskViewDialog from "@/components/TaskViewDialog";

const Agenda = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    client_id: "none",
    due_date: "",
    priority: "medium",
  });

  useEffect(() => {
    fetchTasks();
    fetchClients();
  }, [currentDate]);

  const fetchTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const weekStart = startOfWeek(currentDate, { locale: ptBR });
      const weekEnd = endOfWeek(currentDate, { locale: ptBR });

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          clients(company_name, trade_name)
        `)
        .eq("assigned_to", user.id)
        .gte("due_date", weekStart.toISOString())
        .lte("due_date", weekEnd.toISOString())
        .order("due_date", { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Erro ao carregar atividades");
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, trade_name")
        .order("company_name");

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const handleCreateTask = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("tasks").insert([
        {
          title: formData.title,
          description: formData.description,
          client_id: formData.client_id === "none" ? null : formData.client_id,
          due_date: formData.due_date,
          priority: formData.priority as "low" | "medium" | "high",
          status: "pending",
          assigned_to: user.id,
          created_by: user.id,
        },
      ]);

      if (error) throw error;

      toast.success("Atividade criada com sucesso!");
      setDialogOpen(false);
      resetForm();
      fetchTasks();
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Erro ao criar atividade");
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      if (error) throw error;

      toast.success("Atividade concluída!");
      fetchTasks();
    } catch (error) {
      console.error("Error completing task:", error);
      toast.error("Erro ao concluir atividade");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      client_id: "none",
      due_date: "",
      priority: "medium",
    });
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { locale: ptBR });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const getTasksForDay = (day: Date) => {
    return tasks.filter((task) => {
      const taskDate = startOfDay(parseISO(task.due_date));
      return isSameDay(taskDate, day);
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "default";
    }
  };

  const getTaskStatusColor = (task: any) => {
    if (task.status === "completed") {
      return "border-l-success bg-success/5";
    }
    
    const taskDate = new Date(task.due_date);
    const now = new Date();
    
    if (isPast(taskDate) && task.status !== "completed") {
      return "border-l-destructive bg-destructive/10";
    }
    
    const hoursUntilDue = (taskDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilDue <= 24 && hoursUntilDue > 0) {
      return "border-l-warning bg-warning/10";
    }
    
    return "border-l-primary bg-background";
  };

  const getTaskStatusIcon = (task: any) => {
    if (task.status === "completed") {
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    }
    
    const taskDate = new Date(task.due_date);
    if (isPast(taskDate)) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    
    const hoursUntilDue = (taskDate.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    if (hoursUntilDue <= 24 && hoursUntilDue > 0) {
      return <AlertCircle className="h-4 w-4 text-warning" />;
    }
    
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const weekDays = getWeekDays();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Agenda</h1>
          <p className="text-muted-foreground">
            Organize suas atividades da semana
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Atividade
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Atividade</DialogTitle>
              <DialogDescription>
                Adicione uma nova atividade à sua agenda
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Reunião com cliente"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalhes da atividade..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client">Cliente</Label>
                <Select
                  value={formData.client_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, client_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum cliente</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.trade_name || client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="due_date">Data e Hora *</Label>
                  <Input
                    id="due_date"
                    type="datetime-local"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridade</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  >
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateTask}>
                  Criar Atividade
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(addDays(currentDate, -7))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentDate(new Date())}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(addDays(currentDate, 7))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {weekDays.map((day) => {
                const dayTasks = getTasksForDay(day);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={day.toISOString()}
                    className={`border rounded-lg p-3 min-h-[200px] ${
                      isToday ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="text-center mb-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        {format(day, "EEE", { locale: ptBR })}
                      </p>
                      <p className={`text-2xl font-bold ${
                        isToday ? "text-primary" : "text-foreground"
                      }`}>
                        {format(day, "dd")}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {dayTasks.map((task) => (
                        <Card
                          key={task.id}
                          className={`p-2 hover:shadow-md transition-shadow cursor-pointer border-l-4 ${getTaskStatusColor(task)}`}
                          onClick={() => {
                            setSelectedTask(task);
                            setViewDialogOpen(true);
                          }}
                        >
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1">
                                {getTaskStatusIcon(task)}
                                <p className={`text-sm font-medium line-clamp-2 ${
                                  task.status === "completed" ? "line-through text-muted-foreground" : ""
                                }`}>
                                  {task.title}
                                </p>
                              </div>
                              {task.status !== "completed" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 flex-shrink-0"
                                  onClick={() => handleCompleteTask(task.id)}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground pl-6">
                              {format(parseISO(task.due_date), "HH:mm")}
                              {isPast(new Date(task.due_date)) && task.status !== "completed" && (
                                <span className="text-destructive font-semibold ml-1">(Atrasada)</span>
                              )}
                            </div>
                            {task.clients && (
                              <p className="text-xs text-muted-foreground line-clamp-1 pl-6">
                                {task.clients.trade_name || task.clients.company_name}
                              </p>
                            )}
                            <div className="pl-6">
                              <Badge
                                variant={getPriorityColor(task.priority)}
                                className="text-xs"
                              >
                                {task.priority === "high" && "Alta"}
                                {task.priority === "medium" && "Média"}
                                {task.priority === "low" && "Baixa"}
                              </Badge>
                            </div>
                          </div>
                        </Card>
                      ))}
                      {dayTasks.length === 0 && (
                        <p className="text-xs text-center text-muted-foreground py-4">
                          Sem atividades
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TaskViewDialog
        task={selectedTask}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
      />
    </div>
  );
};

export default Agenda;
