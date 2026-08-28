// Public proposal tracking endpoint. No JWT required.
// Receives a batch of events for a given share token and registers them
// via the SECURITY DEFINER function record_proposal_event using the
// service-role key.

import { createClient } from "npm:@supabase/supabase-js@2.110.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_TYPES = new Set([
  "open",
  "section_view",
  "cta_click",
  "download",
  "share",
  "pricing_view",
  "heartbeat",
]);

interface EventInput {
  event_type: string;
  visitor_id: string;
  section_id?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
  recipient_id?: string;
}

// Tiny in-memory cache for IP geolocation per cold start.
const geoCache = new Map<string, { country?: string; city?: string }>();

async function geolocate(ip: string | null): Promise<{ country?: string; city?: string }> {
  if (!ip || ip === "127.0.0.1" || ip === "::1") return {};
  const cached = geoCache.get(ip);
  if (cached) return cached;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: ctrl.signal });
    clearTimeout(timeout);
    if (!res.ok) return {};
    const j = await res.json();
    const out = { country: j.country_name || j.country, city: j.city };
    geoCache.set(ip, out);
    return out;
  } catch {
    return {};
  }
}

function parseUA(ua: string | null): { device: string; browser: string } {
  if (!ua) return { device: "unknown", browser: "unknown" };
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const device = isMobile ? "mobile" : "desktop";
  let browser = "other";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  return { device, browser };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const token: string | undefined = body?.token;
    const events: EventInput[] = Array.isArray(body?.events) ? body.events : [];
    if (!token || events.length === 0) {
      return new Response(JSON.stringify({ error: "token and events required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fwd = req.headers.get("x-forwarded-for") || "";
    const ip = fwd.split(",")[0].trim() || null;
    const ua = req.headers.get("user-agent");
    const { device, browser } = parseUA(ua);
    // Cloudflare/edge country header shortcut
    const cfCountry = req.headers.get("cf-ipcountry") || undefined;
    const geo = await geolocate(ip);
    const country = geo.country || cfCountry;
    const city = geo.city;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let last: any = null;
    for (const ev of events) {
      if (!ALLOWED_TYPES.has(ev.event_type)) continue;
      if (!ev.visitor_id) continue;
      const { data, error } = await supabase.rpc("record_proposal_event", {
        _token: token,
        _visitor_id: ev.visitor_id,
        _event_type: ev.event_type,
        _section_id: ev.section_id ?? null,
        _duration_ms: ev.duration_ms ?? 0,
        _metadata: ev.metadata ?? {},
        _ip: ip,
        _user_agent: ua,
        _country: country ?? null,
        _city: city ?? null,
        _device: device,
        _browser: browser,
        _recipient_id: ev.recipient_id ?? null,
      });
      if (error) {
        console.error("record_proposal_event error", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      last = data;
    }

    return new Response(JSON.stringify({ ok: true, last }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
