import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2, RefreshCw, History, Trash2, Calendar } from "lucide-react";
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
    }
  };

  // Simple markdown to HTML converter
  const renderMarkdown = (text: string) => {
    return text
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2 text-foreground">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3 text-foreground">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4 text-foreground">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\s*-\s+(.*)$/gim, '<li class="ml-4 mb-1 text-foreground">$1</li>')
      .replace(/^\s*\d+\.\s+(.*)$/gim, '<li class="ml-4 mb-1 list-decimal text-foreground">$1</li>')
      .replace(/\n\n/g, '</p><p class="mb-3 text-foreground">')
      .replace(/\n/g, '<br/>');
  };

  const renderAnalysisContent = (text: string) => (
    <div 
      className="prose prose-sm dark:prose-invert max-w-none text-foreground"
      dangerouslySetInnerHTML={{ __html: `<p class="mb-3 text-foreground">${renderMarkdown(text)}</p>` }}
    />
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise IA - Especialista em Vendas
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Nova Análise
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico ({analysisHistory.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="flex-1 flex flex-col min-h-0 mt-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Analisando dados do prospect...</p>
                <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos</p>
              </div>
            ) : analysis ? (
              <>
                <ScrollArea className="flex-1 pr-4">
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

          <TabsContent value="history" className="flex-1 flex min-h-0 mt-4 gap-4">
            {loadingHistory ? (
              <div className="flex items-center justify-center w-full py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : analysisHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center w-full py-12 gap-4">
                <History className="h-16 w-16 text-muted-foreground/50" />
                <p className="text-muted-foreground">Nenhuma análise realizada ainda.</p>
                <Button onClick={() => setActiveTab("new")}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Criar Primeira Análise
                </Button>
              </div>
            ) : (
              <>
                {/* History List */}
                <div className="w-1/3 border-r pr-4">
                  <ScrollArea className="h-[50vh]">
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
                    <ScrollArea className="h-[50vh]">
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AIAnalysisDialog;
