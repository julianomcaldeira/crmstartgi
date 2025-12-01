import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, Database, TrendingUp, Clock, Filter } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRadarLeads, useRadarSyncHistory } from "@/hooks/useRadarLeads";

export default function RadarLeads() {
  const queryClient = useQueryClient();
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Buscar leads usando hook customizado
  const { data: leads, isLoading } = useRadarLeads(sourceFilter, statusFilter, searchTerm);

  // Buscar histórico de sincronização
  const { data: syncHistory } = useRadarSyncHistory();

  // Mutation para sincronizar leads
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-radar-leads");
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `Sincronização concluída! ${data.totals.leads_new} novos leads, ${data.totals.leads_updated} atualizados.`
      );
      queryClient.invalidateQueries({ queryKey: ["radar-leads"] });
      queryClient.invalidateQueries({ queryKey: ["radar-sync-history"] });
    },
    onError: (error: any) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao converter lead: ${error.message}`);
    },
  });

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case "bndes":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "portal_compras":
        return "bg-green-100 text-green-800 border-green-300";
      case "sicaf":
        return "bg-purple-100 text-purple-800 border-purple-300";
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

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Radar de Leads</h1>
            <p className="text-muted-foreground">
              Empresas que vendem ao governo - BNDES, SICAF e Portal de Compras
            </p>
          </div>
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="gap-2"
          >
            {syncMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Sincronizar Agora
              </>
            )}
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leads?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Leads Novos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {leads?.filter((l) => l.status === "novo").length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Última Sincronização</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {syncHistory?.[0]?.sync_completed_at
                  ? formatDistanceToNow(new Date(syncHistory[0].sync_completed_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })
                  : "Nunca sincronizado"}
              </div>
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
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Fonte</label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as fontes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as fontes</SelectItem>
                    <SelectItem value="bndes">BNDES</SelectItem>
                    <SelectItem value="portal_compras">Portal de Compras</SelectItem>
                    <SelectItem value="sicaf">SICAF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
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
          <CardHeader>
            <CardTitle>Leads Capturados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
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
                  {leads?.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.company_name}</TableCell>
                      <TableCell>{lead.cnpj}</TableCell>
                      <TableCell>
                        <Badge className={getSourceBadgeColor(lead.source)}>
                          {lead.source.toUpperCase()}
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
                          value={lead.status}
                          onValueChange={(value) =>
                            updateStatusMutation.mutate({ leadId: lead.id, status: value })
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <Badge className={getStatusBadgeColor(lead.status)}>
                              {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
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
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}