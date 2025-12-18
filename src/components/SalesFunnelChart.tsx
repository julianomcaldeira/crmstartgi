import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Trophy, XCircle } from "lucide-react";

interface FunnelStage {
  key: string;
  label: string;
  color: string;
  bgColor: string;
  count: number;
  value: number;
}

const SalesFunnelChart = () => {
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);

  const stageConfig = [
    { key: "lead", label: "Lead", color: "#3B82F6", bgColor: "bg-blue-500" },
    { key: "contacted", label: "Contactado", color: "#06B6D4", bgColor: "bg-cyan-500" },
    { key: "qualified", label: "Qualificado", color: "#6366F1", bgColor: "bg-indigo-500" },
    { key: "apresentacao", label: "Apresentação", color: "#8B5CF6", bgColor: "bg-violet-500" },
    { key: "proposal", label: "Proposta", color: "#A855F7", bgColor: "bg-purple-500" },
    { key: "negotiation", label: "Negociação", color: "#F59E0B", bgColor: "bg-amber-500" },
    { key: "won", label: "Ganho", color: "#10B981", bgColor: "bg-emerald-500" },
    { key: "lost", label: "Perdido", color: "#EF4444", bgColor: "bg-red-500" },
  ];

  useEffect(() => {
    fetchFunnelData();
  }, []);

  const fetchFunnelData = async () => {
    try {
      const { data, error } = await supabase
        .from("opportunities")
        .select("status, value, monthly_value");

      if (error) throw error;

      const stageData = stageConfig.map((stage) => {
        const stageOpps = data?.filter((opp) => opp.status === stage.key) || [];
        const totalValue = stageOpps.reduce(
          (sum, opp) => sum + (Number(opp.value) || Number(opp.monthly_value) || 0),
          0
        );
        return {
          ...stage,
          count: stageOpps.length,
          value: totalValue,
        };
      });

      setStages(stageData);
    } catch (error) {
      console.error("Erro ao carregar dados do funil:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}K`;
    }
    return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  };

  const pipelineStages = stages.filter((s) => s.key !== "won" && s.key !== "lost");
  const wonStage = stages.find((s) => s.key === "won");
  const lostStage = stages.find((s) => s.key === "lost");

  const totalPipeline = pipelineStages.reduce((sum, s) => sum + s.count, 0);
  const totalPipelineValue = pipelineStages.reduce((sum, s) => sum + s.value, 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Funil de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Funil de Vendas
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-6">
        {/* Funnel Container */}
        <div className="relative max-w-3xl mx-auto">
          {pipelineStages.map((stage, index) => {
            const totalStages = pipelineStages.length;
            // Width decreases from 100% to 30%
            const widthPercent = 100 - (index * 70) / (totalStages - 1);
            
            return (
              <div
                key={stage.key}
                className="flex items-center justify-center mb-1 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div
                  className="group relative h-11 flex items-center transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:z-10"
                  style={{ width: `${widthPercent}%` }}
                >
                  {/* Trapezoid Shape using SVG */}
                  <svg
                    className="absolute inset-0 w-full h-full drop-shadow-sm transition-all duration-300 group-hover:drop-shadow-lg"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <polygon
                      points="2,0 98,0 95,100 5,100"
                      fill={stage.color}
                      className="transition-all duration-300 group-hover:brightness-110"
                    />
                  </svg>
                  
                  {/* Glow effect on hover */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md -z-10"
                    style={{ backgroundColor: stage.color, transform: 'scale(1.05)' }}
                  />
                  
                  {/* Content */}
                  <div className="relative z-10 flex items-center justify-between w-full px-4">
                    <span className="font-medium text-white text-sm drop-shadow-sm group-hover:font-semibold transition-all duration-200">
                      {stage.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center group-hover:bg-white/40 group-hover:scale-110 transition-all duration-200">
                        {stage.count}
                      </span>
                      <span className="text-white/90 text-xs font-medium min-w-[60px] text-right group-hover:text-white transition-colors duration-200">
                        {formatCurrency(stage.value)}
                      </span>
                    </div>
                  </div>

                  {/* Tooltip on hover */}
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 translate-y-full opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 z-20">
                    <div className="bg-popover text-popover-foreground border shadow-xl rounded-lg px-4 py-3 text-sm whitespace-nowrap mt-2">
                      <p className="font-semibold text-foreground mb-2">{stage.label}</p>
                      <div className="space-y-1 text-xs">
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Quantidade:</span>
                          <span className="font-bold">{stage.count} oportunidades</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Valor total:</span>
                          <span className="font-bold text-primary">
                            R$ {stage.value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                          </span>
                        </p>
                        {stage.count > 0 && (
                          <p className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Ticket médio:</span>
                            <span className="font-medium">
                              R$ {Math.round(stage.value / stage.count).toLocaleString("pt-BR")}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Results Row */}
        <div className="grid grid-cols-2 gap-4 mt-6 max-w-xl mx-auto">
          {/* Won */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Trophy className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Ganhos</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-emerald-600">{wonStage?.count || 0}</span>
                <span className="text-sm text-emerald-600/80">{formatCurrency(wonStage?.value || 0)}</span>
              </div>
            </div>
          </div>

          {/* Lost */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-red-500/10 to-red-500/5 border border-red-500/20">
            <div className="p-2 rounded-lg bg-red-500/20">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Perdidos</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-red-600">{lostStage?.count || 0}</span>
                <span className="text-sm text-red-600/80">{formatCurrency(lostStage?.value || 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="flex items-center justify-center gap-8 mt-6 pt-6 border-t border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Total no Pipeline</p>
            <p className="text-2xl font-bold text-foreground">{totalPipeline}</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Valor Total</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalPipelineValue)}</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Taxa de Conversão</p>
            <p className="text-2xl font-bold text-emerald-600">
              {(() => {
                const totalClosed = (wonStage?.count || 0) + (lostStage?.count || 0);
                return totalClosed > 0
                  ? `${Math.round(((wonStage?.count || 0) / totalClosed) * 100)}%`
                  : "0%";
              })()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesFunnelChart;
