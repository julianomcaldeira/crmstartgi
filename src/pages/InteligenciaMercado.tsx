import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Search,
  TrendingUp,
  Users,
  FileText,
  Sparkles,
  Loader2,
  Building2,
  DollarSign,
  Calendar,
  ExternalLink,
  Plus,
  X,
  Brain,
  Target,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  History,
  Save,
  Trash2,
  Link as LinkIcon,
  MapPin,
  Lightbulb,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MarketData {
  totalValue12Months: number;
  totalValue24Months: number;
  totalQuantity12Months: number;
  totalQuantity24Months: number;
  competitors: Array<{
    name: string;
    cnpj: string;
    totalValue: number;
    contractCount: number;
    period: string;
  }>;
  sampleContracts: Array<{
    title: string;
    value: number;
    date: string;
    organ: string;
    link: string;
    pncpLink?: string;
  }>;
  quickApproach?: string;
}

const BRAZILIAN_STATES = [
  { value: "", label: "Todos os estados" },
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
];


interface SavedSearch {
  id: string;
  search_terms: string[];
  total_value_12m: number | null;
  total_value_24m: number | null;
  total_quantity_12m: number | null;
  total_quantity_24m: number | null;
  competitors: any;
  sample_contracts: any;
  ai_analysis: string | null;
  created_at: string;
}

interface AnalysisSection {
  title: string;
  content: string;
  icon: React.ElementType;
  type: 'summary' | 'opportunity' | 'competition' | 'strategy' | 'warning' | 'action';
}

const InteligenciaMercado = () => {
  const queryClient = useQueryClient();
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [currentTerm, setCurrentTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [parsedSections, setParsedSections] = useState<AnalysisSection[]>([]);
  const [selectedState, setSelectedState] = useState("");
  
  const [showHistory, setShowHistory] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Fetch saved searches
  const { data: savedSearches = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['market-intelligence-searches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_intelligence_searches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as SavedSearch[];
    },
    enabled: !!currentUserId,
  });

  // Save search mutation
  const saveSearchMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId || !marketData) throw new Error('Dados incompletos');
      
      const { error } = await supabase
        .from('market_intelligence_searches')
        .insert({
          user_id: currentUserId,
          search_terms: searchTerms,
          total_value_12m: marketData.totalValue12Months,
          total_value_24m: marketData.totalValue24Months,
          total_quantity_12m: marketData.totalQuantity12Months,
          total_quantity_24m: marketData.totalQuantity24Months,
          competitors: marketData.competitors,
          sample_contracts: marketData.sampleContracts,
          ai_analysis: aiAnalysis,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-intelligence-searches'] });
      toast.success('Pesquisa salva com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao salvar pesquisa:', error);
      toast.error('Erro ao salvar pesquisa');
    },
  });

  // Delete search mutation
  const deleteSearchMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('market_intelligence_searches')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-intelligence-searches'] });
      toast.success('Pesquisa excluída');
    },
    onError: () => {
      toast.error('Erro ao excluir pesquisa');
    },
  });

  const loadSavedSearch = (search: SavedSearch) => {
    setSearchTerms(search.search_terms || []);
    setMarketData({
      totalValue12Months: search.total_value_12m || 0,
      totalValue24Months: search.total_value_24m || 0,
      totalQuantity12Months: search.total_quantity_12m || 0,
      totalQuantity24Months: search.total_quantity_24m || 0,
      competitors: search.competitors || [],
      sampleContracts: search.sample_contracts || [],
    });
    setAiAnalysis(search.ai_analysis);
    if (search.ai_analysis) {
      const sections = parseAnalysisToSections(search.ai_analysis);
      setParsedSections(sections);
    }
    setShowHistory(false);
    toast.success('Pesquisa carregada');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("pt-BR");
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleString("pt-BR", {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const addSearchTerm = () => {
    const term = currentTerm.trim();
    if (term && !searchTerms.includes(term)) {
      setSearchTerms([...searchTerms, term]);
      setCurrentTerm("");
    }
  };

  const removeSearchTerm = (term: string) => {
    setSearchTerms(searchTerms.filter((t) => t !== term));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSearchTerm();
    }
  };

  const parseAnalysisToSections = (text: string): AnalysisSection[] => {
    const sections: AnalysisSection[] = [];
    
    const sectionPatterns = [
      { regex: /##\s*📊\s*RESUMO DO MERCADO\s*\n([\s\S]*?)(?=##|$)/i, type: 'summary' as const, icon: BarChart3, title: 'Resumo do Mercado' },
      { regex: /##\s*💰\s*OPORTUNIDADE DE NEGÓCIO\s*\n([\s\S]*?)(?=##|$)/i, type: 'opportunity' as const, icon: DollarSign, title: 'Oportunidade de Negócio' },
      { regex: /##\s*🏆\s*ANÁLISE DA CONCORRÊNCIA\s*\n([\s\S]*?)(?=##|$)/i, type: 'competition' as const, icon: Users, title: 'Análise da Concorrência' },
      { regex: /##\s*🎯\s*ESTRATÉGIA DE ABORDAGEM\s*\n([\s\S]*?)(?=##|$)/i, type: 'strategy' as const, icon: Target, title: 'Estratégia de Abordagem' },
      { regex: /##\s*⚠️\s*PONTOS DE ATENÇÃO\s*\n([\s\S]*?)(?=##|$)/i, type: 'warning' as const, icon: AlertTriangle, title: 'Pontos de Atenção' },
      { regex: /##\s*✅\s*PRÓXIMOS PASSOS RECOMENDADOS\s*\n([\s\S]*?)(?=##|$)/i, type: 'action' as const, icon: CheckCircle2, title: 'Próximos Passos' },
    ];

    for (const pattern of sectionPatterns) {
      const match = text.match(pattern.regex);
      if (match && match[1]) {
        sections.push({
          title: pattern.title,
          content: match[1].trim(),
          icon: pattern.icon,
          type: pattern.type,
        });
      }
    }

    return sections;
  };

  const getSectionColor = (type: AnalysisSection['type']) => {
    switch (type) {
      case 'summary': return 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300';
      case 'opportunity': return 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300';
      case 'competition': return 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300';
      case 'strategy': return 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300';
      case 'action': return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300';
      default: return 'bg-muted';
    }
  };

  const generateQuickApproach = (data: MarketData): string => {
    const avgTicket = data.totalQuantity12Months > 0 
      ? data.totalValue12Months / data.totalQuantity12Months 
      : 0;
    
    const topCompetitor = data.competitors[0];
    const hasHighValue = data.totalValue12Months > 1000000;
    const hasCompetitors = data.competitors.length > 0;
    
    let approach = "";
    
    if (hasHighValue && hasCompetitors) {
      approach = `O mercado movimenta ${formatCurrency(data.totalValue12Months)} anuais com ticket médio de ${formatCurrency(avgTicket)}. `;
      approach += `O líder "${topCompetitor?.name}" possui ${topCompetitor?.contractCount} contratos. `;
      approach += `Estratégia: Foque em diferenciação por qualidade de atendimento, prazo de entrega e suporte técnico. `;
      approach += `Considere participar de pregões como segunda opção para ganhar experiência e referências no setor público.`;
    } else if (hasHighValue) {
      approach = `Mercado com potencial de ${formatCurrency(data.totalValue12Months)} anuais. `;
      approach += `Poucos concorrentes identificados indica oportunidade de entrada. `;
      approach += `Estratégia: Apresente-se como especialista, destaque cases de sucesso e ofereça condições competitivas para primeiros contratos.`;
    } else if (data.totalQuantity12Months > 0) {
      approach = `Mercado fragmentado com ${data.totalQuantity12Months} contratos no último ano. `;
      approach += `Estratégia: Foque em nichos específicos, construa relacionamento com compradores-chave e participe ativamente de pregões.`;
    } else {
      approach = `Dados limitados para este segmento. `;
      approach += `Estratégia: Realize contatos diretos com órgãos públicos, participe de eventos do setor e monitore novos editais.`;
    }
    
    return approach;
  };

  const searchMarketData = async () => {
    if (searchTerms.length === 0) {
      toast.error("Adicione pelo menos um produto ou serviço para pesquisar");
      return;
    }

    setLoading(true);
    setMarketData(null);
    setAiAnalysis(null);
    setParsedSections([]);

    try {
      // Buscar dados do PNCP com filtros
      const { data, error } = await supabase.functions.invoke("pncp-market-intelligence", {
        body: { 
          searchTerms,
          filters: {
            state: selectedState,
          }
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.success && data?.data) {
        const dataWithApproach = {
          ...data.data,
          quickApproach: generateQuickApproach(data.data),
        };
        setMarketData(dataWithApproach);
        toast.success("Dados de mercado carregados com sucesso!");
      } else {
        toast.error("Nenhum dado encontrado para os termos pesquisados");
      }
    } catch (error: any) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro ao buscar dados do mercado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const generateAIAnalysis = async () => {
    if (!marketData) {
      toast.error("Primeiro busque os dados de mercado");
      return;
    }

    setAnalyzingAI(true);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-market-intelligence", {
        body: { marketData, searchTerms },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.success && data?.analysis) {
        setAiAnalysis(data.analysis);
        const sections = parseAnalysisToSections(data.analysis);
        setParsedSections(sections);
        toast.success("Análise de IA gerada com sucesso!");
      }
    } catch (error: any) {
      console.error("Erro ao gerar análise:", error);
      toast.error("Erro ao gerar análise de IA. Tente novamente.");
    } finally {
      setAnalyzingAI(false);
    }
  };

  const renderMarkdown = (text: string) => {
    // Simple markdown rendering
    return text
      .split('\n')
      .map((line, i) => {
        // Bold
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic
        line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Lists
        if (line.startsWith('- ')) {
          return `<li class="ml-4">${line.substring(2)}</li>`;
        }
        if (/^\d+\.\s/.test(line)) {
          return `<li class="ml-4 list-decimal">${line.replace(/^\d+\.\s/, '')}</li>`;
        }
        return line ? `<p class="mb-2">${line}</p>` : '<br/>';
      })
      .join('');
  };

  const exportToPDF = () => {
    if (!marketData) {
      toast.error("Nenhum dado disponível para exportar");
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 20;

      // Header
      doc.setFontSize(20);
      doc.setTextColor(33, 37, 41);
      doc.text("Análise de Inteligência de Mercado", pageWidth / 2, yPos, { align: "center" });
      yPos += 10;

      // Date
      doc.setFontSize(10);
      doc.setTextColor(108, 117, 125);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 15;

      // Search terms
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);
      doc.text("Termos pesquisados:", 14, yPos);
      yPos += 7;
      doc.setFontSize(10);
      doc.text(searchTerms.join(", "), 14, yPos);
      yPos += 15;

      // Summary Section
      doc.setFontSize(14);
      doc.setTextColor(25, 135, 84);
      doc.text("Resumo do Mercado", 14, yPos);
      yPos += 10;

      // Summary Table
      autoTable(doc, {
        startY: yPos,
        head: [["Métrica", "Últimos 12 meses", "Últimos 24 meses"]],
        body: [
          ["Valor Total", formatCurrency(marketData.totalValue12Months), formatCurrency(marketData.totalValue24Months)],
          ["Qtd. Contratos", marketData.totalQuantity12Months.toString(), marketData.totalQuantity24Months.toString()],
          ["Ticket Médio", 
            marketData.totalQuantity12Months > 0 
              ? formatCurrency(marketData.totalValue12Months / marketData.totalQuantity12Months) 
              : "—",
            marketData.totalQuantity24Months > 0 
              ? formatCurrency(marketData.totalValue24Months / marketData.totalQuantity24Months) 
              : "—"
          ],
        ],
        theme: "striped",
        headStyles: { fillColor: [25, 135, 84] },
        margin: { left: 14, right: 14 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;

      // Quick Approach
      if (marketData.quickApproach) {
        doc.setFontSize(14);
        doc.setTextColor(255, 193, 7);
        doc.text("Abordagem Recomendada", 14, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        doc.setTextColor(33, 37, 41);
        const approachLines = doc.splitTextToSize(marketData.quickApproach, pageWidth - 28);
        doc.text(approachLines, 14, yPos);
        yPos += approachLines.length * 5 + 10;
      }

      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Competitors Section
      if (marketData.competitors.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(111, 66, 193);
        doc.text("Principais Concorrentes", 14, yPos);
        yPos += 10;

        autoTable(doc, {
          startY: yPos,
          head: [["Empresa", "CNPJ", "Valor Total", "Contratos"]],
          body: marketData.competitors.slice(0, 10).map((comp) => [
            comp.name.substring(0, 40),
            comp.cnpj,
            formatCurrency(comp.totalValue),
            comp.contractCount.toString(),
          ]),
          theme: "striped",
          headStyles: { fillColor: [111, 66, 193] },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 40 },
            2: { cellWidth: 45 },
            3: { cellWidth: 25 },
          },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Sample Contracts Section
      if (marketData.sampleContracts.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(13, 110, 253);
        doc.text("Contratos/Editais de Exemplo", 14, yPos);
        yPos += 10;

        autoTable(doc, {
          startY: yPos,
          head: [["Descrição", "Órgão", "Valor", "Data"]],
          body: marketData.sampleContracts.slice(0, 10).map((contract) => [
            contract.title.substring(0, 50) + (contract.title.length > 50 ? "..." : ""),
            contract.organ.substring(0, 30) + (contract.organ.length > 30 ? "..." : ""),
            formatCurrency(contract.value),
            formatDate(contract.date),
          ]),
          theme: "striped",
          headStyles: { fillColor: [13, 110, 253] },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 55 },
            1: { cellWidth: 50 },
            2: { cellWidth: 40 },
            3: { cellWidth: 25 },
          },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // AI Analysis Section
      if (aiAnalysis) {
        doc.addPage();
        yPos = 20;

        doc.setFontSize(14);
        doc.setTextColor(220, 53, 69);
        doc.text("Análise de IA", 14, yPos);
        yPos += 10;

        // Clean markdown and format for PDF
        const cleanText = aiAnalysis
          .replace(/##\s*[📊💰🏆🎯⚠️✅]\s*/g, "\n")
          .replace(/\*\*/g, "")
          .replace(/\*/g, "")
          .replace(/#{1,3}\s*/g, "");

        doc.setFontSize(10);
        doc.setTextColor(33, 37, 41);
        
        const analysisLines = doc.splitTextToSize(cleanText, pageWidth - 28);
        
        // Split into chunks to handle page breaks
        let currentY = yPos;
        for (const line of analysisLines) {
          if (currentY > 280) {
            doc.addPage();
            currentY = 20;
          }
          doc.text(line, 14, currentY);
          currentY += 5;
        }
      }

      // Footer on all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(108, 117, 125);
        doc.text(
          `Página ${i} de ${pageCount} | Evolua CRM - Inteligência de Mercado`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }

      // Download
      const fileName = `inteligencia-mercado-${searchTerms.join("-").substring(0, 30)}-${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            Inteligência de Mercado
          </h1>
          <p className="text-muted-foreground mt-1">
            Analise dados de compras governamentais e identifique oportunidades de vendas
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowHistory(!showHistory)}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            Histórico
            {savedSearches.length > 0 && (
              <Badge variant="secondary" className="ml-1">{savedSearches.length}</Badge>
            )}
          </Button>
          {marketData && (
            <>
              <Button
                variant="outline"
                onClick={exportToPDF}
                className="gap-2"
              >
                <FileDown className="h-4 w-4" />
                Exportar PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => saveSearchMutation.mutate()}
                disabled={saveSearchMutation.isPending}
                className="gap-2"
              >
                {saveSearchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar Pesquisa
              </Button>
            </>
          )}
        </div>
      </div>

      {/* History Section */}
      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Pesquisas Salvas
            </CardTitle>
            <CardDescription>
              Consulte e carregue pesquisas anteriores
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : savedSearches.length > 0 ? (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {savedSearches.map((search) => (
                    <div
                      key={search.id}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1 mb-2">
                            {search.search_terms?.map((term, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {term}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {formatCurrency(search.total_value_12m || 0)} (12m)
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {(search.competitors as any[])?.length || 0} concorrentes
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDateTime(search.created_at)}
                            </span>
                            {search.ai_analysis && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Sparkles className="h-3 w-3" />
                                Com IA
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadSavedSearch(search)}
                          >
                            Carregar
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir pesquisa?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteSearchMutation.mutate(search.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma pesquisa salva ainda
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Pesquisar Produtos/Serviços
          </CardTitle>
          <CardDescription>
            Digite os produtos ou serviços que você quer analisar no mercado governamental
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Ex: software de gestão, consultoria em TI, equipamentos de informática..."
              value={currentTerm}
              onChange={(e) => setCurrentTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button onClick={addSearchTerm} variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {searchTerms.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {searchTerms.map((term) => (
                <Badge key={term} variant="secondary" className="px-3 py-1 text-sm">
                  {term}
                  <button
                    onClick={() => removeSearchTerm(term)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Estado/Região
              </label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Todos os estados" />
                </SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value || "all"}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={searchMarketData}
              disabled={loading || searchTerms.length === 0}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Buscando dados...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar Dados do PNCP
                </>
              )}
            </Button>

            {marketData && (
              <Button
                onClick={generateAIAnalysis}
                disabled={analyzingAI}
                variant="default"
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {analyzingAI ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Gerar Análise com IA
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Approach Card */}
      {marketData?.quickApproach && (
        <Card className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border-amber-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Resumo Rápido de Abordagem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{marketData.quickApproach}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30">
                <Target className="h-3 w-3 mr-1" />
                Prospecção Ativa
              </Badge>
              {marketData.totalValue12Months > 1000000 && (
                <Badge variant="outline" className="bg-green-500/10 border-green-500/30">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Alto Potencial
                </Badge>
              )}
              {marketData.competitors.length > 5 && (
                <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30">
                  <Users className="h-3 w-3 mr-1" />
                  Mercado Competitivo
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {marketData && (
        <div className="grid gap-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                  Valor (12 meses)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(marketData.totalValue12Months)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {marketData.totalQuantity12Months} contratos
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Valor (24 meses)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(marketData.totalValue24Months)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {marketData.totalQuantity24Months} contratos
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  Concorrentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {marketData.competitors.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  empresas identificadas
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-500" />
                  Editais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {marketData.sampleContracts.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  exemplos disponíveis
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for detailed data and AI analysis */}
          <Tabs defaultValue="data" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="data">
                <BarChart3 className="h-4 w-4 mr-2" />
                Dados de Mercado
              </TabsTrigger>
              <TabsTrigger value="competitors">
                <Users className="h-4 w-4 mr-2" />
                Concorrentes
              </TabsTrigger>
              <TabsTrigger value="ai" disabled={!aiAnalysis}>
                <Sparkles className="h-4 w-4 mr-2" />
                Análise IA
              </TabsTrigger>
            </TabsList>

            <TabsContent value="data" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Exemplos de Editais e Contratos</CardTitle>
                  <CardDescription>
                    Contratos e licitações encontrados para os termos pesquisados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {marketData.sampleContracts.length > 0 ? (
                    <div className="space-y-4">
                      {marketData.sampleContracts.map((contract, index) => (
                        <div
                          key={index}
                          className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm line-clamp-2">
                                {contract.title}
                              </h4>
                              <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {contract.organ}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(contract.date)}
                                </span>
                                <span className="flex items-center gap-1 font-medium text-foreground">
                                  <DollarSign className="h-3 w-3" />
                                  {formatCurrency(contract.value)}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                              >
                                <a
                                  href={contract.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Baixar documento do edital"
                                >
                                  <FileText className="h-4 w-4 mr-1" />
                                  Documento
                                </a>
                              </Button>
                              {contract.pncpLink && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                >
                                  <a
                                    href={contract.pncpLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Ver no portal PNCP"
                                  >
                                    <LinkIcon className="h-4 w-4 mr-1" />
                                    PNCP
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhum edital encontrado para os termos pesquisados
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="competitors" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Concorrentes Identificados</CardTitle>
                  <CardDescription>
                    Empresas que vendem produtos/serviços similares para o governo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {marketData.competitors.length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {marketData.competitors.map((competitor, index) => (
                          <div
                            key={index}
                            className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    #{index + 1}
                                  </Badge>
                                  <h4 className="font-medium">{competitor.name}</h4>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  CNPJ: {competitor.cnpj}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg">
                                  {formatCurrency(competitor.totalValue)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {competitor.period}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhum concorrente identificado
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai" className="mt-4">
              {aiAnalysis && parsedSections.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      Análise Estratégica por IA
                    </CardTitle>
                    <CardDescription>
                      Insights e recomendações baseados nos dados de mercado
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="multiple" defaultValue={parsedSections.map((_, i) => `section-${i}`)} className="space-y-3">
                      {parsedSections.map((section, index) => {
                        const Icon = section.icon;
                        return (
                          <AccordionItem
                            key={index}
                            value={`section-${index}`}
                            className={`border rounded-lg px-4 ${getSectionColor(section.type)}`}
                          >
                            <AccordionTrigger className="hover:no-underline py-4">
                              <div className="flex items-center gap-3">
                                <Icon className="h-5 w-5" />
                                <span className="font-semibold">{section.title}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 pb-4">
                              <div
                                className="prose prose-sm dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(section.content) }}
                              />
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      Clique em "Gerar Análise com IA" para obter insights estratégicos
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Empty State */}
      {!marketData && !loading && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Brain className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">
              Descubra Oportunidades de Mercado
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Adicione produtos ou serviços acima para analisar dados de compras
              governamentais e identificar oportunidades de vendas no setor público.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InteligenciaMercado;
