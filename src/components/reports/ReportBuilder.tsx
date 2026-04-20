import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileText,
  Sparkles,
  FileDown,
  Eye,
  Database,
  Layers,
  ListChecks,
} from "lucide-react";
import { ANALYTIC_TABLES, AnalyticTable } from "@/lib/analyticReportSchema";

export type ReportMode = "sintetico" | "analitico" | "hibrido";

export interface AnalyticTableSelection {
  tableId: string;
  selectedColumns: string[];
  filters: Record<string, any>;
}

export interface ReportConfig {
  // Compatibilidade com sintético existente
  type:
    | "vendas"
    | "tarefas"
    | "equipe"
    | "feiras"
    | "oportunidades"
    | "clientes"
    | "produtos"
    | "completo"
    | "custom";
  sections: string[];
  includeAIAnalysis: boolean;
  groupBy?: string;
  sortBy?: string;
  // Novos campos
  mode: ReportMode;
  analyticTables?: AnalyticTableSelection[];
}

interface ReportBuilderProps {
  onGenerate: (config: ReportConfig) => void;
  onPreview: (config: ReportConfig) => void;
  onExportAnalytic?: (config: ReportConfig) => void;
  loading?: boolean;
  sellers?: Array<{ id: string; full_name: string }>;
}

const syntheticTypes = [
  { value: "completo", label: "Completo", description: "Todos os indicadores agregados" },
  { value: "vendas", label: "Vendas", description: "KPIs de vendas e conversão" },
  { value: "tarefas", label: "Tarefas", description: "Produtividade da equipe" },
  { value: "equipe", label: "Equipe", description: "Performance individual" },
  { value: "oportunidades", label: "Oportunidades", description: "Pipeline e funil" },
  { value: "produtos", label: "Produtos", description: "Ranking de produtos" },
  { value: "feiras", label: "Feiras", description: "Leads por feira" },
];

const syntheticSections = [
  { id: "kpis_vendas", label: "KPIs de Vendas", category: "vendas" },
  { id: "tendencias", label: "Tendências", category: "vendas" },
  { id: "top_produtos", label: "Top Produtos", category: "produtos" },
  { id: "kpis_tarefas", label: "KPIs de Tarefas", category: "tarefas" },
  { id: "tarefas_tipo", label: "Tarefas por Tipo", category: "tarefas" },
  { id: "ranking_equipe", label: "Ranking da Equipe", category: "equipe" },
  { id: "performance_individual", label: "Performance Individual", category: "equipe" },
  { id: "oportunidades_status", label: "Oportunidades por Status", category: "oportunidades" },
  { id: "leads_feira", label: "Leads por Feira", category: "feiras" },
];

export function ReportBuilder({
  onGenerate,
  onPreview,
  onExportAnalytic,
  loading,
  sellers = [],
}: ReportBuilderProps) {
  const [mode, setMode] = useState<ReportMode>("sintetico");
  const [includeAI, setIncludeAI] = useState(true);

  // Sintético
  const [syntheticType, setSyntheticType] = useState<string>("completo");

  // Analítico/Híbrido
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>(["opportunities"]);
  const [tableState, setTableState] = useState<Record<string, AnalyticTableSelection>>({});

  // Inicializa estado das tabelas selecionadas com colunas/filtros default
  useEffect(() => {
    setTableState((prev) => {
      const next = { ...prev };
      selectedTableIds.forEach((id) => {
        if (!next[id]) {
          const table = ANALYTIC_TABLES.find((t) => t.id === id);
          if (table) {
            next[id] = {
              tableId: id,
              selectedColumns: [...table.defaultColumns],
              filters: {},
            };
          }
        }
      });
      // remove desmarcadas
      Object.keys(next).forEach((id) => {
        if (!selectedTableIds.includes(id)) delete next[id];
      });
      return next;
    });
  }, [selectedTableIds]);

  const toggleTable = (id: string) =>
    setSelectedTableIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const toggleColumn = (tableId: string, columnKey: string) => {
    setTableState((prev) => {
      const tbl = prev[tableId];
      if (!tbl) return prev;
      const cols = tbl.selectedColumns.includes(columnKey)
        ? tbl.selectedColumns.filter((c) => c !== columnKey)
        : [...tbl.selectedColumns, columnKey];
      return { ...prev, [tableId]: { ...tbl, selectedColumns: cols } };
    });
  };

  const updateFilter = (tableId: string, filterKey: string, value: any) => {
    setTableState((prev) => {
      const tbl = prev[tableId];
      if (!tbl) return prev;
      return { ...prev, [tableId]: { ...tbl, filters: { ...tbl.filters, [filterKey]: value } } };
    });
  };

  const selectAllColumns = (tableId: string) => {
    const t = ANALYTIC_TABLES.find((x) => x.id === tableId);
    if (!t) return;
    setTableState((prev) => ({
      ...prev,
      [tableId]: { ...prev[tableId], selectedColumns: t.columns.map((c) => c.key) },
    }));
  };

  const clearColumns = (tableId: string) => {
    setTableState((prev) => ({ ...prev, [tableId]: { ...prev[tableId], selectedColumns: [] } }));
  };

  const buildConfig = (): ReportConfig => ({
    type: mode === "sintetico" ? (syntheticType as ReportConfig["type"]) : "custom",
    sections:
      mode === "sintetico"
        ? syntheticType === "completo"
          ? syntheticSections.map((s) => s.id)
          : syntheticSections.filter((s) => s.category === syntheticType).map((s) => s.id)
        : [],
    includeAIAnalysis: includeAI,
    mode,
    analyticTables: mode === "sintetico" ? undefined : selectedTableIds.map((id) => tableState[id]).filter(Boolean),
  });

  const totalSelectedColumns = useMemo(
    () => Object.values(tableState).reduce((acc, t) => acc + (t?.selectedColumns?.length || 0), 0),
    [tableState]
  );

  const canGenerateAnalytic = selectedTableIds.length > 0 && totalSelectedColumns > 0;

  return (
    <div className="space-y-6">
      {/* Mode selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Tipo de Relatório
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                value: "sintetico" as const,
                label: "Sintético",
                desc: "Indicadores agregados, KPIs e gráficos",
                icon: FileText,
              },
              {
                value: "analitico" as const,
                label: "Analítico",
                desc: "Linha-a-linha com colunas que você escolhe",
                icon: Database,
              },
              {
                value: "hibrido" as const,
                label: "Híbrido",
                desc: "Resumo + detalhamento em uma única planilha",
                icon: ListChecks,
              },
            ].map((m) => {
              const Icon = m.icon;
              const sel = mode === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    sel ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <Icon className={`h-6 w-6 mb-2 ${sel ? "text-primary" : "text-muted-foreground"}`} />
                  <p className={`font-medium ${sel ? "text-primary" : ""}`}>{m.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sintético */}
      {mode === "sintetico" && (
        <Card>
          <CardHeader>
            <CardTitle>Foco do relatório sintético</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {syntheticTypes.map((t) => {
                const sel = syntheticType === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setSyntheticType(t.value)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      sel ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <p className={`font-medium text-sm ${sel ? "text-primary" : ""}`}>{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analítico/Híbrido — escolha de tabelas */}
      {mode !== "sintetico" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Tabelas a incluir
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {ANALYTIC_TABLES.map((t) => {
                  const sel = selectedTableIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTable(t.id)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        sel ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className={`font-medium text-sm ${sel ? "text-primary" : ""}`}>{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.columns.length} campos</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Configuração por tabela */}
          {selectedTableIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Campos e filtros por tabela</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" defaultValue={selectedTableIds.slice(0, 1)} className="w-full">
                  {selectedTableIds.map((id) => {
                    const t = ANALYTIC_TABLES.find((x) => x.id === id) as AnalyticTable;
                    const state = tableState[id];
                    if (!t || !state) return null;
                    return (
                      <AccordionItem key={id} value={id}>
                        <AccordionTrigger>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{t.label}</span>
                            <Badge variant="secondary">{state.selectedColumns.length} colunas</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-muted-foreground">Selecione as colunas para exportar</p>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => selectAllColumns(id)}>
                                  Todos
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => clearColumns(id)}>
                                  Limpar
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {t.columns.map((col) => (
                                <label
                                  key={col.key}
                                  className="flex items-center gap-2 p-2 rounded border hover:bg-muted/40 cursor-pointer"
                                >
                                  <Checkbox
                                    checked={state.selectedColumns.includes(col.key)}
                                    onCheckedChange={() => toggleColumn(id, col.key)}
                                  />
                                  <span className="text-sm">{col.label}</span>
                                </label>
                              ))}
                            </div>

                            {t.filters.length > 0 && (
                              <div className="space-y-3 pt-3 border-t">
                                <p className="text-sm font-medium">Filtros</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {t.filters.map((f) => {
                                    const val = state.filters[f.key];
                                    if (f.type === "date_range") {
                                      return (
                                        <div key={f.key} className="space-y-1">
                                          <Label className="text-xs">{f.label}</Label>
                                          <div className="flex gap-2">
                                            <Input
                                              type="date"
                                              value={val?.from || ""}
                                              onChange={(e) =>
                                                updateFilter(id, f.key, { ...val, from: e.target.value })
                                              }
                                            />
                                            <Input
                                              type="date"
                                              value={val?.to || ""}
                                              onChange={(e) =>
                                                updateFilter(id, f.key, { ...val, to: e.target.value })
                                              }
                                            />
                                          </div>
                                        </div>
                                      );
                                    }
                                    if (f.type === "select") {
                                      const opts =
                                        f.key === t.sellerField
                                          ? sellers.map((s) => ({ value: s.id, label: s.full_name }))
                                          : f.options || [];
                                      return (
                                        <div key={f.key} className="space-y-1">
                                          <Label className="text-xs">{f.label}</Label>
                                          <Select
                                            value={val || "all"}
                                            onValueChange={(v) =>
                                              updateFilter(id, f.key, v === "all" ? "" : v)
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="all">Todos</SelectItem>
                                              {opts.map((o) => (
                                                <SelectItem key={o.value} value={o.value}>
                                                  {o.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      );
                                    }
                                    if (f.type === "number_min" || f.type === "number_max") {
                                      return (
                                        <div key={f.key} className="space-y-1">
                                          <Label className="text-xs">{f.label}</Label>
                                          <Input
                                            type="number"
                                            value={val ?? ""}
                                            onChange={(e) => updateFilter(id, f.key, e.target.value)}
                                          />
                                        </div>
                                      );
                                    }
                                    return (
                                      <div key={f.key} className="space-y-1">
                                        <Label className="text-xs">{f.label}</Label>
                                        <Input
                                          value={val ?? ""}
                                          onChange={(e) => updateFilter(id, f.key, e.target.value)}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* IA toggle */}
      {mode === "sintetico" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 p-4 rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10">
              <Checkbox
                id="include-ai"
                checked={includeAI}
                onCheckedChange={(c) => setIncludeAI(c as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="include-ai" className="flex items-center gap-2 cursor-pointer font-medium">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Incluir Análise IA
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Gera insights e recomendações automáticas baseadas nos dados
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-muted-foreground">
          Modo:{" "}
          <Badge variant="secondary" className="ml-1">
            {mode === "sintetico" ? "Sintético" : mode === "analitico" ? "Analítico" : "Híbrido"}
          </Badge>
          {mode !== "sintetico" && (
            <span className="ml-2">
              {selectedTableIds.length} tabela(s) · {totalSelectedColumns} coluna(s)
            </span>
          )}
        </div>
        <div className="flex gap-3">
          {mode === "sintetico" ? (
            <>
              <Button variant="outline" onClick={() => onPreview(buildConfig())} disabled={loading}>
                <Eye className="h-4 w-4 mr-2" />
                Visualizar
              </Button>
              <Button
                onClick={() => onGenerate(buildConfig())}
                disabled={loading}
                className="bg-gradient-to-r from-primary to-primary-light"
              >
                <FileDown className="h-4 w-4 mr-2" />
                Gerar Relatório
              </Button>
            </>
          ) : (
            <Button
              onClick={() => onExportAnalytic?.(buildConfig())}
              disabled={loading || !canGenerateAnalytic}
              className="bg-gradient-to-r from-primary to-primary-light"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
