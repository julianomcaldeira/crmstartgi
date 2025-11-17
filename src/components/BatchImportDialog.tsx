import { useState, useRef, useEffect } from "react";
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
import { Upload, Play, Pause, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

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
    currentBatch: 0
  });
  const [batchPaused, setBatchPaused] = useState(false);
  const batchIntervalRef = useRef<number | null>(null);
  const cnpjListRef = useRef<string[]>([]);

  const handleBatchImport = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      
      const cnpjs = data
        .map((row: any) => String(row[0] || '').trim())
        .filter((cnpj: string) => cnpj && cnpj.length >= 11);

      if (cnpjs.length === 0) {
        toast.error("Nenhum CNPJ válido encontrado na planilha");
        return;
      }

      cnpjListRef.current = cnpjs;
      setBatchProgress({
        total: cnpjs.length,
        processed: 0,
        success: 0,
        failed: 0,
        duplicates: 0,
        currentBatch: 0
      });
      setBatchImporting(true);
      setBatchPaused(false);

      processBatch();
    } catch (error: any) {
      toast.error("Erro ao ler arquivo: " + error.message);
    }
  };

  const processBatch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const processNextBatch = async () => {
      if (batchPaused) return;

      const startIdx = batchProgress.processed;
      const batch = cnpjListRef.current.slice(startIdx, startIdx + 3);

      if (batch.length === 0) {
        setBatchImporting(false);
        if (batchIntervalRef.current) {
          clearInterval(batchIntervalRef.current);
        }
        
        // Criar relatório detalhado
        const successRate = Math.round((batchProgress.success / batchProgress.total) * 100);
        const reportMessage = `
📊 Relatório de Importação Concluída

Total processado: ${batchProgress.total} CNPJs
✅ Sucessos: ${batchProgress.success}
🔄 Duplicados: ${batchProgress.duplicates}
❌ Falhas: ${batchProgress.failed}

Taxa de sucesso: ${successRate}%
        `.trim();
        
        console.log("=== RELATÓRIO DE IMPORTAÇÃO ===");
        console.log(reportMessage);
        console.log("================================");
        
        toast.success(
          `Importação concluída! ${batchProgress.success} sucessos, ${batchProgress.duplicates} duplicados, ${batchProgress.failed} falhas. Taxa: ${successRate}%`,
          { duration: 10000 }
        );
        
        onSuccess();
        return;
      }

      try {
        const response = await supabase.functions.invoke('batch-import-cnpj', {
          body: { cnpjs: batch, userId: user.id }
        });

        if (response.error) throw response.error;

        const result = response.data;
        
        setBatchProgress(prev => ({
          ...prev,
          processed: prev.processed + result.processed,
          success: prev.success + result.success,
          failed: prev.failed + result.failed,
          duplicates: prev.duplicates + result.duplicates,
          currentBatch: prev.currentBatch + 1
        }));

      } catch (error: any) {
        console.error('Batch error:', error);
        toast.error("Erro no lote: " + error.message);
      }
    };

    await processNextBatch();
    batchIntervalRef.current = window.setInterval(processNextBatch, 60000);
  };

  const handlePauseBatch = () => {
    setBatchPaused(true);
    if (batchIntervalRef.current) {
      clearInterval(batchIntervalRef.current);
      batchIntervalRef.current = null;
    }
  };

  const handleResumeBatch = () => {
    setBatchPaused(false);
    processBatch();
  };

  const handleCancelBatch = () => {
    setBatchImporting(false);
    setBatchPaused(false);
    if (batchIntervalRef.current) {
      clearInterval(batchIntervalRef.current);
      batchIntervalRef.current = null;
    }
    cnpjListRef.current = [];
    setBatchProgress({
      total: 0,
      processed: 0,
      success: 0,
      failed: 0,
      duplicates: 0,
      currentBatch: 0
    });
  };

  useEffect(() => {
    return () => {
      if (batchIntervalRef.current) {
        clearInterval(batchIntervalRef.current);
      }
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Prospects em Lote</DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo Excel (.xlsx) com os CNPJs na primeira coluna.
            Os prospects serão processados em lotes de 3 a cada 1 minuto.
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
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span>{batchProgress.processed} / {batchProgress.total}</span>
              </div>
              <Progress value={(batchProgress.processed / batchProgress.total) * 100} />
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Sucesso</div>
                <div className="text-2xl font-bold text-green-600">{batchProgress.success}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Duplicados</div>
                <div className="text-2xl font-bold text-yellow-600">{batchProgress.duplicates}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Falhas</div>
                <div className="text-2xl font-bold text-red-600">{batchProgress.failed}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Lote Atual</div>
                <div className="text-2xl font-bold">{batchProgress.currentBatch}</div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground text-center">
              Processando 3 CNPJs a cada 1 minuto para respeitar os limites da Receita Federal
            </div>

            <div className="flex gap-2">
              {!batchPaused ? (
                <Button onClick={handlePauseBatch} variant="outline" className="flex-1">
                  <Pause className="mr-2 h-4 w-4" />
                  Pausar
                </Button>
              ) : (
                <Button onClick={handleResumeBatch} className="flex-1">
                  <Play className="mr-2 h-4 w-4" />
                  Retomar
                </Button>
              )}
              <Button onClick={handleCancelBatch} variant="destructive" className="flex-1">
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
