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
import { ClipboardList, Plus, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
}

export function FeiraVisitsDialog({ feiraId, feiraName }: FeiraVisitsDialogProps) {
  const [open, setOpen] = useState(false);
  const [visits, setVisits] = useState<ClientFeira[]>([]);
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");

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

      // Fetch profiles for visited_by
      const visitsWithProfiles = await Promise.all(
        (data || []).map(async (visit) => {
          if (visit.visited_by) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", visit.visited_by)
              .single();
            return { ...visit, visited_by_profile: profile };
          }
          return visit;
        })
      );

      setVisits(visitsWithProfiles as ClientFeira[]);
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

  const handleToggleVisited = async (visitId: string, currentVisited: boolean) => {
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

      toast.success(currentVisited ? "Marcado como não visitado" : "Marcado como visitado");
      fetchVisits();
    } catch (error) {
      console.error("Error updating visit:", error);
      toast.error("Erro ao atualizar visita");
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
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  {availableClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name} {client.city && `- ${client.city}/${client.state}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAddClient} disabled={loading || !selectedClient}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </Card>

          {/* Visits List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">
              Lista de Empresas ({visits.length})
            </h3>
            
            {visits.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma empresa na lista de visitas desta feira.</p>
                <p className="text-sm mt-1">Adicione empresas acima para começar.</p>
              </Card>
            ) : (
              visits.map((visit) => (
                <Card key={visit.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="pt-1">
                      <Checkbox
                        checked={visit.visited}
                        onCheckedChange={() => handleToggleVisited(visit.id, visit.visited)}
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
                            <Textarea
                              value={notesText}
                              onChange={(e) => setNotesText(e.target.value)}
                              placeholder="Digite suas anotações sobre a visita..."
                              className="min-h-[80px]"
                            />
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
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-1"
                              onClick={() => startEditingNotes(visit.id, visit.notes)}
                            >
                              {visit.notes ? "Editar anotações" : "Adicionar anotações"}
                            </Button>
                          </div>
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
    </Dialog>
  );
}
