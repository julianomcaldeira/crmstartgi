import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProposalRenderer } from "@/components/proposal/ProposalRenderer";
import html2pdf from "html2pdf.js";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: any;
  defaultTo?: string;
  onSent?: () => void;
}

export function SendContractEmailDialog({ open, onOpenChange, contract, defaultTo, onSent }: Props) {
  const [to, setTo] = useState(defaultTo || "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(`Contrato — ${contract?.title || ""}`);
  const [message, setMessage] = useState("Prezado(a),\n\nSegue em anexo o contrato para sua análise. Qualquer consideração, basta responder este e-mail.\n\nAtenciosamente,");
  const [loading, setLoading] = useState(false);
  const renderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTo(defaultTo || "");
      setCc("");
      setSubject(`Contrato — ${contract?.title || ""}`);
    }
  }, [open, defaultTo, contract?.title]);

  const send = async () => {
    if (!to.trim()) return toast.error("Informe o destinatário");
    if (!renderRef.current) return toast.error("Falha ao renderizar contrato");
    setLoading(true);
    try {
      // Gera PDF do contrato
      const opts = {
        margin: [10, 10, 10, 10],
        filename: `${contract.title || "contrato"}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };
      const blob: Blob = await (html2pdf as any)().set(opts).from(renderRef.current).outputPdf("blob");
      const { data: { user } } = await supabase.auth.getUser();
      const path = `${user!.id}/${contract.id}/contrato-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("contracts").upload(path, blob, { upsert: false, contentType: "application/pdf" });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("contracts").createSignedUrl(path, 60 * 60 * 24 * 60);
      const fileName = `${contract.title || "contrato"}.pdf`;

      await supabase.from("contract_files").insert({
        contract_id: contract.id,
        kind: "generated_pdf",
        file_url: signed?.signedUrl || path,
        file_name: fileName,
        mime_type: "application/pdf",
        file_size: blob.size,
        created_by: user!.id,
      });

      // Monta corpo do e-mail
      const html_body = `<div style="white-space:pre-wrap;font-size:14px;line-height:1.6">${message.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</div>`;

      const recipients = to.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      const ccList = cc.split(/[,;]/).map(s => s.trim()).filter(Boolean);

      const { error } = await supabase.functions.invoke("send-contract-email", {
        body: {
          contract_id: contract.id,
          to: recipients,
          cc: ccList,
          subject,
          html_body,
          attachment_url: signed?.signedUrl,
          attachment_name: fileName,
        },
      });
      if (error) throw error;

      toast.success("Contrato enviado por e-mail");
      onSent?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar contrato");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enviar contrato por e-mail</DialogTitle>
          <DialogDescription>O contrato será gerado em PDF, anexado ao e-mail e registrado no histórico da oportunidade.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Para</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="cliente@empresa.com (separar múltiplos por vírgula)" />
          </div>
          <div>
            <Label>CC</Label>
            <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="(opcional)" />
          </div>
          <div>
            <Label>Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button onClick={send} disabled={loading} className="gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar com PDF
            </Button>
          </div>
        </div>

        {/* Render off-screen para gerar PDF */}
        <div style={{ position: "absolute", left: -99999, top: 0, width: 800 }} aria-hidden="true">
          <div ref={renderRef} style={{ padding: 24, background: "#fff", color: "#000" }}>
            <h1 style={{ fontSize: 22, marginBottom: 12 }}>{contract?.title}</h1>
            <ProposalRenderer blocks={contract?.blocks || []} variables={contract?.variables || {}} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
