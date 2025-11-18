import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import * as XLSX from 'xlsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface QuickImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  filePath?: string;
}

const SYSTEM_FIELDS = [
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'company_name', label: 'Razão Social' },
  { value: 'trade_name', label: 'Nome Fantasia' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'address', label: 'Endereço' },
  { value: 'city', label: 'Cidade' },
  { value: 'state', label: 'Estado' },
  { value: 'zip_code', label: 'CEP' },
  { value: 'segment', label: 'Segmento' },
  { value: 'company_size', label: 'Porte da Empresa' },
  { value: 'region', label: 'Região' },
  { value: 'share_capital', label: 'Capital Social' },
  { value: 'seller_name', label: 'Vendedor' },
  { value: 'cnae_principal', label: 'CNAE Principal' },
  { value: 'cnae_description', label: 'CNAE Descrição' },
  { value: 'ignore', label: '-- Ignorar esta coluna --' }
];

export function QuickImportDialog({ open, onOpenChange, onSuccess, filePath = '/empresas_import.xlsx' }: QuickImportDialogProps) {
  const [step, setStep] = useState<'reading' | 'mapping' | 'importing' | 'complete'>('reading');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState({
    total: 0,
    processed: 0,
    success: 0,
    duplicates: 0,
    errors: 0
  });
  const [sessionId] = useState(() => `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (open && step === 'reading') {
      readExcelFile();
    }
  }, [open, step]);

  useEffect(() => {
    if (step === 'importing') {
      const channel = supabase
        .channel(`import_progress_${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'import_progress',
            filter: `session_id=eq.${sessionId}`
          },
          (payload: any) => {
            if (payload.new) {
              setProgress({
                total: payload.new.total_rows,
                processed: payload.new.processed_rows,
                success: payload.new.success_count,
                duplicates: payload.new.duplicate_count,
                errors: payload.new.error_count
              });

              if (payload.new.status === 'completed') {
                setStep('complete');
                toast.success(`Importação concluída! ${payload.new.success_count} prospects importados com sucesso.`);
              } else if (payload.new.status === 'failed') {
                toast.error('Erro na importação: ' + payload.new.error_message);
                setStep('complete');
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [step, sessionId]);

  const readExcelFile = async () => {
    try {
      const response = await fetch(filePath);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
      
      if (data.length > 0) {
        const fileHeaders = data[0].map((h: any) => String(h || '').trim());
        setHeaders(fileHeaders);
        
        // Auto-map headers
        const autoMappings: Record<string, string> = {};
        fileHeaders.forEach((header, index) => {
          const lowerHeader = header.toLowerCase();
          
          if (lowerHeader.includes('cnpj')) autoMappings[index] = 'cnpj';
          else if (lowerHeader.includes('razão social') || lowerHeader.includes('razao social')) autoMappings[index] = 'company_name';
          else if (lowerHeader.includes('nome fantasia')) autoMappings[index] = 'trade_name';
          else if (lowerHeader.includes('telefone') || lowerHeader.includes('fone')) autoMappings[index] = 'phone';
          else if (lowerHeader.includes('email') || lowerHeader.includes('e-mail')) autoMappings[index] = 'email';
          else if (lowerHeader.includes('endereço') || lowerHeader.includes('endereco')) autoMappings[index] = 'address';
          else if (lowerHeader.includes('cidade')) autoMappings[index] = 'city';
          else if (lowerHeader.includes('estado') || lowerHeader.includes('uf')) autoMappings[index] = 'state';
          else if (lowerHeader.includes('cep')) autoMappings[index] = 'zip_code';
          else if (lowerHeader.includes('segmento')) autoMappings[index] = 'segment';
          else if (lowerHeader.includes('porte')) autoMappings[index] = 'company_size';
          else if (lowerHeader.includes('região') || lowerHeader.includes('regiao')) autoMappings[index] = 'region';
          else if (lowerHeader.includes('capital')) autoMappings[index] = 'share_capital';
          else if (lowerHeader.includes('vendedor')) autoMappings[index] = 'seller_name';
          else if (lowerHeader.includes('cnae') && lowerHeader.includes('principal')) autoMappings[index] = 'cnae_principal';
          else if (lowerHeader.includes('cnae') && (lowerHeader.includes('descrição') || lowerHeader.includes('descricao'))) autoMappings[index] = 'cnae_description';
          else autoMappings[index] = 'ignore';
        });
        
        setMappings(autoMappings);
        setStep('mapping');
      } else {
        toast.error('Planilha vazia');
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Erro ao ler arquivo:', error);
      toast.error('Erro ao ler arquivo Excel');
      onOpenChange(false);
    }
  };

  const startImport = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Validate required mappings
      const hasRequiredFields = Object.values(mappings).some(m => m === 'cnpj');
      if (!hasRequiredFields) {
        toast.error('É necessário mapear pelo menos o campo CNPJ');
        return;
      }

      setStep('importing');
      
      const response = await fetch(filePath);
      const blob = await response.blob();
      const file = new File([blob], 'import.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);
      formData.append('sessionId', sessionId);
      formData.append('mappings', JSON.stringify(mappings));

      const { data, error } = await supabase.functions.invoke('import-prospects-mapped', {
        body: formData
      });

      if (error) {
        console.error('Error invoking function:', error);
        toast.error('Erro ao iniciar importação: ' + error.message);
        setStep('mapping');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error('Erro ao importar: ' + error.message);
      setStep('mapping');
    }
  };

  const handleClose = () => {
    if (step === 'complete') {
      onSuccess();
    }
    setStep('reading');
    setHeaders([]);
    setMappings({});
    setProgress({ total: 0, processed: 0, success: 0, duplicates: 0, errors: 0 });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'reading' && 'Lendo planilha...'}
            {step === 'mapping' && 'Mapeamento de Campos'}
            {step === 'importing' && 'Importando Prospects'}
            {step === 'complete' && 'Importação Concluída'}
          </DialogTitle>
        </DialogHeader>

        {step === 'reading' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Lendo arquivo Excel...</p>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Confirme ou ajuste o mapeamento dos campos abaixo:
            </p>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {headers.map((header, index) => (
                <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">{header}</Label>
                  </div>
                  <div className="flex-1">
                    <Select
                      value={mappings[index] || 'ignore'}
                      onValueChange={(value) => {
                        setMappings(prev => ({ ...prev, [index]: value }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SYSTEM_FIELDS.map(field => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={startImport}>
                Iniciar Importação
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span>{progress.processed} / {progress.total}</span>
              </div>
              <Progress 
                value={progress.total > 0 ? (progress.processed / progress.total) * 100 : 0} 
                className="h-2"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Sucesso</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{progress.success}</p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Duplicados</span>
                </div>
                <p className="text-2xl font-bold text-yellow-600">{progress.duplicates}</p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">Erros</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{progress.errors}</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Importando prospects em tempo real...</span>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Importação Concluída!</h3>
              <p className="text-sm text-muted-foreground">
                {progress.success} prospects importados com sucesso
                {progress.duplicates > 0 && `, ${progress.duplicates} duplicados ignorados`}
                {progress.errors > 0 && `, ${progress.errors} com erro`}
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
