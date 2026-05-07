import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, FileSignature, ImagePlus, Copy } from "lucide-react";

export default function EmailSignatureConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [html, setHtml] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await (supabase as any)
        .from("email_signatures")
        .select("signature_html, enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setHtml(data.signature_html || "");
        setEnabled(data.enabled);
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!userId) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("email_signatures")
        .upsert({ user_id: userId, signature_html: html, enabled }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Assinatura salva!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  function insertAtCursor(text: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setHtml((h) => h + text);
      return;
    }
    const start = ta.selectionStart ?? html.length;
    const end = ta.selectionEnd ?? html.length;
    const newVal = html.slice(0, start) + text + html.slice(end);
    setHtml(newVal);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 2MB (e-mails têm limite de tamanho)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${userId}/sig-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("email-signatures")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage
        .from("email-signatures")
        .getPublicUrl(path);
      const tag = `<img src="${publicUrl}" alt="assinatura" style="max-width:200px;height:auto;display:block;" />`;
      insertAtCursor(tag);
      toast.success("Imagem adicionada à assinatura!");
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" /> Assinatura de e-mail
        </CardTitle>
        <CardDescription>
          Adicionada automaticamente ao final dos e-mails enviados pelo Zoho Mail.
          Use o botão "Anexar imagem" para incluir foto ou logo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Switch id="sig-enabled" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="sig-enabled">Anexar assinatura nos e-mails enviados</Label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4 mr-2" />
                )}
                Anexar imagem (foto/logo)
              </Button>
            </div>

            <div>
              <Label>HTML da assinatura</Label>
              <Textarea
                ref={textareaRef}
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                rows={10}
                placeholder={`<p><strong>Seu Nome</strong><br/>\nCargo - Empresa<br/>\n📞 (00) 00000-0000<br/>\n✉️ <a href="mailto:voce@empresa.com">voce@empresa.com</a></p>`}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dica: posicione o cursor no local desejado antes de clicar em "Anexar imagem".
              </p>
            </div>

            {html && (
              <div>
                <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
                <div
                  className="border rounded p-3 bg-background prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            )}
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar assinatura
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
