import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const HEARTBEAT_MS = 3 * 60_000; // 3 min (reduzido para economia de Cloud usage)
const IDLE_THRESHOLD_MS = 5 * 60_000; // 5 min idle => new session

/**
 * Tracks platform usage time per user by maintaining a session row in
 * public.user_sessions. Heartbeats every minute updating last_seen_at and
 * duration_seconds. Starts a new session if user was idle > 5 min.
 */
export const useSessionTracker = (userId: string | null) => {
  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!userId) return;

    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, markActivity, { passive: true }));

    const startSession = async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("user_sessions")
        .insert({
          user_id: userId,
          started_at: now,
          last_seen_at: now,
          duration_seconds: 0,
        })
        .select("id")
        .single();
      if (!error && data) {
        sessionIdRef.current = data.id;
        startedAtRef.current = Date.now();
      }
    };

    const heartbeat = async () => {
      const now = Date.now();
      const idleFor = now - lastActivityRef.current;

      // If idle too long, close current and don't update until activity returns
      if (idleFor > IDLE_THRESHOLD_MS) {
        if (sessionIdRef.current) {
          const duration = Math.floor((lastActivityRef.current - startedAtRef.current) / 1000);
          await supabase
            .from("user_sessions")
            .update({
              ended_at: new Date(lastActivityRef.current).toISOString(),
              last_seen_at: new Date(lastActivityRef.current).toISOString(),
              duration_seconds: Math.max(duration, 0),
            })
            .eq("id", sessionIdRef.current);
          sessionIdRef.current = null;
        }
        return;
      }

      if (!sessionIdRef.current) {
        await startSession();
        return;
      }

      const duration = Math.floor((now - startedAtRef.current) / 1000);
      await supabase
        .from("user_sessions")
        .update({
          last_seen_at: new Date(now).toISOString(),
          duration_seconds: duration,
        })
        .eq("id", sessionIdRef.current);
    };

    startSession();
    const interval = setInterval(heartbeat, HEARTBEAT_MS);

    const onUnload = async () => {
      if (!sessionIdRef.current) return;
      const duration = Math.max(
        Math.floor((Date.now() - startedAtRef.current) / 1000),
        0,
      );
      const nowIso = new Date().toISOString();
      const payload = JSON.stringify({
        last_seen_at: nowIso,
        ended_at: nowIso,
        duration_seconds: duration,
      });
      // Best-effort ao sair da página. Usamos fetch com keepalive em vez de
      // navigator.sendBeacon porque o sendBeacon força credentials:'include' e
      // o PostgREST responde Access-Control-Allow-Origin:'*' — combinação
      // bloqueada pelo navegador (CORS). Também precisamos de PATCH + apikey,
      // que o sendBeacon não permite.
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sessionIdRef.current}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${token}`,
              },
              body: payload,
              keepalive: true,
            },
          );
        }
      } catch {
        // fire-and-forget: falha ao fechar a aba não deve gerar erro visível
      }
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, markActivity));
      window.removeEventListener("beforeunload", onUnload);
      void onUnload();
    };
  }, [userId]);
};
