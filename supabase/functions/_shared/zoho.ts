// Shared Zoho helpers
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export function accountsBase(dc: string) { return `https://accounts.zoho.${dc}`; }
export function calendarBase(dc: string) { return `https://calendar.zoho.${dc}`; }
export function mailBase(dc: string) { return `https://mail.zoho.${dc}`; }

export interface ZohoTokens {
  user_id: string;
  data_center: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  zoho_email: string | null;
  primary_calendar_id: string | null;
}

export async function getValidTokens(admin: SupabaseClient, userId: string): Promise<ZohoTokens> {
  const { data: tok, error } = await admin.from("zoho_user_tokens").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!tok) throw new Error("Zoho não conectado para este usuário");

  const expiresAt = new Date(tok.expires_at).getTime();
  // Refresh se expira em menos de 60s
  if (expiresAt - Date.now() < 60_000) {
    const clientId = Deno.env.get("ZOHO_CLIENT_ID_NEW")!;
    const clientSecret = Deno.env.get("ZOHO_CLIENT_SECRET_NEW")!;
    const res = await fetch(`${accountsBase(tok.data_center)}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tok.refresh_token,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) throw new Error(`Refresh falhou: ${JSON.stringify(data)}`);
    const newExpires = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
    await admin.from("zoho_user_tokens").update({
      access_token: data.access_token,
      expires_at: newExpires,
    }).eq("user_id", userId);
    tok.access_token = data.access_token;
    tok.expires_at = newExpires;
  }
  return tok as ZohoTokens;
}

// Zoho Calendar API expects YYYYMMDDTHHmmssZ (ISO sem separadores, em UTC)
export function toZohoDateTime(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Build .ics body
export function buildIcs(opts: {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startISO: string;
  endISO: string;
  organizerEmail: string;
  attendees: string[];
}) {
  const dt = (s: string) => toZohoDateTime(s);
  const esc = (s: string) => (s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EvoluaCRM//PT-BR",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${dt(new Date().toISOString())}`,
    `DTSTART:${dt(opts.startISO)}`,
    `DTEND:${dt(opts.endISO)}`,
    `SUMMARY:${esc(opts.title)}`,
    opts.description ? `DESCRIPTION:${esc(opts.description)}` : "",
    opts.location ? `LOCATION:${esc(opts.location)}` : "",
    `ORGANIZER:mailto:${opts.organizerEmail}`,
    ...opts.attendees.map((a) => `ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${a}`),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}
