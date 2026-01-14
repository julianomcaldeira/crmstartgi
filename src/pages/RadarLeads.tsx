import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Database, TrendingUp, Filter, Upload, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useRadarLeads, useRadarLeadsStats } from "@/hooks/useRadarLeads";

export default function RadarLeads() {
  const queryClient = useQueryClient();
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Buscar leads usando hook customizado com paginação
  const { data: leadsData, isLoading } = useRadarLeads(sourceFilter, statusFilter, searchTerm, currentPage);
  
  // Buscar estatísticas globais
  const { data: stats } = useRadarLeadsStats();

  const leads = leadsData?.leads || [];
  const totalCount = leadsData?.totalCount || 0;
  const totalPages = leadsData?.totalPages || 1;

  // Reset página ao mudar filtros
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  // Mutation para atribuir lead
  const assignMutation = useMutation({
    mutationFn: async ({ leadId, userId }: { leadId: string; userId: string | null }) => {
      const { error } = await supabase
        .from("radar_leads")
        .update({ assigned_to: userId })
        .eq("id", leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead atribuído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["radar-leads"] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao atribuir lead: ${error.message}`);
    },
  });

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

  // Mutation para converter lead em prospect
  const convertToProspectMutation = useMutation({
    mutationFn: async (lead: any) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Criar prospect a partir do lead
      const { data: newClient, error } = await supabase
        .from("clients")
        .insert({
          cnpj: lead.cnpj,
          company_name: lead.company_name,
          trade_name: lead.trade_name,
          email: lead.email,
          phone: lead.phone,
          city: lead.city,
          state: lead.state,
          segment: lead.segment,
          created_by: userData?.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Atualizar status do lead para "qualificado"
      await supabase
        .from("radar_leads")
        .update({ status: "qualificado" })
        .eq("id", lead.id);

      return newClient;
    },
    onSuccess: () => {
      toast.success("Lead convertido em prospect com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["radar-leads"] });
      queryClient.invalidateQueries({ queryKey: ["radar-leads-stats"] });
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao converter lead: ${error.message}`);
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

  // Obter fontes únicas das estatísticas
  const uniqueSources = stats?.uniqueSources || [];

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
              <label className="text-sm font-medium mb-2 block">Fonte</label>
              <Select value={sourceFilter} onValueChange={(v) => handleFilterChange(setSourceFilter, v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as fontes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as fontes</SelectItem>
                  {uniqueSources.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={(v) => handleFilterChange(setStatusFilter, v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="contatado">Contatado</SelectItem>
                  <SelectItem value="qualificado">Qualificado</SelectItem>
                  <SelectItem value="descartado">Descartado</SelectItem>
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
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead>Valor do Contrato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.company_name}</TableCell>
                      <TableCell>{lead.cnpj}</TableCell>
                      <TableCell>
                        <Badge className={getSourceBadgeColor(lead.source)}>
                          {lead.source?.toUpperCase() || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lead.contract_value
                          ? new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(lead.contract_value)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={lead.status || "novo"}
                          onValueChange={(value) =>
                            updateStatusMutation.mutate({ leadId: lead.id, status: value })
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <Badge className={getStatusBadgeColor(lead.status || "novo")}>
                              {(lead.status || "novo").charAt(0).toUpperCase() + (lead.status || "novo").slice(1)}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="novo">Novo</SelectItem>
                            <SelectItem value="contatado">Contatado</SelectItem>
                            <SelectItem value="qualificado">Qualificado</SelectItem>
                            <SelectItem value="descartado">Descartado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {lead.city && lead.state ? `${lead.city}/${lead.state}` : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {lead.status === "novo" && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => convertToProspectMutation.mutate(lead)}
                              disabled={convertToProspectMutation.isPending}
                            >
                              Converter em Prospect
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              assignMutation.mutate({
                                leadId: lead.id,
                                userId: lead.assigned_to ? null : "current-user-id",
                              })
                            }
                          >
                            {lead.assigned_to ? "Remover" : "Atribuir"}
                          </Button>
                        </div>
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
