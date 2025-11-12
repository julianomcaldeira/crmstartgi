import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Plus
} from "lucide-react";
import { toast } from "sonner";
import TaskViewDialog from "@/components/TaskViewDialog";
import OpportunityViewDialog from "@/components/OpportunityViewDialog";

const ClienteDetalhes = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [oppDialogOpen, setOppDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  const [taskViewDialogOpen, setTaskViewDialogOpen] = useState(false);
  const [oppViewDialogOpen, setOppViewDialogOpen] = useState(false);
  const [taskFormData, setTaskFormData] = useState({
    title: "",
    description: "",
    task_type: "ligacao",
    due_date: "",
    priority: "medium",
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
  }, [id]);

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
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*, profiles(full_name)")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
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

      if (!taskFormData.title || !taskFormData.due_date) {
        toast.error("Preencha os campos obrigatórios");
        return;
      }

      const { error } = await supabase.from("tasks").insert([
        {
          title: taskFormData.title,
          description: taskFormData.description,
          client_id: id,
          task_type: taskFormData.task_type as "ligacao" | "email" | "whatsapp" | "visita_presencial" | "reuniao_online" | "visita_feira" | "visita_evento",
          due_date: taskFormData.due_date,
          priority: taskFormData.priority as "low" | "medium" | "high",
          status: "pending",
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
      title: "",
      description: "",
      task_type: "ligacao",
      due_date: "",
      priority: "medium",
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/clientes")}>
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">{client.company_name}</h1>
          <p className="text-muted-foreground">{client.trade_name}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 bg-gradient-to-br from-card to-muted/20 border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Oportunidades</p>
              <p className="text-2xl font-bold text-foreground">{opportunities.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-card to-muted/20 border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-success/10">
              <DollarSign className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="text-2xl font-bold text-foreground">
                R$ {totalOpportunityValue.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-card to-muted/20 border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-info/10">
              <CheckCircle2 className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fechados</p>
              <p className="text-2xl font-bold text-foreground">{closedOpportunities}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-card to-muted/20 border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-warning/10">
              <Clock className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tarefas Pendentes</p>
              <p className="text-2xl font-bold text-foreground">{pendingTasks}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Client Info Card */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Informações do Cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">CNPJ</p>
                <p className="font-medium text-foreground">{client.cnpj}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{client.email || "-"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium text-foreground">{client.phone || "-"}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Endereço</p>
                <p className="font-medium text-foreground">
                  {client.address || "-"}
                  {client.city && `, ${client.city}`}
                  {client.state && ` - ${client.state}`}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Segmento</p>
                <p className="font-medium text-foreground">{client.segment || "-"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Capital Social</p>
                <p className="font-medium text-foreground">
                  {client.share_capital ? `R$ ${Number(client.share_capital).toLocaleString('pt-BR')}` : "-"}
                </p>
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

      {/* Tabs for Opportunities and Tasks */}
      <Tabs defaultValue="opportunities" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="opportunities">Oportunidades</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
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
                          <SelectValue placeholder="Selecione um produto (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Nenhum produto</SelectItem>
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
                          <SelectContent>
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
                          <SelectContent>
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="contacted">Contactado</SelectItem>
                            <SelectItem value="qualified">Qualificado</SelectItem>
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
                          <SelectContent>
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
                            <SelectValue placeholder="Atribuir a mim" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Atribuir a mim</SelectItem>
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
                      <Label htmlFor="title">Título *</Label>
                      <Input
                        id="title"
                        value={taskFormData.title}
                        onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                        placeholder="Ex: Reunião com cliente"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={taskFormData.description}
                        onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                        placeholder="Detalhes da tarefa..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task_type">Tipo de Tarefa</Label>
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
                          <SelectItem value="visita_presencial">Visita Presencial</SelectItem>
                          <SelectItem value="reuniao_online">Reunião Online</SelectItem>
                          <SelectItem value="visita_feira">Visita a Feira</SelectItem>
                          <SelectItem value="visita_evento">Visita a Evento</SelectItem>
                        </SelectContent>
                      </Select>
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
                          <SelectContent>
                            <SelectItem value="low">Baixa</SelectItem>
                            <SelectItem value="medium">Média</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
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
            {tasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhuma tarefa registrada</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div 
                    key={task.id} 
                    className="p-4 bg-muted/20 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedTask(task);
                      setTaskViewDialogOpen(true);
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{task.title}</h4>
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      </div>
                      {getStatusBadge(task.status)}
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
                        {task.profiles?.full_name || "Não atribuído"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
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
    </div>
  );
};

export default ClienteDetalhes;
