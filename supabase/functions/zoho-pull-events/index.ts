// Pull events from Zoho Calendar back into pre_vendas_agenda
// Triggered manually or via cron
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getValidTokens, calendarBase, toZohoDateTime } from "../_shared/zoho.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function fromZohoDateTime(s: string): string {
  // 20260507T143000Z -> 2026-05-07T14:30:00Z
  if (!s) return new Date().toISOString();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) return new Date(s).toISOString();
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Autorização: permite CRON (x-cron-secret) OU usuário autenticado (JWT)
    const cronSecret = Deno.env.get("CRON_SECRET");
    const cronHeader = req.headers.get("x-cron-secret");
    const isCron = !!cronSecret && cronHeader === cronSecret;

    let targetUserIds: string[] | null = null; // null = todos (cron)

    if (!isCron) {
      // Tentativa via usuário autenticado (botão "Sincronizar agora" do frontend)
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized — forneça x-cron-secret ou Authorization Bearer" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authErr } = await anonClient.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized — JWT inválido" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetUserIds = [user.id];
    }


    // Lista usuários conectados: todos (cron) ou apenas o autenticado (sync manual)
    let tokens: { user_id: string }[] | null = null;
    if (targetUserIds) {
      const { data } = await admin.from("zoho_user_tokens").select("user_id").in("user_id", targetUserIds);
      tokens = data;
    } else {
      const { data } = await admin.from("zoho_user_tokens").select("user_id");
      tokens = data;
    }
    const results: any[] = [];

    for (const t of tokens || []) {
      try {
        const tk = await getValidTokens(admin, t.user_id);
        if (!tk.primary_calendar_id) continue;

        // Janela: -7 dias até +60 dias
        const start = new Date(Date.now() - 7 * 86400000);
        const end = new Date(Date.now() + 60 * 86400000);
        const url = `${calendarBase(tk.data_center)}/api/v1/calendars/${tk.primary_calendar_id}/events?range=${toZohoDateTime(start.toISOString())},${toZohoDateTime(end.toISOString())}`;

        const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${tk.access_token}` } });
        const data = await res.json();
        if (!res.ok) { results.push({ user: t.user_id, error: data }); continue; }

        const events = data?.events || [];
        let imported = 0, updated = 0;

        for (const ze of events) {
          const zohoId = ze.uid || ze.eventid;
          if (!zohoId) continue;
          const startDT = fromZohoDateTime(ze.dateandtime?.start || ze.start);
          const endDT = fromZohoDateTime(ze.dateandtime?.end || ze.end);

          // Existe?
          const { data: existing } = await admin
            .from("pre_vendas_agenda").select("id").eq("zoho_event_id", zohoId).maybeSingle();

          if (existing) {
            await admin.from("pre_vendas_agenda").update({
              title: ze.title || "(sem título)",
              description: ze.description || null,
              location: ze.location || null,
              start_datetime: startDT,
              end_datetime: endDT,
              is_private: !!ze.isprivate,
              last_synced_at: new Date().toISOString(),
              sync_status: "synced",
            }).eq("id", existing.id);
            updated++;
          } else {
            await admin.from("pre_vendas_agenda").insert({
              pre_vendas_user_id: t.user_id,
              created_by: t.user_id,
              title: ze.title || "(sem título)",
              description: ze.description || null,
              location: ze.location || null,
              start_datetime: startDT,
              end_datetime: endDT,
              is_private: !!ze.isprivate,
              zoho_event_id: zohoId,
              last_synced_at: new Date().toISOString(),
              sync_status: "synced",
            });
            imported++;
          }
        }

        await admin.from("zoho_user_tokens").update({ last_sync_at: new Date().toISOString() }).eq("user_id", t.user_id);
        results.push({ user: t.user_id, imported, updated, total: events.length });
      } catch (e: any) {
        results.push({ user: t.user_id, error: e.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
