import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, User, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TaskEditDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const TaskEditDialog = ({ task, open, onOpenChange, onSuccess }: TaskEditDialogProps) => {
  const [taskType, setTaskType] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task) {
      setTaskType(task.task_type || "ligacao");
      setDueDate(task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : "");
      setPriority(task.priority || "medium");
      setStatus(task.status || "pending");
      fetchNotes();
    }
  }, [task]);

  const fetchNotes = async () => {
    if (!task?.id) return;
    
    try {
      const { data, error } = await supabase
        .from("task_notes")
        .select(`
          *,
          profiles:user_id(full_name)
        `)
        .eq("task_id", task.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
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
      fetchNotes();
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
      fetchNotes();
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
        visita_evento: "Visita a Evento"
      };
      
      const title = taskTypeLabels[taskType] || "Tarefa";

      const { error } = await supabase
        .from("tasks")
        .update({
          title,
          task_type: taskType as any,
          due_date: dueDate,
          priority: priority as any,
          status: status as any,
        })
        .eq("id", task.id);

      if (error) throw error;

      toast.success("Tarefa atualizada!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating task:", error);
      toast.error(error.message || "Erro ao atualizar tarefa");
    } finally {
      setLoading(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Editar Tarefa</DialogTitle>
        </DialogHeader>

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
                  placeholder="Digite sua nota aqui..."
                  rows={3}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleAddNote}
                  className="self-end"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Notes List */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
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

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
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
      </DialogContent>
    </Dialog>
  );
};