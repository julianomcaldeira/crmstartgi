import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Users, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface UserWithCount {
  id: string;
  full_name: string;
  email: string;
  prospect_count: number;
}

export const BulkTransferProspects = () => {
  const [users, setUsers] = useState<UserWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceUserId, setSourceUserId] = useState<string>("");
  const [destinationUserId, setDestinationUserId] = useState<string>("");
  const [transferring, setTransferring] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [prospectCount, setProspectCount] = useState(0);

  useEffect(() => {
    fetchUsersWithCounts();
  }, []);

  const fetchUsersWithCounts = async () => {
    setLoading(true);
    try {
      // Fetch all users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");

      if (profilesError) throw profilesError;

      // Fetch prospect counts per user
      const { data: counts, error: countsError } = await supabase
        .from("clients")
        .select("created_by");

      if (countsError) throw countsError;

      // Count prospects per user
      const countMap = new Map<string, number>();
      counts?.forEach((client) => {
        const count = countMap.get(client.created_by) || 0;
        countMap.set(client.created_by, count + 1);
      });

      // Merge users with counts
      const usersWithCounts: UserWithCount[] = (profiles || []).map((profile) => ({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        prospect_count: countMap.get(profile.id) || 0,
      }));

      // Sort by prospect count descending
      usersWithCounts.sort((a, b) => b.prospect_count - a.prospect_count);

      setUsers(usersWithCounts);
    } catch (error: any) {
      console.error("Erro ao carregar usuários:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const handleSourceChange = async (userId: string) => {
    setSourceUserId(userId);
    
    if (userId) {
      // Get count of prospects for selected user
      const { count, error } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("created_by", userId);

      if (!error) {
        setProspectCount(count || 0);
      }
    } else {
      setProspectCount(0);
    }
  };

  const handleTransfer = async () => {
    if (!sourceUserId || !destinationUserId) {
      toast.error("Selecione o vendedor de origem e destino");
      return;
    }

    if (sourceUserId === destinationUserId) {
      toast.error("O vendedor de origem e destino devem ser diferentes");
      return;
    }

    setConfirmDialogOpen(true);
  };

  const executeTransfer = async () => {
    setTransferring(true);
    setConfirmDialogOpen(false);

    try {
      const { error } = await supabase
        .from("clients")
        .update({ created_by: destinationUserId })
        .eq("created_by", sourceUserId);

      if (error) throw error;

      const sourceUser = users.find((u) => u.id === sourceUserId);
      const destUser = users.find((u) => u.id === destinationUserId);

      toast.success(
        `${prospectCount} prospects transferidos de ${sourceUser?.full_name} para ${destUser?.full_name}!`
      );

      // Reset and refresh
      setSourceUserId("");
      setDestinationUserId("");
      setProspectCount(0);
      await fetchUsersWithCounts();
    } catch (error: any) {
      console.error("Erro ao transferir prospects:", error);
      toast.error("Erro ao transferir prospects: " + error.message);
    } finally {
      setTransferring(false);
    }
  };

  const sourceUser = users.find((u) => u.id === sourceUserId);
  const destUser = users.find((u) => u.id === destinationUserId);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando usuários...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5" />
            Transferência de Prospects em Lote
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Transfira todos os prospects de um vendedor para outro
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchUsersWithCounts}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
        {/* Source User */}
        <div className="space-y-2">
          <Label>Vendedor de Origem</Label>
          <Select value={sourceUserId} onValueChange={handleSourceChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o vendedor..." />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem 
                  key={user.id} 
                  value={user.id}
                  disabled={user.id === destinationUserId}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span>{user.full_name}</span>
                    <Badge variant="secondary" className="ml-2">
                      {user.prospect_count} prospects
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sourceUserId && (
            <p className="text-sm text-muted-foreground">
              {prospectCount} prospects serão transferidos
            </p>
          )}
        </div>

        {/* Arrow */}
        <div className="flex justify-center items-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowRight className="h-6 w-6" />
          </div>
        </div>

        {/* Destination User */}
        <div className="space-y-2">
          <Label>Vendedor de Destino</Label>
          <Select value={destinationUserId} onValueChange={setDestinationUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o vendedor..." />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem 
                  key={user.id} 
                  value={user.id}
                  disabled={user.id === sourceUserId}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span>{user.full_name}</span>
                    <Badge variant="secondary" className="ml-2">
                      {user.prospect_count} prospects
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {destinationUserId && destUser && (
            <p className="text-sm text-muted-foreground">
              Total após transferência: {destUser.prospect_count + prospectCount} prospects
            </p>
          )}
        </div>
      </div>

      {/* Transfer Button */}
      <div className="mt-6 flex justify-end">
        <Button
          onClick={handleTransfer}
          disabled={!sourceUserId || !destinationUserId || transferring || prospectCount === 0}
          className="bg-primary hover:bg-primary-dark text-primary-foreground"
        >
          {transferring ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Transferindo...
            </>
          ) : (
            <>
              <Users className="h-4 w-4 mr-2" />
              Transferir {prospectCount} Prospects
            </>
          )}
        </Button>
      </div>

      {/* Summary Table */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Resumo por Vendedor
        </h3>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Vendedor
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Email
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Prospects
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {user.full_name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.email}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge 
                      variant={user.prospect_count > 0 ? "default" : "secondary"}
                      className={user.prospect_count > 1000 ? "bg-primary" : ""}
                    >
                      {user.prospect_count.toLocaleString("pt-BR")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30">
              <tr>
                <td className="px-4 py-3 font-semibold text-foreground" colSpan={2}>
                  Total de Prospects
                </td>
                <td className="px-4 py-3 text-right">
                  <Badge className="bg-primary text-primary-foreground">
                    {users.reduce((sum, u) => sum + u.prospect_count, 0).toLocaleString("pt-BR")}
                  </Badge>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Confirmar Transferência
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a transferir <strong>{prospectCount.toLocaleString("pt-BR")} prospects</strong>:
              </p>
              <div className="bg-muted/50 rounded-lg p-4 my-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{sourceUser?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{sourceUser?.email}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground mx-4" />
                  <div className="text-right">
                    <p className="font-medium text-foreground">{destUser?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{destUser?.email}</p>
                  </div>
                </div>
              </div>
              <p className="text-warning font-medium">
                Esta ação não pode ser desfeita facilmente. Deseja continuar?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeTransfer}
              className="bg-primary hover:bg-primary-dark text-primary-foreground"
            >
              Confirmar Transferência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
