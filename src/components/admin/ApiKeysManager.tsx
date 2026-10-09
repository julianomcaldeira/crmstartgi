import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Key, Plus, Copy, Check, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateKey(): Promise<{ key: string; hash: string; prefix: string }> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const secret = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = `evc_${secret}`;
  const hash = toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
  return { key, hash, prefix: key.slice(0, 12) };
}

const ApiKeysManager = () => {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_api_keys");
    if (error) {
      toast.error("Erro ao carregar chaves", { description: error.message });
    } else {
      setKeys(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Informe um nome para a chave");
      return;
    }
    setCreating(true);
    try {
      const { key, hash, prefix } = await generateKey();
      const { error } = await supabase.rpc("create_api_key", {
        p_name: name.trim(),
        p_key_prefix: prefix,
        p_key_hash: hash,
      });
      if (error) throw error;
      setCreatedKey(key);
      setName("");
      load();
    } catch (e: any) {
      toast.error("Erro ao criar chave", { description: e?.message || String(e) });
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setName("");
    setCreatedKey(null);
    setCopied(false);
  };

  const handleRevoke = async () => {
    if (!keyToRevoke) return;
    const { error } = await supabase.rpc("revoke_api_key", { p_id: keyToRevoke.id });
    if (error) {
      toast.error("Erro ao revogar chave", { description: error.message });
    } else {
      toast.success("Chave revogada");
      setKeyToRevoke(null);
      load();
    }
  };

  const statusBadge = (k: any) => {
    if (k.revoked_at) return <Badge className="bg-muted text-muted-foreground">Revogada</Badge>;
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        Ativa
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Key className="h-5 w-5" /> Chaves de API
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Chaves para agentes externos (ex.: Claude Code) acessarem os dados do CRM via REST.
              A chave completa é exibida apenas uma vez, na criação.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Base URL:{" "}
              <code className="rounded bg-muted px-1 py-0.5 break-all">{API_BASE}</code>
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova chave
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma chave criada ainda.
          </p>
        ) : (
          <div className="divide-y">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{k.name}</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {k.key_prefix}…
                    </Badge>
                    {k.revoked_at ? (
                      <Badge variant="secondary">Revogada</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Ativa
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Criada em {new Date(k.created_at).toLocaleString("pt-BR")}
                    {k.last_used_at
                      ? ` • último uso ${new Date(k.last_used_at).toLocaleString("pt-BR")}`
                      : " • nunca usada"}
                  </p>
                </div>
                {!k.revoked_at && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setKeyToRevoke(k)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Revogar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdKey ? "Chave criada" : "Nova chave de API"}</DialogTitle>
            <DialogDescription>
              {createdKey
                ? "Copie a chave agora. Por segurança, ela não será exibida novamente."
                : "Dê um nome para identificar onde a chave será usada."}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input readOnly value={createdKey} className="font-mono text-xs" />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use em <code>Authorization: Bearer &lt;chave&gt;</code> ou no header{" "}
                <code>x-api-key</code>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="keyName">Nome</Label>
                <Input
                  id="keyName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Claude Code - agendamento"
                  autoFocus
                />
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Gerando...
                  </>
                ) : (
                  "Gerar chave"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!keyToRevoke} onOpenChange={(o) => !o && setKeyToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar chave?</AlertDialogTitle>
            <AlertDialogDescription>
              A chave <strong>{keyToRevoke?.name}</strong> deixará de funcionar imediatamente. Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const k = keyToRevoke;
                setKeyToRevoke(null);
                const { error } = await supabase.rpc("revoke_api_key", { p_id: k.id });
                if (error) {
                  toast.error("Erro ao revogar", { description: error.message });
                } else {
                  toast.success("Chave revogada");
                  load();
                }
              }}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ApiKeysManager;
