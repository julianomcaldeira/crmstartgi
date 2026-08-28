import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, RefreshCw, Trash2, Calendar, Eye, ChevronLeft, GitCompare, X, MessageCircle, Send, User, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DOMPurify from "dompurify";

interface AIAnalysis {
  id: string;
  analysis: string;
  opportunities_count: number | null;
  tasks_count: number | null;
  contacts_count: number | null;
  created_at: string;
  created_by: string;
  profiles?: { full_name: string };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AIAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  opportunities: any[];
  tasks: any[];
  contacts: any[];
}

const AIAnalysisDialog = ({
  open,
  onOpenChange,
  client,
  opportunities,
  tasks,
  contacts,
}: AIAnalysisDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<AIAnalysis[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [viewingAnalysis, setViewingAnalysis] = useState<AIAnalysis | null>(null);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && client?.id) {
      fetchAnalysisHistory();
      fetchCurrentUser();
    }
  }, [open, client?.id]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

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
      setAnalysisHistory((data as any) || []);
    } catch (error) {
      console.error("Error fetching analysis history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);

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

      const { data: savedAnalysis, error: saveError } = await supabase
        .from("prospect_ai_analyses")
        .insert({
          client_id: client.id,
          analysis: analysisText,
          opportunities_count: opportunities.length,
          tasks_count: tasks.length,
          contacts_count: contacts.length,
          created_by: user.id,
        })
        .select(`*, profiles:created_by(full_name)`)
        .single();

      if (saveError) {
        console.error("Error saving analysis:", saveError);
        toast.error("Análise gerada, mas não foi possível salvar.");
      } else {
        toast.success("Análise gerada com sucesso!");
        fetchAnalysisHistory();
        setViewingAnalysis(savedAnalysis);
        setChatMessages([]);
        setShowChat(false);
      }
    } catch (error: any) {
      console.error("Error analyzing prospect:", error);
      toast.error("Erro ao analisar prospect. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnalysis = async (analysisId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const analysis = analysisHistory.find(a => a.id === analysisId);
    if (!analysis) return;
    
    // Check if current user is the owner
    if (analysis.created_by !== currentUserId) {
      toast.error("Você só pode excluir análises que você criou.");
      return;
    }
    
    try {
      const { error } = await supabase
        .from("prospect_ai_analyses")
        .delete()
        .eq("id", analysisId);

      if (error) throw error;

      toast.success("Análise excluída!");
      setAnalysisHistory(prev => prev.filter(a => a.id !== analysisId));
      setSelectedForComparison(prev => prev.filter(id => id !== analysisId));
      if (viewingAnalysis?.id === analysisId) {
        setViewingAnalysis(null);
      }
    } catch (error) {
      console.error("Error deleting analysis:", error);
      toast.error("Erro ao excluir análise.");
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setViewingAnalysis(null);
      setSelectedForComparison([]);
      setIsComparing(false);
      setShowChat(false);
      setChatMessages([]);
      setChatInput("");
    }
  };

  const toggleComparisonSelection = (id: string) => {
    setSelectedForComparison(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      if (prev.length >= 2) {
        toast.error("Selecione no máximo 2 análises para comparar.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const startComparison = () => {
    if (selectedForComparison.length < 2) {
      toast.error("Selecione 2 análises para comparar.");
      return;
    }
    setIsComparing(true);
  };

  const handleSendMessage = async (directMessage?: string) => {
    const messageToSend = directMessage || chatInput.trim();
    if (!messageToSend || chatLoading) return;

    if (!directMessage) {
      setChatInput("");
    }
    setChatMessages(prev => [...prev, { role: "user", content: messageToSend }]);
    setChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("prospect-chat", {
        body: {
          question: messageToSend,
          client,
          opportunities,
          tasks,
          contacts,
          previousAnalysis: viewingAnalysis?.analysis || null,
          conversationHistory: chatMessages,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setChatMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch (error: any) {
      console.error("Error sending chat message:", error);
      toast.error("Erro ao enviar mensagem. Tente novamente.");
      // Remove the user message on error
      setChatMessages(prev => prev.slice(0, -1));
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatAnalysisText = (text: string) => {
    let html = text;
    
    html = html.replace(/^#### (.*$)/gim, '<h4 class="text-sm font-semibold mt-4 mb-2 text-primary">$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold mt-5 mb-2 text-foreground">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold mt-6 mb-3 text-foreground border-b pb-2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-6 mb-3 text-foreground">$1</h1>');
    
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="font-bold italic">$1</strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    
    html = html.replace(/^\s*[-•]\s+(.*)$/gim, '<li class="ml-4 mb-1">• $1</li>');
    html = html.replace(/^\s*(\d+)\.\s+(.*)$/gim, '<li class="ml-4 mb-1">$1. $2</li>');
    
    html = html.replace(/\n\n/g, '</p><p class="mb-3">');
    html = html.replace(/\n/g, '<br/>');
    
    html = html.replace(/^---+$/gm, '<hr class="my-4 border-border"/>');
    
    return DOMPurify.sanitize(`<div class="prose prose-sm max-w-none"><p class="mb-3">${html}</p></div>`);
  };

  const canDeleteAnalysis = (analysis: AIAnalysis) => {
    return analysis.created_by === currentUserId;
  };

  // Comparison view
  if (isComparing) {
    const comparisonItems = analysisHistory.filter(a => selectedForComparison.includes(a.id));
    const [first, second] = comparisonItems;

    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-6xl h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setIsComparing(false)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="flex items-center gap-2">
                  <GitCompare className="h-5 w-5 text-primary" />
                  Comparação de Análises
                </DialogTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsComparing(false)}>
                <X className="h-4 w-4 mr-1" />
                Sair da comparação
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 grid grid-cols-2 gap-4 mt-4">
            {/* First analysis */}
            <div className="flex flex-col border rounded-lg overflow-hidden">
              <div className="bg-muted/50 p-3 border-b shrink-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(first.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                  <span>{first.opportunities_count} oport.</span>
                  <span>{first.tasks_count} tarefas</span>
                  <span>{first.contacts_count} contatos</span>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div 
                  className="p-4 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatAnalysisText(first.analysis), { USE_PROFILES: { html: true } }) }}
                />
              </ScrollArea>
            </div>

            {/* Second analysis */}
            <div className="flex flex-col border rounded-lg overflow-hidden">
              <div className="bg-muted/50 p-3 border-b shrink-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(second.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                  <span>{second.opportunities_count} oport.</span>
                  <span>{second.tasks_count} tarefas</span>
                  <span>{second.contacts_count} contatos</span>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div 
                  className="p-4 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatAnalysisText(second.analysis), { USE_PROFILES: { html: true } }) }}
                />
              </ScrollArea>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t mt-4 shrink-0">
            <Button variant="outline" onClick={() => setIsComparing(false)}>
              Voltar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Viewing a specific analysis with chat
  if (viewingAnalysis) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => {
                    setViewingAnalysis(null);
                    setShowChat(false);
                    setChatMessages([]);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Análise IA
                </DialogTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={showChat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowChat(!showChat)}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {showChat ? "Ocultar Chat" : "Perguntar à IA"}
                </Button>
                {canDeleteAnalysis(viewingAnalysis) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={(e) => handleDeleteAnalysis(viewingAnalysis.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(new Date(viewingAnalysis.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
              <div className="flex gap-4 text-xs">
                <span>{viewingAnalysis.opportunities_count} oportunidades</span>
                <span>{viewingAnalysis.tasks_count} tarefas</span>
                <span>{viewingAnalysis.contacts_count} contatos</span>
              </div>
            </div>
          </DialogHeader>

          <div className={`flex-1 min-h-0 mt-4 ${showChat ? 'grid grid-cols-2 gap-4' : ''}`}>
            {/* Analysis content */}
            <div className={`flex flex-col border rounded-lg overflow-hidden ${showChat ? '' : 'h-full'}`}>
              <ScrollArea className="flex-1">
                <div 
                  className="p-4 text-sm leading-relaxed text-foreground"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatAnalysisText(viewingAnalysis.analysis), { USE_PROFILES: { html: true } }) }}
                />
              </ScrollArea>
            </div>

            {/* Chat panel */}
            {showChat && (
              <div className="flex flex-col border rounded-lg overflow-hidden bg-muted/20">
                <div className="bg-primary/10 p-3 border-b shrink-0">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    Consultor de Vendas IA
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Faça perguntas sobre esta conta específica
                  </p>
                </div>

                <div 
                  ref={chatScrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4"
                >
                  {chatMessages.length === 0 && (
                    <div className="space-y-4 py-4">
                      <div className="text-center text-muted-foreground text-sm">
                        <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="font-medium">Como posso ajudar?</p>
                        <p className="text-xs mt-1">Clique em uma sugestão ou digite sua pergunta</p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {[
                          "Como devo abordar o decisor?",
                          "Qual a melhor estratégia para avançar?",
                          "Quais objeções posso enfrentar?",
                          "Como justificar o valor da proposta?",
                          "Qual o próximo passo ideal?",
                          "Como me diferenciar da concorrência?",
                        ].map((suggestion) => (
                          <Button
                            key={suggestion}
                            variant="outline"
                            size="sm"
                            className="text-xs h-auto py-2 px-3 whitespace-normal text-left"
                            onClick={() => handleSendMessage(suggestion)}
                            disabled={chatLoading}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div 
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatAnalysisText(msg.content), { USE_PROFILES: { html: true } }) }}
                            className="text-sm [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h4]:text-xs"
                          />
                        ) : (
                          msg.content
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex gap-2 justify-start">
                      <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-muted rounded-lg px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 border-t shrink-0">
                  <div className="flex gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Digite sua pergunta sobre esta conta..."
                      disabled={chatLoading}
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      onClick={() => handleSendMessage()}
                      disabled={!chatInput.trim() || chatLoading}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between gap-2 pt-4 border-t mt-4 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => {
              setViewingAnalysis(null);
              setShowChat(false);
              setChatMessages([]);
            }}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleAnalyze} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Nova Análise
              </Button>
              <Button onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Main list view
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise IA - Especialista em Vendas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Generate new analysis button */}
          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div>
              <p className="font-medium text-foreground">Gerar Nova Análise</p>
              <p className="text-sm text-muted-foreground">
                A IA irá analisar {opportunities.length} oportunidades, {tasks.length} tarefas e {contacts.length} contatos
              </p>
            </div>
            <Button onClick={handleAnalyze} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar
                </>
              )}
            </Button>
          </div>

          {/* Comparison bar */}
          {selectedForComparison.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {selectedForComparison.length} análise(s) selecionada(s)
              </span>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedForComparison([])}
                  className="text-blue-700 dark:text-blue-300"
                >
                  Limpar
                </Button>
                <Button 
                  size="sm" 
                  onClick={startComparison}
                  disabled={selectedForComparison.length < 2}
                >
                  <GitCompare className="mr-2 h-4 w-4" />
                  Comparar
                </Button>
              </div>
            </div>
          )}

          {/* History list */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Histórico de Análises ({analysisHistory.length})
              {analysisHistory.length >= 2 && (
                <span className="ml-2 text-xs font-normal">
                  — Selecione 2 para comparar
                </span>
              )}
            </h3>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : analysisHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>Nenhuma análise realizada ainda.</p>
                <p className="text-sm">Clique em "Gerar" para criar a primeira análise.</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2 pr-4">
                  {analysisHistory.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group ${
                        selectedForComparison.includes(item.id) ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' : ''
                      }`}
                    >
                      <Checkbox
                        checked={selectedForComparison.includes(item.id)}
                        onCheckedChange={() => toggleComparisonSelection(item.id)}
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                          {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          <span>{item.opportunities_count} oport.</span>
                          <span>{item.tasks_count} tarefas</span>
                          <span>{item.contacts_count} contatos</span>
                          {item.profiles?.full_name && (
                            <span className="text-primary">por {item.profiles.full_name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setViewingAnalysis(item);
                            setChatMessages([]);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                        {canDeleteAnalysis(item) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => handleDeleteAnalysis(item.id, e)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t mt-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIAnalysisDialog;
