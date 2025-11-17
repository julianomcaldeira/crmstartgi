import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  TrendingUp,
  Target,
  DollarSign,
  ShieldCheck,
  UserPlus,
  Mail,
  Phone,
  Crown,
  Award,
  BarChart3,
  Package,
  Plus,
  Edit,
  Trash2,
  Upload,
  Image as ImageIcon,
  Download,
  X,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertsTester } from "@/components/AlertsTester";

const Admin = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("vendedor");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  
  // Products state
  const [products, setProducts] = useState<any[]>([]);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
  });
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // Loss reasons state
  const [lossReasons, setLossReasons] = useState<any[]>([]);
  const [lossReasonDialogOpen, setLossReasonDialogOpen] = useState(false);
  const [editingLossReason, setEditingLossReason] = useState<any>(null);
  const [lossReasonForm, setLossReasonForm] = useState({
    reason: "",
  });
  const [savingLossReason, setSavingLossReason] = useState(false);
  
  // Export state
  const [exportingData, setExportingData] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleData?.role === "admin") {
        setIsAdmin(true);
        await fetchUsers();
        await fetchStats();
        await fetchProducts();
        await fetchLossReasons();
      } else {
        toast.error("Acesso negado. Apenas administradores podem acessar esta página.");
        setIsAdmin(false);
      }
    } catch (error) {
      console.error("Erro ao verificar acesso:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        *,
        user_roles (role)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar usuários");
      return;
    }

    setUsers(data || []);
  };

  const fetchStats = async () => {
    try {
      // Total clients
      const { count: clientsCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true });

      // Total opportunities
      const { count: opportunitiesCount } = await supabase
        .from("opportunities")
        .select("*", { count: "exact", head: true });

      // Total tasks
      const { count: tasksCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true });

      // Total opportunity value
      const { data: oppData } = await supabase
        .from("opportunities")
        .select("value");

      const totalValue = oppData?.reduce((sum, opp) => sum + (Number(opp.value) || 0), 0) || 0;

      // Closed opportunities
      const { count: closedCount } = await supabase
        .from("opportunities")
        .select("*", { count: "exact", head: true })
        .eq("status", "won" as any);

      setStats({
        clients: clientsCount || 0,
        opportunities: opportunitiesCount || 0,
        tasks: tasksCount || 0,
        totalValue,
        closedOpportunities: closedCount || 0,
      });
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole as any })
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("Role atualizado com sucesso!");
      fetchUsers();
    } catch (error: any) {
      toast.error("Erro ao atualizar role: " + error.message);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar produtos");
      return;
    }

    setProducts(data || []);
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserName) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setCreatingUser(true);
    try {
      // Create user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: {
            full_name: newUserName,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Update role if not vendedor (default)
        if (newUserRole !== "vendedor") {
          const { error: roleError } = await supabase
            .from("user_roles")
            .update({ role: newUserRole as any })
            .eq("user_id", authData.user.id);

          if (roleError) throw roleError;
        }

        toast.success("Usuário criado com sucesso!");
        setDialogOpen(false);
        setNewUserEmail("");
        setNewUserName("");
        setNewUserPassword("");
        setNewUserRole("vendedor");
        fetchUsers();
      }
    } catch (error: any) {
      toast.error("Erro ao criar usuário: " + error.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleProductSubmit = async () => {
    if (!productForm.name) {
      toast.error("Preencha o nome do produto");
      return;
    }

    setSavingProduct(true);
    try {
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update({
            name: productForm.name,
            description: productForm.description,
          })
          .eq("id", editingProduct.id);

        if (error) throw error;
        toast.success("Produto atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("products")
          .insert({
            name: productForm.name,
            description: productForm.description,
            implementation_fee: 0,
            monthly_fee: 0,
          });

        if (error) throw error;
        toast.success("Produto criado com sucesso!");
      }

      setProductDialogOpen(false);
      setEditingProduct(null);
      setProductForm({ name: "", description: "" });
      fetchProducts();
    } catch (error: any) {
      toast.error("Erro ao salvar produto: " + error.message);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleLogoUpload = async (productId: string, file: File) => {
    setUploadingLogo(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${productId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("product-logos")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("products")
        .update({ logo_url: publicUrl })
        .eq("id", productId);

      if (updateError) throw updateError;

      toast.success("Logo atualizada com sucesso!");
      fetchProducts();
    } catch (error: any) {
      toast.error("Erro ao fazer upload da logo: " + error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Produto excluído com sucesso!");
      fetchProducts();
    } catch (error: any) {
      toast.error("Erro ao excluir produto: " + error.message);
    }
  };

  const openProductDialog = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        description: product.description || "",
      });
    } else {
      setEditingProduct(null);
      setProductForm({ name: "", description: "" });
    }
    setProductDialogOpen(true);
  };

  // Loss Reasons functions
  const fetchLossReasons = async () => {
    const { data, error } = await supabase
      .from("loss_reasons")
      .select("*")
      .order("reason", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar motivos de perda");
      return;
    }

    setLossReasons(data || []);
  };

  const handleLossReasonSubmit = async () => {
    if (!lossReasonForm.reason.trim()) {
      toast.error("Preencha o motivo de perda");
      return;
    }

    setSavingLossReason(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (editingLossReason) {
        const { error } = await supabase
          .from("loss_reasons")
          .update({
            reason: lossReasonForm.reason.trim(),
          })
          .eq("id", editingLossReason.id);

        if (error) throw error;
        toast.success("Motivo atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("loss_reasons")
          .insert({
            reason: lossReasonForm.reason.trim(),
            created_by: user.id,
          });

        if (error) throw error;
        toast.success("Motivo criado com sucesso!");
      }

      setLossReasonDialogOpen(false);
      setEditingLossReason(null);
      setLossReasonForm({ reason: "" });
      fetchLossReasons();
    } catch (error: any) {
      toast.error("Erro ao salvar motivo: " + error.message);
    } finally {
      setSavingLossReason(false);
    }
  };

  const handleDeleteLossReason = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este motivo de perda?")) return;

    try {
      const { error } = await supabase
        .from("loss_reasons")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Motivo excluído com sucesso!");
      fetchLossReasons();
    } catch (error: any) {
      toast.error("Erro ao excluir motivo: " + error.message);
    }
  };

  const openLossReasonDialog = (reason?: any) => {
    if (reason) {
      setEditingLossReason(reason);
      setLossReasonForm({
        reason: reason.reason,
      });
    } else {
      setEditingLossReason(null);
      setLossReasonForm({ reason: "" });
    }
    setLossReasonDialogOpen(true);
  };

  const handleExportDatabase = async () => {
    setExportingData(true);
    try {
      // Fetch all data
      const [clientsData, opportunitiesData, tasksData, contactsData, productsData, feirasData, clientFeirasData, profilesData] = await Promise.all([
        supabase.from("clients").select("*"),
        supabase.from("opportunities").select("*"),
        supabase.from("tasks").select("*"),
        supabase.from("contacts").select("*"),
        supabase.from("products").select("*"),
        supabase.from("feiras").select("*"),
        supabase.from("client_feiras").select("*"),
        supabase.from("profiles").select(`*, user_roles(role)`),
      ]);

      // Create CSV content
      let csvContent = "data:text/csv;charset=utf-8,";
      
      // Clients Section
      csvContent += "=== CLIENTES ===\n";
      csvContent += "ID,CNPJ,Razão Social,Nome Fantasia,Email,Telefone,Segmento,Endereço,Cidade,Estado,CEP,Status,Porte,Região,Concorrentes,Data Criação,Criado Por\n";
      clientsData.data?.forEach(client => {
        csvContent += `${client.id},${client.cnpj || ""},${client.company_name || ""},${client.trade_name || ""},${client.email || ""},${client.phone || ""},${client.segment || ""},${client.address || ""},${client.city || ""},${client.state || ""},${client.zip_code || ""},${client.registration_status || ""},${client.company_size || ""},${client.region || ""},${client.competitors || ""},${client.created_at || ""},${client.created_by || ""}\n`;
      });
      
      csvContent += "\n=== OPORTUNIDADES ===\n";
      csvContent += "ID,Título,Cliente ID,Produto ID,Valor,Valor Implementação,Valor Mensal,Status,Probabilidade,Tipo de Negócio,Descrição,Data Prevista,Responsável,Data Criação,Criado Por\n";
      opportunitiesData.data?.forEach(opp => {
        csvContent += `${opp.id},${opp.title || ""},${opp.client_id || ""},${opp.product_id || ""},${opp.value || 0},${opp.implementation_value || 0},${opp.monthly_value || 0},${opp.status || ""},${opp.probability || 0},${opp.business_type || ""},${(opp.description || "").replace(/,/g, ";")},${opp.expected_close_date || ""},${opp.assigned_to || ""},${opp.created_at || ""},${opp.created_by || ""}\n`;
      });
      
      csvContent += "\n=== TAREFAS ===\n";
      csvContent += "ID,Título,Descrição,Tipo,Status,Prioridade,Data Vencimento,Cliente ID,Oportunidade ID,Responsável,Data Conclusão,Data Criação,Criado Por\n";
      tasksData.data?.forEach(task => {
        csvContent += `${task.id},${(task.title || "").replace(/,/g, ";")},${(task.description || "").replace(/,/g, ";")},${task.task_type || ""},${task.status || ""},${task.priority || ""},${task.due_date || ""},${task.client_id || ""},${task.opportunity_id || ""},${task.assigned_to || ""},${task.completed_at || ""},${task.created_at || ""},${task.created_by || ""}\n`;
      });
      
      csvContent += "\n=== CONTATOS ===\n";
      csvContent += "ID,Nome,Email,Telefone,Celular,Cargo,Cliente ID,Principal,Data Criação,Criado Por\n";
      contactsData.data?.forEach(contact => {
        csvContent += `${contact.id},${contact.name || ""},${contact.email || ""},${contact.phone || ""},${contact.mobile || ""},${contact.role || ""},${contact.client_id || ""},${contact.is_primary ? "Sim" : "Não"},${contact.created_at || ""},${contact.created_by || ""}\n`;
      });
      
      csvContent += "\n=== PRODUTOS ===\n";
      csvContent += "ID,Nome,Descrição,Taxa Implementação,Taxa Mensal,Ativo,Logo URL,Data Criação\n";
      productsData.data?.forEach(product => {
        csvContent += `${product.id},${product.name || ""},${(product.description || "").replace(/,/g, ";")},${product.implementation_fee || 0},${product.monthly_fee || 0},${product.active ? "Sim" : "Não"},${product.logo_url || ""},${product.created_at || ""}\n`;
      });
      
      csvContent += "\n=== FEIRAS ===\n";
      csvContent += "ID,Nome,Descrição,Local,Cidade,Estado,Data Início,Data Fim,Status,Website,Data Criação,Criado Por\n";
      feirasData.data?.forEach(feira => {
        csvContent += `${feira.id},${feira.name || ""},${(feira.description || "").replace(/,/g, ";")},${feira.location || ""},${feira.city || ""},${feira.state || ""},${feira.start_date || ""},${feira.end_date || ""},${feira.status || ""},${feira.website || ""},${feira.created_at || ""},${feira.created_by || ""}\n`;
      });
      
      csvContent += "\n=== CLIENTES-FEIRAS (RELACIONAMENTOS) ===\n";
      csvContent += "ID,Cliente ID,Feira ID,Notas,Data Criação,Criado Por\n";
      clientFeirasData.data?.forEach(cf => {
        csvContent += `${cf.id},${cf.client_id || ""},${cf.feira_id || ""},${(cf.notes || "").replace(/,/g, ";")},${cf.created_at || ""},${cf.created_by || ""}\n`;
      });
      
      csvContent += "\n=== USUÁRIOS ===\n";
      csvContent += "ID,Nome Completo,Email,Telefone,Avatar URL,Perfil,Data Criação\n";
      profilesData.data?.forEach(profile => {
        const role = profile.user_roles?.[0]?.role || "vendedor";
        csvContent += `${profile.id},${profile.full_name || ""},${profile.email || ""},${profile.phone || ""},${profile.avatar_url || ""},${role},${profile.created_at || ""}\n`;
      });

      // Create download
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `startgi_database_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Base de dados exportada com sucesso!");
    } catch (error: any) {
      console.error("Erro ao exportar base de dados:", error);
      toast.error("Erro ao exportar base de dados: " + error.message);
    } finally {
      setExportingData(false);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") {
      return (
        <Badge className="bg-primary/10 text-primary border-primary/20">
          <Crown className="h-3 w-3 mr-1" />
          Admin
        </Badge>
      );
    }
    if (role === "gestor") {
      return (
        <Badge className="bg-info/10 text-info border-info/20">
          <ShieldCheck className="h-3 w-3 mr-1" />
          Gestor
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Award className="h-3 w-3 mr-1" />
        Vendedor
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <ShieldCheck className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-muted-foreground">Gerencie sua equipe e visualize métricas</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-6 bg-gradient-to-br from-card to-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Clientes</p>
              <p className="text-2xl font-bold text-foreground">{stats.clients}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-card to-info/5 border-info/20">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-info/10">
              <Target className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Oportunidades</p>
              <p className="text-2xl font-bold text-foreground">{stats.opportunities}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-card to-success/5 border-success/20">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-success/10">
              <DollarSign className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="text-xl font-bold text-foreground">
                R$ {stats.totalValue?.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-card to-warning/5 border-warning/20">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-warning/10">
              <TrendingUp className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fechados</p>
              <p className="text-2xl font-bold text-foreground">{stats.closedOpportunities}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-card to-muted/20 border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-muted">
              <BarChart3 className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tarefas</p>
              <p className="text-2xl font-bold text-foreground">{stats.tasks}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alerts System Tester */}
      <AlertsTester />

      {/* Main Content */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="users">Gerenciar Usuários</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="loss-reasons">Motivos de Perda</TabsTrigger>
          <TabsTrigger value="feiras">Feiras</TabsTrigger>
          <TabsTrigger value="metrics">Métricas da Equipe</TabsTrigger>
          <TabsTrigger value="export">Exportar Base</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">Usuários do Sistema</h2>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary-dark text-primary-foreground">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Criar Novo Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Criar Novo Usuário</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="userName">Nome Completo *</Label>
                      <Input
                        id="userName"
                        placeholder="João Silva"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="userEmail">Email *</Label>
                      <Input
                        id="userEmail"
                        type="email"
                        placeholder="joao@exemplo.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="userPassword">Senha *</Label>
                      <Input
                        id="userPassword"
                        type="password"
                        placeholder="••••••••"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="userRole">Perfil de Acesso *</Label>
                      <Select value={newUserRole} onValueChange={setNewUserRole}>
                        <SelectTrigger id="userRole">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vendedor">Vendedor</SelectItem>
                          <SelectItem value="gestor">Gestor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Vendedor: visualiza tudo, edita apenas suas contas<br />
                        Gestor: visualiza e edita qualquer informação<br />
                        Admin: acesso total ao sistema
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      disabled={creatingUser}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreateUser}
                      disabled={creatingUser}
                      className="bg-primary hover:bg-primary-dark text-primary-foreground"
                    >
                      {creatingUser ? "Criando..." : "Criar Usuário"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="p-4 bg-muted/20 rounded-lg border border-border hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">{user.full_name}</h3>
                          {user.user_roles?.[0]?.role && getRoleBadge(user.user_roles[0].role)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="h-4 w-4" />
                            {user.email}
                          </span>
                          {user.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              {user.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={user.user_roles?.[0]?.role || "vendedor"}
                        onValueChange={(value) => handleRoleChange(user.id, value)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vendedor">Vendedor</SelectItem>
                          <SelectItem value="gestor">Gestor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">Produtos StartGi</h2>
              <Button
                onClick={() => openProductDialog()}
                className="bg-primary hover:bg-primary-dark text-primary-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            </div>

            <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? "Editar Produto" : "Novo Produto"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="productName">Nome do Produto *</Label>
                    <Input
                      id="productName"
                      placeholder="Ex: Sistema de Gestão"
                      value={productForm.name}
                      onChange={(e) =>
                        setProductForm({ ...productForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productDescription">Descrição</Label>
                    <Textarea
                      id="productDescription"
                      placeholder="Descreva as características do produto..."
                      value={productForm.description}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          description: e.target.value,
                        })
                      }
                      rows={4}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setProductDialogOpen(false)}
                    disabled={savingProduct}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleProductSubmit}
                    disabled={savingProduct}
                    className="bg-primary hover:bg-primary-dark text-primary-foreground"
                  >
                    {savingProduct ? "Salvando..." : editingProduct ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="space-y-3">
              {products.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Nenhum produto cadastrado</p>
                  <p className="text-sm mt-2">Clique em "Novo Produto" para começar</p>
                </div>
              ) : (
                products.map((product) => (
                  <div
                    key={product.id}
                    className="p-4 bg-gradient-to-r from-card to-primary/5 rounded-lg border border-border hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        {product.logo_url ? (
                          <img
                            src={product.logo_url}
                            alt={product.name}
                            className="h-16 w-16 object-contain rounded-lg bg-white p-2"
                          />
                        ) : (
                          <div className="p-3 rounded-lg bg-primary/10 h-16 w-16 flex items-center justify-center">
                            <Package className="h-8 w-8 text-primary" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground text-lg mb-2">
                            {product.name}
                          </h3>
                          {product.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                              {product.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor={`logo-upload-${product.id}`}
                              className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors border border-primary/20"
                            >
                              {uploadingLogo ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                                  Enviando...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-3 w-3" />
                                  {product.logo_url ? "Alterar Logo" : "Adicionar Logo"}
                                </>
                              )}
                            </label>
                            <input
                              id={`logo-upload-${product.id}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleLogoUpload(product.id, file);
                              }}
                              disabled={uploadingLogo}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openProductDialog(product)}
                          className="hover:bg-primary/10 hover:text-primary"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteProduct(product.id)}
                          className="hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="loss-reasons" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">Motivos de Perda</h2>
              <Button
                onClick={() => openLossReasonDialog()}
                className="bg-primary hover:bg-primary-dark text-primary-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Motivo
              </Button>
            </div>

            <Dialog open={lossReasonDialogOpen} onOpenChange={setLossReasonDialogOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingLossReason ? "Editar Motivo de Perda" : "Novo Motivo de Perda"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="lossReasonName">Motivo *</Label>
                    <Input
                      id="lossReasonName"
                      placeholder="Ex: Preço muito alto"
                      value={lossReasonForm.reason}
                      onChange={(e) =>
                        setLossReasonForm({ reason: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setLossReasonDialogOpen(false)}
                    disabled={savingLossReason}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleLossReasonSubmit}
                    disabled={savingLossReason}
                    className="bg-primary hover:bg-primary-dark text-primary-foreground"
                  >
                    {savingLossReason
                      ? "Salvando..."
                      : editingLossReason
                      ? "Atualizar"
                      : "Criar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="space-y-3">
              {lossReasons.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Nenhum motivo de perda cadastrado</p>
                  <p className="text-sm mt-2">Clique em "Novo Motivo" para começar</p>
                </div>
              ) : (
                lossReasons.map((reason) => (
                  <div
                    key={reason.id}
                    className="p-4 bg-muted/20 rounded-lg border border-border hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="p-3 rounded-lg bg-destructive/10 h-12 w-12 flex items-center justify-center">
                          <X className="h-6 w-6 text-destructive" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground text-lg">
                            {reason.reason}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            Criado em {new Date(reason.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openLossReasonDialog(reason)}
                          title="Editar motivo"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteLossReason(reason.id)}
                          className="text-destructive hover:text-destructive"
                          title="Excluir motivo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="feiras" className="space-y-4">
          <Card className="p-6">
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">O módulo de Feiras foi movido para uma página dedicada.</p>
              <Button onClick={() => window.location.href = "/feiras"}>
                Ir para Gestão de Feiras
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6 text-foreground">Performance da Equipe</h2>
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Métricas detalhadas em desenvolvimento</p>
              <p className="text-sm mt-2">Em breve: gráficos de performance, ranking de vendedores e muito mais</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6 text-foreground">Exportar Base de Dados Completa</h2>
            <div className="text-center py-12">
              <div className="p-6 rounded-full bg-primary/10 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <Download className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-3">
                Exportação Completa do Sistema
              </h3>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
                Esta funcionalidade permite exportar toda a base de dados do CRM em um único arquivo CSV. 
                Ideal para backup, migração de plataforma ou análise externa dos dados.
              </p>
              <div className="bg-muted/30 rounded-lg p-4 max-w-2xl mx-auto mb-6 text-left">
                <p className="text-sm font-semibold text-foreground mb-2">O relatório inclui:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Todos os clientes cadastrados com informações completas</li>
                  <li>Todas as oportunidades de vendas e seus detalhes</li>
                  <li>Histórico completo de tarefas e atividades</li>
                  <li>Contatos vinculados aos clientes</li>
                  <li>Catálogo de produtos StartGi</li>
                  <li>Feiras cadastradas e relacionamentos com clientes</li>
                  <li>Usuários do sistema e seus perfis de acesso</li>
                </ul>
              </div>
              <Button
                onClick={handleExportDatabase}
                disabled={exportingData}
                size="lg"
                className="bg-primary hover:bg-primary-dark text-primary-foreground"
              >
                {exportingData ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Base de Dados (CSV)
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                O arquivo será salvo como: startgi_database_export_AAAA-MM-DD.csv
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
