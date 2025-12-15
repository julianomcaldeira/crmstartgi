import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { History, User, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OpportunityHistoryLogProps {
  opportunityId: string;
}

interface HistoryEntry {
  id: string;
  opportunity_id: string;
  changed_by: string;
  change_type: string;
  changed_at: string;
  old_data: any;
  new_data: any;
  profile?: {
    full_name: string;
  };
}

const statusLabels: Record<string, string> = {
  lead: "Lead",
  contacted: "Prospecção",
  qualified: "Qualificação",
  apresentacao: "Apresentação",
  proposal: "Proposta",
  negotiation: "Negociação",
  won: "Ganho",
  lost: "Perdido",
};

const fieldLabels: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  value: "Valor",
  monthly_value: "Valor Mensal",
  implementation_value: "Valor Implementação",
  status: "Fase",
  probability: "Probabilidade",
  expected_close_date: "Data Prevista",
  assigned_to: "Responsável",
  product_id: "Produto",
  business_type: "Tipo de Negócio",
  loss_reason_id: "Motivo Perda",
};

const businessTypeLabels: Record<string, string> = {
  cliente_novo: "Cliente Novo",
  venda_na_base: "Venda na Base",
};

const formatValue = (key: string, value: any): string => {
  if (value === null || value === undefined) return "-";
  
  if (key === "status") {
    return statusLabels[value] || value;
  }
  
  if (key === "business_type") {
    return businessTypeLabels[value] || value;
  }
  
  if (key === "probability") {
    return `${value}%`;
  }
  
  if (key === "value" || key === "monthly_value" || key === "implementation_value") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }
  
  if (key === "expected_close_date" && value) {
    try {
      return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return value;
    }
  }
  
  return String(value);
};

export const OpportunityHistoryLog = ({ opportunityId }: OpportunityHistoryLogProps) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchHistory();
    fetchUsers();
    fetchProducts();
  }, [opportunityId]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("opportunity_history")
        .select("*")
        .eq("opportunity_id", opportunityId)
        .order("changed_at", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name");

      if (error) throw error;
      
      const userMap: Record<string, string> = {};
      data?.forEach((user) => {
        userMap[user.id] = user.full_name;
      });
      setUsers(userMap);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name");

      if (error) throw error;
      
      const productMap: Record<string, string> = {};
      data?.forEach((product) => {
        productMap[product.id] = product.name;
      });
      setProducts(productMap);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const getChangedFields = (entry: HistoryEntry) => {
    const changes: { field: string; oldValue: any; newValue: any }[] = [];
    
    if (!entry.old_data || !entry.new_data) return changes;

    Object.keys(entry.new_data).forEach((key) => {
      const oldVal = entry.old_data[key];
      const newVal = entry.new_data[key];
      
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          field: key,
          oldValue: oldVal,
          newValue: newVal,
        });
      }
    });

    return changes;
  };

  const formatFieldValue = (field: string, value: any): string => {
    if (field === "assigned_to" && value) {
      return users[value] || value;
    }
    if (field === "product_id" && value) {
      return products[value] || value;
    }
    return formatValue(field, value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma alteração registrada</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          Histórico de Alterações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {history.map((entry, index) => {
              const changes = getChangedFields(entry);
              
              return (
                <div key={entry.id}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {users[entry.changed_by] || "Usuário"}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {entry.change_type === "UPDATE" ? "Alteração" : entry.change_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(entry.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                      
                      <div className="mt-3 space-y-2">
                        {changes.map((change, idx) => (
                          <div 
                            key={idx} 
                            className="text-sm bg-muted/30 rounded-lg p-3 border border-border/50"
                          >
                            <span className="font-medium text-foreground">
                              {fieldLabels[change.field] || change.field}:
                            </span>
                            <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                              <span className="line-through opacity-70">
                                {formatFieldValue(change.field, change.oldValue)}
                              </span>
                              <ArrowRight className="h-3 w-3 flex-shrink-0" />
                              <span className="text-foreground font-medium">
                                {formatFieldValue(change.field, change.newValue)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {index < history.length - 1 && (
                    <Separator className="my-4" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default OpportunityHistoryLog;
