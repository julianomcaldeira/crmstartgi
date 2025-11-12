import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LossReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReasonSelected: (reasonId: string) => void;
}

export const LossReasonDialog = ({
  open,
  onOpenChange,
  onReasonSelected,
}: LossReasonDialogProps) => {
  const [lossReasons, setLossReasons] = useState<any[]>([]);
  const [selectedReason, setSelectedReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchLossReasons();
    }
  }, [open]);

  const fetchLossReasons = async () => {
    try {
      const { data, error } = await supabase
        .from("loss_reasons")
        .select("*")
        .order("reason");

      if (error) throw error;
      setLossReasons(data || []);
    } catch (error) {
      console.error("Error fetching loss reasons:", error);
      toast.error("Erro ao carregar motivos de perda");
    }
  };

  const handleConfirm = () => {
    if (!selectedReason) {
      toast.error("Selecione um motivo de perda");
      return;
    }

    onReasonSelected(selectedReason);
    setSelectedReason("");
  };

  const handleCancel = () => {
    setSelectedReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Motivo da Perda</DialogTitle>
          <DialogDescription>
            Selecione o motivo pelo qual esta oportunidade foi perdida
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="loss-reason">Motivo *</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger id="loss-reason">
                <SelectValue placeholder="Selecione um motivo" />
              </SelectTrigger>
              <SelectContent>
                {lossReasons.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhum motivo cadastrado. Solicite ao administrador.
                  </div>
                ) : (
                  lossReasons.map((reason) => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.reason}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedReason}>
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};