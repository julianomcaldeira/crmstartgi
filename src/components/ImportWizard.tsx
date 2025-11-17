import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, AlertCircle, CheckCircle2, Loader2, Download, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as XLSX from 'xlsx';

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const SYSTEM_FIELDS = [
  { value: "cnpj", label: "CNPJ" },
  { value: "company_name", label: "Razão Social" },
  { value: "trade_name", label: "Nome Fantasia" },
  { value: "phone", label: "Telefone" },
  { value: "email", label: "Email" },
  { value: "address", label: "Endereço" },
  { value: "city", label: "Cidade" },
  { value: "state", label: "Estado" },
  { value: "zip_code", label: "CEP" },
  { value: "segment", label: "Segmento" },
  { value: "company_size", label: "Porte da Empresa" },
  { value: "region", label: "Região" },
  { value: "share_capital", label: "Capital Social" },
  { value: "registration_status", label: "Situação" },
  { value: "foundation_date", label: "Data de Abertura" },
  { value: "cnae_principal", label: "CNAE Principal" },
  { value: "cnae_description", label: "CNAE Descrição" },
  { value: "seller_name", label: "Vendedor" },
  { value: "ignore", label: "Ignorar esta coluna" },
];

export function ImportWizard({ open, onOpenChange, onSuccess }: ImportWizardProps) {
  const [step, setStep] = useState<"upload" | "mapping" | "importing">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [autoMappings, setAutoMappings] = useState<Record<number, string>>({});
  const [unmappedHeaders, setUnmappedHeaders] = useState<Array<{ index: number; name: string }>>([]);
  const [manualMappings, setManualMappings] = useState<Record<number, string>>({});
  const [totalRows, setTotalRows] = useState(0);
  const [sessionId, setSessionId] = useState<string>("");
  
  const [progress, setProgress] = useState({
    total: 0,
    processed: 0,
    success: 0,
    errors: 0,
    duplicates: 0,
  });
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  // Subscribe to real-time progress updates
  useEffect(() => {
    if (!sessionId || step !== "importing") return;

    const channel = supabase
      .channel(`import-progress-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "import_progress",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const data = payload.new as any;
          setProgress({
            total: data.total_rows,
            processed: data.processed_rows,
            success: data.success_count,
            errors: data.error_count,
            duplicates: data.duplicate_count,
          });

          if (data.status === "completed") {
            toast.success(
              `Importação concluída! ${data.success_count} sucessos, ${data.duplicate_count} duplicados, ${data.error_count} erros.`,
              { duration: 10000 }
            );
            onSuccess();
            setTimeout(() => handleClose(), 2000);
          } else if (data.status === "failed") {
            toast.error(`Erro na importação: ${data.error_message}`);
            setStep("upload");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, step]);

  const downloadTemplate = () => {
    // Create template data with examples
    const templateData = [
      {
        "CNPJ": "12.345.678/0001-90",
        "Razão Social": "Empresa Exemplo Ltda",
        "Nome Fantasia": "Exemplo",
        "Telefone": "(11) 3456-7890",
        "Email": "contato@exemplo.com.br",
        "Endereço": "Rua Exemplo, 123",
        "Cidade": "São Paulo",
        "Estado": "SP",
        "CEP": "01234-567",
        "Segmento": "Tecnologia",
        "Porte da Empresa": "Médio",
        "Região": "Sudeste",
        "Capital Social": "500000",
        "Situação": "Ativa",
        "Data de Abertura": "2020-01-15",
        "CNAE Principal": "6201-5/00",
        "CNAE Descrição": "Desenvolvimento de programas de computador sob encomenda",
        "Vendedor": "João Silva"
      },
      {
        "CNPJ": "98.765.432/0001-10",
        "Razão Social": "Outra Empresa S.A.",
        "Nome Fantasia": "Outra Empresa",
        "Telefone": "(21) 9876-5432",
        "Email": "vendas@outraempresa.com.br",
        "Endereço": "Av. Principal, 456",
        "Cidade": "Rio de Janeiro",
        "Estado": "RJ",
        "CEP": "20000-000",
        "Segmento": "Varejo",
        "Porte da Empresa": "Grande",
        "Região": "Sudeste",
        "Capital Social": "2000000",
        "Situação": "Ativa",
        "Data de Abertura": "2018-05-20",
        "CNAE Principal": "4711-3/02",
        "CNAE Descrição": "Comércio varejista de mercadorias em geral",
        "Vendedor": "Maria Santos"
      }
    ];

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prospects");

    // Set column widths for better readability
    const colWidths = [
      { wch: 20 }, // CNPJ
      { wch: 35 }, // Razão Social
      { wch: 25 }, // Nome Fantasia
      { wch: 18 }, // Telefone
      { wch: 30 }, // Email
      { wch: 30 }, // Endereço
      { wch: 20 }, // Cidade
      { wch: 8 },  // Estado
      { wch: 15 }, // CEP
      { wch: 20 }, // Segmento
      { wch: 20 }, // Porte da Empresa
      { wch: 15 }, // Região
      { wch: 18 }, // Capital Social
      { wch: 15 }, // Situação
      { wch: 18 }, // Data de Abertura
      { wch: 18 }, // CNAE Principal
      { wch: 50 }, // CNAE Descrição
      { wch: 20 }  // Vendedor
    ];
    ws['!cols'] = colWidths;

    // Generate file and trigger download
    XLSX.writeFile(wb, 'template_importacao_prospects.xlsx');
    toast.success("Template baixado com sucesso!");
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setAnalyzing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await supabase.functions.invoke("analyze-import-headers", {
        body: formData,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      setHeaders(result.headers);
      setAutoMappings(result.autoMappings || {});
      setUnmappedHeaders(result.unmappedHeaders || []);
      setTotalRows(result.totalRows);

      // Initialize manual mappings with auto mappings
      setManualMappings({ ...result.autoMappings });

      if (result.requiresManualMapping) {
        setStep("mapping");
        toast.info("Algumas colunas precisam de mapeamento manual");
      } else {
        toast.success("Todas as colunas foram mapeadas automaticamente!");
        setStep("mapping"); // Still show mapping for review
      }
    } catch (error: any) {
      console.error("Erro ao analisar arquivo:", error);
      toast.error("Erro ao analisar arquivo: " + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStartImport = async () => {
    if (!file) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Validate required fields
      const mappedFields = Object.values(manualMappings).filter(v => v !== "ignore");
      if (!mappedFields.includes("cnpj") || !mappedFields.includes("company_name")) {
        toast.error("Os campos CNPJ e Razão Social são obrigatórios");
        return;
      }

      const newSessionId = crypto.randomUUID();
      setSessionId(newSessionId);
      setStep("importing");

      setProgress({
        total: totalRows,
        processed: 0,
        success: 0,
        errors: 0,
        duplicates: 0,
      });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.id);
      formData.append("sessionId", newSessionId);
      formData.append("mappings", JSON.stringify(manualMappings));

      // Start import (non-blocking)
      supabase.functions.invoke("import-prospects-mapped", {
        body: formData,
      });

      toast.info("Importação iniciada! Acompanhe o progresso abaixo.");
    } catch (error: any) {
      console.error("Erro ao iniciar importação:", error);
      toast.error("Erro ao iniciar importação: " + error.message);
      setStep("upload");
    }
  };

  const handleClose = () => {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setAutoMappings({});
    setUnmappedHeaders([]);
    setManualMappings({});
    setSessionId("");
    setProgress({
      total: 0,
      processed: 0,
      success: 0,
      errors: 0,
      duplicates: 0,
    });
    setErrorDetails([]);
    setShowErrors(false);
    onOpenChange(false);
  };

  const progressPercentage = progress.total > 0 
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Importação de Prospects"}
            {step === "mapping" && "Mapeamento de Colunas"}
            {step === "importing" && "Importando Prospects"}
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between gap-4">
            <span>
              {step === "upload" && "Faça upload de uma planilha Excel (.xlsx ou .xls). A primeira linha será usada como cabeçalho."}
              {step === "mapping" && "Revise e ajuste o mapeamento das colunas para os campos do sistema."}
              {step === "importing" && "Aguarde enquanto os prospects são importados..."}
            </span>
            {step === "upload" && (
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="gap-2 shrink-0"
              >
                <Download className="h-4 w-4" />
                Baixar Template
              </Button>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Selecione a planilha</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) handleFileSelect(selectedFile);
                }}
                disabled={analyzing}
              />
            </div>

            {analyzing && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  Analisando cabeçalhos da planilha...
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Campos obrigatórios:</strong> CNPJ e Razão Social
                <br />
                <strong>Campos opcionais:</strong> Nome Fantasia, Telefone, Email, Endereço, Cidade, Estado, CEP, Segmento, Porte da Empresa, Região, Capital Social, Vendedor
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Foram encontradas {headers.length} colunas na planilha com {totalRows} linhas de dados.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Label>Mapeamento de Colunas</Label>
              {headers.map((header, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label className="text-sm font-normal">{header}</Label>
                  </div>
                  <div className="flex-1">
                    <Select
                      value={manualMappings[index] || ""}
                      onValueChange={(value) =>
                        setManualMappings({ ...manualMappings, [index]: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o campo" />
                      </SelectTrigger>
                      <SelectContent>
                        {SYSTEM_FIELDS.map((field) => (
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

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button onClick={handleStartImport} className="flex-1">
                <Upload className="mr-2 h-4 w-4" />
                Iniciar Importação
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span>{progress.processed} / {progress.total}</span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
              <p className="text-sm text-muted-foreground text-center">
                {progressPercentage}% concluído
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="text-2xl font-bold text-green-600">{progress.success}</div>
                <div className="text-xs text-muted-foreground">Sucessos</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="text-2xl font-bold text-yellow-600">{progress.duplicates}</div>
                <div className="text-xs text-muted-foreground">Duplicados</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-2xl font-bold text-red-600">{progress.errors}</div>
                <div className="text-xs text-muted-foreground">Erros</div>
              </div>
            </div>

            {errorDetails.length > 0 && progressPercentage === 100 && (
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

            {progressPercentage === 100 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Importação concluída com sucesso!
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
