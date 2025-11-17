import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Image as ImageIcon, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface FeiraVisitsReportProps {
  feiraId: string;
  feiraName: string;
}

interface VisitStats {
  total: number;
  visited: number;
  pending: number;
  completionRate: number;
  totalPhotos: number;
}

interface SellerStats {
  sellerId: string;
  sellerName: string;
  visitsCount: number;
  photosCount: number;
}

export function FeiraVisitsReport({ feiraId, feiraName }: FeiraVisitsReportProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [sellerStats, setSellerStats] = useState<SellerStats[]>([]);

  useEffect(() => {
    if (open) {
      fetchReport();
    }
  }, [open, feiraId]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      // Fetch all visits for this feira
      const { data: visits, error: visitsError } = await supabase
        .from("client_feiras")
        .select(`
          *,
          clients (company_name)
        `)
        .eq("feira_id", feiraId);

      if (visitsError) throw visitsError;

      // Calculate general stats
      const total = visits?.length || 0;
      const visited = visits?.filter(v => v.visited).length || 0;
      const pending = total - visited;
      const completionRate = total > 0 ? (visited / total) * 100 : 0;

      // Fetch photos count
      const visitIds = visits?.map(v => v.id) || [];
      const { data: photos, error: photosError } = await supabase
        .from("client_feira_photos")
        .select("id, client_feira_id, uploaded_by")
        .in("client_feira_id", visitIds);

      if (photosError) throw photosError;

      const totalPhotos = photos?.length || 0;

      setStats({
        total,
        visited,
        pending,
        completionRate,
        totalPhotos,
      });

      // Calculate seller stats
      const sellerMap = new Map<string, { name: string; visits: number; photos: number }>();

      // Count visits by seller
      for (const visit of visits || []) {
        if (visit.visited && visit.visited_by) {
          const current = sellerMap.get(visit.visited_by) || { name: "", visits: 0, photos: 0 };
          current.visits += 1;
          sellerMap.set(visit.visited_by, current);
        }
      }

      // Count photos by seller
      for (const photo of photos || []) {
        if (photo.uploaded_by) {
          const current = sellerMap.get(photo.uploaded_by) || { name: "", visits: 0, photos: 0 };
          current.photos += 1;
          sellerMap.set(photo.uploaded_by, current);
        }
      }

      // Fetch seller names
      const sellerIds = Array.from(sellerMap.keys());
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", sellerIds);

      const sellerStatsArray: SellerStats[] = [];
      for (const [sellerId, data] of sellerMap.entries()) {
        const profile = profiles?.find(p => p.id === sellerId);
        sellerStatsArray.push({
          sellerId,
          sellerName: profile?.full_name || "Desconhecido",
          visitsCount: data.visits,
          photosCount: data.photos,
        });
      }

      // Sort by visits count
      sellerStatsArray.sort((a, b) => b.visitsCount - a.visitsCount);
      setSellerStats(sellerStatsArray);

    } catch (error) {
      console.error("Error fetching report:", error);
      toast.error("Erro ao carregar relatório");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BarChart3 className="h-4 w-4 mr-2" />
          Relatório de Visitas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relatório de Visitas - {feiraName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Carregando relatório...</p>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* General Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Empresas</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Visitadas</p>
                    <p className="text-2xl font-bold text-success">{stats.visited}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-warning/10 rounded-lg">
                    <Circle className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pendentes</p>
                    <p className="text-2xl font-bold text-warning">{stats.pending}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-info/10 rounded-lg">
                    <ImageIcon className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Fotos</p>
                    <p className="text-2xl font-bold">{stats.totalPhotos}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Completion Rate */}
            <Card className="p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Taxa de Conclusão</h3>
                  </div>
                  <span className="text-2xl font-bold text-primary">
                    {stats.completionRate.toFixed(1)}%
                  </span>
                </div>
                <Progress value={stats.completionRate} className="h-3" />
                <p className="text-sm text-muted-foreground">
                  {stats.visited} de {stats.total} empresas visitadas
                </p>
              </div>
            </Card>

            {/* Seller Statistics */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Estatísticas por Vendedor
              </h3>
              {sellerStats.length > 0 ? (
                <div className="space-y-4">
                  {sellerStats.map((seller) => (
                    <div key={seller.sellerId} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{seller.sellerName}</p>
                        <p className="text-sm text-muted-foreground">
                          {seller.visitsCount} visita{seller.visitsCount !== 1 ? 's' : ''} • {seller.photosCount} foto{seller.photosCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div className="text-center">
                          <p className="font-bold text-lg">{seller.visitsCount}</p>
                          <p className="text-muted-foreground">Visitas</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-lg">{seller.photosCount}</p>
                          <p className="text-muted-foreground">Fotos</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  Nenhuma visita registrada ainda
                </p>
              )}
            </Card>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
