import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, User, Building2, Flag, FileText, Phone, Mail, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPhone } from "@/components/ui/masked-input";

interface TaskHoverPreviewProps {
  task: any;
  children: React.ReactNode;
  enabled?: boolean;
}

const TaskHoverPreview = ({ task, children, enabled = true }: TaskHoverPreviewProps) => {
  // Only show hover preview for completed tasks
  if (!enabled || task.status !== "completed") {
    return <>{children}</>;
  }

  const getTaskTypeLabel = (type: string) => {
    const types: Record<string, string> = {
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
    const priorities: Record<string, string> = {
      high: "Alta",
      medium: "Média",
      low: "Baixa"
    };
    return priorities[priority] || priority;
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "default";
    }
  };

  const client = task.clients || task.client;
  const contact = task.contacts || task.contact;
  const assignedUser = task.profiles || task.assigned_user;

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-96 p-4 z-50" 
        side="top" 
        align="center"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions={true}
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-foreground leading-tight flex-1">
                {task.title}
              </h4>
              <Badge variant="default" className="bg-success text-success-foreground shrink-0">
                Concluída
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {task.task_type && (
                <Badge variant="outline" className="text-xs">
                  {getTaskTypeLabel(task.task_type)}
                </Badge>
              )}
              {task.priority && (
                <Badge variant={getPriorityVariant(task.priority) as any} className="text-xs">
                  <Flag className="h-3 w-3 mr-1" />
                  {getPriorityLabel(task.priority)}
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Description */}
          {task.description && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="h-3 w-3" />
                Descrição
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4 [overflow-wrap:anywhere]">
                {task.description}
              </p>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            {task.due_date && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Data Agendada
                </div>
                <p className="text-sm text-foreground">
                  {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground">
                  às {format(new Date(task.due_date), "HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}
            {task.completed_at && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Concluída em
                </div>
                <p className="text-sm text-foreground">
                  {format(new Date(task.completed_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground">
                  às {format(new Date(task.completed_at), "HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}
          </div>

          {/* Client */}
          {client && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  Cliente
                </div>
                <p className="text-sm font-medium text-foreground">
                  {client.company_name || client.trade_name}
                </p>
                {(client.city || client.state) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[client.city, client.state].filter(Boolean).join(" - ")}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Contact */}
          {contact && (
            <div className="space-y-1.5 p-2 bg-muted/50 rounded-md">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <User className="h-3 w-3" />
                Contato
              </div>
              <p className="text-sm font-medium text-foreground">
                {contact.name}
                {contact.role && (
                  <span className="text-muted-foreground font-normal ml-1">
                    ({contact.role})
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {contact.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {contact.email}
                  </span>
                )}
                {(contact.phone || contact.mobile) && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {formatPhone(contact.mobile || contact.phone)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Assigned User */}
          {assignedUser && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>Responsável: <span className="text-foreground font-medium">{assignedUser.full_name}</span></span>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default TaskHoverPreview;
