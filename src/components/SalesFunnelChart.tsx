import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface FunnelStage {
  key: string;
  label: string;
  color: string;
  count: number;
  value: number;
}

const SalesFunnelChart = () => {
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);

  const stageConfig = [
    { key: "lead", label: "Lead", color: "from-blue-400 to-blue-500" },
    { key: "contacted", label: "Contactado", color: "from-cyan-400 to-cyan-500" },
    { key: "qualified", label: "Qualificado", color: "from-indigo-400 to-indigo-500" },
    { key: "apresentacao", label: "Apresentação", color: "from-violet-400 to-violet-500" },
    { key: "proposal", label: "Proposta", color: "from-purple-400 to-purple-500" },
    { key: "negotiation", label: "Negociação", color: "from-amber-400 to-amber-500" },
    { key: "won", label: "Ganho", color: "from-emerald-400 to-emerald-500" },
    { key: "lost", label: "Perdido", color: "from-red-400 to-red-500" },
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

  // Filter out won and lost for funnel view (they are results, not pipeline stages)
  const pipelineStages = stages.filter(
    (s) => s.key !== "won" && s.key !== "lost"
  );
  const resultStages = stages.filter(
    (s) => s.key === "won" || s.key === "lost"
  );

  // Calculate max count for scaling
  const maxCount = Math.max(...pipelineStages.map((s) => s.count), 1);

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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Funil de Vendas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Funnel Visualization */}
        <div className="flex flex-col items-center space-y-1 py-4">
          {pipelineStages.map((stage, index) => {
            // Calculate width percentage based on funnel shape (wider at top, narrower at bottom)
            const baseWidth = 100 - index * (60 / pipelineStages.length);
            // Adjust slightly by count to show relative volumes
            const countFactor = stage.count > 0 ? 0.9 + (stage.count / maxCount) * 0.1 : 0.9;
            const width = Math.max(baseWidth * countFactor, 20);

            return (
              <div
                key={stage.key}
                className="relative group transition-all duration-300 hover:scale-105"
                style={{ width: `${width}%` }}
              >
                {/* Funnel segment */}
                <div
                  className={`relative h-12 bg-gradient-to-r ${stage.color} rounded-sm shadow-md flex items-center justify-center cursor-default`}
                  style={{
                    clipPath:
                      index === pipelineStages.length - 1
                        ? "polygon(5% 0%, 95% 0%, 100% 100%, 0% 100%)"
                        : "polygon(0% 0%, 100% 0%, 95% 100%, 5% 100%)",
                  }}
                >
                  {/* Content */}
                  <div className="flex items-center justify-between w-full px-4 text-white">
                    <span className="font-medium text-sm truncate">{stage.label}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="bg-white/20 px-2 py-0.5 rounded font-bold">
                        {stage.count}
                      </span>
                      <span className="font-medium hidden sm:inline">
                        {formatCurrency(stage.value)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tooltip on hover */}
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 opacity-0 group-hover:opacity-100 group-hover:translate-y-full transition-all duration-200 z-10 pointer-events-none">
                  <div className="bg-popover text-popover-foreground border shadow-lg rounded-lg px-3 py-2 text-xs whitespace-nowrap mt-2">
                    <p className="font-semibold">{stage.label}</p>
                    <p>
                      <span className="text-muted-foreground">Quantidade:</span>{" "}
                      <span className="font-medium">{stage.count}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Valor:</span>{" "}
                      <span className="font-medium">
                        R$ {stage.value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Results section (Won/Lost) */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
          {resultStages.map((stage) => (
            <div
              key={stage.key}
              className={`p-3 rounded-lg bg-gradient-to-br ${
                stage.key === "won"
                  ? "from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20"
                  : "from-red-500/10 to-red-500/5 border border-red-500/20"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-sm font-medium ${
                    stage.key === "won" ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {stage.label}
                </span>
                <span
                  className={`text-lg font-bold ${
                    stage.key === "won" ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {stage.count}
                </span>
              </div>
              <p
                className={`text-xs ${
                  stage.key === "won" ? "text-emerald-600/80" : "text-red-600/80"
                }`}
              >
                {formatCurrency(stage.value)}
              </p>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Total Pipeline</p>
              <p className="text-lg font-bold text-primary">
                {pipelineStages.reduce((sum, s) => sum + s.count, 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor Pipeline</p>
              <p className="text-lg font-bold text-primary">
                {formatCurrency(pipelineStages.reduce((sum, s) => sum + s.value, 0))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Taxa Conversão</p>
              <p className="text-lg font-bold text-emerald-600">
                {(() => {
                  const totalClosed = resultStages.reduce((sum, s) => sum + s.count, 0);
                  const won = resultStages.find((s) => s.key === "won")?.count || 0;
                  return totalClosed > 0
                    ? `${Math.round((won / totalClosed) * 100)}%`
                    : "0%";
                })()}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesFunnelChart;
