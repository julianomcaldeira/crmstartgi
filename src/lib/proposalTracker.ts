// Lightweight client-side tracker for the public proposal page.
// Buffers events and flushes them to the proposal-track edge function.

const VISITOR_KEY = "evolua_pid";
const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proposal-track`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export interface TrackEvent {
  event_type: "open" | "section_view" | "cta_click" | "download" | "share" | "pricing_view" | "heartbeat";
  visitor_id: string;
  section_id?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
  recipient_id?: string;
}

export function flush(token: string, events: TrackEvent[], _useBeacon = false) {
  if (!events.length) return;
  const body = JSON.stringify({ token, events });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
  };
  // sendBeacon can't set custom headers, and the Supabase gateway requires an
  // apikey header — so we always use fetch with keepalive (works during unload).
  fetch(ENDPOINT, { method: "POST", headers, body, keepalive: true }).catch(() => {});
}
