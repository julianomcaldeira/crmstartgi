import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sparkles, Loader2, RefreshCw, History, Trash2, Calendar, Target, TrendingUp, AlertTriangle, CheckCircle2, Lightbulb, Users, GitCompare, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AIAnalysis {
  id: string;
  analysis: string;
  opportunities_count: number;
  tasks_count: number;
  contacts_count: number;
  created_at: string;
  created_by: string;
  profiles?: { full_name: string };
}

interface AIAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  opportunities: any[];
  tasks: any[];
  contacts: any[];
}

interface AnalysisSection {
  title: string;
  content: string;
  icon: React.ReactNode;
  priority: 'high' | 'medium' | 'low';
}

const AIAnalysisDialog = ({
  open,
  onOpenChange,
  client,
  opportunities,
  tasks,
  contacts,
}: AIAnalysisDialogProps) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<AIAnalysis[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<AIAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState("new");
  const [compareLeft, setCompareLeft] = useState<AIAnalysis | null>(null);
  const [compareRight, setCompareRight] = useState<AIAnalysis | null>(null);
  const [selectingFor, setSelectingFor] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    if (open && client?.id) {
      fetchAnalysisHistory();
    }
  }, [open, client?.id]);

  const fetchAnalysisHistory = async () => {
    if (!client?.id) return;
    
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("prospect_ai_analyses")
        .select(`
          *,
          profiles:created_by(full_name)
        `)
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAnalysisHistory(data || []);
    } catch (error) {
      console.error("Error fetching analysis history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setAnalysis(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado para usar esta funcionalidade.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("analyze-prospect", {
        body: { client, opportunities, tasks, contacts },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const analysisText = data.analysis;
      setAnalysis(analysisText);

      // Save to history
      const { error: saveError } = await supabase
        .from("prospect_ai_analyses")
        .insert({
          client_id: client.id,
          analysis: analysisText,
          opportunities_count: opportunities.length,
          tasks_count: tasks.length,
          contacts_count: contacts.length,
          created_by: user.id,
        });

      if (saveError) {
        console.error("Error saving analysis:", saveError);
        toast.error("Análise gerada, mas não foi possível salvar no histórico.");
      } else {
        toast.success("Análise gerada e salva no histórico!");
        fetchAnalysisHistory();
      }
    } catch (error: any) {
      console.error("Error analyzing prospect:", error);
      toast.error("Erro ao analisar prospect. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnalysis = async (analysisId: string) => {
    try {
      const { error } = await supabase
        .from("prospect_ai_analyses")
        .delete()
        .eq("id", analysisId);

      if (error) throw error;

      toast.success("Análise excluída!");
      setAnalysisHistory(prev => prev.filter(a => a.id !== analysisId));
      if (selectedHistoryItem?.id === analysisId) {
        setSelectedHistoryItem(null);
      }
    } catch (error) {
      console.error("Error deleting analysis:", error);
      toast.error("Erro ao excluir análise.");
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setAnalysis(null);
      setSelectedHistoryItem(null);
      setActiveTab("new");
      setCompareLeft(null);
      setCompareRight(null);
      setSelectingFor(null);
    }
  };

  const handleSelectForCompare = (item: AIAnalysis) => {
    if (selectingFor === 'left') {
      setCompareLeft(item);
      if (!compareRight) {
        setSelectingFor('right');
      } else {
        setSelectingFor(null);
      }
    } else if (selectingFor === 'right') {
      setCompareRight(item);
      setSelectingFor(null);
    }
  };

  const startCompareMode = () => {
    setCompareLeft(null);
    setCompareRight(null);
    setSelectingFor('left');
    setActiveTab('compare');
  };

  // Get icon for section based on keywords
  const getSectionIcon = (title: string): React.ReactNode => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('próximo') || lowerTitle.includes('ação') || lowerTitle.includes('passo')) {
      return <Target className="h-4 w-4" />;
    }
    if (lowerTitle.includes('oportunidade') || lowerTitle.includes('potencial')) {
      return <TrendingUp className="h-4 w-4" />;
    }
    if (lowerTitle.includes('risco') || lowerTitle.includes('atenção') || lowerTitle.includes('cuidado')) {
      return <AlertTriangle className="h-4 w-4" />;
    }
    if (lowerTitle.includes('conclus') || lowerTitle.includes('resumo') || lowerTitle.includes('síntese')) {
      return <CheckCircle2 className="h-4 w-4" />;
    }
    if (lowerTitle.includes('dica') || lowerTitle.includes('sugestão') || lowerTitle.includes('recomenda')) {
      return <Lightbulb className="h-4 w-4" />;
    }
    if (lowerTitle.includes('contato') || lowerTitle.includes('relacionamento')) {
      return <Users className="h-4 w-4" />;
    }
    return <Sparkles className="h-4 w-4" />;
  };

  // Get priority color based on keywords
  const getSectionPriority = (title: string): 'high' | 'medium' | 'low' => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('urgente') || lowerTitle.includes('crítico') || lowerTitle.includes('risco')) {
      return 'high';
    }
    if (lowerTitle.includes('importante') || lowerTitle.includes('próximo') || lowerTitle.includes('ação')) {
      return 'medium';
    }
    return 'low';
  };

  // Parse analysis text into collapsible sections
  const parseAnalysisIntoSections = (text: string): AnalysisSection[] => {
    const sections: AnalysisSection[] = [];
    
    // Clean up the text - remove horizontal rules
    let cleanText = text.replace(/^---+$/gm, '').trim();
    
    // Split by main headers (## or #)
    const headerRegex = /^(#{1,2})\s+(.+)$/gm;
    let lastIndex = 0;
    let matches: RegExpExecArray | null;
    const allMatches: { index: number; title: string; level: number }[] = [];
    
    while ((matches = headerRegex.exec(cleanText)) !== null) {
      allMatches.push({
        index: matches.index,
        title: matches[2].trim(),
        level: matches[1].length
      });
    }
    
    // If no headers found, return single section with full content
    if (allMatches.length === 0) {
      return [{
        title: "Análise Completa",
        content: cleanText,
        icon: <Sparkles className="h-4 w-4" />,
        priority: 'medium'
      }];
    }
    
    // Check if there's content before the first header
    if (allMatches.length > 0 && allMatches[0].index > 0) {
      const introContent = cleanText.substring(0, allMatches[0].index).trim();
      if (introContent) {
        sections.push({
          title: "Visão Geral",
          content: introContent,
          icon: <Sparkles className="h-4 w-4" />,
          priority: 'medium'
        });
      }
    }
    
    // Extract content between headers
    for (let i = 0; i < allMatches.length; i++) {
      const match = allMatches[i];
      const nextMatch = allMatches[i + 1];
      
      // Get content between this header and next (or end of text)
      const headerLine = cleanText.substring(match.index).split('\n')[0];
      const contentStart = match.index + headerLine.length + 1;
      const contentEnd = nextMatch ? nextMatch.index : cleanText.length;
      const content = cleanText.substring(contentStart, contentEnd).trim();
      
      if (content) {
        sections.push({
          title: match.title,
          content: content,
          icon: getSectionIcon(match.title),
          priority: getSectionPriority(match.title)
        });
      }
    }
    
    return sections;
  };

  // Enhanced markdown to HTML converter for section content
  const renderMarkdown = (text: string) => {
    let html = text;
    
    // Remove ## headers since they're already in accordion
    html = html.replace(/^#{1,2}\s+.*$/gm, '');
    
    // Process sub-headers
    html = html.replace(/^#### (.*$)/gim, '<h4 class="text-sm font-semibold mt-3 mb-2 text-foreground border-l-2 border-primary pl-2">$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold mt-4 mb-2 text-foreground border-l-2 border-primary pl-2">$1</h3>');
    
    // Bold and italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="font-bold italic text-primary">$1</strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    
    // Emoji indicators for priority/action items
    html = html.replace(/🔴|❌|⚠️/g, '<span class="text-destructive">$&</span>');
    html = html.replace(/🟢|✅|✓/g, '<span class="text-green-500">$&</span>');
    html = html.replace(/🟡|⚡|💡/g, '<span class="text-yellow-500">$&</span>');
    html = html.replace(/🔵|📌|📋/g, '<span class="text-blue-500">$&</span>');
    
    // Process lists - wrap in ul/ol
    const lines = html.split('\n');
    let inList = false;
    let listType = '';
    const processedLines: string[] = [];
    
    lines.forEach((line) => {
      const unorderedMatch = line.match(/^\s*[-•]\s+(.*)$/);
      const orderedMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
      
      if (unorderedMatch) {
        if (!inList || listType !== 'ul') {
          if (inList) processedLines.push(`</${listType}>`);
          processedLines.push('<ul class="list-none space-y-1.5 my-2 pl-1">');
          inList = true;
          listType = 'ul';
        }
        processedLines.push(`<li class="flex items-start gap-2 text-sm"><span class="text-primary mt-1 text-xs shrink-0">●</span><span class="flex-1">${unorderedMatch[1]}</span></li>`);
      } else if (orderedMatch) {
        if (!inList || listType !== 'ol') {
          if (inList) processedLines.push(`</${listType}>`);
          processedLines.push('<ol class="list-none space-y-1.5 my-2 pl-1">');
          inList = true;
          listType = 'ol';
        }
        processedLines.push(`<li class="flex items-start gap-2 text-sm"><span class="text-primary font-semibold min-w-[1.25rem] shrink-0">${orderedMatch[1]}.</span><span class="flex-1">${orderedMatch[2]}</span></li>`);
      } else {
        if (inList && line.trim() === '') {
          processedLines.push(`</${listType}>`);
          inList = false;
          listType = '';
        }
        if (line.trim()) {
          processedLines.push(line);
        }
      }
    });
    
    if (inList) {
      processedLines.push(`</${listType}>`);
    }
    
    html = processedLines.join('\n');
    
    // Convert paragraphs
    html = html.replace(/\n\n+/g, '</p><p class="mb-3 text-sm leading-relaxed text-foreground/90">');
    html = html.replace(/\n/g, '<br/>');
    
    // Highlight key phrases
    html = html.replace(/\[AÇÃO\]/gi, '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/20 text-primary">AÇÃO</span>');
    html = html.replace(/\[URGENTE\]/gi, '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-destructive/20 text-destructive">URGENTE</span>');
    html = html.replace(/\[DICA\]/gi, '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-600">DICA</span>');
    html = html.replace(/\[IMPORTANTE\]/gi, '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-600">IMPORTANTE</span>');
    
    // Clean up empty paragraphs
    html = html.replace(/<p[^>]*>\s*<\/p>/g, '');
    html = html.replace(/<br\/>\s*<br\/>/g, '<br/>');
    
    return html;
  };

  const getPriorityStyles = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'border-l-destructive bg-destructive/5';
      case 'medium':
        return 'border-l-primary bg-primary/5';
      default:
        return 'border-l-muted-foreground/30 bg-muted/30';
    }
  };

  const renderAnalysisWithAccordion = (text: string) => {
    const sections = parseAnalysisIntoSections(text);
    
    if (sections.length === 1 && sections[0].title === "Análise Completa") {
      // Fallback to simple rendering if no sections - show full text
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border bg-card">
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Análise Completa
            </h3>
            <div 
              className="ai-analysis-content text-sm leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ 
                __html: renderMarkdown(sections[0].content)
              }}
            />
          </div>
        </div>
      );
    }
    
    return (
      <Accordion type="multiple" defaultValue={sections.map((_, i) => `section-${i}`)} className="space-y-2">
        {sections.map((section, index) => (
          <AccordionItem 
            key={index} 
            value={`section-${index}`}
            className={`border rounded-lg px-4 border-l-4 ${getPriorityStyles(section.priority)}`}
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2 text-left">
                <span className={`${section.priority === 'high' ? 'text-destructive' : section.priority === 'medium' ? 'text-primary' : 'text-muted-foreground'}`}>
                  {section.icon}
                </span>
                <span className="font-medium text-sm">{section.title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div 
                className="ai-analysis-content text-sm leading-relaxed pt-2 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ 
                  __html: renderMarkdown(section.content)
                }}
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  const renderAnalysisContent = (text: string) => renderAnalysisWithAccordion(text);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise IA - Especialista em Vendas
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="new" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Nova Análise
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico ({analysisHistory.length})
            </TabsTrigger>
            <TabsTrigger 
              value="compare" 
              className="flex items-center gap-2"
              disabled={analysisHistory.length < 2}
            >
              <GitCompare className="h-4 w-4" />
              Comparar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="flex-1 flex flex-col min-h-0 mt-4 overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Analisando dados do prospect...</p>
                <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos</p>
              </div>
            ) : analysis ? (
              <>
                <ScrollArea className="flex-1 h-full max-h-[calc(85vh-220px)] pr-4">
                  {renderAnalysisContent(analysis)}
                </ScrollArea>
                <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                  <Button variant="outline" onClick={handleAnalyze} disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Nova Análise
                  </Button>
                  <Button variant="default" onClick={() => handleOpenChange(false)}>
                    Fechar
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Sparkles className="h-16 w-16 text-primary/50" />
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium text-foreground">Análise Inteligente de Vendas</p>
                  <p className="text-muted-foreground max-w-md">
                    A IA irá analisar os dados deste prospect (oportunidades, tarefas e contatos) 
                    e fornecer recomendações estratégicas para ajudar a fechar a venda.
                  </p>
                </div>
                <Button onClick={handleAnalyze} size="lg" className="mt-4">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Gerar Análise
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="flex-1 flex min-h-0 mt-4 gap-4 overflow-hidden">
            {loadingHistory ? (
              <div className="flex items-center justify-center w-full py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : analysisHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center w-full py-12 gap-4">
                <History className="h-16 w-16 text-muted-foreground/50" />
                <p className="text-muted-foreground">Nenhuma análise realizada ainda.</p>
                <Button onClick={() => {
                  setActiveTab("new");
                  handleAnalyze();
                }}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Criar Primeira Análise
                </Button>
              </div>
            ) : (
              <>
                {/* History List */}
                <div className="w-1/3 border-r pr-4">
                  <ScrollArea className="h-[calc(85vh-200px)]">
                    <div className="space-y-2">
                      {analysisHistory.map((item) => (
                        <div
                          key={item.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedHistoryItem?.id === item.id
                              ? "bg-primary/10 border-primary"
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => setSelectedHistoryItem(item)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAnalysis(item.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span>{item.opportunities_count} oport.</span>
                            <span>•</span>
                            <span>{item.tasks_count} tarefas</span>
                            <span>•</span>
                            <span>{item.contacts_count} contatos</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Analysis Detail */}
                <div className="flex-1 min-h-0">
                  {selectedHistoryItem ? (
                    <ScrollArea className="h-[calc(85vh-200px)]">
                      <div className="pr-4">
                        <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            Análise realizada em{" "}
                            <strong>
                              {format(new Date(selectedHistoryItem.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                            </strong>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Contexto: {selectedHistoryItem.opportunities_count} oportunidades, {selectedHistoryItem.tasks_count} tarefas, {selectedHistoryItem.contacts_count} contatos
                          </p>
                        </div>
                        {renderAnalysisContent(selectedHistoryItem.analysis)}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <History className="h-12 w-12 mb-2 opacity-50" />
                      <p>Selecione uma análise para visualizar</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="compare" className="flex-1 flex flex-col min-h-0 mt-4 overflow-hidden">
            {analysisHistory.length < 2 ? (
              <div className="flex flex-col items-center justify-center w-full py-12 gap-4">
                <GitCompare className="h-16 w-16 text-muted-foreground/50" />
                <p className="text-muted-foreground text-center">
                  Você precisa de pelo menos 2 análises para comparar.<br />
                  Gere mais análises no histórico.
                </p>
                <Button onClick={() => setActiveTab("new")}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar Nova Análise
                </Button>
              </div>
            ) : selectingFor ? (
              <div className="flex flex-col h-full">
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-4">
                  <p className="text-sm text-primary font-medium">
                    {selectingFor === 'left' 
                      ? '📌 Selecione a primeira análise (mais antiga) para comparar:' 
                      : '📌 Agora selecione a segunda análise (mais recente) para comparar:'}
                  </p>
                </div>
                <ScrollArea className="flex-1 max-h-[calc(85vh-280px)]">
                  <div className="grid grid-cols-2 gap-3">
                    {analysisHistory.map((item) => {
                      const isSelected = compareLeft?.id === item.id || compareRight?.id === item.id;
                      const isDisabled = (selectingFor === 'right' && compareLeft?.id === item.id);
                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? "bg-primary/10 border-primary ring-2 ring-primary/30"
                              : isDisabled
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-muted/50 hover:border-primary/50"
                          }`}
                          onClick={() => !isDisabled && handleSelectForCompare(item)}
                        >
                          <div className="flex items-center gap-2 text-sm font-medium mb-1">
                            <Calendar className="h-3 w-3 text-primary" />
                            {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </div>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span>{item.opportunities_count} oport.</span>
                            <span>•</span>
                            <span>{item.tasks_count} tarefas</span>
                            <span>•</span>
                            <span>{item.contacts_count} contatos</span>
                          </div>
                          {isSelected && (
                            <div className="mt-2 text-xs font-medium text-primary">
                              ✓ {compareLeft?.id === item.id ? 'Análise 1' : 'Análise 2'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                  <Button variant="outline" onClick={() => {
                    setSelectingFor(null);
                    setCompareLeft(null);
                    setCompareRight(null);
                  }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : compareLeft && compareRight ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GitCompare className="h-4 w-4 text-primary" />
                    <span>Comparando 2 análises</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={startCompareMode}>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Nova Comparação
                  </Button>
                </div>
                <div className="flex gap-4 flex-1 min-h-0">
                  {/* Left Analysis */}
                  <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
                    <div className="bg-blue-500/10 border-b border-blue-500/30 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded">1</span>
                          <span className="text-sm font-medium">
                            {format(new Date(compareLeft.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => {
                            setCompareLeft(null);
                            setSelectingFor('left');
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                        <span>{compareLeft.opportunities_count} oport.</span>
                        <span>•</span>
                        <span>{compareLeft.tasks_count} tarefas</span>
                        <span>•</span>
                        <span>{compareLeft.contacts_count} contatos</span>
                      </div>
                    </div>
                    <ScrollArea className="flex-1 max-h-[calc(85vh-350px)] p-3">
                      {renderAnalysisContent(compareLeft.analysis)}
                    </ScrollArea>
                  </div>

                  {/* Right Analysis */}
                  <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
                    <div className="bg-green-500/10 border-b border-green-500/30 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded">2</span>
                          <span className="text-sm font-medium">
                            {format(new Date(compareRight.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => {
                            setCompareRight(null);
                            setSelectingFor('right');
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                        <span>{compareRight.opportunities_count} oport.</span>
                        <span>•</span>
                        <span>{compareRight.tasks_count} tarefas</span>
                        <span>•</span>
                        <span>{compareRight.contacts_count} contatos</span>
                      </div>
                    </div>
                    <ScrollArea className="flex-1 max-h-[calc(85vh-350px)] p-3">
                      {renderAnalysisContent(compareRight.analysis)}
                    </ScrollArea>
                  </div>
                </div>

                {/* Context Changes Summary */}
                <div className="mt-4 p-3 bg-muted/30 rounded-lg border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Mudanças no contexto entre as análises:</p>
                  <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Oportunidades:</span>
                      <span className={`font-medium ${
                        compareRight.opportunities_count > compareLeft.opportunities_count 
                          ? 'text-green-500' 
                          : compareRight.opportunities_count < compareLeft.opportunities_count 
                          ? 'text-destructive' 
                          : 'text-muted-foreground'
                      }`}>
                        {compareLeft.opportunities_count} → {compareRight.opportunities_count}
                        {compareRight.opportunities_count !== compareLeft.opportunities_count && (
                          <span className="ml-1">
                            ({compareRight.opportunities_count > compareLeft.opportunities_count ? '+' : ''}
                            {compareRight.opportunities_count - compareLeft.opportunities_count})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Tarefas:</span>
                      <span className={`font-medium ${
                        compareRight.tasks_count > compareLeft.tasks_count 
                          ? 'text-green-500' 
                          : compareRight.tasks_count < compareLeft.tasks_count 
                          ? 'text-destructive' 
                          : 'text-muted-foreground'
                      }`}>
                        {compareLeft.tasks_count} → {compareRight.tasks_count}
                        {compareRight.tasks_count !== compareLeft.tasks_count && (
                          <span className="ml-1">
                            ({compareRight.tasks_count > compareLeft.tasks_count ? '+' : ''}
                            {compareRight.tasks_count - compareLeft.tasks_count})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Contatos:</span>
                      <span className={`font-medium ${
                        compareRight.contacts_count > compareLeft.contacts_count 
                          ? 'text-green-500' 
                          : compareRight.contacts_count < compareLeft.contacts_count 
                          ? 'text-destructive' 
                          : 'text-muted-foreground'
                      }`}>
                        {compareLeft.contacts_count} → {compareRight.contacts_count}
                        {compareRight.contacts_count !== compareLeft.contacts_count && (
                          <span className="ml-1">
                            ({compareRight.contacts_count > compareLeft.contacts_count ? '+' : ''}
                            {compareRight.contacts_count - compareLeft.contacts_count})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full py-12 gap-4">
                <GitCompare className="h-16 w-16 text-primary/50" />
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium text-foreground">Comparar Análises</p>
                  <p className="text-muted-foreground max-w-md">
                    Compare duas análises lado a lado para identificar mudanças na estratégia 
                    e evolução das recomendações ao longo do tempo.
                  </p>
                </div>
                <Button onClick={startCompareMode} size="lg" className="mt-4">
                  <GitCompare className="mr-2 h-5 w-5" />
                  Iniciar Comparação
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AIAnalysisDialog;
