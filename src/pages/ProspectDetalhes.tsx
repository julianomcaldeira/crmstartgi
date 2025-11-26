import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  DollarSign,
  Target,
  CheckCircle2,
  Clock,
  User,
  TrendingUp,
  Plus,
  Edit,
  Check,
  Trash2,
  Search
} from "lucide-react";
import { toast } from "sonner";
import TaskViewDialog from "@/components/TaskViewDialog";
import OpportunityViewDialog from "@/components/OpportunityViewDialog";
import { ClientEditDialog } from "@/components/ClientEditDialog";

const ClienteDetalhes = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [feiras, setFeiras] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editClientDialogOpen, setEditClientDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [oppDialogOpen, setOppDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  const [taskViewDialogOpen, setTaskViewDialogOpen] = useState(false);
  const [oppViewDialogOpen, setOppViewDialogOpen] = useState(false);
  const [editTaskDialogOpen, setEditTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [taskSearchTerm, setTaskSearchTerm] = useState("");
  const [taskSortBy, setTaskSortBy] = useState<"date" | "priority" | "status">("date");
  const [contactFormData, setContactFormData] = useState({
    name: "",
    role: "",
    email: "",
    phone: "",
    mobile: "",
    rating: 3,
    is_primary: false,
  });
  const [taskFormData, setTaskFormData] = useState({
    description: "",
    task_type: "ligacao",
    due_date: "",
    priority: "medium",
    status: "pending",
  });
  const [oppFormData, setOppFormData] = useState({
    product_id: "",
    implementation_value: "",
    monthly_value: "",
    probability: "50",
    status: "lead",
    assigned_to: "",
    expected_close_date: "",
    business_type: "cliente_novo",
  });

  useEffect(() => {
    fetchClientDetails();
    checkAdminRole();
  }, [id]);

  // Preencher data/hora atual quando o dialog de tarefa abrir
  useEffect(() => {
    if (taskDialogOpen) {
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setTaskFormData(prev => ({ ...prev, due_date: localDateTime }));
    }
  }, [taskDialogOpen]);

  const checkAdminRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setIsAdmin(roleData?.role === "admin");
    } catch (error) {
      console.error("Error checking admin role:", error);
    }
  };

  const fetchClientDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch client data
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      // Fetch contacts
      const { data: contactsData } = await supabase
        .from("contacts")
        .select("*")
        .eq("client_id", id);
      setContacts(contactsData || []);

      // Fetch notes
      const { data: notesData } = await supabase
        .from("client_notes")
        .select(`
          *,
          profiles:user_id(full_name)
        `)
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      setNotes(notesData || []);

      // Fetch opportunities with all related data
      const { data: opportunitiesData } = await supabase
        .from("opportunities")
        .select(`
          *,
          client:clients(company_name, trade_name),
          assigned:profiles!opportunities_assigned_to_fkey(full_name),
          product:products(name, description, logo_url)
        `)
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      setOpportunities(opportunitiesData || []);

      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select(`
          *,
          assigned_user:profiles!tasks_assigned_to_fkey(full_name)
        `)
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      
      if (tasksError) {
        console.error("Error fetching tasks:", tasksError);
      }
      setTasks(tasksData || []);

      // Fetch users for assignment
      const { data: usersData } = await supabase
        .from("profiles")
        .select("id, full_name");
      setUsers(usersData || []);

      // Fetch products
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, description")
        .eq("active", true)
        .order("name", { ascending: true });
      setProducts(productsData || []);

      // Fetch linked feiras
      const { data: feirasData } = await (supabase as any)
        .from("client_feiras")
        .select(`
          *,
          feira:feiras(*)
        `)
        .eq("client_id", id);
      setFeiras(feirasData || []);

    } catch (error: any) {
      toast.error("Erro ao carregar detalhes do cliente");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (!taskFormData.due_date) {
        toast.error("Preencha a data de vencimento");
        return;
      }

      // Generate title from task type
      const taskTypeLabels: Record<string, string> = {
        ligacao: "Ligação",
        email: "E-mail",
        whatsapp: "WhatsApp",
        linkedin: "LinkedIn",
        visita_presencial: "Visita Presencial",
        reuniao_online: "Reunião Online",
        visita_feira: "Visita a Feira",
        visita_evento: "Visita a Evento"
      };
      
      const title = taskTypeLabels[taskFormData.task_type] || "Tarefa";

      const { error } = await supabase.from("tasks").insert([
        {
          title,
          description: taskFormData.description,
          client_id: id,
          task_type: taskFormData.task_type as "ligacao" | "email" | "whatsapp" | "linkedin" | "visita_presencial" | "reuniao_online" | "visita_feira" | "visita_evento",
          due_date: taskFormData.due_date,
          priority: taskFormData.priority as "low" | "medium" | "high",
          status: taskFormData.status as "pending" | "in_progress" | "completed",
          assigned_to: user.id,
          created_by: user.id,
        },
      ]);

      if (error) throw error;

      toast.success("Tarefa criada com sucesso!");
      setTaskDialogOpen(false);
      resetTaskForm();
      fetchClientDetails();
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Erro ao criar tarefa");
    }
  };

  const handleCreateOpportunity = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("opportunities").insert([
        {
          title: `Oportunidade - ${client?.trade_name || client?.company_name}`,
          client_id: id,
          product_id: oppFormData.product_id || null,
          implementation_value: oppFormData.implementation_value ? parseFloat(oppFormData.implementation_value) : null,
          monthly_value: oppFormData.monthly_value ? parseFloat(oppFormData.monthly_value) : null,
          value: (oppFormData.implementation_value || oppFormData.monthly_value) ? 
            (parseFloat(oppFormData.implementation_value || "0") + parseFloat(oppFormData.monthly_value || "0")) : null,
          probability: parseInt(oppFormData.probability),
          status: oppFormData.status as any,
          assigned_to: oppFormData.assigned_to || user.id,
          expected_close_date: oppFormData.expected_close_date || null,
          created_by: user.id,
          business_type: oppFormData.business_type as any,
        },
      ]);

      if (error) throw error;

      toast.success("Oportunidade criada com sucesso!");
      setOppDialogOpen(false);
      resetOppForm();
      fetchClientDetails();
    } catch (error) {
      console.error("Error creating opportunity:", error);
      toast.error("Erro ao criar oportunidade");
    }
  };

  const resetTaskForm = () => {
    setTaskFormData({
      description: "",
      task_type: "ligacao",
      due_date: "",
      priority: "medium",
      status: "pending",
    });
  };

  const resetOppForm = () => {
    setOppFormData({
      product_id: "",
      implementation_value: "",
      monthly_value: "",
      probability: "50",
      status: "lead",
      assigned_to: "",
      expected_close_date: "",
      business_type: "cliente_novo",
    });
  };

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    setTaskFormData({
      description: task.description || "",
      task_type: task.task_type,
      due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : "",
      priority: task.priority,
      status: task.status || "pending",
    });
    setEditTaskDialogOpen(true);
  };

  const handleUpdateTask = async () => {
    try {
      if (!taskFormData.due_date) {
        toast.error("Preencha a data de vencimento");
        return;
      }

      // Generate title from task type
      const taskTypeLabels: Record<string, string> = {
        ligacao: "Ligação",
        email: "E-mail",
        whatsapp: "WhatsApp",
        linkedin: "LinkedIn",
        visita_presencial: "Visita Presencial",
        reuniao_online: "Reunião Online",
        visita_feira: "Visita a Feira",
        visita_evento: "Visita a Evento"
      };
      
      const title = taskTypeLabels[taskFormData.task_type] || "Tarefa";

      const { error } = await supabase
        .from("tasks")
        .update({
          title,
          description: taskFormData.description,
          task_type: taskFormData.task_type as "ligacao" | "email" | "whatsapp" | "linkedin" | "visita_presencial" | "reuniao_online" | "visita_feira" | "visita_evento",
          due_date: taskFormData.due_date,
          priority: taskFormData.priority as "low" | "medium" | "high",
          status: taskFormData.status as "pending" | "in_progress" | "completed",
        })
        .eq("id", editingTask.id);

      if (error) throw error;

      toast.success("Tarefa atualizada com sucesso!");
      setEditTaskDialogOpen(false);
      resetTaskForm();
      setEditingTask(null);
      fetchClientDetails();
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Erro ao atualizar tarefa");
    }
  };

  const handleCompleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      if (error) throw error;

      toast.success("Tarefa concluída!");
      fetchClientDetails();
    } catch (error) {
      console.error("Error completing task:", error);
      toast.error("Erro ao concluir tarefa");
    }
  };

  const handleCreateContact = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (!contactFormData.name) {
        toast.error("Preencha o nome do contato");
        return;
      }

      const { error } = await supabase.from("contacts").insert([
        {
          client_id: id,
          name: contactFormData.name,
          role: contactFormData.role || null,
          email: contactFormData.email || null,
          phone: contactFormData.phone || null,
          mobile: contactFormData.mobile || null,
          rating: contactFormData.rating,
          is_primary: contactFormData.is_primary,
          created_by: user.id,
        },
      ]);

      if (error) throw error;

      toast.success("Contato criado com sucesso!");
      setContactDialogOpen(false);
      resetContactForm();
      fetchClientDetails();
    } catch (error) {
      console.error("Error creating contact:", error);
      toast.error("Erro ao criar contato");
    }
  };

  const handleEditContact = (contact: any) => {
    setEditingContact(contact);
    setContactFormData({
      name: contact.name,
      role: contact.role || "",
      email: contact.email || "",
      phone: contact.phone || "",
      mobile: contact.mobile || "",
      rating: contact.rating || 3,
      is_primary: contact.is_primary || false,
    });
    setContactDialogOpen(true);
  };

  const handleUpdateContact = async () => {
    try {
      if (!contactFormData.name) {
        toast.error("Preencha o nome do contato");
        return;
      }

      const { error } = await supabase
        .from("contacts")
        .update({
          name: contactFormData.name,
          role: contactFormData.role || null,
          email: contactFormData.email || null,
          phone: contactFormData.phone || null,
          mobile: contactFormData.mobile || null,
          rating: contactFormData.rating,
          is_primary: contactFormData.is_primary,
        })
        .eq("id", editingContact.id);

      if (error) throw error;

      toast.success("Contato atualizado com sucesso!");
      setContactDialogOpen(false);
      resetContactForm();
      setEditingContact(null);
      fetchClientDetails();
    } catch (error) {
      console.error("Error updating contact:", error);
      toast.error("Erro ao atualizar contato");
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Tem certeza que deseja excluir este contato?")) return;

    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contactId);

      if (error) throw error;

      toast.success("Contato excluído com sucesso!");
      fetchClientDetails();
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast.error("Erro ao excluir contato");
    }
  };

  const resetContactForm = () => {
    setContactFormData({
      name: "",
      role: "",
      email: "",
      phone: "",
      mobile: "",
      rating: 3,
      is_primary: false,
    });
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error("Digite uma nota");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("client_notes").insert({
        client_id: id,
        user_id: user.id,
        note: newNote.trim(),
      });

      if (error) throw error;

      toast.success("Nota adicionada!");
      setNewNote("");
      fetchClientDetails();
    } catch (error: any) {
      console.error("Error adding note:", error);
      toast.error(error.message || "Erro ao adicionar nota");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta nota?")) return;

    try {
      const { error } = await supabase
        .from("client_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;

      toast.success("Nota removida!");
      fetchClientDetails();
    } catch (error: any) {
      console.error("Error deleting note:", error);
      toast.error("Erro ao remover nota");
    }
  };

  const handleDeleteClient = async () => {
    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Cliente e todo seu histórico foram excluídos com sucesso!");
      navigate("/clientes");
    } catch (error: any) {
      console.error("Error deleting client:", error);
      toast.error("Erro ao excluir cliente: " + (error.message || "Erro desconhecido"));
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: any = {
      lead: { label: "Lead", variant: "secondary" },
      qualificacao: { label: "Qualificação", variant: "default" },
      proposta: { label: "Proposta", variant: "default" },
      negociacao: { label: "Negociação", variant: "default" },
      fechado: { label: "Fechado", variant: "default" },
      perdido: { label: "Perdido", variant: "destructive" },
      pending: { label: "Pendente", variant: "secondary" },
      in_progress: { label: "Em Progresso", variant: "default" },
      completed: { label: "Concluída", variant: "default" }
    };
    
    const config = statusConfig[status] || { label: status, variant: "default" };
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Button onClick={() => navigate("/clientes")} className="mt-4">
          Voltar para Clientes
        </Button>
      </div>
    );
  }

  const totalOpportunityValue = opportunities.reduce((sum, opp) => sum + (Number(opp.value) || 0), 0);
  const closedOpportunities = opportunities.filter(o => o.status === 'fechado').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/clientes")}>
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">{client.company_name}</h1>
          <p className="text-muted-foreground">{client.trade_name}</p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setEditClientDialogOpen(true)}
        >
          <Edit className="mr-2 h-4 w-4" />
          Editar Cliente
        </Button>
        {isAdmin && (
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir Cliente
          </Button>
        )}
      </div>

      {/* Client Info Card */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Informações do Cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">CNPJ</p>
              <p className="text-sm font-medium text-foreground">{client.cnpj}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Endereço</p>
              <p className="text-sm font-medium text-foreground">
                {client.address ? `${client.address}${client.city ? `, ${client.city}` : ''}${client.state ? ` - ${client.state}` : ''}` : "-"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Email</p>
              <p className="text-sm font-medium text-foreground break-all">{client.email || "-"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Segmento</p>
              <p className="text-sm font-medium text-foreground">{client.segment || "-"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Telefone</p>
              <p className="text-sm font-medium text-foreground">{client.phone || "-"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Capital Social</p>
              <p className="text-sm font-medium text-foreground">
                {client.share_capital ? `R$ ${Number(client.share_capital).toLocaleString('pt-BR')}` : "-"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Porte da Empresa</p>
              <p className="text-sm font-medium text-foreground">{client.company_size || "-"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Região</p>
              <p className="text-sm font-medium text-foreground">{client.region || "-"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Concorrentes</p>
              <p className="text-sm font-medium text-foreground">{client.competitors || "-"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Distribuidor</p>
              <p className="text-sm font-medium text-foreground">{client.distributor || "-"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Serviços</p>
              <p className="text-sm font-medium text-foreground">{client.services || "-"}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Notas do Prospect */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Notas do Prospect</h2>
        
        {/* Add Note */}
        <div className="space-y-2 mb-6">
          <Label>Adicionar Nova Nota</Label>
          <div className="flex gap-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Digite sua nota aqui..."
              rows={3}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleAddNote}
              className="self-end"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Notes List */}
        <div className="space-y-3">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma nota adicionada ainda
            </p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="p-3 bg-muted/50 rounded-lg border border-border space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm flex-1 whitespace-pre-wrap">{note.note}</p>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteNote(note.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{note.profiles?.full_name || "Usuário"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {new Date(note.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Contacts */}
      {contacts.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Contatos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contacts.map((contact) => (
              <div key={contact.id} className="p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{contact.name}</p>
                      {contact.is_primary && (
                        <Badge variant="secondary" className="text-xs">Principal</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{contact.role || "Contato"}</p>
                    {contact.email && (
                      <p className="text-sm text-foreground mt-1">{contact.email}</p>
                    )}
                    {contact.phone && (
                      <p className="text-sm text-foreground">{contact.phone}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Feiras Vinculadas */}
      {feiras.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Feiras Vinculadas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feiras.map((item) => (
              <div key={item.id} className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                <h3 className="font-semibold text-foreground mb-2">{item.feira?.name}</h3>
                {item.feira?.city && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <MapPin className="h-4 w-4" />
                    <span>{item.feira.city}{item.feira.state && ` - ${item.feira.state}`}</span>
                  </div>
                )}
                {item.feira?.start_date && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(item.feira.start_date).toLocaleDateString('pt-BR')}
                      {item.feira.end_date && ` - ${new Date(item.feira.end_date).toLocaleDateString('pt-BR')}`}
                    </span>
                  </div>
                )}
                {item.feira?.status && (
                  <Badge variant="secondary" className="mt-2">
                    {item.feira.status === 'planejada' ? 'Planejada' : 
                     item.feira.status === 'em_andamento' ? 'Em Andamento' : 'Concluída'}
                  </Badge>
                )}
                {item.notes && (
                  <p className="text-sm text-muted-foreground mt-2 italic">{item.notes}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabs for Opportunities, Tasks and Contacts */}
      <Tabs defaultValue="opportunities" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="opportunities">Oportunidades</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
          <TabsTrigger value="contacts">Contatos</TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Histórico de Oportunidades</h3>
              <Dialog open={oppDialogOpen} onOpenChange={setOppDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Oportunidade
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Criar Nova Oportunidade</DialogTitle>
                    <DialogDescription>
                      Adicione uma nova oportunidade para este cliente
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="product">Produto</Label>
                      <Select
                        value={oppFormData.product_id}
                        onValueChange={(value) => setOppFormData({ ...oppFormData, product_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um produto" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="implementation_value">Valor de Implantação</Label>
                        <Input
                          id="implementation_value"
                          type="number"
                          step="0.01"
                          value={oppFormData.implementation_value}
                          onChange={(e) => setOppFormData({ ...oppFormData, implementation_value: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="monthly_value">Valor Mensal</Label>
                        <Input
                          id="monthly_value"
                          type="number"
                          step="0.01"
                          value={oppFormData.monthly_value}
                          onChange={(e) => setOppFormData({ ...oppFormData, monthly_value: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="probability">Probabilidade</Label>
                        <Select
                          value={oppFormData.probability}
                          onValueChange={(value) => setOppFormData({ ...oppFormData, probability: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="10">10%</SelectItem>
                            <SelectItem value="25">25%</SelectItem>
                            <SelectItem value="50">50%</SelectItem>
                            <SelectItem value="80">80%</SelectItem>
                            <SelectItem value="90">90%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={oppFormData.status}
                          onValueChange={(value) => setOppFormData({ ...oppFormData, status: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="contacted">Contatado</SelectItem>
                            <SelectItem value="qualified">Qualificado</SelectItem>
                            <SelectItem value="apresentacao">Apresentação</SelectItem>
                            <SelectItem value="proposal">Proposta</SelectItem>
                            <SelectItem value="negotiation">Negociação</SelectItem>
                            <SelectItem value="won">Ganho</SelectItem>
                            <SelectItem value="lost">Perdido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="business_type">Tipo de Negócio</Label>
                        <Select
                          value={oppFormData.business_type}
                          onValueChange={(value) => setOppFormData({ ...oppFormData, business_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="cliente_novo">Cliente Novo</SelectItem>
                            <SelectItem value="venda_na_base">Venda na Base</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assigned_to">Responsável</Label>
                        <Select
                          value={oppFormData.assigned_to}
                          onValueChange={(value) => setOppFormData({ ...oppFormData, assigned_to: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o responsável" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expected_close_date">Data Prevista de Fechamento</Label>
                      <Input
                        id="expected_close_date"
                        type="date"
                        value={oppFormData.expected_close_date}
                        onChange={(e) => setOppFormData({ ...oppFormData, expected_close_date: e.target.value })}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setOppDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleCreateOpportunity}>
                        Criar Oportunidade
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {opportunities.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhuma oportunidade registrada</p>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <div 
                    key={opp.id} 
                    className="p-4 bg-muted/20 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedOpportunity(opp);
                      setOppViewDialogOpen(true);
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{opp.title}</h4>
                        <p className="text-sm text-muted-foreground">{opp.description}</p>
                      </div>
                      {getStatusBadge(opp.status)}
                    </div>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">
                          Valor: <span className="font-medium text-foreground">R$ {Number(opp.value || 0).toLocaleString('pt-BR')}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Probabilidade: <span className="font-medium text-foreground">{opp.probability}%</span>
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        {opp.assigned?.full_name || "Não atribuído"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Histórico de Tarefas</h3>
              <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Tarefa
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Tarefa</DialogTitle>
                    <DialogDescription>
                      Adicione uma nova tarefa para este cliente
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="task_type">Tipo de Tarefa *</Label>
                      <Select
                        value={taskFormData.task_type}
                        onValueChange={(value) => setTaskFormData({ ...taskFormData, task_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ligacao">Ligação</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="linkedin">LinkedIn</SelectItem>
                          <SelectItem value="visita_presencial">Visita Presencial</SelectItem>
                          <SelectItem value="reuniao_online">Reunião Online</SelectItem>
                          <SelectItem value="visita_feira">Visita a Feira</SelectItem>
                          <SelectItem value="visita_evento">Visita a Evento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Notas / Descrição</Label>
                      <Textarea
                        id="description"
                        value={taskFormData.description}
                        onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                        placeholder="Adicione notas sobre esta tarefa..."
                        rows={4}
                      />
                    </div>
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="due_date">Data e Hora *</Label>
                        <Input
                          id="due_date"
                          type="datetime-local"
                          value={taskFormData.due_date}
                          onChange={(e) => setTaskFormData({ ...taskFormData, due_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priority">Prioridade</Label>
                        <Select
                          value={taskFormData.priority}
                          onValueChange={(value) => setTaskFormData({ ...taskFormData, priority: value })}
                        >
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
                    <div className="space-y-2">
                      <Label htmlFor="status">Situação</Label>
                      <Select
                        value={taskFormData.status}
                        onValueChange={(value) => setTaskFormData({ ...taskFormData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="in_progress">Em Execução</SelectItem>
                          <SelectItem value="completed">Realizada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleCreateTask}>
                        Criar Tarefa
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Search and Sort Controls */}
            <div className="mb-4 flex gap-3 flex-col sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por título ou descrição..."
                  value={taskSearchTerm}
                  onChange={(e) => setTaskSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={taskSortBy} onValueChange={(value: any) => setTaskSortBy(value)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Data</SelectItem>
                  <SelectItem value="priority">Prioridade</SelectItem>
                  <SelectItem value="status">Situação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhuma tarefa registrada</p>
            ) : (
              (() => {
                const filteredTasks = tasks.filter(task => {
                  const searchLower = taskSearchTerm.toLowerCase();
                  return (
                    task.title.toLowerCase().includes(searchLower) ||
                    (task.description && task.description.toLowerCase().includes(searchLower))
                  );
                });

                // Sort tasks
                const sortedTasks = [...filteredTasks].sort((a, b) => {
                  if (taskSortBy === "date") {
                    const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
                    const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
                    return dateB - dateA;
                  } else if (taskSortBy === "priority") {
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
                           (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
                  } else if (taskSortBy === "status") {
                    const statusOrder = { pending: 1, in_progress: 2, completed: 3, cancelled: 4 };
                    return (statusOrder[a.status as keyof typeof statusOrder] || 0) - 
                           (statusOrder[b.status as keyof typeof statusOrder] || 0);
                  }
                  return 0;
                });

                return sortedTasks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma tarefa encontrada para "{taskSearchTerm}"
                  </p>
                ) : (
                  <div className="space-y-3">
                    {sortedTasks.map((task) => (
                  <div 
                    key={task.id} 
                    className="p-4 bg-muted/20 rounded-lg border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => {
                          setSelectedTask(task);
                          setTaskViewDialogOpen(true);
                        }}
                      >
                        <h4 className="font-medium text-foreground">{task.title}</h4>
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(task.status)}
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditTask(task);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {task.status !== "completed" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-success hover:text-success"
                              onClick={(e) => handleCompleteTask(task.id, e)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        {task.due_date && (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(task.due_date).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground">
                        {task.assigned_user?.full_name || "Não atribuído"}
                      </span>
                      </div>
                      
                      {task.description && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <span className="text-sm font-medium block mb-2">Notas:</span>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {task.description}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                );
              })()
            )}
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Contatos</h3>
              <Dialog open={contactDialogOpen} onOpenChange={(open) => {
                setContactDialogOpen(open);
                if (!open) {
                  setEditingContact(null);
                  resetContactForm();
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Contato
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingContact ? "Editar Contato" : "Criar Novo Contato"}</DialogTitle>
                    <DialogDescription>
                      {editingContact ? "Atualize as informações do contato" : "Adicione um novo contato para este prospect"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact_name">Nome *</Label>
                      <Input
                        id="contact_name"
                        value={contactFormData.name}
                        onChange={(e) => setContactFormData({ ...contactFormData, name: e.target.value })}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact_role">Cargo</Label>
                      <Input
                        id="contact_role"
                        value={contactFormData.role}
                        onChange={(e) => setContactFormData({ ...contactFormData, role: e.target.value })}
                        placeholder="Ex: Gerente de Compras"
                      />
                    </div>
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="contact_email">E-mail</Label>
                        <Input
                          id="contact_email"
                          type="email"
                          value={contactFormData.email}
                          onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contact_phone">Telefone</Label>
                        <Input
                          id="contact_phone"
                          value={contactFormData.phone}
                          onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                          placeholder="(00) 0000-0000"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="contact_mobile">Celular</Label>
                        <Input
                          id="contact_mobile"
                          value={contactFormData.mobile}
                          onChange={(e) => setContactFormData({ ...contactFormData, mobile: e.target.value })}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contact_rating">Avaliação</Label>
                        <Select
                          value={String(contactFormData.rating)}
                          onValueChange={(value) => setContactFormData({ ...contactFormData, rating: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="1">⭐ 1 - Baixa</SelectItem>
                            <SelectItem value="2">⭐⭐ 2 - Média</SelectItem>
                            <SelectItem value="3">⭐⭐⭐ 3 - Boa</SelectItem>
                            <SelectItem value="4">⭐⭐⭐⭐ 4 - Muito Boa</SelectItem>
                            <SelectItem value="5">⭐⭐⭐⭐⭐ 5 - Excelente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_primary"
                        checked={contactFormData.is_primary}
                        onChange={(e) => setContactFormData({ ...contactFormData, is_primary: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="is_primary" className="text-sm font-normal">
                        Marcar como contato principal
                      </Label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => {
                        setContactDialogOpen(false);
                        setEditingContact(null);
                        resetContactForm();
                      }}>
                        Cancelar
                      </Button>
                      <Button onClick={editingContact ? handleUpdateContact : handleCreateContact}>
                        {editingContact ? "Salvar Alterações" : "Criar Contato"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Search Input */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por nome ou cargo..."
                  value={contactSearchTerm}
                  onChange={(e) => setContactSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {contacts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum contato registrado</p>
            ) : (
              (() => {
                const filteredContacts = contacts.filter(contact => {
                  const searchLower = contactSearchTerm.toLowerCase();
                  return (
                    contact.name.toLowerCase().includes(searchLower) ||
                    (contact.role && contact.role.toLowerCase().includes(searchLower))
                  );
                });

                return filteredContacts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum contato encontrado para "{contactSearchTerm}"
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredContacts.map((contact) => (
                  <div 
                    key={contact.id} 
                    className="p-4 bg-muted/20 rounded-lg border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-foreground">{contact.name}</h4>
                          {contact.is_primary && (
                            <Badge variant="default" className="text-xs">Principal</Badge>
                          )}
                        </div>
                        {contact.role && (
                          <p className="text-sm text-muted-foreground">{contact.role}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleEditContact(contact)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteContact(contact.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Separator className="my-2" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {contact.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{contact.email}</span>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{contact.phone}</span>
                        </div>
                      )}
                      {contact.mobile && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{contact.mobile}</span>
                        </div>
                      )}
                      {contact.rating && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {"⭐".repeat(contact.rating)}
                          </span>
                        </div>
                      )}
                      </div>
                    </div>
                  ))}
                </div>
                );
              })()
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <TaskViewDialog
        task={selectedTask}
        open={taskViewDialogOpen}
        onOpenChange={setTaskViewDialogOpen}
      />
      
      <OpportunityViewDialog
        opportunity={selectedOpportunity}
        open={oppViewDialogOpen}
        onOpenChange={setOppViewDialogOpen}
      />

      <Dialog open={editTaskDialogOpen} onOpenChange={setEditTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tarefa</DialogTitle>
            <DialogDescription>
              Atualize as informações da tarefa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-task_type">Tipo de Tarefa *</Label>
              <Select
                value={taskFormData.task_type}
                onValueChange={(value) => setTaskFormData({ ...taskFormData, task_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="visita_presencial">Visita Presencial</SelectItem>
                  <SelectItem value="reuniao_online">Reunião Online</SelectItem>
                  <SelectItem value="visita_feira">Visita a Feira</SelectItem>
                  <SelectItem value="visita_evento">Visita a Evento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Notas / Descrição</Label>
              <Textarea
                id="edit-description"
                value={taskFormData.description}
                onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                placeholder="Adicione notas sobre esta tarefa..."
                rows={4}
              />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-due_date">Data e Hora *</Label>
                <Input
                  id="edit-due_date"
                  type="datetime-local"
                  value={taskFormData.due_date}
                  onChange={(e) => setTaskFormData({ ...taskFormData, due_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Prioridade</Label>
                <Select
                  value={taskFormData.priority}
                  onValueChange={(value) => setTaskFormData({ ...taskFormData, priority: value })}
                >
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
            <div className="space-y-2">
              <Label htmlFor="edit-status">Situação</Label>
              <Select
                value={taskFormData.status}
                onValueChange={(value) => setTaskFormData({ ...taskFormData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in_progress">Em Execução</SelectItem>
                  <SelectItem value="completed">Realizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setEditTaskDialogOpen(false);
                resetTaskForm();
                setEditingTask(null);
              }}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateTask}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ClientEditDialog
        client={client}
        open={editClientDialogOpen}
        onOpenChange={setEditClientDialogOpen}
        onSuccess={fetchClientDetails}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja excluir este cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isto irá permanentemente excluir o cliente
              <strong> {client?.company_name}</strong> e todo o seu histórico, incluindo:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Todos os contatos associados</li>
                <li>Todas as oportunidades e seus anexos</li>
                <li>Todas as tarefas relacionadas</li>
                <li>Todo o histórico de atividades</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClienteDetalhes;
