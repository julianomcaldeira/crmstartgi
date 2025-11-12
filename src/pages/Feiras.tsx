import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  MapPin,
  Plus,
  Edit,
  Trash2,
  Globe,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Feiras = () => {
  const [feiras, setFeiras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFeira, setEditingFeira] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGestor, setIsGestor] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    location: "",
    city: "",
    state: "",
    start_date: "",
    end_date: "",
    description: "",
    website: "",
    status: "planejada",
  });

  useEffect(() => {
    checkUserRole();
    fetchFeiras();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleData?.role === "admin") {
        setIsAdmin(true);
        setIsGestor(true);
      } else if (roleData?.role === "gestor") {
        setIsGestor(true);
      }
    } catch (error) {
      console.error("Error checking user role:", error);
    }
  };

  const fetchFeiras = async () => {
    try {
      const { data, error } = await supabase
        .from("feiras")
        .select("*")
        .order("start_date", { ascending: false });

      if (error) throw error;
      setFeiras(data || []);
    } catch (error) {
      console.error("Error fetching feiras:", error);
      toast.error("Erro ao carregar feiras");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (!formData.name) {
        toast.error("Nome da feira é obrigatório");
        return;
      }

      if (editingFeira) {
        const { error } = await supabase
          .from("feiras")
          .update({
            name: formData.name,
            location: formData.location,
            city: formData.city,
            state: formData.state,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            description: formData.description,
            website: formData.website,
            status: formData.status,
          })
          .eq("id", editingFeira.id);

        if (error) throw error;
        toast.success("Feira atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("feiras")
          .insert({
            name: formData.name,
            location: formData.location,
            city: formData.city,
            state: formData.state,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            description: formData.description,
            website: formData.website,
            status: formData.status,
            created_by: user.id,
          });

        if (error) throw error;
        toast.success("Feira cadastrada com sucesso!");
      }

      setDialogOpen(false);
      resetForm();
      fetchFeiras();
    } catch (error: any) {
      console.error("Error saving feira:", error);
      toast.error(error.message || "Erro ao salvar feira");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta feira?")) return;

    try {
      const { error } = await supabase
        .from("feiras")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Feira excluída com sucesso!");
      fetchFeiras();
    } catch (error: any) {
      console.error("Error deleting feira:", error);
      toast.error("Erro ao excluir feira");
    }
  };

  const openDialog = (feira?: any) => {
    if (feira) {
      setEditingFeira(feira);
      setFormData({
        name: feira.name,
        location: feira.location || "",
        city: feira.city || "",
        state: feira.state || "",
        start_date: feira.start_date || "",
        end_date: feira.end_date || "",
        description: feira.description || "",
        website: feira.website || "",
        status: feira.status,
      });
    } else {
      setEditingFeira(null);
      resetForm();
    }
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      location: "",
      city: "",
      state: "",
      start_date: "",
      end_date: "",
      description: "",
      website: "",
      status: "planejada",
    });
    setEditingFeira(null);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: any = {
      planejada: { label: "Planejada", variant: "secondary" },
      confirmada: { label: "Confirmada", variant: "default" },
      em_andamento: { label: "Em Andamento", variant: "default" },
      concluida: { label: "Concluída", variant: "default" },
      cancelada: { label: "Cancelada", variant: "destructive" },
    };

    const config = statusConfig[status] || { label: status, variant: "default" };
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  const filteredFeiras = feiras.filter((feira) => {
    const matchesSearch =
      feira.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (feira.city && feira.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (feira.location && feira.location.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === "all" || feira.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-2">
            Gestão de Feiras
          </h1>
          <p className="text-muted-foreground">
            Gerencie e acompanhe as feiras e eventos que sua equipe irá visitar
          </p>
        </div>

        {(isAdmin || isGestor) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-primary">
                <Plus size={20} />
                Nova Feira
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {editingFeira ? "Editar Feira" : "Cadastrar Nova Feira"}
                </DialogTitle>
                <DialogDescription>
                  {editingFeira
                    ? "Atualize as informações da feira"
                    : "Adicione uma nova feira ao sistema"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Feira *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Ex: Expo Tech 2025"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Local do Evento</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    placeholder="Ex: Centro de Convenções"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      placeholder="Ex: São Paulo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">Estado</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                      placeholder="Ex: SP"
                      maxLength={2}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Data de Início</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_date">Data de Término</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) =>
                        setFormData({ ...formData, end_date: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="text"
                    value={formData.website}
                    onChange={(e) =>
                      setFormData({ ...formData, website: e.target.value })
                    }
                    placeholder="Ex: www.exemplo.com ou https://exemplo.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planejada">Planejada</SelectItem>
                      <SelectItem value="confirmada">Confirmada</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="concluida">Concluída</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Detalhes sobre a feira..."
                    rows={4}
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
                  <Button type="submit">
                    {editingFeira ? "Atualizar" : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cidade ou local..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="planejada">Planejada</SelectItem>
              <SelectItem value="confirmada">Confirmada</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Feiras List */}
      {filteredFeiras.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">
            {searchTerm || filterStatus !== "all"
              ? "Nenhuma feira encontrada com os filtros aplicados"
              : "Nenhuma feira cadastrada ainda"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFeiras.map((feira) => (
            <Card key={feira.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {feira.name}
                    </h3>
                    {getStatusBadge(feira.status)}
                  </div>
                  {(isAdmin || isGestor) && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openDialog(feira)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(feira.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>

                {feira.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {feira.description}
                  </p>
                )}

                <div className="space-y-2">
                  {(feira.start_date || feira.end_date) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarIcon className="h-4 w-4" />
                      <span>
                        {feira.start_date
                          ? format(new Date(feira.start_date), "dd/MM/yyyy", {
                              locale: ptBR,
                            })
                          : ""}
                        {feira.start_date && feira.end_date && " - "}
                        {feira.end_date
                          ? format(new Date(feira.end_date), "dd/MM/yyyy", {
                              locale: ptBR,
                            })
                          : ""}
                      </span>
                    </div>
                  )}

                  {(feira.location || feira.city || feira.state) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {feira.location && `${feira.location}`}
                        {feira.location && (feira.city || feira.state) && " - "}
                        {feira.city && `${feira.city}`}
                        {feira.city && feira.state && ", "}
                        {feira.state}
                      </span>
                    </div>
                  )}

                  {feira.website && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={feira.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate"
                      >
                        {feira.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Feiras;
