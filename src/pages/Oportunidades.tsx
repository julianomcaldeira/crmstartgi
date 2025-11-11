import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const Oportunidades = () => {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const stages = [
    { key: "lead", label: "Lead", color: "bg-muted" },
    { key: "contacted", label: "Contactado", color: "bg-info/20 text-info" },
    { key: "qualified", label: "Qualificado", color: "bg-primary/20 text-primary" },
    { key: "proposal", label: "Proposta", color: "bg-warning/20 text-warning" },
    { key: "negotiation", label: "Negociação", color: "bg-accent/20 text-accent" },
    { key: "won", label: "Ganho", color: "bg-success/20 text-success" },
    { key: "lost", label: "Perdido", color: "bg-destructive/20 text-destructive" },
  ];

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const fetchOpportunities = async () => {
    try {
      const { data, error } = await supabase
        .from("opportunities")
        .select(`
          *,
          client:clients(company_name, trade_name),
          assigned:profiles!opportunities_assigned_to_fkey(full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOpportunities(data || []);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      toast.error("Erro ao carregar oportunidades");
    } finally {
      setLoading(false);
    }
  };

  const getOpportunitiesByStage = (stageKey: string) => {
    return opportunities.filter((opp) => opp.status === stageKey);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Pipeline de Vendas</h1>
        <p className="text-muted-foreground">
          Acompanhe suas oportunidades em cada fase
        </p>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {stages.map((stage) => {
            const stageOpps = getOpportunitiesByStage(stage.key);
            const stageValue = stageOpps.reduce(
              (sum, opp) => sum + (Number(opp.value) || 0),
              0
            );

            return (
              <div key={stage.key} className="space-y-3">
                <div className="bg-card p-3 rounded-lg border border-border">
                  <h3 className="font-semibold text-sm mb-1">{stage.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {stageOpps.length} oportunidades
                  </p>
                  <p className="text-xs font-medium text-primary mt-1">
                    {formatCurrency(stageValue)}
                  </p>
                </div>

                <div className="space-y-2">
                  {stageOpps.map((opp) => (
                    <Card
                      key={opp.id}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <CardHeader className="p-3">
                        <CardTitle className="text-sm">{opp.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {opp.client?.company_name || opp.client?.trade_name}
                        </p>
                        <p className="text-xs font-medium text-primary">
                          {formatCurrency(opp.value)}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {opp.probability}%
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {opp.assigned?.full_name}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Oportunidades;