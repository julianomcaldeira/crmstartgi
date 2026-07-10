import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Handshake, Check, X, Inbox, Send, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  canManageAll?: boolean;
  onChanged?: () => void;
}

type Req = {
  id: string;
  client_id: string;
  requester_id: string;
  owner_id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  request_message: string | null;
  response_message: string | null;
  created_at: string;
  responded_at: string | null;
  client?: { company_name: string | null; trade_name: string | null };
  requester?: { full_name: string | null; email: string | null };
  owner?: { full_name: string | null; email: string | null };
};

const statusBadge = (s: Req["status"]) => {
  const map: Record<Req["status"], { label: string; cls: string }> = {
    pending: { label: "Pendente", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
    approved: { label: "Aprovada", cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200" },
    rejected: { label: "Recusada", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
    cancelled: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[s];
  return <Badge className={m.cls}>{m.label}</Badge>;
};

export const TransferRequestsPanel = ({ open, onOpenChange, currentUserId, canManageAll = false, onChanged }: Props) => {
  const [loading, setLoading] = useState(false);
  const [received, setReceived] = useState<Req[]>([]);
  const [sent, setSent] = useState<Req[]>([]);
  const [responseMsg, setResponseMsg] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("prospect_transfer_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const all = (data || []) as any[];

      const clientIds = Array.from(new Set(all.map((r) => r.client_id)));
      const userIds = Array.from(new Set([
        ...all.map((r) => r.requester_id),
        ...all.map((r) => r.owner_id),
      ]));

      const [{ data: clients }, { data: profiles }] = await Promise.all([
        clientIds.length
          ? supabase.from("clients").select("id, company_name, trade_name").in("id", clientIds)
          : Promise.resolve({ data: [] as any[] }),
        userIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const clientMap = new Map((clients || []).map((c: any) => [c.id, c]));
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const enriched = all.map((r) => ({
        ...r,
        client: clientMap.get(r.client_id),
        requester: profileMap.get(r.requester_id),
        owner: profileMap.get(r.owner_id),
      }));

      setReceived(enriched.filter((r) => r.owner_id === currentUserId || (canManageAll && r.status === "pending")));
      setSent(enriched.filter((r) => r.requester_id === currentUserId));
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar solicitações");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, canManageAll]);

  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  const respond = async (id: string, status: "approved" | "rejected") => {
    setActingId(id);
    try {
      const { error } = await supabase
        .from("prospect_transfer_requests")
        .update({
          status,
          response_message: responseMsg[id]?.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success(status === "approved" ? "Transferência aprovada!" : "Solicitação recusada.");
      setResponseMsg((m) => ({ ...m, [id]: "" }));
      await fetchAll();
      onChanged?.();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro: " + (e.message || ""));
    } finally {
      setActingId(null);
    }
  };

  const cancel = async (id: string) => {
    setActingId(id);
    try {
      const { error } = await supabase
        .from("prospect_transfer_requests")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
      toast.success("Solicitação cancelada.");
      await fetchAll();
      onChanged?.();
    } catch (e: any) {
      toast.error("Erro: " + (e.message || ""));
    } finally {
      setActingId(null);
    }
  };

  const renderItem = (r: Req, kind: "received" | "sent") => {
    const company = r.client?.company_name || r.client?.trade_name || "Prospect";
    return (
      <Card key={r.id}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2">
              <Building2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-semibold">{company}</div>
                <div className="text-xs text-muted-foreground">
                  {kind === "received" ? "Solicitado por" : "Dono"}: {(kind === "received" ? r.requester : r.owner)?.full_name || "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
              </div>
            </div>
            {statusBadge(r.status)}
          </div>

          {r.request_message && (
            <div className="text-sm bg-muted/50 p-2 rounded">
              <span className="text-muted-foreground">Mensagem:</span> {r.request_message}
            </div>
          )}
          {r.response_message && (
            <div className="text-sm bg-muted/30 p-2 rounded">
              <span className="text-muted-foreground">Resposta:</span> {r.response_message}
            </div>
          )}

          {kind === "received" && r.status === "pending" && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs">Mensagem ao solicitante (opcional)</Label>
              <Textarea
                rows={2}
                value={responseMsg[r.id] || ""}
                onChange={(e) => setResponseMsg((m) => ({ ...m, [r.id]: e.target.value }))}
                placeholder="Ex: pode assumir, já te repassei o histórico"
                maxLength={500}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => respond(r.id, "rejected")}
                  disabled={actingId === r.id}
                  className="text-destructive hover:text-destructive"
                >
                  {actingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" /> Recusar</>}
                </Button>
                <Button
                  size="sm"
                  onClick={() => respond(r.id, "approved")}
                  disabled={actingId === r.id}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {actingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Aprovar e transferir</>}
                </Button>
              </div>
            </div>
          )}

          {kind === "sent" && r.status === "pending" && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => cancel(r.id)} disabled={actingId === r.id}>
                {actingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancelar solicitação"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const pendingReceived = received.filter((r) => r.status === "pending").length;
  const pendingSent = sent.filter((r) => r.status === "pending").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-green-600" />
            Solicitações de transferência
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="received">
          <TabsList className="w-full">
            <TabsTrigger value="received" className="flex-1">
              <Inbox className="h-4 w-4 mr-2" />
              Recebidas {pendingReceived > 0 && <Badge className="ml-2 bg-amber-500">{pendingReceived}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="sent" className="flex-1">
              <Send className="h-4 w-4 mr-2" />
              Enviadas {pendingSent > 0 && <Badge className="ml-2">{pendingSent}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="space-y-3 mt-4">
            {loading ? (
              <p className="text-center text-muted-foreground py-6">Carregando...</p>
            ) : received.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">Nenhuma solicitação recebida.</p>
            ) : (
              received.map((r) => renderItem(r, "received"))
            )}
          </TabsContent>

          <TabsContent value="sent" className="space-y-3 mt-4">
            {loading ? (
              <p className="text-center text-muted-foreground py-6">Carregando...</p>
            ) : sent.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">Você ainda não fez solicitações.</p>
            ) : (
              sent.map((r) => renderItem(r, "sent"))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
