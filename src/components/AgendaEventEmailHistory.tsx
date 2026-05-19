import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  agendaEventId: string;
}

export default function AgendaEventEmailHistory({ agendaEventId }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("email_invitation_log")
      .select("id, subject, recipients, status, error_message, sent_at")
      .eq("agenda_event_id", agendaEventId)
      .order("sent_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (agendaEventId) load();
  }, [agendaEventId]);

  const statusBadge = (s: string) => {
    if (s === "sent") return <Badge className="bg-green-600 hover:bg-green-700 text-white text-[10px]">Enviado</Badge>;
    if (s === "failed") return <Badge variant="destructive" className="text-[10px]">Falhou</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{s}</Badge>;
  };

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" /> Histórico de convites ({items.length})
        </Label>
        <Button type="button" variant="ghost" size="sm" onClick={load} className="h-6 px-2">
          <RefreshCcw className="h-3 w-3" />
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum convite enviado ainda.</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {items.map((it) => (
            <div key={it.id} className="text-xs border rounded-md p-2 bg-muted/30">
              <div className="flex items-center justify-between gap-2 mb-1">
                {statusBadge(it.status)}
                <span className="text-[10px] text-muted-foreground">
                  {format(parseISO(it.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Para: <span className="text-foreground">{(it.recipients || []).join(", ")}</span>
              </div>
              {it.error_message && (
                <div className="text-[11px] text-destructive mt-1 break-words">
                  Erro: {it.error_message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// minimal Label since we import nothing else
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
