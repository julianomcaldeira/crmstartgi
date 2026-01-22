import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Save, TrendingUp, DollarSign, Users, FileText, Loader2, RefreshCw } from "lucide-react";
import { NumericFormat } from "react-number-format";

interface IndicadorMensal {
  mes_referencia: string;
  vendas: number;
  leads_novos_qualificados: number;
  propostas_enviadas: number;
  leads_negociacao: number;
  contratos_assinados: number;
  venda_na_base: number;
  gasto_midia: number;
  custo_comercial: number;
  cac: number;
  id?: string;
}

export function IndicadoresFundoTab() {
  const [indicadores, setIndicadores] = useState<IndicadorMensal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchIndicadores();
  }, [selectedYear]);

  const fetchIndicadores = async () => {
    setIsLoading(true);
    try {
      const yearStart = startOfYear(new Date(selectedYear, 0, 1));
      const yearEnd = endOfYear(new Date(selectedYear, 0, 1));
      
      const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
      
      const { data: manualData, error: manualError } = await supabase
        .from("indicadores_fundo")
        .select("*")
        .gte("mes_referencia", format(yearStart, "yyyy-MM-dd"))
        .lte("mes_referencia", format(yearEnd, "yyyy-MM-dd"));

      if (manualError) throw manualError;

      const { data: opportunities, error: oppError } = await supabase
        .from("opportunities")
        .select("id, status, value, monthly_value, business_type, created_at, updated_at")
        .gte("created_at", yearStart.toISOString())
        .lte("created_at", yearEnd.toISOString());

      if (oppError) throw oppError;

      const indicadoresMensais: IndicadorMensal[] = months.map(monthDate => {
        const mesRef = format(monthDate, "yyyy-MM-dd");
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        const oppsDoMes = (opportunities || []).filter(opp => {
          const createdAt = new Date(opp.created_at);
          return createdAt >= monthStart && createdAt <= monthEnd;
        });

        const vendas = oppsDoMes
          .filter(o => o.status === "won")
          .reduce((sum, o) => sum + (Number(o.value) || Number(o.monthly_value) * 12 || 0), 0);

        const leads_novos_qualificados = oppsDoMes
          .filter(o => ["qualified", "apresentacao", "proposal", "negotiation", "won"].includes(o.status || ""))
          .length;

        const propostas_enviadas = oppsDoMes
          .filter(o => ["proposal", "negotiation", "won"].includes(o.status || ""))
          .length;

        const leads_negociacao = oppsDoMes
          .filter(o => o.status === "negotiation")
          .length;

        const contratos_assinados = oppsDoMes
          .filter(o => o.status === "won")
          .length;

        const venda_na_base = oppsDoMes
          .filter(o => o.status === "won" && o.business_type === "venda_na_base")
          .reduce((sum, o) => sum + (Number(o.value) || Number(o.monthly_value) * 12 || 0), 0);

        const dadosManuais = manualData?.find(m => m.mes_referencia === mesRef);
        const gasto_midia = Number(dadosManuais?.gasto_midia) || 0;
        const custo_comercial = Number(dadosManuais?.custo_comercial) || 0;
        const cac = gasto_midia + custo_comercial;

        return {
          mes_referencia: mesRef,
          vendas,
          leads_novos_qualificados,
          propostas_enviadas,
          leads_negociacao,
          contratos_assinados,
          venda_na_base,
          gasto_midia,
          custo_comercial,
          cac,
          id: dadosManuais?.id,
        };
      });

      setIndicadores(indicadoresMensais);
    } catch (error) {
      console.error("Erro ao carregar indicadores:", error);
      toast.error("Erro ao carregar indicadores");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCosts = async (indicador: IndicadorMensal) => {
    setIsSaving(indicador.mes_referencia);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (indicador.id) {
        const { error } = await supabase
          .from("indicadores_fundo")
          .update({
            gasto_midia: indicador.gasto_midia,
            custo_comercial: indicador.custo_comercial,
          })
          .eq("id", indicador.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("indicadores_fundo")
          .insert({
            mes_referencia: indicador.mes_referencia,
            vendas: indicador.vendas,
            leads_novos_qualificados: indicador.leads_novos_qualificados,
            propostas_enviadas: indicador.propostas_enviadas,
            leads_negociacao: indicador.leads_negociacao,
            contratos_assinados: indicador.contratos_assinados,
            venda_na_base: indicador.venda_na_base,
            gasto_midia: indicador.gasto_midia,
            custo_comercial: indicador.custo_comercial,
            created_by: user?.id,
          });

        if (error) throw error;
      }
      
      toast.success("Custos salvos com sucesso!");
      fetchIndicadores();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(error.message || "Erro ao salvar custos");
    } finally {
      setIsSaving(null);
    }
  };

  const handleCostChange = (index: number, field: "gasto_midia" | "custo_comercial", value: number) => {
    const updated = [...indicadores];
    const newGastoMidia = field === "gasto_midia" ? value : updated[index].gasto_midia;
    const newCustoComercial = field === "custo_comercial" ? value : updated[index].custo_comercial;
    
    updated[index] = { 
      ...updated[index], 
      [field]: value,
      cac: newGastoMidia + newCustoComercial
    };
    setIndicadores(updated);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getCacColor = (cac: number): string => {
    if (cac === 0) return "text-muted-foreground";
    if (cac <= 5000) return "text-green-600";
    if (cac <= 15000) return "text-yellow-600";
    return "text-red-600";
  };

  const getCacBgColor = (cac: number): string => {
    if (cac === 0) return "bg-muted";
    if (cac <= 5000) return "bg-green-100 dark:bg-green-900/30";
    if (cac <= 15000) return "bg-yellow-100 dark:bg-yellow-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return format(date, "MMMM", { locale: ptBR });
  };

  const totals = indicadores.reduce(
    (acc, ind) => ({
      vendas: acc.vendas + ind.vendas,
      leads_novos_qualificados: acc.leads_novos_qualificados + ind.leads_novos_qualificados,
      propostas_enviadas: acc.propostas_enviadas + ind.propostas_enviadas,
      leads_negociacao: acc.leads_negociacao + ind.leads_negociacao,
      contratos_assinados: acc.contratos_assinados + ind.contratos_assinados,
      venda_na_base: acc.venda_na_base + ind.venda_na_base,
      gasto_midia: acc.gasto_midia + ind.gasto_midia,
      custo_comercial: acc.custo_comercial + ind.custo_comercial,
    }),
    {
      vendas: 0,
      leads_novos_qualificados: 0,
      propostas_enviadas: 0,
      leads_negociacao: 0,
      contratos_assinados: 0,
      venda_na_base: 0,
      gasto_midia: 0,
      custo_comercial: 0,
    }
  );

  const cacTotal = totals.gasto_midia + totals.custo_comercial;
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Indicadores Fundo</h2>
          <p className="text-sm text-muted-foreground">
            Dados calculados automaticamente do CRM + custos manuais
          </p>
        </div>
        <div className="flex gap-2">
          <Select 
            value={selectedYear.toString()} 
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchIndicadores} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.vendas)}</div>
            <p className="text-xs text-muted-foreground">
              Venda na Base: {formatCurrency(totals.venda_na_base)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos Assinados</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.contratos_assinados}</div>
            <p className="text-xs text-muted-foreground">
              Propostas: {totals.propostas_enviadas}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Qualificados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.leads_novos_qualificados}</div>
            <p className="text-xs text-muted-foreground">
              Em negociação: {totals.leads_negociacao}
            </p>
          </CardContent>
        </Card>
        <Card className={getCacBgColor(cacTotal)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CAC</CardTitle>
            <TrendingUp className={`h-4 w-4 ${getCacColor(cacTotal)}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getCacColor(cacTotal)}`}>{formatCurrency(cacTotal)}</div>
            <p className="text-xs text-muted-foreground">
              Mídia: {formatCurrency(totals.gasto_midia)} | Comercial: {formatCurrency(totals.custo_comercial)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de indicadores */}
      <Card>
        <CardHeader>
          <CardTitle>Indicadores por Mês</CardTitle>
          <p className="text-sm text-muted-foreground">
            Os dados de vendas e leads são calculados automaticamente do CRM. Preencha apenas os custos (Gasto com Mídia e Custo Comercial).
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-center">Qualificados</TableHead>
                    <TableHead className="text-center">Propostas</TableHead>
                    <TableHead className="text-center">Negociação</TableHead>
                    <TableHead className="text-center">Contratos</TableHead>
                    <TableHead className="text-right">Venda Base</TableHead>
                    <TableHead>Gasto Mídia</TableHead>
                    <TableHead>Custo Comercial</TableHead>
                    <TableHead className="text-right">CAC</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indicadores.map((indicador, index) => (
                    <TableRow key={indicador.mes_referencia}>
                      <TableCell className="font-medium capitalize">
                        {formatMonth(indicador.mes_referencia)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(indicador.vendas)}
                      </TableCell>
                      <TableCell className="text-center">
                        {indicador.leads_novos_qualificados}
                      </TableCell>
                      <TableCell className="text-center">
                        {indicador.propostas_enviadas}
                      </TableCell>
                      <TableCell className="text-center">
                        {indicador.leads_negociacao}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {indicador.contratos_assinados}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(indicador.venda_na_base)}
                      </TableCell>
                      <TableCell>
                        <NumericFormat
                          value={indicador.gasto_midia || ""}
                          onValueChange={(values) => handleCostChange(index, "gasto_midia", values.floatValue || 0)}
                          thousandSeparator="."
                          decimalSeparator=","
                          prefix="R$ "
                          decimalScale={2}
                          fixedDecimalScale
                          allowNegative={false}
                          placeholder="R$ 0,00"
                          className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </TableCell>
                      <TableCell>
                        <NumericFormat
                          value={indicador.custo_comercial || ""}
                          onValueChange={(values) => handleCostChange(index, "custo_comercial", values.floatValue || 0)}
                          thousandSeparator="."
                          decimalSeparator=","
                          prefix="R$ "
                          decimalScale={2}
                          fixedDecimalScale
                          allowNegative={false}
                          placeholder="R$ 0,00"
                          className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </TableCell>
                      <TableCell className={`text-right font-medium ${getCacColor(indicador.cac)}`}>
                        {formatCurrency(indicador.cac)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSaveCosts(indicador)}
                          disabled={isSaving === indicador.mes_referencia}
                          title="Salvar custos deste mês"
                        >
                          {isSaving === indicador.mes_referencia ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Linha de totais */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TOTAL {selectedYear}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(totals.vendas)}</TableCell>
                    <TableCell className="text-center">{totals.leads_novos_qualificados}</TableCell>
                    <TableCell className="text-center">{totals.propostas_enviadas}</TableCell>
                    <TableCell className="text-center">{totals.leads_negociacao}</TableCell>
                    <TableCell className="text-center">{totals.contratos_assinados}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.venda_na_base)}</TableCell>
                    <TableCell>{formatCurrency(totals.gasto_midia)}</TableCell>
                    <TableCell>{formatCurrency(totals.custo_comercial)}</TableCell>
                    <TableCell className={`text-right ${getCacColor(cacTotal)}`}>{formatCurrency(cacTotal)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
