import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Plus, Calendar, CheckCircle2, Circle, ListTodo, Phone, Mail, MessageCircle, MapPin, Video, Briefcase, Users, Building2, CalendarIcon, ChevronLeft, ChevronRight, Clock, AlertCircle, LayoutGrid, List as ListIcon, Search, ChevronsLeft, ChevronsRight, Sparkles, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInHours, isPast, startOfWeek, endOfWeek, addDays, isSameDay, parseISO, startOfDay, endOfDay, isToday as isTodayFn, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { DraggableCard } from "@/components/DraggableCard";
import { DroppableColumn } from "@/components/DroppableColumn";
import TaskHoverPreview from "@/components/TaskHoverPreview";
import TaskViewDialog from "@/components/TaskViewDialog";
import { TaskEditDialog } from "@/components/TaskEditDialog";
import { SwipeableCard } from "@/components/SwipeableCard";
import { useViewMode } from "@/hooks/useViewMode";
import TaskQuickMessages from "@/components/TaskQuickMessages";
import TaskTemplateSelector from "@/components/TaskTemplateSelector";
import AudioRecorder from "@/components/AudioRecorder";
import { SearchableCombobox } from "@/components/SearchableCombobox";
import TaskAttachments, { uploadTaskAttachments } from "@/components/TaskAttachments";
import { parseDateOnly } from "@/lib/dateUtils";
import { fetchAllPaged } from "@/lib/fetchAllPaged";
import SalesAgenda from "@/components/SalesAgenda";
import { useCanEdit } from "@/hooks/useCanEdit";

const Tarefas = () => {
  const navigate = useNavigate();
  const { canEdit } = useCanEdit();
  const [tasks, setTasks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "overdue">("pending");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar" | "agenda">("list");
  const [cardViewMode, setCardViewMode] = useViewMode("tasks-card-view-mode", "cards");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Filters
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignClientsMap, setCampaignClientsMap] = useState<Record<string, Set<string>>>({});
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  
  // Quick filters for list view
  const [quickTaskTypeFilter, setQuickTaskTypeFilter] = useState("all");
  const [quickPriorityFilter, setQuickPriorityFilter] = useState("all");
  const [calendarCompanySearch, setCalendarCompanySearch] = useState("");
  
  // AI Search
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearching, setAiSearching] = useState(false);
  const [aiMatchedIds, setAiMatchedIds] = useState<string[] | null>(null);
  const [aiExplanation, setAiExplanation] = useState("");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form state
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [taskType, setTaskType] = useState("ligacao");
  const [clientId, setClientId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [contactId, setContactId] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [initialFilterApplied, setInitialFilterApplied] = useState(false);

  useEffect(() => {
    fetchData();
    checkUpcomingTasks();
    checkUserRole();
    
    // Check for upcoming tasks every 5 minutes
    const interval = setInterval(checkUpcomingTasks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentDate, viewMode]);

  // Auto-preencher data e hora atual quando abrir o dialog de criar tarefa
  useEffect(() => {
    if (dialogOpen) {
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setDueDate(localDateTime);
    }
  }, [dialogOpen]);

  // Apply initial filter for vendedor role - tasks are already filtered by assigned_to in fetchData
  // but we keep this for consistency
  useEffect(() => {
    if (currentUserId && userRole === "vendedor" && !initialFilterApplied) {
      setInitialFilterApplied(true);
    }
  }, [currentUserId, userRole, initialFilterApplied]);

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
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check user role to determine if they can see all tasks
      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)

      if (roleError) {
        console.warn("Erro ao buscar roles do usuário:", roleError);
      }

      const resolvedRole = (() => {
        const roles = (roleRows || []).map((r: any) => r.role);
        if (roles.includes("admin")) return "admin";
        if (roles.includes("gestor")) return "gestor";
        if (roles.includes("vendedor")) return "vendedor";
        return null;
      })();

      const isAdminOrGestor = resolvedRole === "admin" || resolvedRole === "gestor";

      const buildTasksQuery = () => {
        if (viewMode === "calendar") {
          const weekStart = startOfWeek(currentDate, { locale: ptBR });
          const weekEnd = endOfWeek(currentDate, { locale: ptBR });

          let q = supabase
            .from("tasks")
            .select(`
              *,
              clients(id, company_name, trade_name, cnpj, created_by, email, phone, city, state, website, address, segment),
              opportunities(title),
              contacts(id, name, email, phone, mobile, role),
              profiles:assigned_to(full_name)
            `)
            .gte("due_date", weekStart.toISOString())
            .lte("due_date", weekEnd.toISOString())
            .order("due_date", { ascending: true });

          if (!isAdminOrGestor) {
            q = q.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
          }

          return q;
        }

        let q = supabase
          .from("tasks")
          .select(`
            *,
            clients(id, company_name, trade_name, cnpj, created_by, email, phone, city, state, website, address, segment),
            opportunities(title),
            contacts(id, name, email, phone, mobile, role),
            profiles:assigned_to(full_name)
          `)
          // importante para paginação: ordenação estável
          .order("due_date", { ascending: true });

        if (!isAdminOrGestor) {
          q = q.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
        }

        return q;
      };
      
      const [tasksData, clientsResponse, oppsResponse, usersResponse, campaignsResponse, clientCampaignsResponse] = await Promise.all([
        // Lista pode ultrapassar 1000 linhas; paginamos para não "sumir" tarefa pendente
        fetchAllPaged(async (from, to) => {
          const { data, error } = await buildTasksQuery().range(from, to);
          if (error) throw error;
          return (data || []) as any[];
        }),
        supabase.from("clients").select("id, company_name, trade_name, cnpj"),
        supabase.from("opportunities").select("id, title"),
        supabase.from("profiles").select("id, full_name").or("is_deleted.is.null,is_deleted.eq.false"),
        supabase.from("campaigns").select("id, name, status").order("name"),
        supabase.from("client_campaigns").select("campaign_id, client_id"),
      ]);

      if (clientsResponse.error) throw clientsResponse.error;
      if (oppsResponse.error) throw oppsResponse.error;
      if (usersResponse.error) throw usersResponse.error;

      const normalizedTasks = (tasksData || []).map((t: any) => ({
        ...t,
        client: t.client ?? t.clients,
        contact: t.contact ?? t.contacts,
        opportunity: t.opportunity ?? t.opportunities,
      }));

      // Mapear campanha -> set de client_ids
      const campaignMap: Record<string, Set<string>> = {};
      (clientCampaignsResponse.data || []).forEach((cc: any) => {
        if (!campaignMap[cc.campaign_id]) campaignMap[cc.campaign_id] = new Set();
        campaignMap[cc.campaign_id].add(cc.client_id);
      });

      setTasks(normalizedTasks);
      setClients(clientsResponse.data || []);
      setOpportunities(oppsResponse.data || []);
      setUsers(usersResponse.data || []);
      setCampaigns(campaignsResponse.data || []);
      setCampaignClientsMap(campaignMap);

      // Mantém userRole do estado alinhada com a role real (evita admin/gestor serem tratados como vendedor)
      setUserRole(resolvedRole);
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
    if (saving) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

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
      
      const title = taskTypeLabels[taskType] || "Tarefa";

      // Converter datetime-local para ISO preservando o horário local
      // O input datetime-local retorna no formato "YYYY-MM-DDTHH:mm"
      // Precisamos adicionar os segundos e o timezone offset para evitar conversão incorreta
      let dueDateISO = null;
      if (dueDate) {
        const localDate = new Date(dueDate);
        dueDateISO = localDate.toISOString();
      }

      const { data, error } = await supabase.from("tasks").insert([{
        title,
        description,
        due_date: dueDateISO,
        priority: priority as any,
        task_type: taskType as any,
        client_id: clientId || null,
        contact_id: contactId || null,
        opportunity_id: opportunityId || null,
        assigned_to: assignedTo || user.id,
        created_by: user.id,
      }]).select().single();

      if (error) throw error;

      // Upload pending attachments if any
      if (pendingAttachments.length > 0 && data?.id) {
        try {
          await uploadTaskAttachments(data.id, pendingAttachments);
        } catch (attachError) {
          console.error("Error uploading attachments:", attachError);
          toast.warning("Tarefa criada, mas houve erro ao anexar arquivos");
        }
      }

      toast.success("Tarefa criada com sucesso!");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error creating task:", error);
      toast.error(error.message || "Erro ao criar tarefa");
    } finally {
      setSaving(false);
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
    setPendingAttachments([]);
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

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)

      if (roleError) {
        console.warn("Erro ao buscar roles do usuário:", roleError);
      }

      const roles = (roleRows || []).map((r: any) => r.role);
      const resolvedRole = roles.includes("admin")
        ? "admin"
        : roles.includes("gestor")
          ? "gestor"
          : roles.includes("vendedor")
            ? "vendedor"
            : null;

      setUserRole(resolvedRole);
    } catch (error) {
      console.error("Error checking user role:", error);
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

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;

      toast.success("Tarefa excluída com sucesso!");
      setViewDialogOpen(false);
      setEditDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting task:", error);
      toast.error("Erro ao excluir tarefa: " + error.message);
    }
  };

  const handleAiSearch = async () => {
    if (!aiSearchQuery.trim()) {
      setAiMatchedIds(null);
      setAiExplanation("");
      return;
    }
    setAiSearching(true);
    try {
      const taskSummaries = tasks.map((t: any) => ({
        id: t.id,
        title: t.title || "",
        description: t.description || "",
        client_name: t.clients?.company_name || t.clients?.trade_name || "",
        task_type: t.task_type || "",
        status: t.status || "",
        notes: "",
      }));
      const taskIds = tasks.map((t: any) => t.id);
      const { data: notesData } = await supabase
        .from("task_notes")
        .select("task_id, note")
        .in("task_id", taskIds.slice(0, 200));
      const notesByTask: Record<string, string> = {};
      (notesData || []).forEach((n: any) => {
        notesByTask[n.task_id] = (notesByTask[n.task_id] || "") + " " + n.note;
      });
      const enrichedSummaries = taskSummaries.map((t) => ({
        ...t,
        notes: notesByTask[t.id] || "",
      }));
      const { data, error } = await supabase.functions.invoke("search-tasks-ai", {
        body: { query: aiSearchQuery, tasks: enrichedSummaries },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setAiMatchedIds(data.matching_ids || []);
      setAiExplanation(data.explanation || "");
      if ((data.matching_ids || []).length === 0) {
        toast.info("Nenhuma tarefa encontrada para essa busca.");
      } else {
        toast.success(`${data.matching_ids.length} tarefa(s) encontrada(s)`);
      }
    } catch (error: any) {
      console.error("AI search error:", error);
      toast.error("Erro na busca inteligente: " + (error.message || "Tente novamente"));
    } finally {
      setAiSearching(false);
    }
  };

  const clearAiSearch = () => {
    setAiSearchQuery("");
    setAiMatchedIds(null);
    setAiExplanation("");
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    try {
      const taskId = active.id as string;
      const newDateStr = over.id as string;
      
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      const oldDueDate = new Date(task.due_date);
      const newDate = new Date(newDateStr);
      
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
      case "linkedin": return <Users size={16} />;
      case "visita_presencial": return <MapPin size={16} />;
      case "reuniao_online": return <Video size={16} />;
      case "visita_feira": return <Briefcase size={16} />;
      case "visita_evento": return <Users size={16} />;
      case "apresentacao": return <Briefcase size={16} />;
      case "proposta": return <Briefcase size={16} />;
      case "pesquisa_inicial": return <Search size={16} />;
      default: return <Circle size={16} />;
    }
  };

  const getTaskTypeLabel = (type: string) => {
    switch (type) {
      case "ligacao": return "Ligação";
      case "email": return "E-mail";
      case "whatsapp": return "WhatsApp";
      case "linkedin": return "LinkedIn";
      case "visita_presencial": return "Visita Presencial";
      case "reuniao_online": return "Reunião Online";
      case "visita_feira": return "Visita a Feira";
      case "visita_evento": return "Visita a Evento";
      case "apresentacao": return "Apresentação";
      case "proposta": return "Proposta";
      case "pesquisa_inicial": return "Pesquisa Inicial";
      default: return type;
    }
  };

  const getTaskStatusColor = (task: any) => {
    if (task.status === "completed") {
      return "border-l-success bg-success/5";
    }

    if (task.status === "cancelled") {
      return "border-l-muted bg-muted/20";
    }

    if (!task.due_date) {
      return "border-l-primary bg-background";
    }

    const taskDate = new Date(task.due_date);
    const taskDay = startOfDay(taskDate);
    const todayStartLocal = startOfDay(new Date());

    // Atrasada só se for dia anterior (não por hora)
    if (taskDay < todayStartLocal) {
      return "border-l-destructive bg-destructive/10";
    }

    const hoursUntilDue = (taskDate.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    if (hoursUntilDue <= 24 && hoursUntilDue > 0) {
      return "border-l-warning bg-warning/10";
    }
    
    return "border-l-primary bg-background";
  };

  const getTaskStatusIcon = (task: any) => {
    if (task.status === "completed") {
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    }

    if (task.status === "cancelled") {
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
    
    if (!task.due_date) {
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
    
    const taskDate = new Date(task.due_date);
    const taskDay = startOfDay(taskDate);
    const todayStartLocal = startOfDay(new Date());

    if (taskDay < todayStartLocal) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    
    const hoursUntilDue = (taskDate.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    if (hoursUntilDue <= 24 && hoursUntilDue > 0) {
      return <AlertCircle className="h-4 w-4 text-warning" />;
    }
    
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getTaskDate = (task: any) => (task?.due_date ? new Date(task.due_date) : null);

  // Comparações por dia (evita que tarefas "de hoje" sumam da aba Pendentes após o horário passar)
  const todayStart = startOfDay(new Date());
  const getTaskDay = (task: any) => {
    const dt = getTaskDate(task);
    return dt ? startOfDay(dt) : null;
  };

  const matchesStatusFilter = (task: any, statusFilter: typeof filter) => {
    const taskDay = getTaskDay(task);

    if (statusFilter === "all") return true;
    if (statusFilter === "completed") return task.status === "completed";

    // Pendentes/Atrasadas: apenas tarefas "abertas" (evita canceladas entrarem)
    const isOpen = task.status === "pending" || task.status === "in_progress";
    if (!isOpen) return false;

    if (statusFilter === "pending") {
      // inclui sem data e datas hoje/futuro
      return !taskDay || taskDay >= todayStart;
    }

    // overdue
    return !!taskDay && taskDay < todayStart;
  };

  const startBoundary = startDate ? startOfDay(parseDateOnly(startDate)) : null;
  const endBoundary = endDate ? endOfDay(parseDateOnly(endDate)) : null;

  const matchesNonStatusFilters = (task: any) => {
    const taskDate = getTaskDate(task);

    const matchesClient = selectedClient === "all" || task.client_id === selectedClient;
    const matchesUser = selectedUser === "all" || task.assigned_to === selectedUser;

    const matchesCampaign =
      selectedCampaign === "all" ||
      (!!task.client_id && (campaignClientsMap[selectedCampaign]?.has(task.client_id) ?? false));

    const matchesStartDate = !startBoundary || !taskDate || taskDate >= startBoundary;
    const matchesEndDate = !endBoundary || !taskDate || taskDate <= endBoundary;

    const matchesQuickTaskType = quickTaskTypeFilter === "all" || task.task_type === quickTaskTypeFilter;
    const matchesQuickPriority = quickPriorityFilter === "all" || task.priority === quickPriorityFilter;

    return (
      matchesClient &&
      matchesUser &&
      matchesCampaign &&
      matchesStartDate &&
      matchesEndDate &&
      matchesQuickTaskType &&
      matchesQuickPriority
    );
  };

  const tasksFilteredWithoutStatus = tasks.filter(matchesNonStatusFilters);
  const tasksAfterAiFilter = aiMatchedIds !== null 
    ? tasksFilteredWithoutStatus.filter((t) => aiMatchedIds.includes(t.id))
    : tasksFilteredWithoutStatus;
  const filteredTasks = tasksAfterAiFilter.filter((t) => matchesStatusFilter(t, filter));

  const taskCounts = {
    all: tasksAfterAiFilter.length,
    pending: tasksAfterAiFilter.filter((t) => matchesStatusFilter(t, "pending")).length,
    overdue: tasksAfterAiFilter.filter((t) => matchesStatusFilter(t, "overdue")).length,
    completed: tasksAfterAiFilter.filter((t) => matchesStatusFilter(t, "completed")).length,
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, selectedClient, selectedUser, selectedCampaign, startDate, endDate, quickTaskTypeFilter, quickPriorityFilter, aiMatchedIds]);

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { locale: ptBR });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const getTasksForDay = (day: Date) => {
    const normalizedSearch = calendarCompanySearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return tasks
      .filter(matchesNonStatusFilters)
      .filter((task) => {
        if (!task.due_date) return false;
        const taskDay = startOfDay(new Date(task.due_date));
        if (!isSameDay(taskDay, day)) return false;
        if (!matchesStatusFilter(task, filter)) return false;
        if (normalizedSearch) {
          const companyName = (task.clients?.company_name || task.clients?.trade_name || "")
            .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (!companyName.includes(normalizedSearch)) return false;
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="text-2xl">Nova Tarefa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="flex justify-end">
                <TaskTemplateSelector 
                  onSelect={(template) => {
                    setTaskType(template.task_type);
                    setPriority(template.priority);
                    setDescription(template.description);
                  }} 
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="visita_presencial">Visita Presencial</SelectItem>
                      <SelectItem value="reuniao_online">Reunião Online</SelectItem>
                      <SelectItem value="visita_feira">Visita a Feira</SelectItem>
                      <SelectItem value="visita_evento">Visita a Evento</SelectItem>
                      <SelectItem value="apresentacao">Apresentação</SelectItem>
                      <SelectItem value="proposta">Proposta</SelectItem>
                      <SelectItem value="pesquisa_inicial">Pesquisa Inicial</SelectItem>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Notas / Descrição</Label>
                <TaskQuickMessages 
                  taskType={taskType} 
                  onSelect={(msg) => setDescription(prev => prev ? `${prev}\n${msg}` : msg)} 
                />
                <div className="flex gap-2">
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Adicione notas ou grave um áudio..."
                    rows={4}
                    className="flex-1 resize-y min-h-[100px] overflow-x-hidden overflow-y-auto no-scrollbar [overflow-wrap:anywhere]"
                  />
                  <AudioRecorder
                    onTranscription={(text) => setDescription(prev => prev ? `${prev}\n${text}` : text)}
                  />
                </div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Cliente (Opcional)</Label>
                  <SearchableCombobox
                    items={clients.map((c) => ({
                      value: c.id,
                      label: c.company_name || c.trade_name,
                      subLabel: c.cnpj ? c.cnpj : undefined,
                      searchText: `${c.company_name ?? ""} ${c.trade_name ?? ""} ${c.cnpj ?? ""}`.trim(),
                    }))}
                    value={clientId}
                    onValueChange={(value) => {
                      setClientId(value);
                      setContactId("");
                      fetchContactsByClient(value);
                    }}
                    placeholder="Selecione um cliente"
                    searchPlaceholder="Buscar cliente por nome ou CNPJ..."
                    emptyText="Nenhum cliente encontrado."
                  />
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
                <SearchableCombobox
                  items={opportunities.map((o) => ({
                    value: o.id,
                    label: o.title,
                    searchText: o.title,
                  }))}
                  value={opportunityId}
                  onValueChange={setOpportunityId}
                  placeholder="Selecione uma oportunidade"
                  searchPlaceholder="Buscar oportunidade..."
                  emptyText="Nenhuma oportunidade encontrada."
                />
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

              {/* Attachments Section */}
              <div className="border-t pt-4">
                <TaskAttachments
                  taskId={null}
                  pendingFiles={pendingAttachments}
                  onPendingFilesChange={setPendingAttachments}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Criar Tarefa"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "calendar" | "agenda")}>
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <ListTodo size={16} />
            Lista
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar size={16} />
            Calendário
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-2">
            <CalendarIcon size={16} />
            Agenda Zoho
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap items-center">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
                size="sm"
                className="gap-2"
              >
                Todas
                <Badge variant="secondary" className="ml-1">
                  {taskCounts.all}
                </Badge>
              </Button>
              <Button
                variant={filter === "pending" ? "default" : "outline"}
                onClick={() => setFilter("pending")}
                size="sm"
                className="gap-2"
              >
                Pendentes
                <Badge variant="secondary" className="ml-1">
                  {taskCounts.pending}
                </Badge>
              </Button>
              <Button
                variant={filter === "overdue" ? "default" : "outline"}
                onClick={() => setFilter("overdue")}
                size="sm"
                className="gap-2"
              >
                Atrasadas
                <Badge variant="secondary" className="ml-1">
                  {taskCounts.overdue}
                </Badge>
              </Button>
              <Button
                variant={filter === "completed" ? "default" : "outline"}
                onClick={() => setFilter("completed")}
                size="sm"
                className="gap-2"
              >
                Concluídas
                <Badge variant="secondary" className="ml-1">
                  {taskCounts.completed}
                </Badge>
              </Button>
              
              {cardViewMode === 'compact' && (
                <div className="flex items-center gap-2 ml-auto animate-fade-in">
                  <select 
                    value={quickTaskTypeFilter} 
                    onChange={(e) => setQuickTaskTypeFilter(e.target.value)}
                    className="h-9 px-3 text-sm border rounded-md bg-background"
                  >
                    <option value="all">Todos Tipos</option>
                    <option value="ligacao">Ligação</option>
                    <option value="email">E-mail</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="visita_presencial">Visita Presencial</option>
                    <option value="reuniao_online">Reunião Online</option>
                    <option value="visita_feira">Visita a Feira</option>
                    <option value="visita_evento">Visita a Evento</option>
                    <option value="apresentacao">Apresentação</option>
                    <option value="proposta">Proposta</option>
                    <option value="pesquisa_inicial">Pesquisa Inicial</option>
                  </select>
                  <select 
                    value={quickPriorityFilter} 
                    onChange={(e) => setQuickPriorityFilter(e.target.value)}
                    className="h-9 px-3 text-sm border rounded-md bg-background"
                  >
                    <option value="all">Todas Prioridades</option>
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
              )}
              
              <div className="flex items-center gap-1 bg-muted p-1 rounded-md ml-auto">
                <Button
                  size="sm"
                  variant={cardViewMode === "cards" ? "secondary" : "ghost"}
                  onClick={() => setCardViewMode("cards")}
                  className="h-8 px-3"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">Cards</span>
                </Button>
                <Button
                  size="sm"
                  variant={cardViewMode === "compact" ? "secondary" : "ghost"}
                  onClick={() => setCardViewMode("compact")}
                  className="h-8 px-3"
                >
                  <ListIcon className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">Lista</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name || client.trade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as campanhas</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(userRole === "admin" || userRole === "gestor") && (
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os vendedores</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={quickTaskTypeFilter} onValueChange={setQuickTaskTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="visita_presencial">Visita Presencial</SelectItem>
                  <SelectItem value="reuniao_online">Reunião Online</SelectItem>
                  <SelectItem value="visita_feira">Visita a Feira</SelectItem>
                  <SelectItem value="visita_evento">Visita a Evento</SelectItem>
                  <SelectItem value="apresentacao">Apresentação</SelectItem>
                  <SelectItem value="proposta">Proposta</SelectItem>
                  <SelectItem value="pesquisa_inicial">Pesquisa Inicial</SelectItem>
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

            {/* AI Search */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                  <Input
                    placeholder="Busca inteligente com IA... (ex: 'tarefas sobre proposta de preço', 'reuniões com cliente X')"
                    value={aiSearchQuery}
                    onChange={(e) => setAiSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAiSearch()}
                    className="pl-10 pr-10"
                  />
                  {aiSearchQuery && (
                    <button
                      onClick={clearAiSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button 
                  onClick={handleAiSearch} 
                  disabled={aiSearching || !aiSearchQuery.trim()}
                  className="gap-2"
                  variant="secondary"
                >
                  {aiSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar com IA
                </Button>
              </div>
              {aiMatchedIds !== null && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    {aiMatchedIds.length} resultado(s)
                  </Badge>
                  {aiExplanation && (
                    <span className="text-muted-foreground">{aiExplanation}</span>
                  )}
                  <Button variant="ghost" size="sm" onClick={clearAiSearch} className="h-6 px-2 text-xs">
                    Limpar busca IA
                  </Button>
                </div>
              )}
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
            <>
              <div 
                key={cardViewMode}
                className="space-y-3 animate-fade-in"
              >
                {paginatedTasks.map((task) => (
                  <TaskHoverPreview key={task.id} task={task}>
                    <SwipeableCard
                      onEdit={() => {
                        setSelectedTask(task);
                        setEditDialogOpen(true);
                      }}
                    >
                    <Card 
                      className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${getTaskStatusColor(task)}`}
                      onClick={() => {
                        setSelectedTask(task);
                        setEditDialogOpen(true);
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
                                {task.clients && (
                                  <div 
                                    className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/clientes/${task.client_id}`);
                                    }}
                                  >
                                    <Building2 size={14} />
                                    <span className="hover:underline">{task.clients.company_name || task.clients.trade_name}</span>
                                  </div>
                                )}
                                {task.contacts && (
                                  <div className="flex items-center gap-1">
                                    <Users size={14} />
                                    <span>{task.contacts.name}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <Badge variant="outline">{getTaskTypeLabel(task.task_type)}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                    </SwipeableCard>
                  </TaskHoverPreview>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {startIndex + 1} - {Math.min(endIndex, filteredTasks.length)} de {filteredTasks.length} tarefas
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="h-8 w-8"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex items-center gap-1 px-2">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="icon"
                            onClick={() => setCurrentPage(pageNum)}
                            className="h-8 w-8"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <div className="flex gap-2 flex-wrap mb-4">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
              className="gap-2"
            >
              Todas
              <Badge variant="secondary" className="ml-1">
                {taskCounts.all}
              </Badge>
            </Button>
            <Button
              variant={filter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("pending")}
              className="gap-2"
            >
              <Clock className="h-4 w-4" />
              Pendentes
              <Badge variant="secondary" className="ml-1">
                {taskCounts.pending}
              </Badge>
            </Button>
            <Button
              variant={filter === "overdue" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("overdue")}
              className="gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              Atrasadas
              <Badge variant="secondary" className="ml-1">
                {taskCounts.overdue}
              </Badge>
            </Button>
            <Button
              variant={filter === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("completed")}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Concluídas
              <Badge variant="secondary" className="ml-1">
                {taskCounts.completed}
              </Badge>
            </Button>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por empresa..."
              value={calendarCompanySearch}
              onChange={(e) => setCalendarCompanySearch(e.target.value)}
              className="pl-9"
            />
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
                          
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
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
                                  {task.clients && (
                                    <div className="flex items-center gap-1 text-muted-foreground mt-1">
                                      <Building2 size={12} />
                                      <span className="truncate">{task.clients.company_name || task.clients.trade_name}</span>
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

        <TabsContent value="agenda" className="space-y-4">
          {currentUserId && userRole && (
            <SalesAgenda
              userId={currentUserId}
              role={userRole}
              sellers={users.map(u => ({ id: u.id, full_name: u.full_name || u.email || "—" }))}
            />
          )}
        </TabsContent>
      </Tabs>

      {selectedTask && (
        <>
          <TaskViewDialog
            task={selectedTask}
            open={viewDialogOpen}
            onOpenChange={(open) => {
              setViewDialogOpen(open);
              if (!open) {
                fetchData();
              }
            }}
            onDelete={canDeleteTask(selectedTask) ? handleDeleteTask : undefined}
            onEdit={() => {
              if (!canEdit(selectedTask)) {
                toast.info("Somente leitura: você não é o responsável por esta tarefa.");
                return;
              }
              setViewDialogOpen(false);
              setEditDialogOpen(true);
            }}
          />
          
          <TaskEditDialog
            task={selectedTask}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            onSuccess={fetchData}
          />
        </>
      )}
    </div>
  );
};

export default Tarefas;
