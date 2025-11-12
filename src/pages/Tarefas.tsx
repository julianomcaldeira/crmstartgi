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
import { Plus, Calendar, CheckCircle2, Circle, ListTodo, Phone, Mail, MessageCircle, MapPin, Video, Briefcase, Users, Building2, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInHours, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

const Tarefas = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("pending");
  const [dialogOpen, setDialogOpen] = useState(false);
  
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

  useEffect(() => {
    fetchData();
    checkUpcomingTasks();
    
    // Check for upcoming tasks every 5 minutes
    const interval = setInterval(checkUpcomingTasks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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

      const [tasksResponse, clientsResponse, oppsResponse, usersResponse] = await Promise.all([
        supabase
          .from("tasks")
          .select(`
            *,
            client:clients(company_name),
            opportunity:opportunities(title),
            contact:contacts(id, name, email, phone, mobile, role)
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

  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = 
      filter === "all" ? true :
      filter === "pending" ? task.status !== "completed" :
      task.status === "completed";
    
    const matchesClient = selectedClient === "all" || task.client_id === selectedClient;
    
    const taskDate = task.due_date ? new Date(task.due_date) : null;
    const matchesStartDate = !startDate || !taskDate || taskDate >= new Date(startDate);
    const matchesEndDate = !endDate || !taskDate || taskDate <= new Date(endDate);
    
    return matchesStatus && matchesClient && matchesStartDate && matchesEndDate;
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

      <div className="space-y-4">
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

        <Card className="shadow-lg">
          <CardHeader className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-muted-foreground" />
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">Todos os clientes</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.trade_name || client.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  type="date"
                  placeholder="Data inicial"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  type="date"
                  placeholder="Data final"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
        </Card>
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
                <div className="flex flex-wrap gap-4 text-sm">
                  {task.task_type && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      {getTaskTypeIcon(task.task_type)}
                      {getTaskTypeLabel(task.task_type)}
                    </Badge>
                  )}
                  {task.due_date && (
                    <div className={`flex items-center gap-1 ${
                      isPast(new Date(task.due_date)) && task.status !== "completed"
                        ? "text-destructive font-semibold"
                        : "text-muted-foreground"
                    }`}>
                      <Calendar size={16} />
                      {format(new Date(task.due_date), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                      {isPast(new Date(task.due_date)) && task.status !== "completed" && (
                        <span className="text-xs">(Atrasada)</span>
                      )}
                    </div>
                  )}
                </div>
                {(task.client || task.opportunity) && (
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                    {task.client && (
                      <span>Cliente: {task.client.company_name}</span>
                    )}
                    {task.opportunity && (
                      <span>Oportunidade: {task.opportunity.title}</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Tarefas;