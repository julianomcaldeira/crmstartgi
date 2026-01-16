import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useQueries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, parse, startOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Save, Trash2, TrendingUp, DollarSign, Users, FileText, Loader2 } from "lucide-react";

interface IndicadorFundo {
  id?: string;
  mes_referencia: string;
  vendas: number;
  leads_novos_qualificados: number;
  propostas_enviadas: number;
  leads_negociacao: number;
  contratos_assinados: number;
  venda_na_base: number;
  gasto_midia: number;
  custo_comercial: number;
  cac?: number;
}

export default function IndicadoresFundo() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const { data: userRole, isLoading: isLoadingRole } = useUserRole(userId);
  const [indicadores, setIndicadores] = useState<IndicadorFundo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [newIndicador, setNewIndicador] = useState<IndicadorFundo | null>(null);

  // Verificar autenticação e role
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);
    };
    checkAuth();
  }, [navigate]);

  // Verificar se é admin
  useEffect(() => {
    if (!isLoadingRole && userRole !== "admin") {
      toast.error("Acesso negado. Apenas administradores podem acessar esta página.");
      navigate("/");
    }
  }, [userRole, isLoadingRole, navigate]);

  // Carregar indicadores
  useEffect(() => {
    if (userRole === "admin") {
      fetchIndicadores();
    }
  }, [selectedYear, userRole]);

  const fetchIndicadores = async () => {
    setIsLoading(true);
    try {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      
      const { data, error } = await supabase
        .from("indicadores_fundo")
        .select("*")
        .gte("mes_referencia", startDate)
        .lte("mes_referencia", endDate)
        .order("mes_referencia", { ascending: true });

      if (error) throw error;
      setIndicadores(data || []);
    } catch (error) {
      console.error("Erro ao carregar indicadores:", error);
      toast.error("Erro ao carregar indicadores");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMonth = () => {
    // Encontrar o próximo mês disponível
    const existingMonths = indicadores.map(i => i.mes_referencia);
    let nextMonth = startOfMonth(new Date(selectedYear, 0, 1));
    
    for (let i = 0; i < 12; i++) {
      const monthStr = format(nextMonth, "yyyy-MM-dd");
      if (!existingMonths.includes(monthStr)) {
        setNewIndicador({
          mes_referencia: monthStr,
          vendas: 0,
          leads_novos_qualificados: 0,
          propostas_enviadas: 0,
          leads_negociacao: 0,
          contratos_assinados: 0,
          venda_na_base: 0,
          gasto_midia: 0,
          custo_comercial: 0,
        });
        return;
      }
      nextMonth = addMonths(nextMonth, 1);
    }
    
    toast.info("Todos os meses do ano já foram cadastrados");
  };

  const handleSaveNew = async () => {
    if (!newIndicador) return;
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("indicadores_fundo")
        .insert({
          ...newIndicador,
          created_by: user?.id,
        });

      if (error) throw error;
      
      toast.success("Indicadores salvos com sucesso!");
      setNewIndicador(null);
      fetchIndicadores();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(error.message || "Erro ao salvar indicadores");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (indicador: IndicadorFundo) => {
    if (!indicador.id) return;
    
    try {
      const { error } = await supabase
        .from("indicadores_fundo")
        .update({
          vendas: indicador.vendas,
          leads_novos_qualificados: indicador.leads_novos_qualificados,
          propostas_enviadas: indicador.propostas_enviadas,
          leads_negociacao: indicador.leads_negociacao,
          contratos_assinados: indicador.contratos_assinados,
          venda_na_base: indicador.venda_na_base,
          gasto_midia: indicador.gasto_midia,
          custo_comercial: indicador.custo_comercial,
        })
        .eq("id", indicador.id);

      if (error) throw error;
      
      toast.success("Indicadores atualizados!");
      fetchIndicadores();
    } catch (error: any) {
      console.error("Erro ao atualizar:", error);
      toast.error(error.message || "Erro ao atualizar indicadores");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    
    try {
      const { error } = await supabase
        .from("indicadores_fundo")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Registro excluído!");
      fetchIndicadores();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error(error.message || "Erro ao excluir registro");
    }
  };

  const handleIndicadorChange = (index: number, field: keyof IndicadorFundo, value: number) => {
    const updated = [...indicadores];
    updated[index] = { ...updated[index], [field]: value };
    setIndicadores(updated);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return format(date, "MMMM yyyy", { locale: ptBR });
  };

  // Calcular totais
  const totals = indicadores.reduce(
    (acc, ind) => ({
      vendas: acc.vendas + Number(ind.vendas || 0),
      leads_novos_qualificados: acc.leads_novos_qualificados + Number(ind.leads_novos_qualificados || 0),
      propostas_enviadas: acc.propostas_enviadas + Number(ind.propostas_enviadas || 0),
      leads_negociacao: acc.leads_negociacao + Number(ind.leads_negociacao || 0),
      contratos_assinados: acc.contratos_assinados + Number(ind.contratos_assinados || 0),
      venda_na_base: acc.venda_na_base + Number(ind.venda_na_base || 0),
      gasto_midia: acc.gasto_midia + Number(ind.gasto_midia || 0),
      custo_comercial: acc.custo_comercial + Number(ind.custo_comercial || 0),
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

  const cacTotal = totals.contratos_assinados > 0 
    ? (totals.gasto_midia + totals.custo_comercial) / totals.contratos_assinados 
    : 0;

  if (isLoadingRole || (userRole !== "admin" && !isLoadingRole)) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Indicadores Fundo</h1>
          <p className="text-muted-foreground">
            Acompanhamento mensal de métricas comerciais
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
          <Button onClick={handleAddMonth}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Mês
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos Assinados</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.contratos_assinados}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Qualificados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.leads_novos_qualificados}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CAC Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(cacTotal)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Formulário para novo mês */}
      {newIndicador && (
        <Card>
          <CardHeader>
            <CardTitle>Novo Registro - {formatMonth(newIndicador.mes_referencia)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5">
              <div>
                <Label>Mês</Label>
                <Select 
                  value={newIndicador.mes_referencia}
                  onValueChange={(v) => setNewIndicador({ ...newIndicador, mes_referencia: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const date = new Date(selectedYear, i, 1);
                      const dateStr = format(date, "yyyy-MM-dd");
                      const exists = indicadores.some(ind => ind.mes_referencia === dateStr);
                      if (exists) return null;
                      return (
                        <SelectItem key={i} value={dateStr}>
                          {format(date, "MMMM", { locale: ptBR })}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vendas (R$)</Label>
                <Input
                  type="number"
                  value={newIndicador.vendas}
                  onChange={(e) => setNewIndicador({ ...newIndicador, vendas: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Leads Qualificados</Label>
                <Input
                  type="number"
                  value={newIndicador.leads_novos_qualificados}
                  onChange={(e) => setNewIndicador({ ...newIndicador, leads_novos_qualificados: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Propostas Enviadas</Label>
                <Input
                  type="number"
                  value={newIndicador.propostas_enviadas}
                  onChange={(e) => setNewIndicador({ ...newIndicador, propostas_enviadas: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Leads em Negociação</Label>
                <Input
                  type="number"
                  value={newIndicador.leads_negociacao}
                  onChange={(e) => setNewIndicador({ ...newIndicador, leads_negociacao: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Contratos Assinados</Label>
                <Input
                  type="number"
                  value={newIndicador.contratos_assinados}
                  onChange={(e) => setNewIndicador({ ...newIndicador, contratos_assinados: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Venda na Base (R$)</Label>
                <Input
                  type="number"
                  value={newIndicador.venda_na_base}
                  onChange={(e) => setNewIndicador({ ...newIndicador, venda_na_base: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Gasto com Mídia (R$)</Label>
                <Input
                  type="number"
                  value={newIndicador.gasto_midia}
                  onChange={(e) => setNewIndicador({ ...newIndicador, gasto_midia: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Custo Comercial (R$)</Label>
                <Input
                  type="number"
                  value={newIndicador.custo_comercial}
                  onChange={(e) => setNewIndicador({ ...newIndicador, custo_comercial: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSaveNew} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar
              </Button>
              <Button variant="outline" onClick={() => setNewIndicador(null)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de indicadores */}
      <Card>
        <CardHeader>
          <CardTitle>Indicadores por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : indicadores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum indicador cadastrado para {selectedYear}. Clique em "Adicionar Mês" para começar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead>Vendas (R$)</TableHead>
                    <TableHead>Leads Qualificados</TableHead>
                    <TableHead>Propostas</TableHead>
                    <TableHead>Em Negociação</TableHead>
                    <TableHead>Contratos</TableHead>
                    <TableHead>Venda Base (R$)</TableHead>
                    <TableHead>Gasto Mídia (R$)</TableHead>
                    <TableHead>Custo Comercial (R$)</TableHead>
                    <TableHead>CAC (R$)</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indicadores.map((indicador, index) => (
                    <TableRow key={indicador.id}>
                      <TableCell className="font-medium capitalize">
                        {formatMonth(indicador.mes_referencia)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-28"
                          value={indicador.vendas}
                          onChange={(e) => handleIndicadorChange(index, "vendas", parseFloat(e.target.value) || 0)}
                          onBlur={() => handleUpdate(indicador)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-20"
                          value={indicador.leads_novos_qualificados}
                          onChange={(e) => handleIndicadorChange(index, "leads_novos_qualificados", parseInt(e.target.value) || 0)}
                          onBlur={() => handleUpdate(indicador)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-20"
                          value={indicador.propostas_enviadas}
                          onChange={(e) => handleIndicadorChange(index, "propostas_enviadas", parseInt(e.target.value) || 0)}
                          onBlur={() => handleUpdate(indicador)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-20"
                          value={indicador.leads_negociacao}
                          onChange={(e) => handleIndicadorChange(index, "leads_negociacao", parseInt(e.target.value) || 0)}
                          onBlur={() => handleUpdate(indicador)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-20"
                          value={indicador.contratos_assinados}
                          onChange={(e) => handleIndicadorChange(index, "contratos_assinados", parseInt(e.target.value) || 0)}
                          onBlur={() => handleUpdate(indicador)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-28"
                          value={indicador.venda_na_base}
                          onChange={(e) => handleIndicadorChange(index, "venda_na_base", parseFloat(e.target.value) || 0)}
                          onBlur={() => handleUpdate(indicador)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-28"
                          value={indicador.gasto_midia}
                          onChange={(e) => handleIndicadorChange(index, "gasto_midia", parseFloat(e.target.value) || 0)}
                          onBlur={() => handleUpdate(indicador)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-28"
                          value={indicador.custo_comercial}
                          onChange={(e) => handleIndicadorChange(index, "custo_comercial", parseFloat(e.target.value) || 0)}
                          onBlur={() => handleUpdate(indicador)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(Number(indicador.cac) || 0)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(indicador.id!)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Linha de totais */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell>{formatCurrency(totals.vendas)}</TableCell>
                    <TableCell>{totals.leads_novos_qualificados}</TableCell>
                    <TableCell>{totals.propostas_enviadas}</TableCell>
                    <TableCell>{totals.leads_negociacao}</TableCell>
                    <TableCell>{totals.contratos_assinados}</TableCell>
                    <TableCell>{formatCurrency(totals.venda_na_base)}</TableCell>
                    <TableCell>{formatCurrency(totals.gasto_midia)}</TableCell>
                    <TableCell>{formatCurrency(totals.custo_comercial)}</TableCell>
                    <TableCell>{formatCurrency(cacTotal)}</TableCell>
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
