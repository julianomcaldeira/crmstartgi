import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, User, Building2, FileText, Flag, Mail, Phone, Briefcase, Trash2, History, MapPin, Globe, Users, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone, formatCNPJ } from "@/components/ui/masked-input";

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
  onEdit?: () => void;
}

const TaskViewDialog = ({ task, open, onOpenChange, onDelete, onEdit }: TaskViewDialogProps) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState("tarefa");
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  useEffect(() => {
    if (task?.clients?.id && open) {
      fetchClientContacts();
    }
  }, [task?.clients?.id, open]);

  const fetchClientContacts = async () => {
    if (!task?.clients?.id) return;
    
    setLoadingContacts(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("client_id", task.clients.id)
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
      visita_evento: "Visita a Evento",
      apresentacao: "Apresentação",
      proposta: "Proposta",
      pesquisa_inicial: "Pesquisa Inicial"
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl">{task.title}</DialogTitle>
          {/* Status and Priority Badges */}
          <div className="flex items-center gap-2 pt-2">
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
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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

          <TabsContent value="tarefa" className="space-y-6 mt-4">
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
                  {format(new Date(task.due_date), "PPP 'às' HH:mm", { locale: ptBR })}
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

            {/* Contact of the task */}
            {task.contacts && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <User className="h-4 w-4" />
                  Contato da Tarefa
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
                        {formatPhone(task.contacts.mobile || task.contacts.phone)}
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
                  {format(new Date(task.completed_at), "PPP 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}

            {/* Task History */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <History className="h-4 w-4" />
                Histórico de Alterações
              </div>
              {loadingHistory ? (
                <div className="text-sm text-muted-foreground">Carregando histórico...</div>
              ) : history.length > 0 ? (
                <div className="h-[200px] rounded-lg border border-border p-4 overflow-y-auto overflow-x-hidden no-scrollbar">
                  <div className="space-y-4">
                    {history.map((record) => {
                      const oldData = record.old_data || {};
                      const newData = record.new_data || {};
                      const changedFields = Object.keys(newData).filter(
                        (key) => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]),
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
              ) : (
                <div className="text-sm text-muted-foreground p-4 border border-border rounded-lg">
                  Nenhuma alteração registrada ainda.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="contatos" className="space-y-4 mt-4">
            {/* Client Info Header */}
            {task.clients && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Building2 className="h-4 w-4" />
                  {task.clients.company_name || task.clients.trade_name}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground pl-6">
                  {task.clients.cnpj && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3" />
                      CNPJ: {formatCNPJ(task.clients.cnpj)}
                    </div>
                  )}
                  {task.clients.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      <a href={`mailto:${task.clients.email}`} className="hover:text-primary transition-colors">
                        {task.clients.email}
                      </a>
                    </div>
                  )}
                  {task.clients.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      <a href={`tel:${task.clients.phone}`} className="hover:text-primary transition-colors">
                        {formatPhone(task.clients.phone)}
                      </a>
                    </div>
                  )}
                  {(task.clients.city || task.clients.state) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      {[task.clients.city, task.clients.state].filter(Boolean).join(" - ")}
                    </div>
                  )}
                  {task.clients.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-3 w-3" />
                      <a href={task.clients.website.startsWith('http') ? task.clients.website : `https://${task.clients.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                        {task.clients.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contacts List */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                Contatos ({allContacts.length})
              </div>

              {loadingContacts ? (
                <div className="text-sm text-muted-foreground">Carregando contatos...</div>
              ) : allContacts.length > 0 ? (
                <div className="max-h-[350px] overflow-y-auto space-y-3 pr-2">
                  {allContacts.map((contact) => (
                    <div 
                      key={contact.id} 
                      className={`p-4 rounded-lg border ${contact.id === task.contact_id ? 'border-primary bg-primary/5' : 'border-border'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{contact.name}</span>
                          {contact.is_primary && (
                            <Badge variant="default" className="text-xs">Principal</Badge>
                          )}
                          {contact.id === task.contact_id && (
                            <Badge variant="outline" className="text-xs">Contato da Tarefa</Badge>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1 pl-6 text-sm">
                        {contact.role && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Briefcase className="h-3 w-3" />
                            {contact.role}
                          </div>
                        )}
                        {contact.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <a href={`mailto:${contact.email}`} className="hover:text-primary transition-colors">
                              {contact.email}
                            </a>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <a href={`tel:${contact.phone}`} className="hover:text-primary transition-colors">
                              {formatPhone(contact.phone)}
                            </a>
                          </div>
                        )}
                        {contact.mobile && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <a href={`tel:${contact.mobile}`} className="hover:text-primary transition-colors">
                              {formatPhone(contact.mobile)} (Celular)
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : !task.clients ? (
                <div className="text-sm text-muted-foreground p-4 border border-border rounded-lg">
                  Nenhuma empresa associada a esta tarefa.
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-4 border border-border rounded-lg">
                  Nenhum contato cadastrado para esta empresa.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {(onEdit || onDelete) && (
          <DialogFooter className="flex justify-between sm:justify-between">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => {
                onOpenChange(false);
                onEdit();
              }}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar Tarefa
              </Button>
            )}
            {onDelete && (
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
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TaskViewDialog;
