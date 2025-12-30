import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Users,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ReportAIAnalysisProps {
  reportData: {
    totalClients?: number;
    totalOpportunities?: number;
    wonOpportunities?: number;
    lostOpportunities?: number;
    totalValue?: number;
    conversionRate?: number;
    totalTasks?: number;
    completedTasks?: number;
    pendingTasks?: number;
    overdueTasks?: number;
    topProducts?: Array<{ name: string; quantity: number; value: number }>;
    sellersPerformance?: Array<{
      name: string;
      clients: number;
      opportunities: number;
      won: number;
      value: number;
      conversionRate: number;
    }>;
    startDate?: string;
    endDate?: string;
  };
  onAnalysisComplete?: (analysis: string) => void;
}

interface AnalysisSection {
  title: string;
  content: string;
  type: 'insight' | 'warning' | 'opportunity' | 'trend_up' | 'trend_down';
}

export function ReportAIAnalysis({ reportData, onAnalysisComplete }: ReportAIAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [sections, setSections] = useState<AnalysisSection[]>([]);
  const [copied, setCopied] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);

  const parseAnalysisToSections = (text: string): AnalysisSection[] => {
    const lines = text.split('\n');
    const sections: AnalysisSection[] = [];
    let currentSection: AnalysisSection | null = null;
    let currentContent: string[] = [];

    const getTypeFromTitle = (title: string): AnalysisSection['type'] => {
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('alerta') || lowerTitle.includes('atenção') || lowerTitle.includes('crítico')) {
        return 'warning';
      }
      if (lowerTitle.includes('oportunidade') || lowerTitle.includes('potencial')) {
        return 'opportunity';
      }
      if (lowerTitle.includes('crescimento') || lowerTitle.includes('aumento') || lowerTitle.includes('positivo')) {
        return 'trend_up';
      }
      if (lowerTitle.includes('queda') || lowerTitle.includes('redução') || lowerTitle.includes('negativo')) {
        return 'trend_down';
      }
      return 'insight';
    };

    for (const line of lines) {
      if (line.startsWith('##') || line.startsWith('# ')) {
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          sections.push(currentSection);
        }
        const title = line.replace(/^#+\s*/, '').trim();
        currentSection = {
          title,
          content: '',
          type: getTypeFromTitle(title),
        };
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(currentSection);
    }

    return sections;
  };

  const generateAnalysis = async () => {
    setLoading(true);
    try {
      const prompt = customPrompt || buildDefaultPrompt();

      const response = await supabase.functions.invoke('analyze-prospect', {
        body: {
          customPrompt: true,
          prompt: prompt,
          systemPrompt: `Você é um Especialista em Análise de Dados Comerciais com expertise em:
- Análise de performance de vendas
- Identificação de tendências e padrões
- Recomendações estratégicas baseadas em dados
- Benchmarking e comparação de desempenho

Formate sua resposta em seções claras usando markdown com títulos ##.
Seja específico, use números e percentuais quando disponíveis.
Dê recomendações práticas e acionáveis.`,
        },
      });

      if (response.error) throw response.error;

      const analysisText = response.data?.analysis || response.data?.message || "";
      setAnalysis(analysisText);
      setSections(parseAnalysisToSections(analysisText));
      onAnalysisComplete?.(analysisText);
    } catch (error: any) {
      console.error("Error generating analysis:", error);
      toast.error("Erro ao gerar análise: " + (error.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const buildDefaultPrompt = () => {
    const { 
      totalClients, totalOpportunities, wonOpportunities, lostOpportunities,
      totalValue, conversionRate, totalTasks, completedTasks, pendingTasks,
      overdueTasks, topProducts, sellersPerformance, startDate, endDate 
    } = reportData;

    return `Analise os seguintes dados comerciais do período ${startDate} a ${endDate}:

## Métricas de Vendas
- Total de Clientes: ${totalClients || 0}
- Total de Oportunidades: ${totalOpportunities || 0}
- Oportunidades Ganhas: ${wonOpportunities || 0}
- Oportunidades Perdidas: ${lostOpportunities || 0}
- Valor Total Vendido: R$ ${(totalValue || 0).toLocaleString('pt-BR')}
- Taxa de Conversão: ${(conversionRate || 0).toFixed(1)}%

## Métricas de Tarefas
- Total de Tarefas: ${totalTasks || 0}
- Concluídas: ${completedTasks || 0}
- Pendentes: ${pendingTasks || 0}
- Atrasadas: ${overdueTasks || 0}

${topProducts && topProducts.length > 0 ? `## Top Produtos
${topProducts.map((p, i) => `${i + 1}. ${p.name}: ${p.quantity} vendas, R$ ${p.value.toLocaleString('pt-BR')}`).join('\n')}` : ''}

${sellersPerformance && sellersPerformance.length > 0 ? `## Performance da Equipe
${sellersPerformance.map(s => `- ${s.name}: ${s.won} vendas, R$ ${s.value.toLocaleString('pt-BR')}, ${s.conversionRate.toFixed(1)}% conversão`).join('\n')}` : ''}

Por favor, forneça:
1. **Resumo Executivo**: Visão geral do desempenho
2. **Pontos Fortes**: O que está funcionando bem
3. **Pontos de Atenção**: Áreas que precisam de melhoria
4. **Oportunidades**: Potenciais de crescimento identificados
5. **Recomendações**: Ações práticas sugeridas
6. **Metas Sugeridas**: Objetivos para o próximo período`;
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Análise copiada!");
  };

  const getIconForType = (type: AnalysisSection['type']) => {
    switch (type) {
      case 'warning': return AlertTriangle;
      case 'opportunity': return Target;
      case 'trend_up': return TrendingUp;
      case 'trend_down': return TrendingDown;
      default: return Lightbulb;
    }
  };

  const getColorForType = (type: AnalysisSection['type']) => {
    switch (type) {
      case 'warning': return 'text-destructive';
      case 'opportunity': return 'text-primary';
      case 'trend_up': return 'text-success';
      case 'trend_down': return 'text-warning';
      default: return 'text-info';
    }
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise Inteligente com IA
          </CardTitle>
          <div className="flex gap-2">
            {analysis && (
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            )}
            <Button
              onClick={generateAnalysis}
              disabled={loading}
              size="sm"
              className="bg-gradient-to-r from-primary to-primary-light"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : analysis ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reanalisar
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Análise
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Custom Prompt Toggle */}
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCustomPrompt(!showCustomPrompt)}
            className="text-muted-foreground"
          >
            <Lightbulb className="h-4 w-4 mr-2" />
            {showCustomPrompt ? 'Ocultar prompt personalizado' : 'Personalizar análise'}
          </Button>
          
          {showCustomPrompt && (
            <div className="mt-3 space-y-2">
              <Label htmlFor="custom-prompt">Prompt personalizado (opcional)</Label>
              <Textarea
                id="custom-prompt"
                placeholder="Ex: Foque na análise de conversão por vendedor e sugira treinamentos específicos..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para usar a análise padrão
              </p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Analisando dados do relatório...</p>
          </div>
        ) : sections.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <Accordion type="multiple" defaultValue={sections.map((_, i) => `section-${i}`)} className="space-y-2">
              {sections.map((section, index) => {
                const Icon = getIconForType(section.type);
                const colorClass = getColorForType(section.type);
                
                return (
                  <AccordionItem key={index} value={`section-${index}`} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${colorClass}`} />
                        <span className="font-medium">{section.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="prose prose-sm max-w-none dark:prose-invert pl-8">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {section.content}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </ScrollArea>
        ) : analysis ? (
          <ScrollArea className="h-[400px]">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {analysis}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
            <div className="p-4 rounded-full bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Análise Inteligente</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Clique em "Gerar Análise" para obter insights, tendências e recomendações 
                baseadas nos dados do seu relatório.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              <Badge variant="outline" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                Tendências
              </Badge>
              <Badge variant="outline" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Alertas
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Target className="h-3 w-3 mr-1" />
                Oportunidades
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Lightbulb className="h-3 w-3 mr-1" />
                Recomendações
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
