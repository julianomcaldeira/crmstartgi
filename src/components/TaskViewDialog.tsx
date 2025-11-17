import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, User, Building2, FileText, Flag, Mail, Phone, Briefcase } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TaskViewDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TaskViewDialog = ({ task, open, onOpenChange }: TaskViewDialogProps) => {
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
    return status === "completed" ? "default" : "secondary";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
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
              <p className="text-foreground pl-6">{task.description}</p>
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
                {task.clients.trade_name || task.clients.company_name}
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskViewDialog;
