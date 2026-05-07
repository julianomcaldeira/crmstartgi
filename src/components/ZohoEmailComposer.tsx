import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Mail } from "lucide-react";

interface ZohoEmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  opportunityId?: string;
  onSent?: () => void;
}

export default function ZohoEmailComposer({
  open,
  onOpenChange,
  defaultTo = "",
  defaultSubject = "",
  defaultBody = "",
  opportunityId,
  onSent,
}: ZohoEmailComposerProps) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);

  async function handleSend() {
    if (!to.trim()) return toast.error("Informe ao menos um destinatário");
    if (!subject.trim()) return toast.error("Informe o assunto");
    if (!body.trim()) return toast.error("Escreva o corpo do e-mail");

    setSending(true);
    try {
      // Convert plain text line breaks to HTML
      const html = body
        .split("\n")
        .map((l) => l || "&nbsp;")
        .join("<br/>");

      const { data, error } = await supabase.functions.invoke("zoho-send-email", {
        body: {
          to,
          cc: cc || undefined,
          bcc: bcc || undefined,
          subject,
          content: html,
          mailFormat: "html",
          opportunityId,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("E-mail enviado!");
      setCc(""); setBcc(""); setSubject(""); setBody(""); setTo("");
      onOpenChange(false);
      onSent?.();
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e.message || e));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Novo e-mail (Zoho Mail)
          </DialogTitle>
          <DialogDescription>
            Enviado a partir da sua conta Zoho conectada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="to">Para *</Label>
            <Input
              id="to"
              placeholder="email@cliente.com, outro@cliente.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Separe múltiplos por vírgula</p>
          </div>

          {!showCcBcc && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => setShowCcBcc(true)}
            >
              + Adicionar CC / BCC
            </Button>
          )}

          {showCcBcc && (
            <>
              <div>
                <Label htmlFor="cc">CC</Label>
                <Input id="cc" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="copia@empresa.com" />
              </div>
              <div>
                <Label htmlFor="bcc">BCC</Label>
                <Input id="bcc" value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="oculto@empresa.com" />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="subject">Assunto *</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={500} />
          </div>

          <div>
            <Label htmlFor="body">Mensagem *</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Escreva sua mensagem..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
