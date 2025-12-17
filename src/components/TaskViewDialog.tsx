import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, User, Building2, FileText, Flag, Mail, Phone, Briefcase, Trash2, History } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface TaskViewDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (taskId: string) => void;
}

const TaskViewDialog = ({ task, open, onOpenChange, onDelete }: TaskViewDialogProps) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (task?.id && open) {
      fetchTaskHistory();
    }
  }, [task?.id, open]);

  const fetchTaskHistory = async () => {
    if (!task?.id) return;
    
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("task_history")
        .select(`
          *,
          profiles:changed_by(full_name)
        `)
        .eq("task_id", task.id)
        .order("changed_at", { ascending: false });

      if (error) {
        console.error("Error fetching task history:", error);
        throw error;
      }
      console.log("Task history fetched:", data);
      setHistory(data || []);
    } catch (error) {
      console.error("Error fetching task history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!task) return null;

  const getTaskTypeLabel = (type: string) => {
    const types: any = {
      ligacao: "Ligação",
      email: "E-mail",
      whatsapp: "WhatsApp",
      linkedin: "LinkedIn",
      visita_presencial: "Visita Presencial",
      reuniao_online: "Reunião Online",
      visita_feira: "Visita a Feira",
      visita_evento: "Visita a Evento"
    };
    return types[type] || type;
  };

  const getPriorityLabel = (priority: string) => {
    const priorities: any = {
      high: "Alta",
      medium: "Média",
      low: "Baixa"
    };
    return priorities[priority] || priority;
  };

  const getStatusLabel = (status: string) => {
    const statuses: any = {
      pending: "Pendente",
      completed: "Concluída"
    };
    return statuses[status] || status;
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "default";
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in_progress": return "secondary";
      case "pending": return "outline";
      default: return "secondary";
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
      visita_evento: "Visita a Evento"
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
        oldDisplay = format(parseISO(oldValue), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        newDisplay = format(parseISO(newValue), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Priority Badges */}
          <div className="flex items-center gap-2">
            <Badge variant={getStatusVariant(task.status)}>
              {getStatusLabel(task.status)}
            </Badge>
            <Badge variant={getPriorityVariant(task.priority)}>
              <Flag className="h-3 w-3 mr-1" />
              {getPriorityLabel(task.priority)}
            </Badge>
            {task.task_type && (
              <Badge variant="outline">
                {getTaskTypeLabel(task.task_type)}
              </Badge>
            )}
          </div>

          <Separator />

          {/* Description */}
          {task.description && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                Descrição
              </div>
              <p className="text-foreground pl-6 whitespace-pre-wrap [overflow-wrap:anywhere]">{task.description}</p>
            </div>
          )}

          {/* Date and Time */}
          {task.due_date && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Data e Hora
              </div>
              <p className="text-foreground pl-6">
                {format(parseISO(task.due_date), "PPP 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          )}

          {/* Client */}
          {task.clients && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Cliente
              </div>
              <p className="text-foreground pl-6">
                {task.clients.company_name || task.clients.trade_name}
              </p>
            </div>
          )}

          {/* Contact Information */}
          {task.contacts && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <User className="h-4 w-4" />
                Informações do Contato
              </div>
              <div className="space-y-2 pl-6">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-medium">{task.contacts.name}</span>
                  {task.contacts.role && (
                    <Badge variant="outline" className="text-xs">
                      {task.contacts.role}
                    </Badge>
                  )}
                </div>
                {task.contacts.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <a href={`mailto:${task.contacts.email}`} className="hover:text-primary transition-colors">
                      {task.contacts.email}
                    </a>
                  </div>
                )}
                {(task.contacts.phone || task.contacts.mobile) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <a 
                      href={`tel:${task.contacts.mobile || task.contacts.phone}`} 
                      className="hover:text-primary transition-colors"
                    >
                      {task.contacts.mobile || task.contacts.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assigned To */}
          {task.profiles && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                Responsável
              </div>
              <p className="text-foreground pl-6">{task.profiles.full_name}</p>
            </div>
          )}

          {/* Completion Date */}
          {task.completed_at && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4" />
                Concluída em
              </div>
              <p className="text-foreground pl-6">
                {format(parseISO(task.completed_at), "PPP 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          )}

          {/* Task History */}
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <History className="h-4 w-4" />
                Histórico de Alterações
              </div>
              {loadingHistory ? (
                <div className="text-sm text-muted-foreground">Carregando histórico...</div>
              ) : history.length > 0 ? (
                <ScrollArea className="h-[300px] rounded-lg border border-border p-4 overflow-x-hidden">
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
                              {format(parseISO(record.changed_at), "dd/MM/yyyy 'às' HH:mm", {
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
                </ScrollArea>
              ) : (
                <div className="text-sm text-muted-foreground p-4 border border-border rounded-lg">
                  Nenhuma alteração registrada ainda. As alterações serão registradas quando você editar esta tarefa.
                </div>
              )}
            </div>
          </>
        </div>

        {onDelete && (
          <DialogFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Tarefa
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
                  <AlertDialogAction onClick={() => onDelete(task.id)}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TaskViewDialog;
