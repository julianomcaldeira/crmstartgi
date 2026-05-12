import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Handshake } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: { id: string; company_name?: string; trade_name?: string; created_by: string } | null;
  ownerName?: string;
  requesterId: string;
  onSuccess?: () => void;
}

export const RequestTransferDialog = ({ open, onOpenChange, client, ownerName, requesterId, onSuccess }: Props) => {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!client) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("prospect_transfer_requests").insert({
        client_id: client.id,
        requester_id: requesterId,
        owner_id: client.created_by,
        request_message: message.trim() || null,
        status: "pending",
      });
      if (error) {
        if (error.code === "23505") {
          toast.error("Você já tem uma solicitação pendente para este prospect.");
        } else {
          throw error;
        }
      } else {
        toast.success("Solicitação enviada! O dono do prospect precisará aprovar.");
        setMessage("");
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao enviar solicitação: " + (e.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-green-600" />
            Solicitar transferência de prospect
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 p-3 rounded-md text-sm space-y-1">
            <div><span className="text-muted-foreground">Prospect:</span> <strong>{client?.company_name || client?.trade_name}</strong></div>
            <div><span className="text-muted-foreground">Dono atual:</span> <strong>{ownerName || "—"}</strong></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="msg">Mensagem para o dono (opcional)</Label>
            <Textarea
              id="msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: Já estou em contato com este lead há semanas, posso assumir?"
              rows={4}
              maxLength={500}
            />
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-md text-sm text-amber-900 dark:text-amber-200">
            O dono atual receberá a solicitação e poderá aprovar ou recusar. A transferência só acontece após a aprovação.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-green-600 hover:bg-green-700">
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : "Enviar solicitação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
