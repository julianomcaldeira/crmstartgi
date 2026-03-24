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
import { formatDateLocaleBR } from "@/lib/dateUtils";
import { Input } from "@/components/ui/input";
import { PhoneInput, CurrencyInput, formatCNPJ, formatPhone, autoAddMobileNine } from "@/components/ui/masked-input";
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
  Search,
  Copy,
  Globe,
  PhoneCall,
  MessageSquare,
  Video,
  MapPinned,
  Linkedin,
  Briefcase,
  Flag,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import TaskViewDialog from "@/components/TaskViewDialog";
import TaskNotesDialog from "@/components/TaskNotesDialog";
import OpportunityViewDialog from "@/components/OpportunityViewDialog";
import { ClientEditDialog } from "@/components/ClientEditDialog";
import { TaskEditDialog } from "@/components/TaskEditDialog";
import TaskQuickMessages from "@/components/TaskQuickMessages";
import TaskTemplateSelector from "@/components/TaskTemplateSelector";
import AudioRecorder from "@/components/AudioRecorder";
import BusinessCardScanner from "@/components/BusinessCardScanner";
import AIAnalysisDialog from "@/components/AIAnalysisDialog";
import { ProspectDiagnosticDialog } from "@/components/ProspectDiagnosticDialog";
import { DiagnosticHistoryList } from "@/components/DiagnosticHistoryList";
import { AIAnalysisHistoryList } from "@/components/AIAnalysisHistoryList";
import { ClipboardList } from "lucide-react";
import TaskHoverPreview from "@/components/TaskHoverPreview";

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
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
  const [taskStatusFilter, setTaskStatusFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [taskNotesDialogOpen, setTaskNotesDialogOpen] = useState(false);
  const [selectedTaskForNotes, setSelectedTaskForNotes] = useState<any>(null);
  const [aiAnalysisDialogOpen, setAiAnalysisDialogOpen] = useState(false);
  const [diagnosticDialogOpen, setDiagnosticDialogOpen] = useState(false);
  

  const handleCopy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success("Copiado!");
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast.error("Erro ao copiar");
    }
  };
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
    charge_commission: false,
    billing_type: "recorrente",
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

      setCurrentUserId(user.id);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const role = roleData?.role || null;
      setUserRole(role);
      setIsAdmin(role === "admin");
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
          assigned_user:profiles!tasks_assigned_to_fkey(full_name),
          clients(id, company_name, trade_name, cnpj, email, phone, city, state, website, address, segment),
          contacts(id, name, email, phone, mobile, role),
          profiles:assigned_to(full_name)
        `)
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      
      if (tasksError) {
        console.error("Error fetching tasks:", tasksError);
      }

      const normalizedTasks = (tasksData || []).map((t: any) => ({
        ...t,
        client: t.client ?? t.clients,
        contact: t.contact ?? t.contacts,
        opportunity: t.opportunity ?? t.opportunities,
      }));

      setTasks(normalizedTasks);

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
        visita_evento: "Visita a Evento",
        pesquisa_inicial: "Pesquisa Inicial"
      };
      
      const title = taskTypeLabels[taskFormData.task_type] || "Tarefa";

      // Converter datetime-local para ISO preservando o horário local
      let dueDateISO = null;
      if (taskFormData.due_date) {
        const localDate = new Date(taskFormData.due_date);
        dueDateISO = localDate.toISOString();
      }

      const { error } = await supabase.from("tasks").insert([
        {
          title,
          description: taskFormData.description,
          client_id: id,
          task_type: taskFormData.task_type as any,
          due_date: dueDateISO,
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
          title: `Oportunidade - ${client?.company_name || client?.trade_name}`,
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
          charge_commission: oppFormData.charge_commission,
          billing_type: oppFormData.billing_type,
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
      charge_commission: false,
      billing_type: "recorrente",
    });
  };

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    setEditTaskDialogOpen(true);
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

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;

      toast.success("Tarefa excluída com sucesso!");
      setTaskViewDialogOpen(false);
      fetchClientDetails();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Erro ao excluir tarefa");
    }
  };

  const canDeleteTask = (task: any) => {
    if (!currentUserId) return false;
    // Admin ou gestor podem deletar qualquer tarefa
    if (userRole === "admin" || userRole === "gestor") return true;
    // O criador da tarefa pode deletar
    if (task.created_by === currentUserId) return true;
    return false;
  };

  const handleCreateContact = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (!contactFormData.name) {
        toast.error("Preencha o nome do contato");
        return;
      }

      const { data, error } = await supabase.from("contacts").insert([
        {
          client_id: id,
          name: contactFormData.name,
          role: contactFormData.role || null,
          email: contactFormData.email || null,
          phone: contactFormData.phone || null,
          mobile: contactFormData.mobile ? autoAddMobileNine(contactFormData.mobile) : null,
          rating: contactFormData.rating,
          is_primary: contactFormData.is_primary,
          created_by: user.id,
        },
      ]).select();

      if (error) throw error;

      // Verificar se o contato foi realmente criado
      if (!data || data.length === 0) {
        throw new Error("Contato não foi salvo corretamente");
      }

      toast.success("Contato criado com sucesso!");
      resetContactForm();
      setContactDialogOpen(false);
      // Re-fetch only contacts to avoid full page reload race condition
      const { data: updatedContacts } = await supabase
        .from("contacts")
        .select("*")
        .eq("client_id", id)
        .order("name");
      setContacts(updatedContacts || []);
    } catch (error: any) {
      console.error("Error creating contact:", error);
      toast.error(error.message || "Erro ao criar contato");
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

      const { data, error } = await supabase
        .from("contacts")
        .update({
          name: contactFormData.name,
          role: contactFormData.role || null,
          email: contactFormData.email || null,
          phone: contactFormData.phone ? autoAddMobileNine(contactFormData.phone) : null,
          mobile: contactFormData.mobile ? autoAddMobileNine(contactFormData.mobile) : null,
          rating: contactFormData.rating,
          is_primary: contactFormData.is_primary,
        })
        .eq("id", editingContact.id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("Contato não foi atualizado corretamente");
      }

      toast.success("Contato atualizado com sucesso!");
      resetContactForm();
      setEditingContact(null);
      setContactDialogOpen(false);
      await fetchClientDetails();
    } catch (error: any) {
      console.error("Error updating contact:", error);
      toast.error(error.message || "Erro ao atualizar contato");
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
    const statusConfig: Record<string, { label: string; className: string }> = {
      // Opportunity statuses - matching pipeline colors
      lead: { label: "Lead", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-100" },
      contacted: { label: "Contactado", className: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 hover:bg-sky-100" },
      qualified: { label: "Qualificado", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300 hover:bg-cyan-100" },
      apresentacao: { label: "Apresentação", className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 hover:bg-purple-100" },
      proposal: { label: "Proposta", className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 hover:bg-amber-100" },
      negotiation: { label: "Negociação", className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 hover:bg-orange-100" },
      won: { label: "Ganho", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 hover:bg-green-100" },
      lost: { label: "Perdido", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 hover:bg-red-100" },
      // Task statuses
      pending: { label: "Pendente", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-100" },
      in_progress: { label: "Em Progresso", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-100" },
      completed: { label: "Concluída", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 hover:bg-green-100" },
      cancelled: { label: "Cancelada", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-100" },
    };
    
    const config = statusConfig[status] || { label: status, className: "bg-gray-100 text-gray-700" };
    return <Badge className={config.className}>{config.label}</Badge>;
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
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground">{client.company_name}</h1>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={() => handleCopy(client.company_name, "companyName")}
              title="Copiar Razão Social"
            >
              {copiedField === "companyName" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-muted-foreground">{client.trade_name}</p>
        </div>
        <Button 
          variant="default" 
          size="sm"
          onClick={() => setDiagnosticDialogOpen(true)}
          className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
        >
          <ClipboardList className="mr-2 h-4 w-4" />
          Diagnóstico
        </Button>
        {opportunities.length > 0 && (
          <Button 
            variant="default" 
            size="sm"
            onClick={() => setAiAnalysisDialogOpen(true)}
            className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Análise IA
          </Button>
        )}
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
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{formatCNPJ(client.cnpj)}</p>
                {client.cnpj && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(client.cnpj, "cnpj")} title="Copiar">
                    {copiedField === "cnpj" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Endereço</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">
                  {client.address ? `${client.address}${client.city ? `, ${client.city}` : ''}${client.state ? ` - ${client.state}` : ''}` : "-"}
                </p>
                {client.address && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(`${client.address}${client.city ? `, ${client.city}` : ''}${client.state ? ` - ${client.state}` : ''}`, "address")} title="Copiar">
                    {copiedField === "address" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Email</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground break-all">{client.email || "-"}</p>
                {client.email && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(client.email, "email")} title="Copiar">
                    {copiedField === "email" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Segmento</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{client.segment || "-"}</p>
                {client.segment && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(client.segment, "segment")} title="Copiar">
                    {copiedField === "segment" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Telefone</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{client.phone ? formatPhone(client.phone) : "-"}</p>
                {client.phone && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(client.phone, "phone")} title="Copiar">
                    {copiedField === "phone" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Site</p>
              <div className="flex items-center gap-2">
                {client.website ? (
                  <a 
                    href={client.website.startsWith('http') ? client.website : `https://${client.website}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {client.website}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-foreground">-</p>
                )}
                {client.website && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(client.website, "website")} title="Copiar">
                    {copiedField === "website" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Capital Social</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">
                  {client.share_capital ? `R$ ${Number(client.share_capital).toLocaleString('pt-BR')}` : "-"}
                </p>
                {client.share_capital && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(`R$ ${Number(client.share_capital).toLocaleString('pt-BR')}`, "capital")} title="Copiar">
                    {copiedField === "capital" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Porte da Empresa</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{client.company_size || "-"}</p>
                {client.company_size && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(client.company_size, "size")} title="Copiar">
                    {copiedField === "size" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Região</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{client.region || "-"}</p>
                {client.region && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(client.region, "region")} title="Copiar">
                    {copiedField === "region" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Concorrentes</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{client.competitors || "-"}</p>
                {client.competitors && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(client.competitors, "competitors")} title="Copiar">
                    {copiedField === "competitors" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Distribuidor</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{client.distributor || "-"}</p>
                {client.distributor && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(client.distributor, "distributor")} title="Copiar">
                    {copiedField === "distributor" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">Serviços</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{client.services || "-"}</p>
                {client.services && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(client.services, "services")} title="Copiar">
                    {copiedField === "services" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Contacts */}
      {contacts.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Contatos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contacts.map((contact, idx) => (
              <div key={contact.id} className="p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{contact.name}</p>
                      {contact.is_primary && (
                        <Badge variant="secondary" className="text-xs">Principal</Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(contact.name, `contact-name-${idx}`)} title="Copiar nome">
                        {copiedField === `contact-name-${idx}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{contact.role || "Contato"}</p>
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <p className="text-sm text-foreground">{contact.email}</p>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCopy(contact.email, `contact-email-${idx}`)} title="Copiar email">
                          {copiedField === `contact-email-${idx}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <p className="text-sm text-foreground">{formatPhone(contact.phone)}</p>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCopy(contact.phone, `contact-phone-${idx}`)} title="Copiar telefone">
                          {copiedField === `contact-phone-${idx}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    )}
                    {contact.mobile && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <p className="text-sm text-foreground">{formatPhone(contact.mobile)}</p>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCopy(contact.mobile, `contact-mobile-${idx}`)} title="Copiar celular">
                          {copiedField === `contact-mobile-${idx}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
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
                      {formatDateLocaleBR(item.feira.start_date)}
                      {item.feira.end_date && ` - ${formatDateLocaleBR(item.feira.end_date)}`}
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="opportunities">Oportunidades</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
          <TabsTrigger value="contacts">Contatos</TabsTrigger>
          <TabsTrigger value="ai-analyses">Análises IA</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnósticos</TabsTrigger>
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
                        <CurrencyInput
                          id="implementation_value"
                          value={oppFormData.implementation_value}
                          onValueChange={(value) => setOppFormData({ ...oppFormData, implementation_value: value })}
                          placeholder="R$ 0,00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="monthly_value">
                          {oppFormData.billing_type === 'pontual' ? 'Valor Pontual' : 'Valor Mensal'}
                        </Label>
                        <CurrencyInput
                          id="monthly_value"
                          value={oppFormData.monthly_value}
                          onValueChange={(value) => setOppFormData({ ...oppFormData, monthly_value: value })}
                          placeholder="R$ 0,00"
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

                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="billing_type">Tipo de Cobrança</Label>
                        <Select
                          value={oppFormData.billing_type}
                          onValueChange={(value) => setOppFormData({ ...oppFormData, billing_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="recorrente">Recorrente (Mensal x 12)</SelectItem>
                            <SelectItem value="pontual">Pontual (Valor Único)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {oppFormData.billing_type === 'pontual' 
                            ? 'Valor único, sem mensalidade' 
                            : 'Valor mensal multiplicado por 12 meses'}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 pt-6">
                        <input
                          type="checkbox"
                          id="charge_commission"
                          checked={oppFormData.charge_commission}
                          onChange={(e) => setOppFormData({ ...oppFormData, charge_commission: e.target.checked })}
                          className="h-4 w-4 rounded border-border"
                        />
                        <Label htmlFor="charge_commission" className="text-sm font-normal cursor-pointer">
                          Cobrar comissão do cliente
                        </Label>
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
                      <div className="flex items-center gap-2">
                        {getStatusBadge(opp.status)}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/oportunidades?edit=${opp.id}`);
                          }}
                          title="Editar oportunidade"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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

        <TabsContent value="tasks" className="space-y-4 overflow-x-hidden">
          <Card className="p-6 overflow-x-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Histórico de Tarefas</h3>
              <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Tarefa
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
                  <DialogHeader>
                    <DialogTitle>Criar Nova Tarefa</DialogTitle>
                    <DialogDescription>
                      Adicione uma nova tarefa para este cliente
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <TaskTemplateSelector 
                        onSelect={(template) => {
                          setTaskFormData({
                            ...taskFormData,
                            task_type: template.task_type,
                            priority: template.priority,
                            description: template.description,
                          });
                        }} 
                      />
                    </div>
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
                          <SelectItem value="proposta">Proposta</SelectItem>
                          <SelectItem value="pesquisa_inicial">Pesquisa Inicial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Notas / Descrição</Label>
                      <TaskQuickMessages 
                        taskType={taskFormData.task_type} 
                        onSelect={(msg) => setTaskFormData({ 
                          ...taskFormData, 
                          description: taskFormData.description ? `${taskFormData.description}\n${msg}` : msg 
                        })} 
                      />
                      <div className="flex gap-2">
                        <Textarea
                          id="description"
                          value={taskFormData.description}
                          onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                          placeholder="Adicione notas sobre esta tarefa..."
                          rows={4}
                          className="flex-1 resize-y min-h-[100px] overflow-x-hidden overflow-y-auto no-scrollbar [overflow-wrap:anywhere]"
                        />
                        <AudioRecorder
                          onTranscription={(text) => setTaskFormData({
                            ...taskFormData,
                            description: taskFormData.description ? `${taskFormData.description}\n${text}` : text
                          })}
                        />
                      </div>
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

            {/* Quick Status Filter */}
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                variant={taskStatusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setTaskStatusFilter("all")}
                className="h-8"
              >
                Todas
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {tasks.length}
                </Badge>
              </Button>
              <Button
                variant={taskStatusFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setTaskStatusFilter("pending")}
                className="h-8"
              >
                Pendentes
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {tasks.filter(t => t.status === "pending").length}
                </Badge>
              </Button>
              <Button
                variant={taskStatusFilter === "in_progress" ? "default" : "outline"}
                size="sm"
                onClick={() => setTaskStatusFilter("in_progress")}
                className="h-8"
              >
                Em Execução
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {tasks.filter(t => t.status === "in_progress").length}
                </Badge>
              </Button>
              <Button
                variant={taskStatusFilter === "completed" ? "default" : "outline"}
                size="sm"
                onClick={() => setTaskStatusFilter("completed")}
                className="h-8"
              >
                Realizadas
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {tasks.filter(t => t.status === "completed").length}
                </Badge>
              </Button>
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
                  // Status filter
                  if (taskStatusFilter !== "all" && task.status !== taskStatusFilter) {
                    return false;
                  }
                  // Search filter
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
                    Nenhuma tarefa encontrada {taskSearchTerm && `para "${taskSearchTerm}"`} {taskStatusFilter !== "all" && `com status "${taskStatusFilter === 'pending' ? 'Pendente' : taskStatusFilter === 'in_progress' ? 'Em Execução' : 'Realizada'}"`}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {sortedTasks.map((task) => {
                      const taskTypeConfig: Record<string, { icon: any; label: string; color: string }> = {
                        ligacao: { icon: PhoneCall, label: "Ligação", color: "text-blue-500" },
                        email: { icon: Mail, label: "E-mail", color: "text-amber-500" },
                        whatsapp: { icon: MessageSquare, label: "WhatsApp", color: "text-green-500" },
                        visita_presencial: { icon: MapPinned, label: "Visita", color: "text-purple-500" },
                        reuniao_online: { icon: Video, label: "Reunião Online", color: "text-cyan-500" },
                        visita_feira: { icon: Flag, label: "Visita Feira", color: "text-orange-500" },
                        visita_evento: { icon: Flag, label: "Visita Evento", color: "text-pink-500" },
                        linkedin: { icon: Linkedin, label: "LinkedIn", color: "text-blue-600" },
                        proposta: { icon: Briefcase, label: "Proposta", color: "text-emerald-500" },
                        pesquisa_inicial: { icon: Search, label: "Pesquisa Inicial", color: "text-indigo-500" },
                      };
                      
                      const priorityConfig: Record<string, { label: string; bgColor: string; textColor: string }> = {
                        high: { label: "Alta", bgColor: "bg-destructive/10", textColor: "text-destructive" },
                        medium: { label: "Média", bgColor: "bg-warning/10", textColor: "text-warning" },
                        low: { label: "Baixa", bgColor: "bg-muted", textColor: "text-muted-foreground" },
                      };
                      
                      const typeInfo = taskTypeConfig[task.task_type || ""] || { icon: Clock, label: "Tarefa", color: "text-muted-foreground" };
                      const priorityInfo = priorityConfig[task.priority || "medium"];
                      const TaskIcon = typeInfo.icon;
                      
                      const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "completed";
                      
                      return (
                        <TaskHoverPreview key={task.id} task={task}>
                          <div 
                            className={`group relative p-4 rounded-xl border bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
                              task.status === "completed" ? "opacity-70" : ""
                            } ${isOverdue ? "border-destructive/50" : "border-border hover:border-primary/30"}`}
                          >
                            {/* Priority indicator bar */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                              task.priority === "high" ? "bg-destructive" : 
                              task.priority === "medium" ? "bg-warning" : "bg-muted-foreground/30"
                            }`} />
                            
                            <div className="pl-3">
                              {/* Header */}
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div 
                                  className="flex items-start gap-3 flex-1 cursor-pointer min-w-0"
                                  onClick={() => {
                                    setSelectedTask(task);
                                    setTaskViewDialogOpen(true);
                                  }}
                                >
                                  <div className={`p-2 rounded-lg bg-muted/50 ${typeInfo.color} shrink-0`}>
                                    <TaskIcon className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h4 className={`font-semibold text-foreground leading-tight ${task.status === "completed" ? "line-through" : ""}`}>
                                      {task.title}
                                    </h4>
                                    <span className={`text-xs ${typeInfo.color}`}>{typeInfo.label}</span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 shrink-0">
                                  {getStatusBadge(task.status)}
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTaskForNotes(task);
                                        setTaskNotesDialogOpen(true);
                                      }}
                                      title="Ver notas"
                                    >
                                      <MessageSquare className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditTask(task);
                                      }}
                                      title="Editar tarefa"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>

                                    {canDeleteTask(task) && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm("Tem certeza que deseja excluir esta tarefa?")) {
                                            handleDeleteTask(task.id);
                                          }
                                        }}
                                        title="Excluir tarefa"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}

                                    {task.status !== "completed" && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                                        onClick={(e) => handleCompleteTask(task.id, e)}
                                        title="Marcar como realizada"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Meta info */}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap min-w-0 [overflow-wrap:anywhere]">
                                {task.due_date && (
                                  <span className={`flex items-center gap-1.5 ${isOverdue ? "text-destructive font-medium" : ""}`}>
                                    <Calendar className="h-3.5 w-3.5" />
                                    {new Date(task.due_date).toLocaleDateString('pt-BR')} às {new Date(task.due_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    {isOverdue && <span className="text-[10px] bg-destructive/10 px-1.5 py-0.5 rounded">Atrasada</span>}
                                  </span>
                                )}
                                {priorityInfo && (
                                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${priorityInfo.bgColor} ${priorityInfo.textColor}`}>
                                    {priorityInfo.label}
                                  </span>
                                )}
                                {task.assigned_user?.full_name && (
                                  <span className="flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5" />
                                    {task.assigned_user.full_name}
                                  </span>
                                )}
                              </div>
                              
                              {/* Description */}
                              {task.description && (
                                <div className="mt-3 pt-3 border-t border-border/50">
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere] overflow-x-hidden line-clamp-3">
                                    {task.description}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </TaskHoverPreview>
                      );
                    })}
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
                    {!editingContact && (
                      <BusinessCardScanner
                        onContactExtracted={(contact) => {
                          // Limpa os telefones para conter apenas dígitos (para a máscara funcionar corretamente)
                          const cleanPhone = contact.phone?.replace(/\D/g, '') || '';
                          const cleanMobile = contact.mobile?.replace(/\D/g, '') || '';
                          setContactFormData({
                            ...contactFormData,
                            name: contact.name || contactFormData.name,
                            role: contact.role || contactFormData.role,
                            email: contact.email || contactFormData.email,
                            phone: cleanPhone || contactFormData.phone,
                            mobile: cleanMobile || contactFormData.mobile,
                          });
                        }}
                      />
                    )}
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
                        <PhoneInput
                          id="contact_phone"
                          value={contactFormData.phone}
                          onValueChange={(value) => setContactFormData({ ...contactFormData, phone: value })}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="contact_mobile">Celular</Label>
                        <PhoneInput
                          id="contact_mobile"
                          value={contactFormData.mobile}
                          onValueChange={(value) => setContactFormData({ ...contactFormData, mobile: value })}
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
                          <span className="text-muted-foreground">{formatPhone(contact.phone)}</span>
                        </div>
                      )}
                      {contact.mobile && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{formatPhone(contact.mobile)}</span>
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

        <TabsContent value="ai-analyses" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Histórico de Análises de IA</h3>
              <Button size="sm" onClick={() => setAiAnalysisDialogOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Nova Análise
              </Button>
            </div>
            <AIAnalysisHistoryList clientId={id || ""} />
          </Card>
        </TabsContent>

        <TabsContent value="diagnostics" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Histórico de Diagnósticos</h3>
              <Button size="sm" onClick={() => setDiagnosticDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Diagnóstico
              </Button>
            </div>
            <DiagnosticHistoryList 
              clientId={id || ""}
              clientName={client?.company_name || client?.trade_name || ""}
            />
          </Card>
        </TabsContent>
      </Tabs>

      <TaskViewDialog
        task={selectedTask}
        open={taskViewDialogOpen}
        onOpenChange={setTaskViewDialogOpen}
        onDelete={selectedTask && canDeleteTask(selectedTask) ? handleDeleteTask : undefined}
      />
      
      <OpportunityViewDialog
        opportunity={selectedOpportunity}
        open={oppViewDialogOpen}
        onOpenChange={setOppViewDialogOpen}
      />

      {editingTask && (
        <TaskEditDialog
          task={editingTask}
          open={editTaskDialogOpen}
          onOpenChange={(open) => {
            setEditTaskDialogOpen(open);
            if (!open) {
              setEditingTask(null);
            }
          }}
          onSuccess={fetchClientDetails}
        />
      )}

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

      {/* Task Notes Dialog */}
      <TaskNotesDialog
        taskId={selectedTaskForNotes?.id || ""}
        taskTitle={selectedTaskForNotes?.title || ""}
        open={taskNotesDialogOpen}
        onOpenChange={setTaskNotesDialogOpen}
      />

      {/* AI Analysis Dialog */}
      <AIAnalysisDialog
        open={aiAnalysisDialogOpen}
        onOpenChange={setAiAnalysisDialogOpen}
        client={client}
        opportunities={opportunities}
        tasks={tasks}
        contacts={contacts}
      />

      {/* Prospect Diagnostic Dialog */}
      <ProspectDiagnosticDialog
        open={diagnosticDialogOpen}
        onOpenChange={setDiagnosticDialogOpen}
        clientId={id || ""}
        clientName={client?.company_name || client?.trade_name || ""}
        onComplete={fetchClientDetails}
      />
    </div>
  );
};

export default ClienteDetalhes;
