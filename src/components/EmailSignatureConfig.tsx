import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, FileSignature } from "lucide-react";

export default function EmailSignatureConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [html, setHtml] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" /> Assinatura de e-mail
        </CardTitle>
        <CardDescription>
          Adicionada automaticamente ao final dos e-mails enviados pelo Zoho Mail.
          Aceita HTML (links, formatação, imagens com URL pública).
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
            <div>
              <Label>HTML da assinatura</Label>
              <Textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                rows={10}
                placeholder={`<p><strong>Seu Nome</strong><br/>\nCargo - Empresa<br/>\n📞 (00) 00000-0000<br/>\n✉️ <a href="mailto:voce@empresa.com">voce@empresa.com</a></p>`}
                className="font-mono text-xs"
              />
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
