import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus, CheckCircle2, Circle, Upload, X, Image as ImageIcon, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { AudioRecorder } from "@/components/AudioRecorder";
import { SearchableCombobox } from "@/components/SearchableCombobox";

interface FeiraVisitsDialogProps {
  feiraId: string;
  feiraName: string;
}

interface ClientFeira {
  id: string;
  client_id: string;
  feira_id: string;
  visited: boolean;
  notes: string | null;
  visited_at: string | null;
  visited_by: string | null;
  clients: {
    id: string;
    company_name: string;
    trade_name: string | null;
    city: string | null;
    state: string | null;
  };
  visited_by_profile?: {
    full_name: string;
  };
  photos?: FeiraPhoto[];
}

interface FeiraPhoto {
  id: string;
  photo_url: string;
  uploaded_at: string;
  uploaded_by: string;
  notes: string | null;
}

export function FeiraVisitsDialog({ feiraId, feiraName }: FeiraVisitsDialogProps) {
  const [open, setOpen] = useState(false);
  const [visits, setVisits] = useState<ClientFeira[]>([]);
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");
  const [uploadingPhotos, setUploadingPhotos] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [visitFilter, setVisitFilter] = useState<"all" | "visited" | "pending">("all");
  const [visitSearch, setVisitSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "status" | "date">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const filteredAndSortedVisits = visits
    .filter((visit) => {
      // Filter by visit status
      const matchesStatus = 
        visitFilter === "all" ? true :
        visitFilter === "visited" ? visit.visited :
        visitFilter === "pending" ? !visit.visited : true;
      
      // Filter by search term
      const searchTerm = visitSearch.toLowerCase().trim();
      const matchesSearch = !searchTerm || 
        visit.clients.company_name?.toLowerCase().includes(searchTerm) ||
        visit.clients.trade_name?.toLowerCase().includes(searchTerm) ||
        visit.clients.city?.toLowerCase().includes(searchTerm);
      
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === "name") {
        comparison = (a.clients.company_name || "").localeCompare(b.clients.company_name || "");
      } else if (sortBy === "status") {
        // Visited first (true = 1, false = 0)
        comparison = (b.visited ? 1 : 0) - (a.visited ? 1 : 0);
      } else if (sortBy === "date") {
        const dateA = a.visited_at ? new Date(a.visited_at).getTime() : 0;
        const dateB = b.visited_at ? new Date(b.visited_at).getTime() : 0;
        comparison = dateB - dateA;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const toggleSort = (field: "name" | "status" | "date") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (field: "name" | "status" | "date") => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3" />;
    return sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  useEffect(() => {
    if (open) {
      fetchVisits();
      fetchAvailableClients();
    }
  }, [open, feiraId]);

  const fetchVisits = async () => {
    try {
      const { data, error } = await supabase
        .from("client_feiras")
        .select(`
          *,
          clients (
            id,
            company_name,
            trade_name,
            city,
            state
          )
        `)
        .eq("feira_id", feiraId)
        .order("visited", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles and photos for each visit
      const visitsWithDetails = await Promise.all(
        (data || []).map(async (visit) => {
          let visited_by_profile = null;
          if (visit.visited_by) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", visit.visited_by)
              .single();
            visited_by_profile = profile;
          }

          // Fetch photos for this visit
          const { data: photos } = await supabase
            .from("client_feira_photos")
            .select("*")
            .eq("client_feira_id", visit.id)
            .order("uploaded_at", { ascending: false });

          return { ...visit, visited_by_profile, photos: photos || [] };
        })
      );

      setVisits(visitsWithDetails as ClientFeira[]);
    } catch (error) {
      console.error("Error fetching visits:", error);
      toast.error("Erro ao carregar visitas");
    }
  };

  const fetchAvailableClients = async () => {
    try {
      // Fetch all clients that are NOT already linked to this feira
      const { data: existingLinks } = await supabase
        .from("client_feiras")
        .select("client_id")
        .eq("feira_id", feiraId);

      const existingClientIds = existingLinks?.map((link) => link.client_id) || [];

      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, trade_name, city, state")
        .not("id", "in", `(${existingClientIds.join(",") || "''"})`)
        .order("company_name");

      if (error) throw error;
      setAvailableClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const handleAddClient = async () => {
    if (!selectedClient) {
      toast.error("Selecione uma empresa");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("client_feiras").insert({
        feira_id: feiraId,
        client_id: selectedClient,
        created_by: user.id,
        visited: false,
      });

      if (error) throw error;

      toast.success("Empresa adicionada à lista de visitas");
      setSelectedClient("");
      fetchVisits();
      fetchAvailableClients();
    } catch (error) {
      console.error("Error adding client:", error);
      toast.error("Erro ao adicionar empresa");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisited = async (visitId: string, currentVisited: boolean, clientData: { id: string; company_name: string }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const updateData = currentVisited
        ? {
            visited: false,
            visited_at: null,
            visited_by: null,
          }
        : {
            visited: true,
            visited_at: new Date().toISOString(),
            visited_by: user.id,
          };

      const { error } = await supabase
        .from("client_feiras")
        .update(updateData)
        .eq("id", visitId);

      if (error) throw error;

      // Create task when marking as visited
      if (!currentVisited) {
        const visit = visits.find(v => v.id === visitId);
        const taskDescription = visit?.notes 
          ? `Visita realizada na feira ${feiraName}.\n\nAnotações da visita:\n${visit.notes}`
          : `Visita realizada na feira ${feiraName}.`;

        const { error: taskError } = await supabase
          .from("tasks")
          .insert({
            title: `Visita Feira: ${clientData.company_name}`,
            description: taskDescription,
            task_type: "visita_feira",
            status: "completed",
            priority: "medium",
            client_id: clientData.id,
            assigned_to: user.id,
            created_by: user.id,
            due_date: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          });

        if (taskError) {
          console.error("Error creating task:", taskError);
          toast.error("Visita marcada, mas erro ao criar tarefa");
        } else {
          toast.success("Visita marcada e tarefa criada no prospect!");
        }
      } else {
        toast.success("Marcado como não visitado");
      }
      
      fetchVisits();
    } catch (error) {
      console.error("Error updating visit:", error);
      toast.error("Erro ao atualizar visita");
    }
  };

  const handleAudioTranscription = (visitId: string, text: string) => {
    const visit = visits.find(v => v.id === visitId);
    const currentNotes = visit?.notes || "";
    const newNotes = currentNotes ? `${currentNotes}\n\n${text}` : text;
    
    // If editing, append to current text
    if (editingNotes === visitId) {
      setNotesText(prev => prev ? `${prev}\n\n${text}` : text);
    } else {
      // Open editing mode and set the text
      setEditingNotes(visitId);
      setNotesText(newNotes);
    }
  };

  const handleSaveNotes = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from("client_feiras")
        .update({ notes: notesText })
        .eq("id", visitId);

      if (error) throw error;

      toast.success("Anotações salvas");
      setEditingNotes(null);
      setNotesText("");
      fetchVisits();
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Erro ao salvar anotações");
    }
  };

  const startEditingNotes = (visitId: string, currentNotes: string | null) => {
    setEditingNotes(visitId);
    setNotesText(currentNotes || "");
  };

  const handlePhotoUpload = async (visitId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadingPhotos(visitId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const uploadPromises = Array.from(files).map(async (file) => {
        // Upload to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${visitId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('feira-visit-photos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('feira-visit-photos')
          .getPublicUrl(fileName);

        // Save metadata to database
        const { error: dbError } = await supabase
          .from('client_feira_photos')
          .insert({
            client_feira_id: visitId,
            photo_url: publicUrl,
            uploaded_by: user.id,
          });

        if (dbError) throw dbError;
      });

      await Promise.all(uploadPromises);
      toast.success(`${files.length} foto(s) enviada(s) com sucesso`);
      fetchVisits();
    } catch (error) {
      console.error("Error uploading photos:", error);
      toast.error("Erro ao enviar fotos");
    } finally {
      setUploadingPhotos(null);
    }
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    try {
      // Extract file path from URL
      const urlParts = photoUrl.split('/feira-visit-photos/');
      if (urlParts.length < 2) throw new Error("URL inválida");
      
      const filePath = urlParts[1];

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('feira-visit-photos')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('client_feira_photos')
        .delete()
        .eq('id', photoId);

      if (dbError) throw dbError;

      toast.success("Foto excluída com sucesso");
      fetchVisits();
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast.error("Erro ao excluir foto");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardList className="h-4 w-4 mr-2" />
          Gerenciar Visitas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Controle de Visitas - {feiraName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Client Section */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 text-sm">Adicionar Empresa à Lista de Visitas</h3>
            <div className="flex gap-2">
              <div className="flex-1">
                <SearchableCombobox
                  items={availableClients.map((client) => ({
                    value: client.id,
                    label: client.company_name,
                    subLabel: client.city ? `${client.city}/${client.state}` : undefined,
                    searchText: `${client.company_name ?? ""} ${client.trade_name ?? ""} ${client.cnpj ?? ""} ${client.city ?? ""}`.trim(),
                  }))}
                  value={selectedClient}
                  onValueChange={setSelectedClient}
                  placeholder="Buscar e selecionar empresa..."
                  searchPlaceholder="Digite para buscar por nome, CNPJ ou cidade..."
                  emptyText="Nenhuma empresa disponível para adicionar."
                />
              </div>
              <Button onClick={handleAddClient} disabled={loading || !selectedClient}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
            {availableClients.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Todas as empresas já foram adicionadas a esta feira.
              </p>
            )}
          </Card>

          {/* Visits List */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">
                Lista de Empresas ({filteredAndSortedVisits.length}{filteredAndSortedVisits.length !== visits.length ? ` de ${visits.length}` : ""})
              </h3>
              
              {/* Visit Filter Buttons */}
              <div className="flex gap-1">
                <Button
                  variant={visitFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVisitFilter("all")}
                  className="h-7 text-xs"
                >
                  Todos
                </Button>
                <Button
                  variant={visitFilter === "visited" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVisitFilter("visited")}
                  className="h-7 text-xs gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Visitados ({visits.filter(v => v.visited).length})
                </Button>
                <Button
                  variant={visitFilter === "pending" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVisitFilter("pending")}
                  className="h-7 text-xs gap-1"
                >
                  <Circle className="h-3 w-3" />
                  Pendentes ({visits.filter(v => !v.visited).length})
                </Button>
              </div>
            </div>

            {/* Search and Sort Controls */}
            {visits.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empresa por nome ou cidade..."
                    value={visitSearch}
                    onChange={(e) => setVisitSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                {/* Sort Buttons */}
                <div className="flex gap-1">
                  <Button
                    variant={sortBy === "name" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => toggleSort("name")}
                    className="h-9 text-xs gap-1"
                  >
                    {getSortIcon("name")}
                    Nome
                  </Button>
                  <Button
                    variant={sortBy === "status" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => toggleSort("status")}
                    className="h-9 text-xs gap-1"
                  >
                    {getSortIcon("status")}
                    Status
                  </Button>
                  <Button
                    variant={sortBy === "date" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => toggleSort("date")}
                    className="h-9 text-xs gap-1"
                  >
                    {getSortIcon("date")}
                    Data
                  </Button>
                </div>
              </div>
            )}
            
            {filteredAndSortedVisits.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                {visits.length === 0 ? (
                  <>
                    <p>Nenhuma empresa na lista de visitas desta feira.</p>
                    <p className="text-sm mt-1">Adicione empresas acima para começar.</p>
                  </>
                ) : (
                  <p>Nenhuma empresa encontrada com este filtro.</p>
                )}
              </Card>
            ) : (
              filteredAndSortedVisits.map((visit) => (
                <Card key={visit.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="pt-1">
                      <Checkbox
                        checked={visit.visited}
                        onCheckedChange={() => handleToggleVisited(visit.id, visit.visited, { id: visit.clients.id, company_name: visit.clients.company_name })}
                      />
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold flex items-center gap-2">
                            {visit.clients.company_name}
                            {visit.visited && (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Visitado
                              </Badge>
                            )}
                            {!visit.visited && (
                              <Badge variant="outline" className="gap-1">
                                <Circle className="h-3 w-3" />
                                Pendente
                              </Badge>
                            )}
                          </h4>
                          {visit.clients.trade_name && (
                            <p className="text-sm text-muted-foreground">
                              {visit.clients.trade_name}
                            </p>
                          )}
                          {visit.clients.city && (
                            <p className="text-xs text-muted-foreground">
                              {visit.clients.city}/{visit.clients.state}
                            </p>
                          )}
                        </div>
                      </div>

                      {visit.visited && visit.visited_at && (
                        <p className="text-xs text-muted-foreground">
                          Visitado em {format(new Date(visit.visited_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {visit.visited_by_profile && ` por ${visit.visited_by_profile.full_name}`}
                        </p>
                      )}

                      {/* Notes Section */}
                      <div className="space-y-2">
                        {editingNotes === visit.id ? (
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <Textarea
                                value={notesText}
                                onChange={(e) => setNotesText(e.target.value)}
                                placeholder="Digite suas anotações sobre a visita..."
                                className="min-h-[80px] flex-1"
                              />
                              <AudioRecorder 
                                onTranscription={(text) => setNotesText(prev => prev ? `${prev}\n\n${text}` : text)}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleSaveNotes(visit.id)}>
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingNotes(null);
                                  setNotesText("");
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {visit.notes ? (
                              <div className="bg-muted p-3 rounded-md text-sm">
                                <p className="whitespace-pre-wrap">{visit.notes}</p>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">
                                Sem anotações
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditingNotes(visit.id, visit.notes)}
                              >
                                {visit.notes ? "Editar anotações" : "Adicionar anotações"}
                              </Button>
                              <AudioRecorder 
                                onTranscription={(text) => handleAudioTranscription(visit.id, text)}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Photos Section */}
                      <div className="space-y-2 mt-4">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-medium flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" />
                            Fotos da Visita
                          </h5>
                          <label htmlFor={`photo-upload-${visit.id}`}>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              disabled={uploadingPhotos === visit.id}
                              asChild
                            >
                              <span className="cursor-pointer">
                                <Upload className="h-4 w-4 mr-2" />
                                {uploadingPhotos === visit.id ? "Enviando..." : "Adicionar Fotos"}
                              </span>
                            </Button>
                            <Input
                              id={`photo-upload-${visit.id}`}
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(e) => handlePhotoUpload(visit.id, e.target.files)}
                            />
                          </label>
                        </div>

                        {visit.photos && visit.photos.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {visit.photos.map((photo) => (
                              <div key={photo.id} className="relative group">
                                <img
                                  src={photo.photo_url}
                                  alt="Foto da visita"
                                  className="w-full h-24 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => setSelectedPhoto(photo.photo_url)}
                                />
                                <Button
                                  size="icon"
                                  variant="destructive"
                                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePhoto(photo.id, photo.photo_url);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            Nenhuma foto adicionada
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </DialogContent>

      {/* Photo Viewer Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Visualização da Foto</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="flex items-center justify-center">
              <img
                src={selectedPhoto}
                alt="Foto ampliada"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
