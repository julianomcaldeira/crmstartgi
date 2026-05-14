import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { buildVariableContext } from "@/lib/proposalTypes";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  opportunity: any;
  onCreated?: (contractId: string) => void;
}

export function GenerateContractDialog({ open, onOpenChange, opportunity, onCreated }: Props) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTemplateId("");
    supabase.from("contract_templates").select("*").eq("is_active", true).order("created_at", { ascending: false })
      .then(({ data }) => setTemplates(data || []));
  }, [open]);

  const generate = async () => {
    if (!templateId) return toast.error("Selecione um modelo");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tpl = templates.find(t => t.id === templateId);
      if (!tpl) throw new Error("Modelo não encontrado");

      const { data: client } = opportunity?.client_id
        ? await supabase.from("clients").select("*").eq("id", opportunity.client_id).maybeSingle()
        : { data: null } as any;
      const { data: seller } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      const vars = buildVariableContext({ client, opportunity, seller });

      const { data, error } = await supabase.from("contracts").insert({
        template_id: tpl.id,
        opportunity_id: opportunity.id,
        client_id: opportunity.client_id,
        created_by: user.id,
        title: `${tpl.name} - ${client?.company_name || opportunity.title}`,
        blocks: tpl.blocks,
        variables: vars as any,
        status: "draft",
      }).select("id").single();
      if (error) throw error;
      toast.success("Contrato gerado");
      onOpenChange(false);
      onCreated?.(data.id);
      navigate(`/contratos/${data.id}`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar contrato");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScrollText className="text-primary" size={18} /> Gerar contrato</DialogTitle>
          <DialogDescription>Escolha o modelo de contrato. As variáveis (cliente, valores, vendedor) serão preenchidas automaticamente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Modelo</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
              <SelectContent>
                {templates.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">Nenhum modelo disponível.</div>
                ) : templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button onClick={generate} disabled={loading || !templateId} className="gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />} Gerar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
