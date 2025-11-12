import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, DollarSign, User, Building2, Package, TrendingUp, Target, Briefcase } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OpportunityViewDialogProps {
  opportunity: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OpportunityViewDialog = ({ opportunity, open, onOpenChange }: OpportunityViewDialogProps) => {
  if (!opportunity) return null;

  const getStatusLabel = (status: string) => {
    const statuses: any = {
      lead: "Lead",
      contacted: "Contactado",
      qualified: "Qualificado",
      proposal: "Proposta",
      negotiation: "Negociação",
      won: "Ganho",
      lost: "Perdido"
    };
    return statuses[status] || status;
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "won": return "default";
      case "lost": return "destructive";
      case "negotiation": return "default";
      case "proposal": return "secondary";
      default: return "outline";
    }
  };

  const getBusinessTypeLabel = (type: string) => {
    const types: any = {
      cliente_novo: "Cliente Novo",
      venda_na_base: "Venda na Base"
    };
    return types[type] || type;
  };

  const totalValue = (Number(opportunity.implementation_value || 0) + Number(opportunity.monthly_value || 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{opportunity.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Business Type Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={getStatusVariant(opportunity.status)}>
              {getStatusLabel(opportunity.status)}
            </Badge>
            {opportunity.business_type && (
              <Badge variant="outline">
                <Briefcase className="h-3 w-3 mr-1" />
                {getBusinessTypeLabel(opportunity.business_type)}
              </Badge>
            )}
            <Badge variant="secondary">
              <Target className="h-3 w-3 mr-1" />
              {opportunity.probability}% de chance
            </Badge>
          </div>

          <Separator />

          {/* Description */}
          {opportunity.description && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Descrição
              </div>
              <p className="text-foreground pl-6">{opportunity.description}</p>
            </div>
          )}

          {/* Client */}
          {opportunity.client && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Cliente
              </div>
              <p className="text-foreground pl-6">
                {opportunity.client.trade_name || opportunity.client.company_name}
              </p>
            </div>
          )}

          {/* Product */}
          {opportunity.product && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Package className="h-4 w-4" />
                Produto
              </div>
              <div className="pl-6">
                <p className="text-foreground font-medium">{opportunity.product.name}</p>
                {opportunity.product.description && (
                  <p className="text-sm text-muted-foreground mt-1">{opportunity.product.description}</p>
                )}
              </div>
            </div>
          )}

          {/* Values */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Valores
            </div>
            <div className="pl-6 space-y-2">
              {opportunity.implementation_value && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Implantação:</span>
                  <span className="text-foreground font-medium">
                    R$ {Number(opportunity.implementation_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {opportunity.monthly_value && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Mensalidade:</span>
                  <span className="text-foreground font-medium">
                    R$ {Number(opportunity.monthly_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {totalValue > 0 && (
                <>
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-foreground">Total:</span>
                    <span className="text-foreground font-bold text-lg">
                      R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Expected Close Date */}
          {opportunity.expected_close_date && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Data Prevista de Fechamento
              </div>
              <p className="text-foreground pl-6">
                {format(parseISO(opportunity.expected_close_date), "PPP", { locale: ptBR })}
              </p>
            </div>
          )}

          {/* Assigned To */}
          {opportunity.assigned && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                Responsável
              </div>
              <p className="text-foreground pl-6">{opportunity.assigned.full_name}</p>
            </div>
          )}

          {/* Created Date */}
          {opportunity.created_at && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Criada em
              </div>
              <p className="text-foreground pl-6">
                {format(parseISO(opportunity.created_at), "PPP 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OpportunityViewDialog;
