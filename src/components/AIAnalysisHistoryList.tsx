import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Calendar,
  Eye,
  Trash2,
  Loader2,
  ChevronLeft,
  GitCompare,
  Target,
  ClipboardList,
  Users,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  creator?: { full_name: string };
}

interface AIAnalysisHistoryListProps {
  clientId: string;
}

export function AIAnalysisHistoryList({ clientId }: AIAnalysisHistoryListProps) {
  const [analyses, setAnalyses] = useState<AIAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewingAnalysis, setViewingAnalysis] = useState<AIAnalysis | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  useEffect(() => {
    fetchAnalyses();
    fetchCurrentUser();
  }, [clientId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("prospect_ai_analyses")
        .select(`
          *,
          creator:profiles!prospect_ai_analyses_created_by_fkey(full_name)
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAnalyses(data || []);
    } catch (error) {
      console.error("Error fetching AI analyses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (analysisId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const analysis = analyses.find(a => a.id === analysisId);
    if (!analysis || analysis.created_by !== currentUserId) {
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
      setAnalyses(prev => prev.filter(a => a.id !== analysisId));
      setSelectedForComparison(prev => prev.filter(id => id !== analysisId));
      if (viewingAnalysis?.id === analysisId) {
        setViewingAnalysis(null);
        setViewDialogOpen(false);
      }
    } catch (error) {
      console.error("Error deleting analysis:", error);
      toast.error("Erro ao excluir análise.");
    }
  };

  const toggleComparisonSelection = (id: string) => {
    setSelectedForComparison(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
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
    setViewDialogOpen(true);
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

  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="text-center py-8">
        <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-muted-foreground">Nenhuma análise de IA realizada ainda.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Use o botão "Análise IA" no topo da página para gerar uma análise.
        </p>
      </div>
    );
  }

  // Comparison view dialog
  if (isComparing && viewDialogOpen) {
    const comparisonItems = analyses.filter(a => selectedForComparison.includes(a.id));
    if (comparisonItems.length < 2) return null;
    const [first, second] = comparisonItems;

    return (
      <Dialog open={viewDialogOpen} onOpenChange={(open) => {
        setViewDialogOpen(open);
        if (!open) setIsComparing(false);
      }}>
        <DialogContent className="max-w-6xl h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setIsComparing(false); setViewDialogOpen(false); }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-primary" />
                Comparação de Análises
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-4 mt-4">
            {[first, second].map((item) => (
              <div key={item.id} className="flex flex-col border rounded-lg overflow-hidden">
                <div className="bg-muted/50 p-3 border-b shrink-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDate(item.created_at)}
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span>{item.opportunities_count ?? 0} oport.</span>
                    <span>{item.tasks_count ?? 0} tarefas</span>
                    <span>{item.contacts_count ?? 0} contatos</span>
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div
                    className="p-4 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatAnalysisText(item.analysis), { USE_PROFILES: { html: true } }) }}
                  />
                </ScrollArea>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      {/* Comparison toolbar */}
      {selectedForComparison.length > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-primary/10 rounded-lg">
          <GitCompare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{selectedForComparison.length}/2 selecionadas</span>
          <Button
            size="sm"
            variant="default"
            onClick={startComparison}
            disabled={selectedForComparison.length < 2}
          >
            Comparar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedForComparison([])}>
            Limpar
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {analyses.map((analysis) => (
          <Card
            key={analysis.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => { setViewingAnalysis(analysis); setViewDialogOpen(true); }}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedForComparison.includes(analysis.id)}
                    onCheckedChange={() => toggleComparisonSelection(analysis.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Análise de IA</span>
                      <Badge variant="outline" className="text-xs">
                        {formatDate(analysis.created_at)}
                      </Badge>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {analysis.opportunities_count ?? 0} oportunidades
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardList className="h-3 w-3" />
                        {analysis.tasks_count ?? 0} tarefas
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {analysis.contacts_count ?? 0} contatos
                      </span>
                    </div>
                    {analysis.creator && (
                      <p className="text-xs text-muted-foreground mt-1">
                        por {analysis.creator.full_name}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {analysis.analysis.substring(0, 150)}...
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); setViewingAnalysis(analysis); setViewDialogOpen(true); }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {analysis.created_by === currentUserId && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => handleDelete(analysis.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View Dialog */}
      {viewingAnalysis && !isComparing && (
        <Dialog open={viewDialogOpen} onOpenChange={(open) => {
          setViewDialogOpen(open);
          if (!open) setViewingAnalysis(null);
        }}>
          <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Análise de IA
              </DialogTitle>
              <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(viewingAnalysis.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
                <div className="flex gap-4 text-xs">
                  <span>{viewingAnalysis.opportunities_count ?? 0} oportunidades</span>
                  <span>{viewingAnalysis.tasks_count ?? 0} tarefas</span>
                  <span>{viewingAnalysis.contacts_count ?? 0} contatos</span>
                </div>
              </div>
              {viewingAnalysis.creator && (
                <p className="text-xs text-muted-foreground">
                  por {viewingAnalysis.creator.full_name}
                </p>
              )}
            </DialogHeader>
            <ScrollArea className="flex-1 mt-4">
              <div
                className="p-4 text-sm leading-relaxed text-foreground"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatAnalysisText(viewingAnalysis.analysis), { USE_PROFILES: { html: true } }) }}
              />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
