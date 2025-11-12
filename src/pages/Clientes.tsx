import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Phone, Mail, ExternalLink, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

const Clientes = () => {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      // Buscar clientes que têm pelo menos uma oportunidade ganha
      const { data, error } = await supabase
        .from("clients")
        .select(`
          *,
          opportunities!inner(id, status, value, created_at),
          profiles:created_by(full_name, email)
        `)
        .eq("opportunities.status", "won")
        .order("company_name");

      if (error) throw error;

      // Agrupar por cliente único e calcular resumo
      const clientesUnicos = data?.reduce((acc: any[], client) => {
        const existingClient = acc.find((c) => c.id === client.id);
        
        if (!existingClient) {
          // Filtrar todas as oportunidades ganhas deste cliente
          const clientOpportunities = data.filter((c) => c.id === client.id);
          
          const totalValue = clientOpportunities.reduce(
            (sum, c) => sum + (Number(c.opportunities[0]?.value) || 0),
            0
          );

          const sortedOpps = clientOpportunities.sort(
            (a, b) =>
              new Date(a.opportunities[0]?.created_at).getTime() -
              new Date(b.opportunities[0]?.created_at).getTime()
          );

          acc.push({
            ...client,
            wonOpportunitiesCount: clientOpportunities.length,
            totalValue,
            firstWonDate: sortedOpps[0]?.opportunities[0]?.created_at,
          });
        }
        
        return acc;
      }, []);

      setClientes(clientesUnicos || []);
    } catch (error) {
      console.error("Error fetching clientes:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Clientes</h1>
        <p className="text-muted-foreground">
          Empresas com oportunidades ganhas - Total de {clientes.length} cliente
          {clientes.length !== 1 ? "s" : ""}
        </p>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Carregando...</p>
      ) : clientes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="mx-auto mb-4 text-muted-foreground" size={48} />
            <p className="text-muted-foreground">
              Nenhum cliente cadastrado ainda. Clientes aparecem aqui quando uma oportunidade
              é marcada como Ganha.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {clientes.map((cliente) => (
            <Card
              key={cliente.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/prospects/${cliente.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="h-6 w-6 text-green-600" />
                      <div>
                        <CardTitle className="text-xl">
                          {cliente.trade_name || cliente.company_name}
                        </CardTitle>
                        {cliente.trade_name && (
                          <p className="text-sm text-muted-foreground">
                            {cliente.company_name}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="default" className="bg-green-600">
                        Cliente Ativo
                      </Badge>
                      <Badge variant="outline">
                        {cliente.wonOpportunitiesCount} oportunidade
                        {cliente.wonOpportunitiesCount !== 1 ? "s" : ""} ganha
                        {cliente.wonOpportunitiesCount !== 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="secondary">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(cliente.totalValue)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {[cliente.city, cliente.state].filter(Boolean).join(" - ") ||
                          "Não informado"}
                      </span>
                    </div>

                    {cliente.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{cliente.phone}</span>
                      </div>
                    )}

                    {cliente.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{cliente.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {cliente.segment && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Segmento: </span>
                        <span className="font-medium">{cliente.segment}</span>
                      </div>
                    )}

                    {cliente.company_size && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Porte: </span>
                        <span className="font-medium">{cliente.company_size}</span>
                      </div>
                    )}

                    {cliente.firstWonDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Cliente desde: </span>
                        <span className="font-medium">
                          {new Date(cliente.firstWonDate).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Responsável:</span>
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-lg border border-green-200 dark:border-green-800">
                      <span className="font-medium">
                        {cliente.profiles?.full_name || "Não atribuído"}
                      </span>
                      {cliente.profiles?.email && (
                        <span className="text-xs">({cliente.profiles.email})</span>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/prospects/${cliente.id}`);
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver Detalhes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Clientes;