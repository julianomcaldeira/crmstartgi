import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Database, TrendingUp, Filter, Upload, FileSpreadsheet, ChevronLeft, ChevronRight, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { useRadarLeads, useRadarLeadsStats, useRadarLeadsCities, SortColumn, SortDirection } from "@/hooks/useRadarLeads";
import { formatCNPJ } from "@/components/ui/masked-input";

export default function RadarLeads() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Buscar leads usando hook customizado com paginação e ordenação
  const { data: leadsData, isLoading } = useRadarLeads("all", "all", searchTerm, currentPage, sortColumn, sortDirection, stateFilter, cityFilter);
  
  // Buscar cidades com base no estado selecionado
  const { data: citiesForState } = useRadarLeadsCities(stateFilter);
  
  // Buscar estatísticas globais
  const { data: stats } = useRadarLeadsStats();

  const leads = leadsData?.leads || [];
  const totalCount = leadsData?.totalCount || 0;
  const totalPages = leadsData?.totalPages || 1;

  // Reset página ao mudar filtros
  const handleFilterChange = (setter: (value: string) => void, value: string, resetCity?: boolean) => {
    setter(value);
    setCurrentPage(1);
    // Reset cidade quando mudar estado
    if (resetCity) {
      setCityFilter("all");
    }
  };

  // Função para alternar ordenação
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  // Componente para cabeçalho ordenável
  const SortableHeader = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column ? (
          sortDirection === "asc" ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 text-muted-foreground/50" />
        )}
      </div>
    </TableHead>
  );


  // Mutation para atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      const { error } = await supabase
        .from("radar_leads")
        .update({ status })
        .eq("id", leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado!");
      queryClient.invalidateQueries({ queryKey: ["radar-leads"] });
      queryClient.invalidateQueries({ queryKey: ["radar-leads-stats"] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    },
  });

  // Mutation para excluir lead do radar
  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from("radar_leads")
        .delete()
        .eq("id", leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radar-leads"] });
      queryClient.invalidateQueries({ queryKey: ["radar-leads-stats"] });
    },
  });

  // Mutation para converter lead em prospect com validação e busca CNPJ
  const convertToProspectMutation = useMutation({
    mutationFn: async (lead: any) => {
      setConvertingLeadId(lead.id);
      
      const cleanCnpj = lead.cnpj?.replace(/\D/g, "") || "";
      
      if (!cleanCnpj || cleanCnpj.length !== 14) {
        throw new Error("CNPJ inválido. Não é possível converter este lead.");
      }

      // 1. Verificar se já existe como prospect/cliente
      const { data: existingClient, error: checkError } = await supabase
        .from("clients")
        .select("id, company_name")
        .eq("cnpj", cleanCnpj)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingClient) {
        // Já existe - deletar do radar e informar usuário
        await supabase
          .from("radar_leads")
          .delete()
          .eq("id", lead.id);

        return { 
          alreadyExists: true, 
          companyName: existingClient.company_name 
        };
      }

      // 2. Buscar dados completos do CNPJ na Receita Federal
      const { data: cnpjData, error: cnpjError } = await supabase.functions.invoke("buscar-cnpj", {
        body: { cnpj: cleanCnpj },
      });

      if (cnpjError) {
        console.error("Erro ao buscar CNPJ:", cnpjError);
        throw new Error("Erro ao consultar CNPJ na Receita Federal. Tente novamente.");
      }

      if (cnpjData?.error) {
        throw new Error(cnpjData.error);
      }

      // 3. Criar prospect com dados completos da Receita
      const { data: userData } = await supabase.auth.getUser();
      
      const { data: newClient, error: insertError } = await supabase
        .from("clients")
        .insert({
          cnpj: cleanCnpj,
          company_name: cnpjData.company_name || lead.company_name,
          trade_name: cnpjData.trade_name || lead.trade_name,
          email: cnpjData.email || lead.email,
          phone: cnpjData.phone || lead.phone,
          address: cnpjData.address,
          city: cnpjData.city || lead.city,
          state: cnpjData.state || lead.state,
          zip_code: cnpjData.zip_code,
          segment: cnpjData.segment || lead.segment,
          share_capital: cnpjData.share_capital,
          legal_nature: cnpjData.legal_nature,
          registration_status: cnpjData.registration_status,
          foundation_date: cnpjData.foundation_date,
          cnae_principal: cnpjData.cnae_principal,
          cnae_description: cnpjData.cnae_description,
          created_by: userData?.user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 4. Excluir lead do radar após conversão
      await supabase
        .from("radar_leads")
        .delete()
        .eq("id", lead.id);

      return { alreadyExists: false, newClient };
    },
    onSuccess: (result) => {
      setConvertingLeadId(null);
      
      if (result.alreadyExists) {
        toast.info(`A empresa "${result.companyName}" já está cadastrada como prospect. Lead removido do radar.`);
      } else {
        toast.success("Lead convertido em prospect com sucesso! Dados completos obtidos da Receita Federal.");
        // Redirect to the new prospect
        if (result.newClient?.id) {
          navigate(`/clientes/${result.newClient.id}`);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["radar-leads"] });
      queryClient.invalidateQueries({ queryKey: ["radar-leads-stats"] });
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    },
    onError: (error: any) => {
      setConvertingLeadId(null);
      toast.error(`Erro ao converter lead: ${error.message}`);
    },
  });

  // Mutation para limpar duplicados em lote
  const cleanDuplicatesMutation = useMutation({
    mutationFn: async () => {
      // 1. Buscar todos os leads do radar
      const { data: allLeads, error: leadsError } = await supabase
        .from("radar_leads")
        .select("id, cnpj, company_name");

      if (leadsError) throw leadsError;

      if (!allLeads || allLeads.length === 0) {
        return { removed: 0, duplicates: [] };
      }

      // 2. Extrair CNPJs únicos e limpos
      const leadsByCnpj = new Map<string, { id: string; company_name: string }[]>();
      allLeads.forEach(lead => {
        const cleanCnpj = lead.cnpj?.replace(/\D/g, "") || "";
        if (cleanCnpj.length === 14) {
          if (!leadsByCnpj.has(cleanCnpj)) {
            leadsByCnpj.set(cleanCnpj, []);
          }
          leadsByCnpj.get(cleanCnpj)!.push({ id: lead.id, company_name: lead.company_name });
        }
      });

      const uniqueCnpjs = Array.from(leadsByCnpj.keys());

      if (uniqueCnpjs.length === 0) {
        return { removed: 0, duplicates: [] };
      }

      // 3. Buscar quais CNPJs já existem como prospects (em batches de 100)
      const existingCnpjs: string[] = [];
      const batchSize = 100;

      for (let i = 0; i < uniqueCnpjs.length; i += batchSize) {
        const batch = uniqueCnpjs.slice(i, i + batchSize);
        const { data: existingClients } = await supabase
          .from("clients")
          .select("cnpj")
          .in("cnpj", batch);

        if (existingClients) {
          existingClients.forEach(client => {
            const cleanCnpj = client.cnpj?.replace(/\D/g, "") || "";
            if (cleanCnpj) existingCnpjs.push(cleanCnpj);
          });
        }
      }

      if (existingCnpjs.length === 0) {
        return { removed: 0, duplicates: [] };
      }

      // 4. Identificar leads duplicados para remover
      const leadsToRemove: string[] = [];
      const duplicateNames: string[] = [];

      existingCnpjs.forEach(cnpj => {
        const leads = leadsByCnpj.get(cnpj);
        if (leads) {
          leads.forEach(lead => {
            leadsToRemove.push(lead.id);
            if (!duplicateNames.includes(lead.company_name)) {
              duplicateNames.push(lead.company_name);
            }
          });
        }
      });

      // 5. Remover leads duplicados em batches
      for (let i = 0; i < leadsToRemove.length; i += batchSize) {
        const batch = leadsToRemove.slice(i, i + batchSize);
        await supabase
          .from("radar_leads")
          .delete()
          .in("id", batch);
      }

      return { removed: leadsToRemove.length, duplicates: duplicateNames };
    },
    onSuccess: (result) => {
      if (result.removed === 0) {
        toast.info("Nenhum lead duplicado encontrado. Todos os leads do radar são únicos!");
      } else {
        toast.success(`${result.removed} lead(s) duplicado(s) removido(s) do radar.`);
      }
      queryClient.invalidateQueries({ queryKey: ["radar-leads"] });
      queryClient.invalidateQueries({ queryKey: ["radar-leads-stats"] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao verificar duplicados: ${error.message}`);
    },
  });

  const getSourceBadgeColor = (source: string) => {
    switch (source?.toLowerCase()) {
      case "bndes":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "portal_compras":
        return "bg-green-100 text-green-800 border-green-300";
      case "sicaf":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "importacao":
        return "bg-orange-100 text-orange-800 border-orange-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "novo":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "contatado":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "qualificado":
        return "bg-green-100 text-green-800 border-green-300";
      case "descartado":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  // Obter fontes e estados únicos das estatísticas
  const uniqueSources = stats?.uniqueSources || [];
  const uniqueStates = stats?.uniqueStates || [];
  const availableCities = citiesForState || [];

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Radar de Leads</h1>
          <p className="text-muted-foreground">
            Gerencie sua base de leads importados
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => cleanDuplicatesMutation.mutate()}
            disabled={cleanDuplicatesMutation.isPending}
          >
            {cleanDuplicatesMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Limpar Duplicados
              </>
            )}
          </Button>
          <Button asChild variant="default" className="gap-2">
            <Link to="/admin/importar">
              <Upload className="h-4 w-4" />
              Importar Leads
            </Link>
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCount?.toLocaleString("pt-BR") || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Leads Novos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.newCount?.toLocaleString("pt-BR") || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fontes Cadastradas</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueSources.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar</label>
              <Input
                placeholder="Nome ou CNPJ..."
                value={searchTerm}
                onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Estado</label>
              <Select value={stateFilter} onValueChange={(v) => handleFilterChange(setStateFilter, v, true)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  {uniqueStates.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Cidade</label>
              <Select value={cityFilter} onValueChange={(v) => handleFilterChange(setCityFilter, v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as cidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as cidades</SelectItem>
                  {availableCities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Leads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Leads Importados</CardTitle>
          <span className="text-sm text-muted-foreground">
            Mostrando {leads.length} de {totalCount.toLocaleString("pt-BR")} leads
          </span>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum lead encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Importe uma planilha com seus leads para começar.
              </p>
              <Button asChild>
                <Link to="/admin/importar">
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Leads
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                     <SortableHeader column="company_name">Empresa</SortableHeader>
                     <SortableHeader column="cnpj">CNPJ</SortableHeader>
                     <SortableHeader column="city">Localização</SortableHeader>
                     <TableHead>Capital Social</TableHead>
                     <TableHead>Região</TableHead>
                     <TableHead>Ações</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {leads.map((lead) => (
                     <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          <button
                            className="text-left hover:text-primary hover:underline cursor-pointer transition-colors"
                            onClick={async () => {
                              const cleanCnpj = lead.cnpj?.replace(/\D/g, "") || "";
                              const { data: client } = await supabase
                                .from("clients")
                                .select("id")
                                .eq("cnpj", cleanCnpj)
                                .maybeSingle();
                              if (client) {
                                navigate(`/prospect/${client.id}`);
                              } else {
                                toast.info("Este lead ainda não foi convertido em prospect.");
                              }
                            }}
                          >
                            {lead.company_name}
                          </button>
                        </TableCell>
                       <TableCell className="font-mono text-sm">{formatCNPJ(lead.cnpj)}</TableCell>
                       <TableCell>
                         {lead.city && lead.state ? `${lead.city}/${lead.state}` : "-"}
                       </TableCell>
                       <TableCell className="text-sm">
                         {(lead.source_data as any)?.share_capital 
                           ? `R$ ${Number((lead.source_data as any).share_capital).toLocaleString('pt-BR')}` 
                           : "-"}
                       </TableCell>
                       <TableCell className="text-sm">
                         {(lead.source_data as any)?.region || "-"}
                       </TableCell>
                      <TableCell>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => convertToProspectMutation.mutate(lead)}
                          disabled={convertingLeadId === lead.id || convertToProspectMutation.isPending}
                        >
                          {convertingLeadId === lead.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Consultando...
                            </>
                          ) : (
                            "Converter em Prospect"
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    
                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
