import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Target, TrendingUp, DollarSign, Award } from "lucide-react";
import { toast } from "sonner";

const PerformanceVendedores = () => {
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSellerPerformance();
  }, []);

  const fetchSellerPerformance = async () => {
    try {
      // Fetch all users with vendedor or gestor role
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles!inner(role)
        `)
        .in("user_roles.role", ["vendedor", "gestor"]);

      if (usersError) throw usersError;

      // Fetch performance data for each seller
      const performancePromises = usersData.map(async (user) => {
        const [clientsRes, oppsRes, wonOppsRes] = await Promise.all([
          // Total clients created by this seller
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .eq("created_by", user.id),
          
          // Total opportunities
          supabase
            .from("opportunities")
            .select("id, value", { count: "exact" })
            .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`),
          
          // Won opportunities
          supabase
            .from("opportunities")
            .select("id, value", { count: "exact" })
            .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
            .eq("status", "won"),
        ]);

        const totalOppsValue = oppsRes.data?.reduce((sum, opp) => sum + (Number(opp.value) || 0), 0) || 0;
        const wonOppsValue = wonOppsRes.data?.reduce((sum, opp) => sum + (Number(opp.value) || 0), 0) || 0;
        const conversionRate = oppsRes.count ? ((wonOppsRes.count || 0) / oppsRes.count) * 100 : 0;

        return {
          ...user,
          role: user.user_roles[0]?.role,
          clientsCount: clientsRes.count || 0,
          opportunitiesCount: oppsRes.count || 0,
          wonOpportunitiesCount: wonOppsRes.count || 0,
          totalValue: totalOppsValue,
          wonValue: wonOppsValue,
          conversionRate: conversionRate.toFixed(1),
        };
      });

      const performance = await Promise.all(performancePromises);
      setSellers(performance.sort((a, b) => b.wonValue - a.wonValue));
    } catch (error) {
      console.error("Error fetching performance:", error);
      toast.error("Erro ao carregar performance dos vendedores");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") {
      return <Badge className="bg-primary/10 text-primary border-primary/20">Admin</Badge>;
    }
    if (role === "gestor") {
      return <Badge className="bg-info/10 text-info border-info/20">Gestor</Badge>;
    }
    return <Badge variant="secondary">Vendedor</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-2">
          Performance dos Vendedores
        </h1>
        <p className="text-muted-foreground">
          Acompanhe o desempenho de cada membro da equipe
        </p>
      </div>

      <div className="space-y-4">
        {sellers.map((seller, index) => (
          <Card key={seller.id} className="hover:shadow-lg transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {index < 3 && (
                    <Award className={`h-8 w-8 ${
                      index === 0 ? "text-yellow-500" : 
                      index === 1 ? "text-gray-400" : 
                      "text-amber-700"
                    }`} />
                  )}
                  <div>
                    <CardTitle className="text-xl">{seller.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{seller.email}</p>
                  </div>
                </div>
                {getRoleBadge(seller.role)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <Users className="h-5 w-5 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold text-foreground">{seller.clientsCount}</p>
                  <p className="text-xs text-muted-foreground">Clientes</p>
                </div>

                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <Target className="h-5 w-5 mx-auto mb-2 text-info" />
                  <p className="text-2xl font-bold text-foreground">{seller.opportunitiesCount}</p>
                  <p className="text-xs text-muted-foreground">Oportunidades</p>
                </div>

                <div className="text-center p-4 bg-success/10 rounded-lg border border-success/20">
                  <TrendingUp className="h-5 w-5 mx-auto mb-2 text-success" />
                  <p className="text-2xl font-bold text-success">{seller.wonOpportunitiesCount}</p>
                  <p className="text-xs text-muted-foreground">Convertidas</p>
                </div>

                <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <DollarSign className="h-5 w-5 mx-auto mb-2 text-primary" />
                  <p className="text-lg font-bold text-primary">{formatCurrency(seller.wonValue)}</p>
                  <p className="text-xs text-muted-foreground">Vendido</p>
                </div>

                <div className="text-center p-4 bg-warning/10 rounded-lg border border-warning/20">
                  <div className="text-2xl font-bold text-warning mb-1">{seller.conversionRate}%</div>
                  <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {sellers.length === 0 && (
          <Card className="p-12 text-center">
            <Users className="mx-auto mb-4 text-muted-foreground" size={48} />
            <p className="text-muted-foreground">Nenhum vendedor encontrado</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PerformanceVendedores;
