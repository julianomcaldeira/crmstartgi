import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Target, TrendingUp, DollarSign, Award } from "lucide-react";
import { toast } from "sonner";

const PerformanceVendedores = () => {
  const [sellers, setSellers] = useState<any[]>([]);
  const [productRanking, setProductRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSellerPerformance();
    fetchProductRanking();
  }, []);

  const fetchProductRanking = async () => {
    try {
      const { data: oppsData, error } = await supabase
        .from("opportunities")
        .select(`
          product_id,
          status,
          value,
          implementation_value,
          monthly_value,
          product:products(name, logo_url)
        `)
        .eq("status", "won")
        .not("product_id", "is", null);

      if (error) throw error;

      // Group by product and calculate totals
      const productMap = new Map();
      oppsData?.forEach((opp) => {
        if (!opp.product_id || !opp.product) return;
        
        const existing = productMap.get(opp.product_id) || {
          productId: opp.product_id,
          productName: opp.product.name,
          logoUrl: opp.product.logo_url,
          quantity: 0,
          totalValue: 0,
          implementationValue: 0,
          monthlyValue: 0,
        };

        existing.quantity += 1;
        existing.totalValue += Number(opp.value) || 0;
        existing.implementationValue += Number(opp.implementation_value) || 0;
        existing.monthlyValue += Number(opp.monthly_value) || 0;

        productMap.set(opp.product_id, existing);
      });

      const ranking = Array.from(productMap.values())
        .sort((a, b) => b.totalValue - a.totalValue);
      
      setProductRanking(ranking);
    } catch (error) {
      console.error("Error fetching product ranking:", error);
    }
  };

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

      {productRanking.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Ranking de Produtos Mais Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {productRanking.map((product, index) => (
                <div 
                  key={product.productId}
                  className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                      index === 0 ? "bg-yellow-500/20 text-yellow-700" :
                      index === 1 ? "bg-gray-400/20 text-gray-700" :
                      index === 2 ? "bg-amber-700/20 text-amber-800" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {index + 1}
                    </div>
                    {product.logoUrl && (
                      <img 
                        src={product.logoUrl} 
                        alt={product.productName}
                        className="h-8 w-8 object-contain bg-white rounded p-1"
                      />
                    )}
                    <div>
                      <p className="font-semibold">{product.productName}</p>
                      <p className="text-sm text-muted-foreground">
                        {product.quantity} venda{product.quantity !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(product.totalValue)}
                    </p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {product.implementationValue > 0 && (
                        <span>Impl: {formatCurrency(product.implementationValue)}</span>
                      )}
                      {product.monthlyValue > 0 && (
                        <span>Mensal: {formatCurrency(product.monthlyValue)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
