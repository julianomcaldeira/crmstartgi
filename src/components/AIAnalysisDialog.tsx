import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-prospect", {
        body: { client, opportunities, tasks, contacts },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setAnalysis(data.analysis);
      setHasAnalyzed(true);
    } catch (error: any) {
      console.error("Error analyzing prospect:", error);
      toast.error("Erro ao analisar prospect. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-analyze when dialog opens for the first time
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !hasAnalyzed && !loading) {
      handleAnalyze();
    }
  };

  // Simple markdown to HTML converter
  const renderMarkdown = (text: string) => {
    return text
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2 text-foreground">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3 text-foreground">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4 text-foreground">$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Lists
      .replace(/^\s*-\s+(.*)$/gim, '<li class="ml-4 mb-1 text-foreground">$1</li>')
      .replace(/^\s*\d+\.\s+(.*)$/gim, '<li class="ml-4 mb-1 list-decimal text-foreground">$1</li>')
      // Line breaks
      .replace(/\n\n/g, '</p><p class="mb-3 text-foreground">')
      .replace(/\n/g, '<br/>');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise IA - Especialista em Vendas
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Analisando dados do prospect...</p>
              <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos</p>
            </div>
          ) : analysis ? (
            <ScrollArea className="h-[60vh] pr-4">
              <div 
                className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                dangerouslySetInnerHTML={{ __html: `<p class="mb-3 text-foreground">${renderMarkdown(analysis)}</p>` }}
              />
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Sparkles className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">Clique para analisar este prospect</p>
              <Button onClick={handleAnalyze}>
                <Sparkles className="mr-2 h-4 w-4" />
                Iniciar Análise
              </Button>
            </div>
          )}
        </div>

        {analysis && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleAnalyze} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Nova Análise
            </Button>
            <Button variant="default" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AIAnalysisDialog;
