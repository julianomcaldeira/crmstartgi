import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type State =
  | { kind: "loading" }
  | { kind: "valid" }
  | { kind: "already" }
  | { kind: "invalid" }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<State>({ kind: "loading" });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: supabaseAnonKey } }
        );
        const data = await res.json();
        if (!res.ok) {
          setState({ kind: "invalid" });
          return;
        }
        if (data?.valid === false && data?.reason === "already_unsubscribed") {
          setState({ kind: "already" });
          return;
        }
        setState({ kind: "valid" });
      } catch {
        setState({ kind: "invalid" });
      }
    })();
  }, [token, supabaseUrl, supabaseAnonKey]);

  const confirm = async () => {
    setState({ kind: "submitting" });
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (error) {
      setState({ kind: "error", message: error.message });
      return;
    }
    if (data?.success || data?.reason === "already_unsubscribed") {
      setState({ kind: "done" });
    } else {
      setState({ kind: "error", message: "Não foi possível processar o cancelamento." });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-sm p-8 text-center">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Cancelar inscrição</h1>

        {state.kind === "loading" && (
          <p className="text-muted-foreground">Validando link…</p>
        )}

        {state.kind === "invalid" && (
          <p className="text-muted-foreground">
            Link inválido ou expirado. Se você quer parar de receber emails, abra o link
            mais recente do rodapé do email.
          </p>
        )}

        {state.kind === "already" && (
          <p className="text-muted-foreground">
            Este email já foi removido da lista de envios. Nada mais a fazer.
          </p>
        )}

        {state.kind === "valid" && (
          <>
            <p className="text-muted-foreground mb-6">
              Confirme abaixo para parar de receber notificações deste sistema.
            </p>
            <button
              onClick={confirm}
              className="w-full bg-primary text-primary-foreground rounded-md py-2 px-4 font-medium hover:opacity-90"
            >
              Confirmar cancelamento
            </button>
          </>
        )}

        {state.kind === "submitting" && (
          <p className="text-muted-foreground">Processando…</p>
        )}

        {state.kind === "done" && (
          <p className="text-foreground">
            Pronto. Você não receberá mais emails deste sistema.
          </p>
        )}

        {state.kind === "error" && (
          <p className="text-destructive">Erro: {state.message}</p>
        )}
      </div>
    </div>
  );
}
