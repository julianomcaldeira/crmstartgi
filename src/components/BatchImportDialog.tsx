import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface BatchImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BatchImportDialog({ open, onOpenChange, onSuccess }: BatchImportDialogProps) {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [batchImporting, setBatchImporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    duplicates: 0,
  });
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  const handleBatchImport = async (file: File) => {
    try {
      toast.info("Iniciando importação completa da planilha...");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      setBatchImporting(true);
      setBatchProgress({
        total: 0,
        processed: 0,
        success: 0,
        failed: 0,
        duplicates: 0,
      });

      // Prepare form data
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.id);

      // Call edge function to process complete import
      const response = await supabase.functions.invoke('import-prospects-complete', {
        body: formData,
      });

      if (response.error) {
        console.error("Erro na importação:", response.error);
        throw new Error(response.error.message || "Erro ao processar importação");
      }

      const result = response.data;
      
      setBatchProgress({
        total: result.total,
        processed: result.total,
        success: result.success,
        failed: result.errors,
        duplicates: result.duplicates,
      });

      // Store error details for display
      if (result.errorDetails && result.errorDetails.length > 0) {
        setErrorDetails(result.errorDetails);
      }

      const successRate = result.total > 0 
        ? Math.round((result.success / result.total) * 100) 
        : 0;
      
      const reportMessage = `
📊 Importação Completa Finalizada

Total processado: ${result.total} registros
✅ Sucessos: ${result.success}
🔄 Duplicados: ${result.duplicates}
❌ Falhas: ${result.errors}

Taxa de sucesso: ${successRate}%
      `.trim();
      
      console.log("=== RELATÓRIO DE IMPORTAÇÃO ===");
      console.log(reportMessage);
      if (result.errorDetails && result.errorDetails.length > 0) {
        console.log("\nDetalhes dos erros:");
        result.errorDetails.forEach((err: string) => console.log(`- ${err}`));
      }
      console.log("================================");
      
      toast.success(
        `Importação concluída! ${result.success} sucessos, ${result.duplicates} duplicados, ${result.errors} falhas. Taxa: ${successRate}%`,
        { duration: 10000 }
      );
      
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao processar importação:", error);
      toast.error("Erro ao processar importação: " + error.message);
    } finally {
      setBatchImporting(false);
    }
  };

  const handleClose = () => {
    setImportFile(null);
    setBatchProgress({
      total: 0,
      processed: 0,
      success: 0,
      failed: 0,
      duplicates: 0,
    });
    setErrorDetails([]);
    setShowErrors(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importação em Lote de Prospects</DialogTitle>
          <DialogDescription>
            Faça upload de uma planilha Excel com todos os dados dos prospects. A primeira linha deve conter os cabeçalhos.
            <br />
            <strong>Colunas esperadas:</strong> CNPJ, Razão Social, Nome Fantasia, Telefone, Email, Endereço, Cidade, Estado, CEP, Segmento, Porte da Empresa, Região, Capital Social
          </DialogDescription>
        </DialogHeader>
        
        {!batchImporting ? (
          <>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            />
            
            <Button
              onClick={() => importFile && handleBatchImport(importFile)}
              disabled={!importFile}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              Iniciar Importação
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {batchProgress.processed === batchProgress.total && batchProgress.total > 0
                  ? `Importação concluída: ${batchProgress.total} registros processados`
                  : `Processando importação... aguarde`
                }
              </p>
              <Progress 
                value={batchProgress.total > 0 ? (batchProgress.processed / batchProgress.total) * 100 : 0} 
                className="h-2"
              />
            </div>

            {batchProgress.processed > 0 && (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-green-500">{batchProgress.success}</p>
                  <p className="text-xs text-muted-foreground">Sucessos</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-yellow-500">{batchProgress.duplicates}</p>
                  <p className="text-xs text-muted-foreground">Duplicados</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-red-500">{batchProgress.failed}</p>
                  <p className="text-xs text-muted-foreground">Falhas</p>
                </div>
              </div>
            )}

            {errorDetails.length > 0 && batchProgress.processed === batchProgress.total && (
              <Collapsible open={showErrors} onOpenChange={setShowErrors} className="space-y-2">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span>Ver detalhes dos erros ({errorDetails.length})</span>
                    </div>
                    {showErrors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                    <div className="space-y-2">
                      {errorDetails.map((error, index) => (
                        <div
                          key={index}
                          className="text-sm p-2 rounded-md bg-destructive/10 border border-destructive/20"
                        >
                          <p className="text-destructive font-medium">{error}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            )}

            {batchProgress.processed === batchProgress.total && batchProgress.total > 0 && (
              <div className="flex justify-center">
                <Button onClick={handleClose} variant="default">
                  Fechar
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
