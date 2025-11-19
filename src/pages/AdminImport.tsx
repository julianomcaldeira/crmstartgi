import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Download, Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type ImportType = "prospects" | "feiras" | "knowledge_base" | "contacts" | "opportunities" | "tasks";

interface ImportProgress {
  total: number;
  processed: number;
  success: number;
  errors: number;
  duplicates: number;
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
  }
};

const AdminImport = () => {
  const navigate = useNavigate();
  const [importType, setImportType] = useState<ImportType | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setProgress(null);
      setErrorDetails([]);
    }
  };

  const handleImport = async () => {
    if (!file || !importType) {
      toast.error("Selecione o tipo de importação e arquivo");
      return;
    }

    setImporting(true);
    setProgress({ total: 0, processed: 0, success: 0, errors: 0, duplicates: 0 });
    setErrorDetails([]);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const sessionId = `import_${Date.now()}`;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.id);
      formData.append("sessionId", sessionId);
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
        .channel(`import-${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "import_progress",
            filter: `session_id=eq.${sessionId}`,
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

            <Button
              onClick={handleImport}
              disabled={!file || importing}
              className="w-full"
              size="lg"
            >
              <Upload className="mr-2 h-4 w-4" />
              {importing ? "Importando..." : "Iniciar Importação"}
            </Button>
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
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Erros encontrados:</strong>
                  <ul className="mt-2 list-disc list-inside text-sm">
                    {errorDetails.slice(0, 10).map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                    {errorDetails.length > 10 && (
                      <li>... e mais {errorDetails.length - 10} erros</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminImport;
