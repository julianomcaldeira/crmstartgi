import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, Link2, Unlink, RefreshCcw, CheckCircle2 } from "lucide-react";

const DC_OPTIONS = [
  { value: "com", label: "Zoho.com (US/Brasil)" },
  { value: "eu", label: "Zoho.eu (Europa)" },
  { value: "in", label: "Zoho.in (Índia)" },
  { value: "com.au", label: "Zoho.com.au (Austrália)" },
  { value: "jp", label: "Zoho.jp (Japão)" },
  { value: "com.cn", label: "Zoho.com.cn (China)" },
];

export default function ZohoConnection() {
  const [tokens, setTokens] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dc, setDc] = useState("com");

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("zoho_user_tokens" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setTokens(data);
    if (data) setDc(data.data_center);
    setLoading(false);
  }

  useEffect(() => {
    load();
    function handler(e: MessageEvent) {
      if (e.data?.type === "zoho-oauth") {
        if (e.data.ok) toast.success("Zoho conectado!");
        else toast.error("Falha ao conectar Zoho");
        load();
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  async function handleConnect() {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("zoho-oauth-init", {
        body: { dc },
      });
      if (error) throw error;
      const popup = window.open(data.url, "zoho_oauth", "width=600,height=700");
      if (!popup) toast.error("Permita pop-ups para conectar.");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar Zoho? Os eventos no Zoho não serão removidos.")) return;
    const { error } = await supabase.functions.invoke("zoho-disconnect");
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Desconectado"); load(); }
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("zoho-pull-events");
      if (error) throw error;
      toast.success("Sincronização concluída");
      load();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> Integração Zoho Mail + Calendar
        </CardTitle>
        <CardDescription>
          Conecte sua conta Zoho para enviar convites de reunião e sincronizar eventos da agenda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : tokens ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Conectado
              </Badge>
              <span className="text-sm font-medium">{tokens.zoho_email}</span>
              <Badge variant="outline">DC: {tokens.data_center}</Badge>
              {tokens.last_sync_at && (
                <span className="text-xs text-muted-foreground">
                  Último sync: {new Date(tokens.last_sync_at).toLocaleString("pt-BR")}
                </span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleSyncNow} disabled={syncing}>
                {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-1" />}
                Sincronizar agora
              </Button>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                <Unlink className="h-4 w-4 mr-1" /> Desconectar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 max-w-sm">
              <Label>Data Center da sua conta Zoho</Label>
              <Select value={dc} onValueChange={setDc}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DC_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Confira em mail.zoho.<strong>com</strong> / .eu / .in (a URL após login indica seu DC).
              </p>
            </div>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
              Conectar com Zoho
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
