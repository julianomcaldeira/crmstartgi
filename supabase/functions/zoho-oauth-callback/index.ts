import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function accountsBase(dc: string) {
  return `https://accounts.zoho.${dc}`;
}
function calendarBase(dc: string) {
  return `https://calendar.zoho.${dc}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  function html(msg: string, ok = false) {
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zoho</title>
      <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#fff}
      .box{text-align:center;padding:32px;border-radius:12px;background:#1e293b;max-width:420px}
      .ok{color:#22c55e}.err{color:#ef4444}</style></head>
      <body><div class="box"><h2 class="${ok ? "ok" : "err"}">${ok ? "✓ Conectado!" : "Erro"}</h2>
      <p>${msg}</p>
      <p style="opacity:.7;font-size:14px">Você pode fechar esta janela.</p>
      <script>setTimeout(()=>{window.close();if(window.opener){window.opener.postMessage({type:'zoho-oauth',ok:${ok}},'*')}},1500)</script>
      </div></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  try {
    if (errorParam) return html(`Zoho retornou: ${errorParam}`);
    if (!code || !stateRaw) return html("Parâmetros ausentes.");

    // Verifica assinatura HMAC do state
    const signingKey = Deno.env.get("OAUTH_STATE_SIGNING_KEY");
    if (!signingKey) return html("OAUTH_STATE_SIGNING_KEY not configured");
    const dot = stateRaw.indexOf(".");
    if (dot < 0) return html("State inválido.");
    const payloadB64 = stateRaw.slice(0, dot);
    const sigB64 = stateRaw.slice(dot + 1);
    try {
      const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(signingKey),
        { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
      );
      const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
      const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payloadB64));
      if (!valid) return html("Assinatura inválida.");
    } catch {
      return html("Falha ao validar state.");
    }
    const state = JSON.parse(atob(payloadB64));
    // Reject stale state (>10 minutes old)
    if (!state.iat || Date.now() - Number(state.iat) > 10 * 60 * 1000) {
      return html("State expirado. Tente novamente.");
    }
    const userId = state.uid as string;
    const dc = (state.dc as string) || "com";


    const clientId = Deno.env.get("ZOHO_CLIENT_ID_NEW");
    const clientSecret = Deno.env.get("ZOHO_CLIENT_SECRET_NEW");
    if (!clientId || !clientSecret) throw new Error("Zoho credentials not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const redirectUri = `${supabaseUrl}/functions/v1/zoho-oauth-callback`;

    // Troca code por tokens
    const tokenRes = await fetch(`${accountsBase(dc)}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Token exchange error", tokenData);
      return html(`Falha ao obter token: ${JSON.stringify(tokenData)}`);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    // Pega info do usuário (email)
    let zohoEmail: string | null = null;
    try {
      const meRes = await fetch(`${accountsBase(dc)}/oauth/user/info`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      const me = await meRes.json();
      zohoEmail = me?.Email || me?.email || null;
    } catch (e) { console.warn("user info fail", e); }

    // Pega calendário primário
    let primaryCalId: string | null = null;
    try {
      const calRes = await fetch(`${calendarBase(dc)}/api/v1/calendars`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      const calData = await calRes.json();
      const cals = calData?.calendars || [];
      const primary = cals.find((c: any) => c.isdefault === true || c.isdefault === "true") || cals[0];
      primaryCalId = primary?.uid || primary?.id || null;
    } catch (e) { console.warn("calendar list fail", e); }

    // Salva no banco com service role
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: upsertErr } = await adminClient
      .from("zoho_user_tokens")
      .upsert({
        user_id: userId,
        data_center: dc,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        zoho_email: zohoEmail,
        primary_calendar_id: primaryCalId,
        scopes: tokenData.scope || null,
      }, { onConflict: "user_id" });

    if (upsertErr) {
      console.error("upsert err", upsertErr);
      return html(`Erro ao salvar: ${upsertErr.message}`);
    }

    return html(`Zoho ${zohoEmail || ""} conectado com sucesso.`, true);
  } catch (e: any) {
    console.error("callback error", e);
    return html(e.message || "Erro inesperado");
  }
});
