import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, User, Clock, History, Building2, Users, Mail, Phone, FileText, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import TaskQuickMessages from "@/components/TaskQuickMessages";
import AudioRecorder from "@/components/AudioRecorder";
import TaskAttachments from "@/components/TaskAttachments";
import { formatPhone } from "@/components/ui/masked-input";
import { SearchableCombobox } from "@/components/SearchableCombobox";

interface TaskEditDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onDelete?: (taskId: string) => void;
}

export const TaskEditDialog = ({ task, open, onOpenChange, onSuccess, onDelete }: TaskEditDialogProps) => {
  const [taskType, setTaskType] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [activeTab, setActiveTab] = useState<"tarefa" | "contatos">("tarefa");
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  // Editable client/opportunity fields
  const [editClientId, setEditClientId] = useState<string>("");
  const [editOpportunityId, setEditOpportunityId] = useState<string>("");
  const [allClients, setAllClients] = useState<any[]>([]);
  const [allOpportunities, setAllOpportunities] = useState<any[]>([]);

  const clientDisplay = task?.client ?? task?.clients;
  const contactDisplay = task?.contact ?? task?.contacts;
  const resolvedClientId: string | undefined = task?.client_id ?? clientDisplay?.id;
  const selectedContactId: string | undefined = task?.contact_id ?? contactDisplay?.id;

  useEffect(() => {
    if (task?.id && open) {
      setTaskType(task.task_type || "ligacao");
      if (task.due_date) {
        const utcDate = new Date(task.due_date);
        const localDate = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);
        setDueDate(localDate.toISOString().slice(0, 16));
      } else {
        setDueDate("");
      }
      setPriority(task.priority || "medium");
      setStatus(task.status || "pending");
      // Strip campaign instructions from editable description
      const fullDesc = task.description || "";
      const campaignMarker = "━━━ Orientações da Campanha (não editável) ━━━";
      const markerIdx = fullDesc.indexOf(campaignMarker);
      if (markerIdx > -1) {
        setDescription(fullDesc.substring(0, fullDesc.lastIndexOf("\n\n", markerIdx)).trim());
      } else {
        setDescription(fullDesc);
      }
      setEditClientId(task.client_id || "");
      setEditOpportunityId(task.opportunity_id || "");
      setNotes([]);
      setNewNote("");
      fetchNotesForTask(task.id);
      fetchTaskHistoryForTask(task.id);
    }
  }, [task?.id, open]);

  // Fetch clients and opportunities for editing
  useEffect(() => {
    if (!open) return;
    const fetchLists = async () => {
      const [clientsRes, oppsRes] = await Promise.all([
        supabase.from("clients").select("id, company_name, trade_name, cnpj").order("company_name"),
        supabase.from("opportunities").select("id, title").order("title"),
      ]);
      setAllClients(clientsRes.data || []);
      setAllOpportunities(oppsRes.data || []);
    };
    fetchLists();
  }, [open]);

  useEffect(() => {
    if (open) {
      setActiveTab("tarefa");
      setContactSearch("");
    }
  }, [open, task?.id]);

  useEffect(() => {
    if (!open) return;
    if (resolvedClientId) {
      fetchClientContacts(resolvedClientId);
    } else {
      setAllContacts([]);
    }
  }, [open, resolvedClientId]);

  const fetchNotesForTask = async (taskId: string) => {
    if (!taskId) return;
    
    try {
      const { data, error } = await supabase
        .from("task_notes")
        .select(`
          *,
          profiles:user_id(full_name)
        `)
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
  };

  const fetchTaskHistoryForTask = async (taskId: string) => {
    if (!taskId) return;
    
    try {
      const { data, error } = await supabase
        .from("task_history")
        .select(`
          *,
          profiles:changed_by(full_name)
        `)
        .eq("task_id", taskId)
        .order("changed_at", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Error fetching task history:", error);
    }
  };

  const fetchClientContacts = async (clientId: string) => {
    setLoadingContacts(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("client_id", clientId)
        .order("is_primary", { ascending: false })
        .order("name", { ascending: true });

      if (error) throw error;
      setAllContacts(data || []);
    } catch (error) {
      console.error("Error fetching client contacts:", error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const renderFieldChange = (field: string, oldValue: any, newValue: any) => {
    const fieldLabels: any = {
      title: "Título",
      description: "Descrição",
      task_type: "Tipo de Tarefa",
      due_date: "Data",
      priority: "Prioridade",
      status: "Situação",
      assigned_to: "Responsável"
    };

    const taskTypeLabels: any = {
      ligacao: "Ligação",
      email: "E-mail",
      whatsapp: "WhatsApp",
      linkedin: "LinkedIn",
      visita_presencial: "Visita Presencial",
      reuniao_online: "Reunião Online",
      visita_feira: "Visita a Feira",
      visita_evento: "Visita a Evento",
      apresentacao: "Apresentação",
      proposta: "Proposta",
      pesquisa_inicial: "Pesquisa Inicial"
    };

    const priorityLabels: any = {
      high: "Alta",
      medium: "Média",
      low: "Baixa"
    };

    const statusLabels: any = {
      pending: "Pendente",
      in_progress: "Em Execução",
      completed: "Realizada",
      cancelled: "Cancelada"
    };

    let oldDisplay = oldValue;
    let newDisplay = newValue;

    if (field === "task_type") {
      oldDisplay = taskTypeLabels[oldValue] || oldValue;
      newDisplay = taskTypeLabels[newValue] || newValue;
    } else if (field === "priority") {
      oldDisplay = priorityLabels[oldValue] || oldValue;
      newDisplay = priorityLabels[newValue] || newValue;
    } else if (field === "status") {
      oldDisplay = statusLabels[oldValue] || oldValue;
      newDisplay = statusLabels[newValue] || newValue;
    } else if (field === "due_date" && oldValue && newValue) {
      try {
        oldDisplay = format(new Date(oldValue), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        newDisplay = format(new Date(newValue), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      } catch (e) {
        // Keep original values if parsing fails
      }
    }

    return (
      <div className="text-sm">
        <span className="font-medium text-foreground">{fieldLabels[field] || field}:</span>
        <div className="mt-1 pl-4">
          <div className="text-muted-foreground line-through">
            {oldDisplay || "(vazio)"}
          </div>
          <div className="text-foreground font-medium">
            {newDisplay || "(vazio)"}
          </div>
        </div>
      </div>
    );
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error("Digite uma nota");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("task_notes").insert({
        task_id: task.id,
        user_id: user.id,
        note: newNote.trim(),
      });

      if (error) throw error;

      toast.success("Nota adicionada!");
      setNewNote("");
      if (task?.id) fetchNotesForTask(task.id);
    } catch (error: any) {
      console.error("Error adding note:", error);
      toast.error(error.message || "Erro ao adicionar nota");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("task_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;

      toast.success("Nota removida!");
      if (task?.id) fetchNotesForTask(task.id);
    } catch (error: any) {
      console.error("Error deleting note:", error);
      toast.error("Erro ao remover nota");
    }
  };

  const handleUpdate = async () => {
    if (!dueDate) {
      toast.error("Preencha a data de vencimento");
      return;
    }

    setLoading(true);
    try {
      const taskTypeLabels: Record<string, string> = {
        ligacao: "Ligação",
        email: "E-mail",
        whatsapp: "WhatsApp",
        linkedin: "LinkedIn",
        visita_presencial: "Visita Presencial",
        reuniao_online: "Reunião Online",
        visita_feira: "Visita a Feira",
        visita_evento: "Visita a Evento",
        proposta: "Proposta",
        pesquisa_inicial: "Pesquisa Inicial"
      };
      
      const title = taskTypeLabels[taskType] || "Tarefa";

      // Converter o valor local do input para UTC antes de salvar
      const dueDateUTC = dueDate ? new Date(dueDate).toISOString() : null;

      const { error } = await supabase
        .from("tasks")
        .update({
          title,
          task_type: taskType as any,
          due_date: dueDateUTC,
          priority: priority as any,
          status: status as any,
          description: (() => {
            // Preserve campaign instructions on save
            const fullDesc = task.description || "";
            const campaignMarker = "━━━ Orientações da Campanha (não editável) ━━━";
            const markerIdx = fullDesc.indexOf(campaignMarker);
            const campaignPart = markerIdx > -1 ? fullDesc.substring(fullDesc.lastIndexOf("\n\n", markerIdx)) : "";
            const userDesc = description.trim();
            return userDesc ? (userDesc + campaignPart) : (campaignPart.trim() || null);
          })(),
          client_id: editClientId || null,
          opportunity_id: editOpportunityId || null,
        })
        .eq("id", task.id);

      if (error) throw error;

      toast.success("Tarefa atualizada!");
      
      // Wait a moment for the trigger to process, then refresh history
      setTimeout(() => {
        if (task?.id) fetchTaskHistoryForTask(task.id);
      }, 500);
      
      onSuccess();
    } catch (error: any) {
      console.error("Error updating task:", error);
      toast.error(error.message || "Erro ao atualizar tarefa");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!task?.id) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", task.id);

      if (error) throw error;

      toast.success("Tarefa excluída com sucesso!");
      onOpenChange(false);
      if (onDelete) {
        onDelete(task.id);
      }
      onSuccess();
    } catch (error: any) {
      console.error("Error deleting task:", error);
      toast.error(error.message || "Erro ao excluir tarefa");
    } finally {
      setDeleting(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl">Editar Tarefa</DialogTitle>
          {/* Client/Contact Info */}
          {(clientDisplay || contactDisplay) && (
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              {clientDisplay && (
                <div className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-medium">{clientDisplay.company_name || clientDisplay.trade_name}</span>
                </div>
              )}
              {contactDisplay && (
                <div className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md">
                  <Users className="h-4 w-4 text-primary" />
                  <span>{contactDisplay.name}</span>
                  {contactDisplay.role && <span className="text-xs">({contactDisplay.role})</span>}
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tarefa" className="gap-2">
              <FileText className="h-4 w-4" />
              Tarefa
            </TabsTrigger>
            <TabsTrigger value="contatos" className="gap-2">
              <Users className="h-4 w-4" />
              Contatos do Prospect
              {allContacts.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {allContacts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tarefa" className="mt-4">
            <div className="space-y-6">
          {/* Task Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Tarefa *</Label>
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
              <Label>Data e Hora *</Label>
              <Input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
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

            <div className="space-y-2">
              <Label>Situação</Label>
              <Select value={status} onValueChange={setStatus}>
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
           </div>

          {/* Client & Opportunity linking */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente / Prospect</Label>
              <SearchableCombobox
                items={allClients.map((c) => ({
                  value: c.id,
                  label: c.company_name || c.trade_name,
                  subLabel: c.cnpj || undefined,
                  searchText: `${c.company_name ?? ""} ${c.trade_name ?? ""} ${c.cnpj ?? ""}`.trim(),
                }))}
                value={editClientId}
                onValueChange={setEditClientId}
                placeholder="Vincular cliente"
                searchPlaceholder="Buscar cliente por nome ou CNPJ..."
                emptyText="Nenhum cliente encontrado."
              />
            </div>
            <div className="space-y-2">
              <Label>Oportunidade</Label>
              <SearchableCombobox
                items={allOpportunities.map((o) => ({
                  value: o.id,
                  label: o.title,
                  searchText: o.title,
                }))}
                value={editOpportunityId}
                onValueChange={setEditOpportunityId}
                placeholder="Vincular oportunidade"
                searchPlaceholder="Buscar oportunidade..."
                emptyText="Nenhuma oportunidade encontrada."
              />
            </div>
          </div>

          <Separator />

          {/* Campaign Instructions (read-only) */}
          {(() => {
            const fullDesc = task?.description || "";
            const campaignMarker = "━━━ Orientações da Campanha (não editável) ━━━";
            const markerIdx = fullDesc.indexOf(campaignMarker);
            if (markerIdx === -1) return null;
            const instructionsText = fullDesc.substring(markerIdx + campaignMarker.length).split("[Campanha:")[0].trim();
            const campaignTag = fullDesc.match(/\[Campanha: (.+?)\]/)?.[1];
            return (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <FileText className="h-4 w-4" />
                  Orientações da Campanha{campaignTag ? ` — ${campaignTag}` : ""}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap [overflow-wrap:anywhere]">{instructionsText}</p>
              </div>
            );
          })()}

          {/* Description Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Descrição da Tarefa</Label>
              <AudioRecorder 
                onTranscription={(text) => setDescription(prev => prev ? `${prev}\n${text}` : text)}
              />
            </div>
            <TaskQuickMessages 
              taskType={taskType} 
              onSelect={(msg) => setDescription(prev => prev ? `${prev}\n${msg}` : msg)} 
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva os detalhes da tarefa ou grave um áudio..."
              rows={4}
              className="resize-y min-h-[100px] overflow-x-hidden overflow-y-auto no-scrollbar [overflow-wrap:anywhere]"
            />
          </div>

          <Separator />

          {/* Notes Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Notas da Tarefa</h3>
            
            {/* Add Note */}
            <div className="space-y-2">
              <Label>Adicionar Nova Nota</Label>
              <div className="flex gap-2">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Digite sua nota ou grave um áudio..."
                  rows={3}
                  className="flex-1 resize-y min-h-[80px] overflow-x-hidden overflow-y-auto no-scrollbar [overflow-wrap:anywhere]"
                />
                <div className="flex flex-col gap-2 self-end">
                  <AudioRecorder
                    onTranscription={(text) => setNewNote(prev => prev ? `${prev}\n${text}` : text)}
                  />
                  <Button
                    type="button"
                    onClick={handleAddNote}
                    size="icon"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Notes List */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto overflow-x-hidden no-scrollbar">
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
                          {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Separator />

          {/* Attachments Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Anexos</h3>
            <TaskAttachments taskId={task?.id} />
          </div>

          {/* Task History */}
          {history.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <History className="h-4 w-4" />
                  Histórico de Alterações
                </div>
                <div className="h-[300px] rounded-lg border border-border p-4 overflow-y-auto overflow-x-hidden no-scrollbar">
                  <div className="space-y-4">
                    {history.map((record) => {
                      const oldData = record.old_data || {};
                      const newData = record.new_data || {};
                      const changedFields = Object.keys(newData).filter(
                        key => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])
                      );

                      return (
                        <div
                          key={record.id}
                          className="pb-4 border-b border-border last:border-0 last:pb-0"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium text-foreground">
                                {record.profiles?.full_name || "Usuário"}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(record.changed_at), "dd/MM/yyyy 'às' HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                          <div className="space-y-3 pl-5">
                            {changedFields.map((field) => (
                              <div key={field}>
                                {renderFieldChange(field, oldData[field], newData[field])}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-between gap-2 pt-4 border-t">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleting ? "Excluindo..." : "Excluir"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Sim, Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleUpdate} disabled={loading}>
                {loading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </div>
            </div>
          </TabsContent>

          <TabsContent value="contatos" className="mt-4 space-y-4">
            {!resolvedClientId ? (
              <div className="text-sm text-muted-foreground p-4 border border-border rounded-lg">
                Nenhum prospect associado a esta tarefa.
              </div>
            ) : loadingContacts ? (
              <div className="text-sm text-muted-foreground">Carregando contatos...</div>
            ) : allContacts.length > 0 ? (
              <>
                {/* Search/Filter Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, cargo ou e-mail..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {(() => {
                  const searchLower = contactSearch.toLowerCase().trim();
                  const filteredContacts = searchLower
                    ? allContacts.filter((c) =>
                        (c.name?.toLowerCase() || "").includes(searchLower) ||
                        (c.role?.toLowerCase() || "").includes(searchLower) ||
                        (c.email?.toLowerCase() || "").includes(searchLower)
                      )
                    : allContacts;

                  if (filteredContacts.length === 0) {
                    return (
                      <div className="text-sm text-muted-foreground p-4 border border-border rounded-lg text-center">
                        Nenhum contato encontrado para "{contactSearch}"
                      </div>
                    );
                  }

                  return (
                    <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-2">
                      {filteredContacts.map((c) => (
                        <div
                          key={c.id}
                          className={`p-4 rounded-lg border ${c.id === selectedContactId ? "border-primary bg-primary/5" : "border-border"}`}
                        >
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-foreground">{c.name}</span>
                            {c.is_primary && (
                              <Badge variant="default" className="text-xs">
                                Principal
                              </Badge>
                            )}
                            {c.id === selectedContactId && (
                              <Badge variant="outline" className="text-xs">
                                Contato da Tarefa
                              </Badge>
                            )}
                            {c.role && (
                              <Badge variant="secondary" className="text-xs">
                                {c.role}
                              </Badge>
                            )}
                          </div>

                          <div className="space-y-1 pl-6 text-sm text-muted-foreground">
                            {c.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-3 w-3" />
                                <a href={`mailto:${c.email}`} className="hover:text-primary transition-colors">
                                  {c.email}
                                </a>
                              </div>
                            )}
                            {c.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3 w-3" />
                                <a href={`tel:${c.phone}`} className="hover:text-primary transition-colors">
                                  {formatPhone(c.phone)}
                                </a>
                              </div>
                            )}
                            {c.mobile && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3 w-3" />
                                <a href={`tel:${c.mobile}`} className="hover:text-primary transition-colors">
                                  {formatPhone(c.mobile)} (Celular)
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="text-sm text-muted-foreground p-4 border border-border rounded-lg">
                Nenhum contato cadastrado para este prospect.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};