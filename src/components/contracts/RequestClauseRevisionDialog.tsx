import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  onCreated?: () => void;
}

export function RequestClauseRevisionDialog({ open, onOpenChange, contractId, onCreated }: Props) {
  const [prospectInput, setProspectInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => { setProspectInput(""); setFile(null); };

  const submit = async () => {
    if (!prospectInput.trim() && !file) {
      toast.error("Cole o texto do prospect ou anexe um arquivo");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Upload do anexo (se houver)
      let attachment_url: string | null = null;
      let attachment_name: string | null = null;
      let extractedText = prospectInput;

      if (file) {
        const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/${contractId}/${Date.now()}-${sanitized}`;
        const { error: upErr } = await supabase.storage.from("contracts").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("contracts").createSignedUrl(path, 60 * 60 * 24 * 30);
        attachment_url = signed?.signedUrl || path;
        attachment_name = file.name;

        // Extrai texto do anexo via edge function (PDF via IA, DOCX via mammoth, TXT direto)
        toast.info("Extraindo texto do anexo…");
        const { data: extracted, error: exErr } = await supabase.functions.invoke("extract-contract-attachment", {
          body: { storage_path: path, file_name: file.name, mime_type: file.type },
        });
        if (exErr) {
          toast.warning("Não foi possível extrair texto do anexo automaticamente. Use o campo de texto acima.");
        } else if (extracted?.text) {
          extractedText = (extractedText ? extractedText + "\n\n" : "") + `[Conteúdo extraído de ${file.name}]\n${extracted.text}`;
        }
      }

      // Cria revisão
      const { data: rev, error: insErr } = await supabase
        .from("contract_clause_revisions")
        .insert({
          contract_id: contractId,
          requested_by: user.id,
          prospect_input: extractedText || null,
          attachment_url,
          attachment_name,
          status: "pending_extraction",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      // Atualiza status do contrato
      await supabase.from("contracts").update({ status: "under_negotiation" }).eq("id", contractId);

      // Chama IA para extrair mudanças
      toast.info("Analisando considerações com IA…");
      const { error: fnErr } = await supabase.functions.invoke("analyze-contract-changes", {
        body: { revision_id: rev.id },
      });
      if (fnErr) {
        toast.warning("Revisão criada, mas a IA não conseguiu extrair as mudanças. Reabra para revisar manualmente.");
      } else {
        toast.success("Revisão criada e cláusulas extraídas");
        // Notifica admin/pré-vendas + vendedor por e-mail
        supabase.functions.invoke("notify-contract-revision", {
          body: { revision_id: rev.id, event: "submitted" },
        }).catch(() => {});
      }

      reset();
      onCreated?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar revisão");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Solicitar revisão de cláusulas</DialogTitle>
          <DialogDescription>
            Cole o retorno do prospect com as mudanças solicitadas. A IA vai identificar cláusula por cláusula
            e enviar para a aprovação do super admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Considerações do prospect</Label>
            <Textarea
              rows={10}
              value={prospectInput}
              onChange={(e) => setProspectInput(e.target.value)}
              placeholder="Cole aqui o e-mail / documento / pontos enviados pelo prospect…"
            />
          </div>
          <div>
            <Label>Anexar arquivo (opcional)</Label>
            <Input type="file" accept=".pdf,.docx,.doc,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <p className="text-xs text-muted-foreground mt-1">
              Para PDF/DOCX, cole também o texto principal acima. Em breve a IA fará a extração direta do anexo.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
            Enviar e analisar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
