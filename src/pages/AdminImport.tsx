import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Download, Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, ChevronDown, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

type ImportType = "prospects" | "feiras" | "knowledge_base" | "contacts" | "opportunities" | "tasks" | "radar_leads";

interface ImportProgress {
  total: number;
  processed: number;
  success: number;
  errors: number;
  duplicates: number;
}

interface ValidationError {
  row: number;
  field: string;
  value: any;
  message: string;
}

interface PreviewData {
  headers: string[];
  rows: any[];
  validationErrors: ValidationError[];
  isValid: boolean;
}

const IMPORT_TEMPLATES = {
  prospects: {
    name: "Prospects",
    columns: ["CNPJ", "Razão Social", "Nome Fantasia", "Email", "Telefone", "Logradouro", "Número", "Complemento", "Cidade", "Estado", "CEP", "Segmento", "Porte", "Região", "Capital Social", "CNAE Principal", "CNAE Descrição", "Situação", "Data Abertura", "Natureza Jurídica", "Vendedor"],
    description: "Importar lista de prospects/clientes potenciais"
  },
  feiras: {
    name: "Feiras",
    columns: ["Data Início", "Data Fim", "Nome", "Segmento", "Local"],
    description: "Importar lista de feiras e eventos"
  },
  knowledge_base: {
    name: "Base de Conhecimento",
    columns: ["Título", "Conteúdo", "Categoria", "Tipo", "URL", "Tags"],
    description: "Importar artigos da base de conhecimento"
  },
  contacts: {
    name: "Contatos",
    columns: ["CNPJ Cliente", "Nome", "Email", "Telefone", "Celular", "Cargo", "Principal"],
    description: "Importar contatos de clientes"
  },
  opportunities: {
    name: "Oportunidades",
    columns: ["CNPJ Cliente", "Produto", "Valor Implementação", "Valor Mensal", "Probabilidade", "Tipo Negócio", "Data Fechamento", "Vendedor"],
    description: "Importar oportunidades de vendas"
  },
  tasks: {
    name: "Tarefas",
    columns: ["Título", "Descrição", "CNPJ Cliente", "Tipo", "Data Vencimento", "Prioridade", "Vendedor"],
    description: "Importar tarefas"
  },
  radar_leads: {
    name: "Radar de Leads",
    columns: ["CNPJ", "Razão Social", "Nome Fantasia", "Fonte", "Email", "Telefone", "Cidade", "Estado", "Segmento", "Valor Contrato", "Data Contrato", "Notas", "Vendedor"],
    description: "Importar leads para o Radar de Leads"
  }
};

const AdminImport = () => {
  const navigate = useNavigate();
  const [importType, setImportType] = useState<ImportType | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [validating, setValidating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");

  // Load import history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const { data, error } = await supabase
      .from('import_history')
      .select(`
        *,
        profiles!import_history_user_id_fkey(full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setImportHistory(data);
    }
  };

  const exportErrors = () => {
    if (!errorDetails || errorDetails.length === 0) {
      toast.error("Sem erros", { description: "Não há erros para exportar nesta importação." });
      return;
    }

    const errorsData = errorDetails.map(err => ({ erro: err }));
    const ws = XLSX.utils.json_to_sheet(errorsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Erros");
    XLSX.writeFile(wb, `erros_importacao_${sessionId}_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);

    toast.success("Relatório exportado", { description: "O arquivo com os erros foi baixado com sucesso." });
  };

  const downloadTemplate = () => {
    if (!importType) {
      toast.error("Selecione o tipo de importação primeiro");
      return;
    }

    const template = IMPORT_TEMPLATES[importType];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([template.columns]);
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `template_${importType}.xlsx`);
    toast.success("Template baixado com sucesso!");
  };

  const validateCNPJ = (cnpj: string): boolean => {
    const cleaned = String(cnpj).replace(/\D/g, '');
    if (cleaned.length !== 14) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cleaned)) return false;
    
    // Validação dos dígitos verificadores
    let sum = 0;
    let pos = 5;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleaned.charAt(i)) * pos;
      pos = pos === 2 ? 9 : pos - 1;
    }
    let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (parseInt(cleaned.charAt(12)) !== digit) return false;
    
    sum = 0;
    pos = 6;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cleaned.charAt(i)) * pos;
      pos = pos === 2 ? 9 : pos - 1;
    }
    digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return parseInt(cleaned.charAt(13)) === digit;
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateDate = (date: string): boolean => {
    if (!date) return true; // Campo opcional
    const dateObj = new Date(date);
    return !isNaN(dateObj.getTime());
  };

  const validatePhone = (phone: string): boolean => {
    if (!phone) return true; // Campo opcional
    const cleaned = String(phone).replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 11;
  };

  const validateField = (
    importType: ImportType,
    field: string,
    value: any,
    row: number
  ): ValidationError | null => {
    // Campos obrigatórios por tipo de importação
    const requiredFields: Record<ImportType, string[]> = {
      prospects: ['CNPJ', 'Razão Social'],
      feiras: ['Nome'],
      knowledge_base: ['Título', 'Conteúdo'],
      contacts: ['CNPJ Cliente', 'Nome'],
      opportunities: ['CNPJ Cliente', 'Produto'],
      tasks: ['Título'],
      radar_leads: ['CNPJ', 'Razão Social']
    };

    const required = requiredFields[importType];
    
    // Verifica campo obrigatório
    if (required.includes(field) && (!value || value === '')) {
      return {
        row,
        field,
        value,
        message: `Campo obrigatório não preenchido`
      };
    }

    // Validações específicas por campo
    if (field === 'CNPJ' || field === 'CNPJ Cliente') {
      if (value && !validateCNPJ(value)) {
        return {
          row,
          field,
          value,
          message: 'CNPJ inválido'
        };
      }
    }

    if (field === 'Email' && value && !validateEmail(value)) {
      return {
        row,
        field,
        value,
        message: 'Email inválido'
      };
    }

    if ((field === 'Data Início' || field === 'Data Fim' || field === 'Data Fechamento' || field === 'Data Vencimento' || field === 'Data Abertura') && value && !validateDate(value)) {
      return {
        row,
        field,
        value,
        message: 'Data inválida'
      };
    }

    if ((field === 'Telefone' || field === 'Celular') && value && !validatePhone(value)) {
      return {
        row,
        field,
        value,
        message: 'Telefone inválido (deve ter 10-11 dígitos)'
      };
    }

    if (field === 'Probabilidade' && value) {
      const validProbabilities = [10, 25, 50, 80, 90];
      if (!validProbabilities.includes(Number(value))) {
        return {
          row,
          field,
          value,
          message: 'Probabilidade deve ser: 10, 25, 50, 80 ou 90'
        };
      }
    }

    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setProgress(null);
      setErrorDetails([]);
      setPreviewData(null);
      setShowPreview(false);
      
      // Validação automática do arquivo
      if (importType) {
        await validateFile(selectedFile);
      }
    }
  };

  const validateFile = async (fileToValidate: File) => {
    if (!importType) {
      toast.error("Selecione o tipo de importação primeiro");
      return;
    }

    setValidating(true);
    
    try {
      const arrayBuffer = await fileToValidate.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });
      
      const template = IMPORT_TEMPLATES[importType];
      const headers = Object.keys(data[0] || {});
      const validationErrors: ValidationError[] = [];
      
      // Valida cada linha
      data.forEach((row: any, index: number) => {
        template.columns.forEach(column => {
          const error = validateField(importType, column, row[column], index + 2);
          if (error) {
            validationErrors.push(error);
          }
        });
      });

      setPreviewData({
        headers,
        rows: data.slice(0, 10), // Mostra primeiras 10 linhas
        validationErrors,
        isValid: validationErrors.length === 0
      });

      setShowPreview(true);

      if (validationErrors.length === 0) {
        toast.success(`Arquivo validado! ${data.length} registros prontos para importação.`);
      } else {
        toast.warning(`${validationErrors.length} erros de validação encontrados. Revise antes de importar.`);
      }
    } catch (error: any) {
      console.error("Erro na validação:", error);
      toast.error("Erro ao validar arquivo: " + error.message);
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!file || !importType) {
      toast.error("Selecione o tipo de importação e arquivo");
      return;
    }

    if (previewData && !previewData.isValid) {
      const confirmImport = window.confirm(
        `Foram encontrados ${previewData.validationErrors.length} erros de validação. Deseja continuar mesmo assim? Alguns registros podem falhar na importação.`
      );
      if (!confirmImport) return;
    }

    setImporting(true);
    setShowPreview(false);
    setProgress({ total: 0, processed: 0, success: 0, errors: 0, duplicates: 0 });
    setErrorDetails([]);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const newSessionId = `import_${Date.now()}`;
      setSessionId(newSessionId);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.id);
      formData.append("sessionId", newSessionId);
      formData.append("importType", importType);

      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "universal-import",
        {
          body: formData,
        }
      );

      if (functionError) throw functionError;

      // Subscribe to real-time progress
      const channel = supabase
        .channel(`import-${newSessionId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "import_progress",
            filter: `session_id=eq.${newSessionId}`,
          },
          (payload: any) => {
            const data = payload.new;
            setProgress({
              total: data.total_rows,
              processed: data.processed_rows,
              success: data.success_count,
              errors: data.error_count,
              duplicates: data.duplicate_count,
            });

            if (data.error_message) {
              try {
                const errors = JSON.parse(data.error_message);
                setErrorDetails(errors);
              } catch {
                setErrorDetails([data.error_message]);
              }
            }

            if (data.status === "completed") {
              toast.success(`Importação concluída! ${data.success_count} registros importados`);
              setImporting(false);
              channel.unsubscribe();
              loadHistory(); // Reload history after completion
            }
          }
        )
        .subscribe();

      toast.success("Importação iniciada!");
    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast.error(error.message || "Erro ao iniciar importação");
      setImporting(false);
    }
  };

  const progressPercentage = progress ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Importação de Dados</h1>
          <p className="text-muted-foreground">Importe dados em massa para o sistema</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecione o Tipo de Importação</CardTitle>
          <CardDescription>
            Escolha qual tipo de dados você deseja importar e baixe o template correspondente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Dados</label>
            <Select value={importType} onValueChange={(value) => setImportType(value as ImportType)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de importação" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(IMPORT_TEMPLATES).map(([key, template]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex flex-col">
                      <span className="font-medium">{template.name}</span>
                      <span className="text-xs text-muted-foreground">{template.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {importType && (
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                <strong>Colunas do template:</strong> {IMPORT_TEMPLATES[importType].columns.join(", ")}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              onClick={downloadTemplate}
              disabled={!importType}
              variant="outline"
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar Template Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {importType && (
        <Card>
          <CardHeader>
            <CardTitle>Upload do Arquivo</CardTitle>
            <CardDescription>
              Selecione o arquivo Excel preenchido com os dados para importação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                disabled={importing}
              />
            </div>

            {file && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Arquivo selecionado: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              {file && !showPreview && (
                <Button
                  onClick={() => validateFile(file)}
                  disabled={validating || importing}
                  variant="outline"
                  className="flex-1"
                >
                  {validating ? "Validando..." : "Validar Arquivo"}
                </Button>
              )}
              
              <Button
                onClick={handleImport}
                disabled={!file || importing || validating}
                className="flex-1"
                size="lg"
              >
                <Upload className="mr-2 h-4 w-4" />
                {importing ? "Importando..." : showPreview ? "Confirmar Importação" : "Iniciar Importação"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showPreview && previewData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {previewData.isValid ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              Preview e Validação
            </CardTitle>
            <CardDescription>
              {previewData.isValid 
                ? "Todos os dados foram validados com sucesso!"
                : `${previewData.validationErrors.length} erros encontrados - revise antes de importar`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Erros de Validação */}
            {previewData.validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Erros de Validação ({previewData.validationErrors.length}):</strong>
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                    {previewData.validationErrors.slice(0, 20).map((error, i) => (
                      <div key={i} className="text-xs border-l-2 border-red-500 pl-2 py-1">
                        <strong>Linha {error.row}, Campo "{error.field}":</strong> {error.message}
                        {error.value && <span className="text-muted-foreground"> (valor: "{error.value}")</span>}
                      </div>
                    ))}
                    {previewData.validationErrors.length > 20 && (
                      <p className="text-xs text-muted-foreground italic">
                        ... e mais {previewData.validationErrors.length - 20} erros
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Preview das Primeiras Linhas */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Preview (primeiras 10 linhas):</h3>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">#</th>
                      {previewData.headers.map((header, i) => (
                        <th key={i} className="px-2 py-1 text-left font-medium">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1 text-muted-foreground">{i + 2}</td>
                        {previewData.headers.map((header, j) => (
                          <td key={j} className="px-2 py-1 max-w-[200px] truncate">
                            {row[header] || <span className="text-muted-foreground italic">vazio</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                <strong>Total de registros:</strong> {previewData.rows.length}+ linhas detectadas
                {!previewData.isValid && (
                  <div className="mt-2 text-yellow-600">
                    ⚠️ Registros com erros serão ignorados durante a importação
                  </div>
                )}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {progress && (
        <Card>
          <CardHeader>
            <CardTitle>Progresso da Importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span>{progress.processed} / {progress.total}</span>
              </div>
              <Progress value={progressPercentage} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-500">{progress.success}</p>
                  <p className="text-xs text-muted-foreground">Sucesso</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold text-yellow-500">{progress.duplicates}</p>
                  <p className="text-xs text-muted-foreground">Duplicados</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-500">{progress.errors}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <FileSpreadsheet className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold text-blue-500">{progress.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </div>

            {errorDetails.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Ver Detalhes dos Erros ({errorDetails.length})
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Erros encontrados:</strong>
                      <ul className="mt-2 list-disc list-inside text-sm max-h-60 overflow-y-auto">
                        {errorDetails.slice(0, 50).map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                        {errorDetails.length > 50 && (
                          <li>... e mais {errorDetails.length - 50} erros</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import History Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <CardTitle>Histórico de Importações</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? "Ocultar" : "Mostrar"}
            </Button>
          </div>
          <CardDescription>Auditoria completa de todas as importações realizadas</CardDescription>
        </CardHeader>

        {showHistory && (
          <CardContent className="space-y-3">
            {importHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma importação realizada ainda
              </p>
            ) : (
              importHistory.map((record) => (
                <div
                  key={record.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        record.status === 'completed' ? 'bg-green-500' : 
                        record.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                      <div>
                        <p className="font-medium">{record.file_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(record.created_at), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {IMPORT_TEMPLATES[record.import_type as ImportType]?.name || record.import_type}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-medium">{record.total_rows}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sucesso</p>
                      <p className="font-medium text-green-600">{record.success_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Erros</p>
                      <p className="font-medium text-red-600">{record.error_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duplicados</p>
                      <p className="font-medium text-yellow-600">{record.duplicate_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tamanho</p>
                      <p className="font-medium">{record.file_size ? `${(record.file_size / 1024).toFixed(1)} KB` : '-'}</p>
                    </div>
                  </div>

                  {record.profiles && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">
                        Importado por: <span className="font-medium text-foreground">
                          {record.profiles.full_name} ({record.profiles.email})
                        </span>
                      </p>
                    </div>
                  )}

                  {record.error_details && record.error_details.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const ws = XLSX.utils.json_to_sheet(record.error_details);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "Erros");
                        XLSX.writeFile(wb, `erros_${record.file_name}_${format(new Date(record.created_at), "yyyyMMdd_HHmm")}.xlsx`);
                        toast.success("Relatório exportado", { description: "O arquivo com os erros foi baixado." });
                      }}
                      className="w-full"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Erros em Excel
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        )}
      </Card>

      {/* Export Errors Button for Current Import */}
      {errorDetails.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Exportar Erros da Importação Atual</h3>
                <p className="text-sm text-muted-foreground">
                  {errorDetails.length} erro(s) encontrado(s)
                </p>
              </div>
              <Button
                onClick={exportErrors}
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Erros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminImport;
