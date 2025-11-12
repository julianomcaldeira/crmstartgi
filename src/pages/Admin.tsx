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
} from "lucide-react";
import { toast } from "sonner";

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

      {/* Main Content */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">Gerenciar Usuários</TabsTrigger>
          <TabsTrigger value="metrics">Métricas da Equipe</TabsTrigger>
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
      </Tabs>
    </div>
  );
};

export default Admin;
