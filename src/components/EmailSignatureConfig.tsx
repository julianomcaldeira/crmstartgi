import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, FileSignature, ImagePlus, RefreshCw } from "lucide-react";

const EXTERNAL_SIGNATURE_IMAGE_PATTERN = /https?:\/\/(?:i\.)?(?:postimg\.cc|postimages\.org|imgbb\.com|ibb\.co|i\.ibb\.co)\/[^\s"'<>]+/i;

function getExternalSignatureImageUrls(signatureHtml: string) {
  if (!signatureHtml) return [];
  const doc = new DOMParser().parseFromString(signatureHtml, "text/html");
  const urls = Array.from(doc.querySelectorAll("img[src]"))
    .map((img) => img.getAttribute("src")?.trim())
    .filter((src): src is string => !!src && EXTERNAL_SIGNATURE_IMAGE_PATTERN.test(src));

  return Array.from(new Set(urls));
}

function normalizeSignatureImagesForPreview(signatureHtml: string) {
  return signatureHtml.replace(/<img\b[^>]*>/gi, (tag) => {
    let next = tag;
    if (!/referrerpolicy\s*=/i.test(next)) {
      next = next.replace(/\s*\/?>$/, ' referrerpolicy="origin-when-cross-origin"$&');
    }
    if (!/style\s*=/i.test(next)) {
      next = next.replace(/\s*\/?>$/, ' style="max-width:100%;height:auto;display:block;"$&');
    }
    return next;
  });
}

export default function EmailSignatureConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [html, setHtml] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasExternalImages = EXTERNAL_SIGNATURE_IMAGE_PATTERN.test(html);

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

  async function importExternalImages(currentHtml = html) {
    const urls = getExternalSignatureImageUrls(currentHtml);
    if (!urls.length) {
      toast.info("Nenhuma imagem externa compatível encontrada na assinatura.");
      return currentHtml;
    }

    setImporting(true);
    try {
      let nextHtml = currentHtml;
      for (const url of urls) {
        const { data, error } = await supabase.functions.invoke("import-signature-image", {
          body: { url },
        });
        if (error) throw error;
        if (!data?.publicUrl) throw new Error("A imagem externa não pôde ser importada.");
        nextHtml = nextHtml.split(url).join(data.publicUrl);
      }
      setHtml(nextHtml);
      toast.success(urls.length === 1 ? "Imagem externa corrigida!" : "Imagens externas corrigidas!");
      return nextHtml;
    } catch (err: any) {
      toast.error("Erro ao corrigir imagem externa: " + (err.message || "tente anexar a imagem pelo botão de upload"));
      throw err;
    } finally {
      setImporting(false);
    }
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    try {
      const htmlToSave = EXTERNAL_SIGNATURE_IMAGE_PATTERN.test(html)
        ? await importExternalImages(html)
        : html;
      const { error } = await (supabase as any)
        .from("email_signatures")
        .upsert({ user_id: userId, signature_html: htmlToSave, enabled }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Assinatura salva!");
    } catch (e: any) {
      if (!String(e?.message || "").includes("imagem externa")) {
        toast.error("Erro ao salvar: " + e.message);
      }
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
                <Label className="text-xs text-muted-foreground">Pré-visualização (renderizada como o destinatário verá)</Label>
                <iframe
                  title="Pré-visualização da assinatura"
                  className="w-full border rounded bg-white"
                  style={{ height: 280 }}
                  sandbox=""
                  srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><style>body{font-family:Arial,sans-serif;font-size:14px;color:#111;margin:12px;}img{max-width:100%;height:auto;}</style></head><body>${html}</body></html>`}
                />
                {/postimg\.cc|imgbb\.com|ibb\.co/i.test(html) && (
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ Detectamos uma imagem hospedada em serviço gratuito (postimg/imgbb). Esses serviços às vezes substituem a imagem por um banner de "Upgrade" quando carregada fora do site deles. Recomendamos usar o botão <strong>"Anexar imagem"</strong> acima — ela será hospedada no seu próprio servidor e nunca será trocada.
                  </p>
                )}
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
