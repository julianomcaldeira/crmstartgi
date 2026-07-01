import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, RefreshCcw, ChevronDown, ChevronUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmailHistoryProps {
  clientId?: string;
  opportunityId?: string;
}

export default function EmailHistory({ clientId, opportunityId }: EmailHistoryProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    let q = (supabase as any).from("email_invitation_log").select("*").order("sent_at", { ascending: false }).limit(100);
    if (opportunityId) q = q.eq("opportunity_id", opportunityId);
    else if (clientId) q = q.eq("client_id", clientId);
    const { data } = await q;
    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (clientId || opportunityId) load();
  }, [clientId, opportunityId]);

  const statusVariant = (s: string, dir: string): any => {
    if (dir === "inbound") return "outline";
    if (s === "sent") return "default";
    if (s === "failed") return "destructive";
    return "secondary";
  };
  const statusLabel = (s: string, dir: string) => {
    if (dir === "inbound") return "Recebido";
    if (s === "sent") return "Enviado";
    if (s === "failed") return "Falhou";
    if (s === "pending") return "Pendente";
    return s;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Mail className="h-4 w-4" /> Histórico de e-mails ({items.length})
        </div>
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Atualizar
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
          Nenhum e-mail enviado ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const isOpen = expanded === it.id;
            const dir = it.direction || "outbound";
            const isInbound = dir === "inbound";
            const dateStr = isInbound && it.received_at ? it.received_at : it.sent_at;
            return (
              <div key={it.id} className={`border rounded-lg ${isInbound ? "bg-primary/5 border-primary/30" : "bg-muted/30"}`}>
                <button
                  className="w-full flex items-start justify-between gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : it.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={statusVariant(it.status, dir)} className="text-xs">{statusLabel(it.status, dir)}</Badge>
                      <span className="text-sm font-medium truncate">{it.subject}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {isInbound ? `De: ${it.from_email || "—"}` : `Para: ${(it.recipients || []).join(", ")}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {isOpen && (
                  <div className="border-t p-3 space-y-2 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Destinatários: </span>
                      <span>{(it.recipients || []).join(", ")}</span>
                    </div>
                    {it.error_message && (
                      <div className="text-xs text-destructive">
                        Erro: {it.error_message}
                      </div>
                    )}
                    {it.body && (
                      <div
                        className="text-sm border-t pt-2 mt-2 prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: it.body }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
