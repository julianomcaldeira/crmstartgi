// Remove eventos duplicados no Zoho Calendar criados acidentalmente por syncs anteriores.
// Estratégia: lista eventos numa janela, agrupa por (title + start), mantém o que está
// vinculado em pre_vendas_agenda (zoho_event_id) ou, na falta, o primeiro; apaga os demais.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getValidTokens, calendarBase, toZohoDateTime } from "../_shared/zoho.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body?.dryRun !== false; // default true — só relata
    const daysBack: number = Number(body?.daysBack ?? 30);
    const daysFwd: number = Number(body?.daysFwd ?? 90);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tk = await getValidTokens(admin, user.id);
    if (!tk.primary_calendar_id) throw new Error("Calendário primário do Zoho não definido");

    const start = new Date(Date.now() - daysBack * 86400000);
    const end = new Date(Date.now() + daysFwd * 86400000);
    const listUrl = `${calendarBase(tk.data_center)}/api/v1/calendars/${tk.primary_calendar_id}/events?range=${toZohoDateTime(start.toISOString())},${toZohoDateTime(end.toISOString())}`;

    const listRes = await fetch(listUrl, { headers: { Authorization: `Zoho-oauthtoken ${tk.access_token}` } });
    const listData = await listRes.json();
    if (!listRes.ok) throw new Error(`Zoho list: ${JSON.stringify(listData)}`);
    const events: any[] = listData?.events || [];

    // ids vinculados no nosso banco (referência para "qual manter")
    const { data: linkedRows } = await admin
      .from("pre_vendas_agenda")
      .select("zoho_event_id")
      .eq("pre_vendas_user_id", user.id)
      .not("zoho_event_id", "is", null);
    const linked = new Set((linkedRows || []).map((r: any) => r.zoho_event_id));

    // Agrupa por chave título+start
    const groups = new Map<string, any[]>();
    for (const e of events) {
      const uid = e.uid || e.eventid;
      if (!uid) continue;
      const s = e.dateandtime?.start || e.start || "";
      const key = `${(e.title || "").trim().toLowerCase()}|${s}`;
      const arr = groups.get(key) || [];
      arr.push(e);
      groups.set(key, arr);
    }

    const toDelete: { uid: string; etag: string | null; title: string; start: string }[] = [];
    let groupsWithDupes = 0;

    for (const [, arr] of groups) {
      if (arr.length < 2) continue;
      groupsWithDupes++;
      // ordena: primeiro o vinculado ao nosso banco; depois o primeiro retornado
      arr.sort((a, b) => {
        const aLinked = linked.has(a.uid || a.eventid) ? 0 : 1;
        const bLinked = linked.has(b.uid || b.eventid) ? 0 : 1;
        return aLinked - bLinked;
      });
      const [keep, ...dupes] = arr;
      for (const d of dupes) {
        toDelete.push({
          uid: d.uid || d.eventid,
          etag: d.etag || d.ETAG || null,
          title: d.title || "",
          start: d.dateandtime?.start || d.start || "",
        });
      }
      console.log(`[dedupe] keep=${keep.uid || keep.eventid} drop=${dupes.length} title="${keep.title}"`);
    }

    const results: any[] = [];
    if (!dryRun) {
      for (const d of toDelete) {
        try {
          // Zoho DELETE requer etag no body como eventdata
          const delUrl = `${calendarBase(tk.data_center)}/api/v1/calendars/${tk.primary_calendar_id}/events/${encodeURIComponent(d.uid)}`;
          const params = new URLSearchParams();
          if (d.etag) params.set("eventdata", JSON.stringify({ etag: d.etag }));
          const delRes = await fetch(delUrl, {
            method: "DELETE",
            headers: {
              Authorization: `Zoho-oauthtoken ${tk.access_token}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString() || undefined,
          });
          const txt = await delRes.text();
          results.push({ uid: d.uid, status: delRes.status, ok: delRes.ok, response: txt.slice(0, 200) });

          // remove referência no banco se houver
          if (delRes.ok) {
            await admin.from("pre_vendas_agenda")
              .update({ zoho_event_id: null, zoho_etag: null, sync_status: "duplicate_removed" })
              .eq("zoho_event_id", d.uid);
          }
        } catch (e: any) {
          results.push({ uid: d.uid, error: e.message });
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      dryRun,
      window: { start: start.toISOString(), end: end.toISOString() },
      totalEvents: events.length,
      groupsWithDupes,
      duplicatesFound: toDelete.length,
      duplicates: toDelete,
      deletions: results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("zoho-dedupe-events error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
