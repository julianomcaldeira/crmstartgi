import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Mail, Paperclip, X } from "lucide-react";

const MAX_ATTACH_MB = 10;
const MAX_ATTACH_COUNT = 10;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.includes(",") ? res.split(",")[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface ZohoEmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  opportunityId?: string;
  clientId?: string;
  onSent?: () => void;
}

export default function ZohoEmailComposer({
  open,
  onOpenChange,
  defaultTo = "",
  defaultSubject = "",
  defaultBody = "",
  opportunityId,
  clientId,
  onSent,
}: ZohoEmailComposerProps) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(picked: FileList | null) {
    if (!picked) return;
    const newOnes = Array.from(picked);
    const combined = [...files, ...newOnes].slice(0, MAX_ATTACH_COUNT);
    const tooBig = combined.find((f) => f.size > MAX_ATTACH_MB * 1024 * 1024);
    if (tooBig) {
      toast.error(`"${tooBig.name}" excede ${MAX_ATTACH_MB}MB`);
      return;
    }
    setFiles(combined);
  }
  function removeFile(idx: number) {
    setFiles((f) => f.filter((_, i) => i !== idx));
  }

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

      const attachments = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          mimeType: f.type || "application/octet-stream",
          base64: await fileToBase64(f),
        }))
      );

      const { data, error } = await supabase.functions.invoke("zoho-send-email", {
        body: {
          to,
          cc: cc || undefined,
          bcc: bcc || undefined,
          subject,
          content: html,
          mailFormat: "html",
          opportunityId,
          clientId,
          attachments,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("E-mail enviado!");
      setCc(""); setBcc(""); setSubject(""); setBody(""); setTo(""); setFiles([]);
      onOpenChange(false);
      onSent?.();
    } catch (e: any) {
      const raw = (e?.message || String(e) || "").toString();
      const low = raw.toLowerCase();
      let title = "Não foi possível enviar o e-mail";
      let description = raw;
      if (low.includes("invalid_oauthtoken") || low.includes("oauth") || low.includes("token") || low.includes("unauthorized") || low.includes("401")) {
        title = "Conta Zoho desconectada ou token expirado";
        description = "Vá em Configurações → Integrações → Zoho Mail e clique em Reconectar para autorizar novamente.";
      } else if (low.includes("replyto") || low.includes("reply-to") || low.includes("not verified") || low.includes("verify")) {
        title = "E-mail de resposta não verificado pela Zoho";
        description = "A Zoho exige que o endereço de resposta seja verificado. Acesse Zoho Mail → Configurações → E-mails → Endereços de envio e verifique sua conta, ou reenvie sem CC/BCC personalizado.";
      } else if (low.includes("invalid") && (low.includes("to") || low.includes("recipient") || low.includes("address"))) {
        title = "Destinatário inválido";
        description = "Verifique se os e-mails em Para/CC/BCC estão corretos e separados por vírgula.";
      } else if (low.includes("limit") || low.includes("quota") || low.includes("throttl") || low.includes("429")) {
        title = "Limite de envio da Zoho atingido";
        description = "Aguarde alguns minutos antes de enviar novamente. A Zoho aplica limites por hora/dia em sua conta.";
      } else if (low.includes("attach")) {
        title = "Falha ao enviar anexo";
        description = "Verifique o tamanho (máx. 10MB cada) e o formato dos arquivos anexados, e tente novamente.";
      } else if (low.includes("accountid") || low.includes("conta zoho")) {
        title = "Conta Zoho não configurada";
        description = "Conecte sua conta Zoho em Configurações → Integrações antes de enviar e-mails.";
      } else if (low.includes("network") || low.includes("failed to fetch")) {
        title = "Falha de conexão";
        description = "Verifique sua internet e tente novamente em instantes.";
      }
      toast.error(title, { description, duration: 8000 });
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

          <div>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { addFiles(e.target.files); if (fileRef.current) fileRef.current.value = ""; }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-4 w-4 mr-2" /> Anexar arquivos
            </Button>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {files.map((f, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {f.name} ({(f.size / 1024).toFixed(0)}KB)
                    <button type="button" onClick={() => removeFile(i)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Máx {MAX_ATTACH_COUNT} arquivos, {MAX_ATTACH_MB}MB cada. Sua assinatura será adicionada automaticamente se configurada.
            </p>
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
