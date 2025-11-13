import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Calendar, CheckCircle2, Circle, ListTodo, Phone, Mail, MessageCircle, MapPin, Video, Briefcase, Users, Building2, CalendarIcon, ChevronLeft, ChevronRight, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInHours, isPast, startOfWeek, endOfWeek, addDays, isSameDay, parseISO, startOfDay, isToday as isTodayFn } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { DraggableCard } from "@/components/DraggableCard";
import { DroppableColumn } from "@/components/DroppableColumn";
import TaskViewDialog from "@/components/TaskViewDialog";

const Tarefas = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "overdue">("pending");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  
  // Filters
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Form state
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [taskType, setTaskType] = useState("ligacao");
  const [clientId, setClientId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [contactId, setContactId] = useState("");
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchData();
    checkUpcomingTasks();
    
    // Check for upcoming tasks every 5 minutes
    const interval = setInterval(checkUpcomingTasks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentDate, viewMode]);

  const checkUpcomingTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: upcomingTasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", user.id)
        .eq("status", "pending")
        .not("due_date", "is", null);

      if (!upcomingTasks) return;

      const now = new Date();
      upcomingTasks.forEach((task) => {
        const dueDate = new Date(task.due_date);
        const hoursUntilDue = differenceInHours(dueDate, now);
        
        // Notify if task is due within 24 hours and not overdue
        if (hoursUntilDue > 0 && hoursUntilDue <= 24) {
          toast.warning(`Tarefa vencendo em breve: ${task.title}`, {
            description: `Vence em ${hoursUntilDue}h`,
            duration: 10000,
          });
        } else if (isPast(dueDate)) {
          toast.error(`Tarefa atrasada: ${task.title}`, {
            description: "Esta tarefa já passou do prazo!",
            duration: 10000,
          });
        }
      });
    } catch (error) {
      console.error("Error checking upcoming tasks:", error);
    }
  };

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let tasksQuery;
      
      if (viewMode === "calendar") {
        const weekStart = startOfWeek(currentDate, { locale: ptBR });
        const weekEnd = endOfWeek(currentDate, { locale: ptBR });
        
        tasksQuery = supabase
          .from("tasks")
          .select(`
            *,
            client:clients(company_name, trade_name),
            opportunity:opportunities(title),
            contact:contacts(id, name, email, phone, mobile, role)
          `)
          .eq("assigned_to", user.id)
          .gte("due_date", weekStart.toISOString())
          .lte("due_date", weekEnd.toISOString())
          .order("due_date", { ascending: true });
      } else {
        tasksQuery = supabase
          .from("tasks")
          .select(`
            *,
            client:clients(company_name, trade_name),
            opportunity:opportunities(title),
            contact:contacts(id, name, email, phone, mobile, role)
          `)
          .eq("assigned_to", user.id)
          .order("due_date", { ascending: true });
      }

      const [tasksResponse, clientsResponse, oppsResponse, usersResponse] = await Promise.all([
        tasksQuery,
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

  const fetchContactsByClient = async (clientId: string) => {
    if (!clientId) {
      setContacts([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("client_id", clientId)
        .order("name");
      
      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      setContacts([]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Generate title from task type
      const taskTypeLabels: Record<string, string> = {
        ligacao: "Ligação",
        email: "E-mail",
        whatsapp: "WhatsApp",
        visita_presencial: "Visita Presencial",
        reuniao_online: "Reunião Online",
        visita_feira: "Visita a Feira",
        visita_evento: "Visita a Evento"
      };
      
      const title = taskTypeLabels[taskType] || "Tarefa";

      const { error } = await supabase.from("tasks").insert([{
        title,
        description,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        priority: priority as any,
        task_type: taskType as any,
        client_id: clientId || null,
        contact_id: contactId || null,
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
    setDescription("");
    setDueDate("");
    setPriority("medium");
    setTaskType("ligacao");
    setClientId("");
    setContactId("");
    setOpportunityId("");
    setAssignedTo("");
    setContacts([]);
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    try {
      const taskId = active.id as string;
      const newDateStr = over.id as string;
      
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      const oldDueDate = parseISO(task.due_date);
      const newDate = parseISO(newDateStr);
      
      const newDueDate = new Date(
        newDate.getFullYear(),
        newDate.getMonth(),
        newDate.getDate(),
        oldDueDate.getHours(),
        oldDueDate.getMinutes(),
        oldDueDate.getSeconds()
      );
      
      const { error } = await supabase
        .from("tasks")
        .update({ due_date: newDueDate.toISOString() })
        .eq("id", taskId);
      
      if (error) throw error;
      
      toast.success("Tarefa movida com sucesso!");
      fetchData();
    } catch (error) {
      console.error("Error moving task:", error);
      toast.error("Erro ao mover tarefa");
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

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case "ligacao": return <Phone size={16} />;
      case "email": return <Mail size={16} />;
      case "whatsapp": return <MessageCircle size={16} />;
      case "visita_presencial": return <MapPin size={16} />;
      case "reuniao_online": return <Video size={16} />;
      case "visita_feira": return <Briefcase size={16} />;
      case "visita_evento": return <Users size={16} />;
      default: return <Circle size={16} />;
    }
  };

  const getTaskTypeLabel = (type: string) => {
    switch (type) {
      case "ligacao": return "Ligação";
      case "email": return "E-mail";
      case "whatsapp": return "WhatsApp";
      case "visita_presencial": return "Visita Presencial";
      case "reuniao_online": return "Reunião Online";
      case "visita_feira": return "Visita a Feira";
      case "visita_evento": return "Visita a Evento";
      default: return type;
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

  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = 
      filter === "all" ? true :
      filter === "pending" ? task.status !== "completed" && (!task.due_date || !isPast(new Date(task.due_date))) :
      filter === "overdue" ? task.status !== "completed" && task.due_date && isPast(new Date(task.due_date)) :
      task.status === "completed";
    
    const matchesClient = selectedClient === "all" || task.client_id === selectedClient;
    
    const taskDate = task.due_date ? new Date(task.due_date) : null;
    const matchesStartDate = !startDate || !taskDate || taskDate >= new Date(startDate);
    const matchesEndDate = !endDate || !taskDate || taskDate <= new Date(endDate);
    
    return matchesStatus && matchesClient && matchesStartDate && matchesEndDate;
  });

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { locale: ptBR });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const getTasksForDay = (day: Date) => {
    return tasks.filter((task) => {
      const taskDate = startOfDay(parseISO(task.due_date));
      const matchesDay = isSameDay(taskDate, day);
      
      if (!matchesDay) return false;
      
      if (filter === "completed") {
        return task.status === "completed";
      } else if (filter === "pending") {
        return task.status === "pending" && !isPast(new Date(task.due_date));
      } else if (filter === "overdue") {
        return task.status !== "completed" && isPast(new Date(task.due_date));
      }
      
      return true;
    });
  };

  const weekDays = getWeekDays();

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
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes da tarefa..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taskType">Tipo de Tarefa *</Label>
                  <Select value={taskType} onValueChange={setTaskType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="ligacao">Ligação</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="visita_presencial">Visita Presencial</SelectItem>
                      <SelectItem value="reuniao_online">Reunião Online</SelectItem>
                      <SelectItem value="visita_feira">Visita a Feira</SelectItem>
                      <SelectItem value="visita_evento">Visita a Evento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                    <SelectContent className="bg-background z-50">
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
                  <Select 
                    value={clientId} 
                    onValueChange={(value) => {
                      setClientId(value);
                      setContactId("");
                      fetchContactsByClient(value);
                    }}
                  >
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
                  <Label htmlFor="contact">Contato (Opcional)</Label>
                  <Select 
                    value={contactId} 
                    onValueChange={setContactId}
                    disabled={!clientId || contacts.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        !clientId ? "Selecione um cliente primeiro" : 
                        contacts.length === 0 ? "Nenhum contato cadastrado" :
                        "Selecione um contato"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name} {contact.role ? `- ${contact.role}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "calendar")}>
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <ListTodo size={16} />
            Lista
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar size={16} />
            Agenda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
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
                variant={filter === "overdue" ? "default" : "outline"}
                onClick={() => setFilter("overdue")}
                size="sm"
              >
                Atrasadas
              </Button>
              <Button
                variant={filter === "completed" ? "default" : "outline"}
                onClick={() => setFilter("completed")}
                size="sm"
              >
                Concluídas
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.trade_name || client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                placeholder="Data início"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              
              <Input
                type="date"
                placeholder="Data fim"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma tarefa encontrada</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <Card 
                  key={task.id} 
                  className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${getTaskStatusColor(task)}`}
                  onClick={() => {
                    setSelectedTask(task);
                    setViewDialogOpen(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTaskStatus(task.id, task.status);
                          }}
                          className="mt-1"
                        >
                          {task.status === "completed" ? (
                            <CheckCircle2 className="h-5 w-5 text-success" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                          )}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {getTaskTypeIcon(task.task_type)}
                            <span className="font-medium">{task.title}</span>
                            <Badge className={getPriorityColor(task.priority)}>
                              {getPriorityLabel(task.priority)}
                            </Badge>
                          </div>
                          
                          {task.description && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                            {task.due_date && (
                              <div className="flex items-center gap-1">
                                {getTaskStatusIcon(task)}
                                <span>
                                  {format(new Date(task.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                            )}
                            {task.client && (
                              <div className="flex items-center gap-1">
                                <Building2 size={14} />
                                <span>{task.client.trade_name || task.client.company_name}</span>
                              </div>
                            )}
                            {task.contact && (
                              <div className="flex items-center gap-1">
                                <Users size={14} />
                                <span>{task.contact.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <Badge variant="outline">{getTaskTypeLabel(task.task_type)}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <div className="flex gap-2 flex-wrap mb-4">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Todas
            </Button>
            <Button
              variant={filter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("pending")}
              className="gap-2"
            >
              <Clock className="h-4 w-4" />
              Pendentes
            </Button>
            <Button
              variant={filter === "overdue" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("overdue")}
              className="gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              Atrasadas
            </Button>
            <Button
              variant={filter === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("completed")}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Concluídas
            </Button>
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
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((day) => {
                    const dayTasks = getTasksForDay(day);
                    const isToday = isTodayFn(day);

                    return (
                      <DroppableColumn key={day.toISOString()} id={day.toISOString()}>
                        <div className={`min-h-[200px] rounded-lg border-2 p-3 ${
                          isToday ? "border-primary bg-primary/5" : "border-border"
                        }`}>
                          <div className="text-center mb-3">
                            <div className={`text-xs font-medium uppercase ${
                              isToday ? "text-primary" : "text-muted-foreground"
                            }`}>
                              {format(day, "EEE", { locale: ptBR })}
                            </div>
                            <div className={`text-2xl font-bold ${
                              isToday ? "text-primary" : ""
                            }`}>
                              {format(day, "dd")}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            {dayTasks.map((task) => (
                              <DraggableCard 
                                key={task.id} 
                                id={task.id}
                              >
                                <div 
                                  className={`p-2 rounded border-l-4 text-xs ${getTaskStatusColor(task)} cursor-move`}
                                  onClick={() => {
                                    setSelectedTask(task);
                                    setViewDialogOpen(true);
                                  }}
                                >
                                  <div className="flex items-center gap-1 mb-1">
                                    {getTaskTypeIcon(task.task_type)}
                                    <span className="font-medium truncate">{task.title}</span>
                                  </div>
                                  {task.due_date && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      {getTaskStatusIcon(task)}
                                      <span>{format(new Date(task.due_date), "HH:mm")}</span>
                                    </div>
                                  )}
                                  {task.client && (
                                    <div className="flex items-center gap-1 text-muted-foreground mt-1">
                                      <Building2 size={12} />
                                      <span className="truncate">{task.client.trade_name || task.client.company_name}</span>
                                    </div>
                                  )}
                                </div>
                              </DraggableCard>
                            ))}
                          </div>
                        </div>
                      </DroppableColumn>
                    );
                  })}
                </div>
              </DndContext>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedTask && (
        <TaskViewDialog
          task={selectedTask}
          open={viewDialogOpen}
          onOpenChange={(open) => {
            setViewDialogOpen(open);
            if (!open) {
              fetchData();
            }
          }}
        />
      )}
    </div>
  );
};

export default Tarefas;
