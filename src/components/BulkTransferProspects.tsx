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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    initUserContext();
  }, []);

  const initUserContext = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = (roleData || []).map((r) => r.role);
      setIsManager(
        roles.includes("admin") || roles.includes("gestor") || roles.includes("pre_vendas"),
      );
    }
    fetchUsersWithCounts();
  };

  // Vendedor só pode transferir a própria carteira
  const sourceOptions = isManager
    ? users
    : users.filter((u) => u.id === currentUserId);

  const fetchUsersWithCounts = async () => {
    setLoading(true);
    try {
      // Fetch all users (excluding deleted users)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .or("is_deleted.is.null,is_deleted.eq.false")
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

  // Vendedor: a origem é fixa (a própria carteira), então pré-selecionamos
  useEffect(() => {
    if (!isManager && currentUserId && !sourceUserId) {
      setSourceUserId(currentUserId);
      handleSourceChange(currentUserId);
    }
  }, [isManager, currentUserId, sourceUserId]);

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
      // Vendedor só pode transferir a própria carteira
      if (!isManager && sourceUserId !== currentUserId) {
        toast.error("Você só pode transferir sua própria carteira");
        return;
      }

      // Captura os clientes da origem
      const { data: clientsToTransfer, error: fetchError } = await supabase
        .from("clients")
        .select("id")
        .eq("created_by", sourceUserId);
      if (fetchError) throw fetchError;
      const clientIds = (clientsToTransfer || []).map((c: any) => c.id);

      if (clientIds.length === 0) {
        toast.error("Nenhuma conta encontrada para transferir");
        return;
      }

      // Transferimos via RPC para respeitar as regras de ownership e propagar
      // as oportunidades em aberto. A RPC também aceita _new_owner_id nulo
      // (carteira disponível).
      const POOL = "__POOL__";
      const targetOwner = destinationUserId === POOL ? null : destinationUserId;

      const results = await Promise.all(
        clientIds.map((id: string) =>
          supabase.rpc("transfer_client_owner", {
            _client_id: id,
            _new_owner_id: targetOwner,
          } as any),
        ),
      );

      const failed = results.filter((r) => r.error);
      if (failed.length > 0) {
        console.error("Falhas parciais na transferência em lote:", failed.map((f) => f.error));
      }

      const okCount = clientIds.length - failed.length;
      if (okCount === 0) {
        throw failed[0]?.error || new Error("Nenhuma conta foi transferida");
      }

      const sourceUser = users.find((u) => u.id === sourceUserId);
      const destLabel =
        destinationUserId === POOL
          ? "Carteira de Contas Disponíveis"
          : users.find((u) => u.id === destinationUserId)?.full_name;

      if (failed.length > 0) {
        toast.warning(
          `${okCount} de ${clientIds.length} contas transferidas de ${sourceUser?.full_name} para ${destLabel}. ${failed.length} falharam (verifique as permissões no banco).`,
          { duration: 9000 },
        );
      } else {
        toast.success(
          `${okCount} contas transferidas de ${sourceUser?.full_name} para ${destLabel}! Oportunidades em aberto também foram transferidas.`,
        );
      }

      // Reset and refresh
      setSourceUserId("");
      setDestinationUserId("");
      setProspectCount(0);
      await fetchUsersWithCounts();
    } catch (error: any) {
      console.error("Erro ao transferir prospects:", error);
      toast.error("Erro ao transferir prospects: " + (error?.message || "tente novamente"));
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
            {isManager
              ? "Transfira todos os prospects de um vendedor para outro ou para a carteira disponível"
              : "Transfira toda a sua carteira para outro vendedor ou para a carteira disponível"}
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
          <Select
            value={sourceUserId}
            onValueChange={handleSourceChange}
            disabled={!isManager}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isManager
                    ? "Selecione o vendedor..."
                    : "Sua própria carteira"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {sourceOptions.map((user) => (
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
          <Label>Destino</Label>
          <Select value={destinationUserId} onValueChange={setDestinationUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o destino..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__POOL__">
                <div className="flex items-center justify-between w-full gap-2">
                  <span>Carteira de Contas Disponíveis</span>
                  <Badge variant="outline" className="ml-2">
                    sem responsável
                  </Badge>
                </div>
              </SelectItem>
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
          {destinationUserId && destinationUserId !== "__POOL__" && destUser && (
            <p className="text-sm text-muted-foreground">
              Total após transferência: {destUser.prospect_count + prospectCount} prospects
            </p>
          )}
          {destinationUserId === "__POOL__" && (
            <p className="text-sm text-muted-foreground">
              As contas ficarão sem responsável e poderão ser claimadas por qualquer vendedor.
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
      {isManager && (
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
      )}

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
                    {destinationUserId === "__POOL__" ? (
                      <>
                        <p className="font-medium text-foreground">
                          Carteira de Contas Disponíveis
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ficarão sem responsável
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-foreground">{destUser?.full_name}</p>
                        <p className="text-sm text-muted-foreground">{destUser?.email}</p>
                      </>
                    )}
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
