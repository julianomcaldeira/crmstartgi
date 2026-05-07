import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCOPES = [
  "ZohoCalendar.calendar.ALL",
  "ZohoCalendar.event.ALL",
  "ZohoCalendar.freebusy.READ",
  "ZohoMail.messages.CREATE",
  "ZohoMail.accounts.READ",
  "AaaServer.profile.READ",
].join(",");

function accountsBase(dc: string) {
  return `https://accounts.zoho.${dc}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dc = "com", returnUrl } = await req.json().catch(() => ({}));
    const clientId = Deno.env.get("ZOHO_CLIENT_ID_NEW");
    if (!clientId) throw new Error("ZOHO_CLIENT_ID_NEW not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const redirectUri = `${supabaseUrl}/functions/v1/zoho-oauth-callback`;

    // state contém userId, dc e returnUrl (codificados)
    const state = btoa(JSON.stringify({ uid: user.id, dc, ret: returnUrl || "" }));

    const url = new URL(`${accountsBase(dc)}/oauth/v2/auth`);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);

    return new Response(JSON.stringify({ url: url.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("zoho-oauth-init error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
