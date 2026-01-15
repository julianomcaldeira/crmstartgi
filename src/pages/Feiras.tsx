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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Calendar as CalendarIcon,
  MapPin,
  Plus,
  Edit,
  Trash2,
  Globe,
  Search,
  Users,
  LayoutGrid,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { isThisWeek, startOfDay, endOfDay } from "date-fns";
import { FeiraVisitsDialog } from "@/components/FeiraVisitsDialog";
import { FeiraVisitsReport } from "@/components/FeiraVisitsReport";
import { SwipeableCard } from "@/components/SwipeableCard";
import { useViewMode } from "@/hooks/useViewMode";
import { parseDateOnly, formatDateBR, formatDateShortBR } from "@/lib/dateUtils";

const Feiras = () => {
  const [feiras, setFeiras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFeira, setEditingFeira] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [feiraToDelete, setFeiraToDelete] = useState<any>(null);
  const [selectedFeiras, setSelectedFeiras] = useState<string[]>([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [deleteConfirmations, setDeleteConfirmations] = useState({
    first: false,
    second: false,
    third: false,
  });
  const [viewMode, setViewMode] = useViewMode("feiras-view-mode", "cards");

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
      if (user) {
        setIsAuthenticated(true);
        
        // Fetch user roles
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        
        if (rolesData) {
          setUserRoles(rolesData.map(r => r.role));
        }
      }
    } catch (error) {
      console.error("Error checking user:", error);
    }
  };

  const canDeleteFeira = () => {
    return userRoles.includes('admin') || userRoles.includes('gestor');
  };

  const fetchFeiras = async () => {
    try {
      const { data, error } = await supabase
        .from("feiras")
        .select(`
          *,
          client_feiras (count)
        `)
        .order("start_date", { ascending: true });

      if (error) throw error;
      
      // Process data to add prospect count
      const feirasWithCount = data?.map(feira => ({
        ...feira,
        prospect_count: feira.client_feiras?.[0]?.count || 0
      })) || [];
      
      setFeiras(feirasWithCount);
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

  const handleDelete = async (feira: any) => {
    setFeiraToDelete(feira);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!feiraToDelete) return;

    try {
      const { error } = await supabase
        .from("feiras")
        .delete()
        .eq("id", feiraToDelete.id);

      if (error) throw error;
      toast.success("Feira excluída com sucesso!");
      setDeleteDialogOpen(false);
      setFeiraToDelete(null);
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

  const isFeiraHappeningToday = (feira: any) => {
    if (!feira.start_date || !feira.end_date) return false;
    const today = startOfDay(new Date());
    const startDate = startOfDay(parseDateOnly(feira.start_date));
    const endDate = endOfDay(parseDateOnly(feira.end_date));
    return today >= startDate && today <= endDate;
  };

  const isFeiraHappeningThisWeek = (feira: any) => {
    if (!feira.start_date) return false;
    const startDate = parseDateOnly(feira.start_date);
    return isThisWeek(startDate, { weekStartsOn: 0 });
  };

  const getFeiraTimingBadge = (feira: any) => {
    if (isFeiraHappeningToday(feira)) {
      return (
        <Badge className="bg-green-500 text-white hover:bg-green-600 animate-pulse">
          Acontecendo Hoje
        </Badge>
      );
    }
    if (isFeiraHappeningThisWeek(feira)) {
      return (
        <Badge className="bg-blue-500 text-white hover:bg-blue-600">
          Esta Semana
        </Badge>
      );
    }
    return null;
  };

  const handleBulkDelete = () => {
    if (selectedFeiras.length === 0) {
      toast.error("Selecione ao menos uma feira para excluir");
      return;
    }
    setDeleteConfirmations({ first: false, second: false, third: false });
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (!deleteConfirmations.first || !deleteConfirmations.second || !deleteConfirmations.third) {
      toast.error("Confirme todas as opções para prosseguir");
      return;
    }

    try {
      const { error } = await supabase
        .from("feiras")
        .delete()
        .in("id", selectedFeiras);

      if (error) throw error;

      toast.success(`${selectedFeiras.length} feira(s) excluída(s) com sucesso`);
      setSelectedFeiras([]);
      fetchFeiras();
    } catch (error) {
      console.error("Error deleting feiras:", error);
      toast.error("Erro ao excluir feiras");
    } finally {
      setBulkDeleteDialogOpen(false);
      setDeleteConfirmations({ first: false, second: false, third: false });
    }
  };

  const toggleFeiraSelection = (feiraId: string) => {
    setSelectedFeiras(prev =>
      prev.includes(feiraId)
        ? prev.filter(id => id !== feiraId)
        : [...prev, feiraId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedFeiras.length === filteredFeiras.length) {
      setSelectedFeiras([]);
    } else {
      setSelectedFeiras(filteredFeiras.map(f => f.id));
    }
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
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-2">
            Gestão de Feiras
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gerencie e acompanhe as feiras e eventos que sua equipe irá visitar
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Total: <span className="font-semibold text-foreground">{filteredFeiras.length}</span> {filteredFeiras.length !== feiras.length && `de ${feiras.length}`} feira{filteredFeiras.length !== 1 ? 's' : ''}
          </p>
        </div>

        {isAuthenticated && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {selectedFeiras.length > 0 && canDeleteFeira() && (
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                className="w-full sm:w-auto gap-2"
              >
                <Trash2 size={18} />
                Excluir ({selectedFeiras.length})
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-primary w-full sm:w-auto">
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
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-4">
          {selectedFeiras.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
              <span className="text-sm font-medium">
                {selectedFeiras.length} feira(s) selecionada(s)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFeiras([])}
              >
                Limpar seleção
              </Button>
            </div>
          )}
          
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

          {filteredFeiras.length > 0 && (
            <div className="flex items-center justify-between gap-4 pt-2 border-t flex-wrap">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedFeiras.length === filteredFeiras.length && filteredFeiras.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  Selecionar todas ({filteredFeiras.length})
                </span>
              </div>
              
              <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                <Button
                  size="sm"
                  variant={viewMode === "cards" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("cards")}
                  className="h-8 px-3"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">Cards</span>
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "compact" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("compact")}
                  className="h-8 px-3"
                >
                  <List className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">Lista</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Feiras List */}
      {filteredFeiras.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center">
          <p className="text-muted-foreground text-sm sm:text-base">
            {searchTerm || filterStatus !== "all"
              ? "Nenhuma feira encontrada com os filtros aplicados"
              : "Nenhuma feira cadastrada ainda"}
          </p>
        </Card>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFeiras.map((feira) => (
            <SwipeableCard
              key={feira.id}
              onEdit={isAuthenticated ? () => openDialog(feira) : undefined}
              onDelete={canDeleteFeira() ? () => handleDelete(feira) : undefined}
            >
              <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Checkbox
                        checked={selectedFeiras.includes(feira.id)}
                        onCheckedChange={() => toggleFeiraSelection(feira.id)}
                        className="mt-1 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2 truncate">
                          {feira.name}
                        </h3>
                        <div className="flex flex-wrap gap-2 items-center">
                          {getStatusBadge(feira.status)}
                          {getFeiraTimingBadge(feira)}
                        </div>
                      </div>
                    </div>
                    {isAuthenticated && (
                      <div className="hidden md:flex gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openDialog(feira)}
                          className="h-8 w-8"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {canDeleteFeira() && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(feira)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                {feira.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {feira.description}
                  </p>
                )}

                <div className="space-y-2 text-sm">
                  {(feira.start_date || feira.end_date) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {feira.start_date && formatDateBR(feira.start_date)}
                        {feira.start_date && feira.end_date && " - "}
                        {feira.end_date && formatDateBR(feira.end_date)}
                      </span>
                    </div>
                  )}

                  {(feira.location || feira.city || feira.state) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {[feira.location, feira.city, feira.state]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}

                  {feira.website && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="h-4 w-4 flex-shrink-0" />
                      <a
                        href={feira.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {feira.website}
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <Users className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="font-medium text-foreground text-sm">
                      {feira.prospect_count || 0} prospect(s)
                    </span>
                  </div>
                  
                  {isAuthenticated && (
                    <div className="pt-3 border-t flex flex-col sm:flex-row gap-2">
                      <FeiraVisitsDialog 
                        feiraId={feira.id} 
                        feiraName={feira.name} 
                      />
                      <FeiraVisitsReport 
                        feiraId={feira.id} 
                        feiraName={feira.name} 
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </SwipeableCard>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFeiras.map((feira) => (
            <SwipeableCard
              key={feira.id}
              onEdit={isAuthenticated ? () => openDialog(feira) : undefined}
              onDelete={canDeleteFeira() ? () => handleDelete(feira) : undefined}
            >
              <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Checkbox
                      checked={selectedFeiras.includes(feira.id)}
                      onCheckedChange={() => toggleFeiraSelection(feira.id)}
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-center">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate">
                          {feira.name}
                        </h3>
                        {(feira.city || feira.state) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {[feira.city, feira.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(feira.status)}
                        {getFeiraTimingBadge(feira)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {feira.start_date && (
                          <span className="truncate">
                            {formatDateShortBR(feira.start_date)}
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{feira.prospect_count || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {isAuthenticated && (
                    <div className="hidden sm:flex gap-1 flex-shrink-0">
                      <FeiraVisitsDialog 
                        feiraId={feira.id} 
                        feiraName={feira.name} 
                      />
                      <FeiraVisitsReport 
                        feiraId={feira.id} 
                        feiraName={feira.name} 
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openDialog(feira)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {canDeleteFeira() && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(feira)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </SwipeableCard>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a feira <strong>{feiraToDelete?.name}</strong>?
              <br /><br />
              {feiraToDelete?.prospect_count > 0 ? (
                <>
                  <span className="text-destructive font-semibold">
                    Atenção: Esta feira possui {feiraToDelete.prospect_count} prospect(s) vinculado(s).
                  </span>
                  <br />
                  Os prospects não serão excluídos, mas a vinculação com esta feira será removida.
                </>
              ) : (
                "Esta ação não pode ser desfeita."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
            >
              Excluir Feira
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão em Lote</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Você está prestes a excluir <strong>{selectedFeiras.length} feira(s)</strong>.
                  <br />
                  Esta ação não pode ser desfeita.
                </p>
                
                <div className="space-y-3 p-4 bg-muted rounded-lg">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={deleteConfirmations.first}
                      onCheckedChange={(checked) => 
                        setDeleteConfirmations(prev => ({ ...prev, first: checked as boolean }))
                      }
                    />
                    <label className="text-sm">
                      Entendo que esta ação excluirá permanentemente as feiras selecionadas
                    </label>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={deleteConfirmations.second}
                      onCheckedChange={(checked) => 
                        setDeleteConfirmations(prev => ({ ...prev, second: checked as boolean }))
                      }
                    />
                    <label className="text-sm">
                      Entendo que todos os vínculos com prospects serão removidos
                    </label>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={deleteConfirmations.third}
                      onCheckedChange={(checked) => 
                        setDeleteConfirmations(prev => ({ ...prev, third: checked as boolean }))
                      }
                    />
                    <label className="text-sm font-semibold text-destructive">
                      Confirmo que desejo prosseguir com a exclusão
                    </label>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel 
              className="w-full sm:w-auto"
              onClick={() => {
                setBulkDeleteDialogOpen(false);
                setDeleteConfirmations({ first: false, second: false, third: false });
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={!deleteConfirmations.first || !deleteConfirmations.second || !deleteConfirmations.third}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 w-full sm:w-auto"
            >
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Feiras;
