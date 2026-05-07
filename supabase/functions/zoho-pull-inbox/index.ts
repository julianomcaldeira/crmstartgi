// Polls Zoho Mail Inbox for incoming replies and links them to outbound emails
// via plus-addressing reply tokens or thread IDs. Runs via pg_cron every 5 minutes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getValidTokens, mailBase } from "../_shared/zoho.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractPlusToken(s: string): string | null {
  if (!s) return null;
  const m = /[\w.+-]+\+([0-9a-f-]{36})@/i.exec(s);
  return m ? m[1] : null;
}

function pickFirstEmail(s: string): string | null {
  if (!s) return null;
  const m = s.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : null;
}

async function pullForUser(admin: any, userId: string) {
  const tokens = await getValidTokens(admin, userId);
  if (!tokens.zoho_email) return { processed: 0, matched: 0 };

  // Get accountId
  const accRes = await fetch(`${mailBase(tokens.data_center)}/api/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${tokens.access_token}` },
  });
  const accData = await accRes.json();
  const accountId = accData?.data?.[0]?.accountId;
  if (!accountId) throw new Error("No Zoho accountId");

  // Get last check timestamp
  const { data: tokRow } = await admin
    .from("zoho_user_tokens")
    .select("last_inbox_check_at")
    .eq("user_id", userId)
    .maybeSingle();
  const sinceMs = tokRow?.last_inbox_check_at
    ? new Date(tokRow.last_inbox_check_at).getTime()
    : Date.now() - 30 * 60 * 1000; // first run: last 30 min
  const nowIso = new Date().toISOString();

  // List recent inbox messages (Zoho returns most recent first)
  const listRes = await fetch(
    `${mailBase(tokens.data_center)}/api/accounts/${accountId}/messages/view?folderId=&start=1&limit=50&status=unread`,
    { headers: { Authorization: `Zoho-oauthtoken ${tokens.access_token}` } }
  );
  const listData = await listRes.json();
  const messages: any[] = Array.isArray(listData?.data) ? listData.data : [];

  let processed = 0;
  let matched = 0;

  for (const m of messages) {
    const receivedMs = Number(m.receivedTime || m.sentDateInGMT || 0);
    if (receivedMs && receivedMs <= sinceMs) continue;

    const messageId: string = m.messageId || m.id || "";
    if (!messageId) continue;

    // Skip if already saved
    const { data: dup } = await admin
      .from("email_invitation_log")
      .select("id")
      .eq("zoho_message_id", messageId)
      .eq("direction", "inbound")
      .maybeSingle();
    if (dup) continue;

    // Fetch full message details
    const detRes = await fetch(
      `${mailBase(tokens.data_center)}/api/accounts/${accountId}/folders/${m.folderId}/messages/${messageId}`,
      { headers: { Authorization: `Zoho-oauthtoken ${tokens.access_token}` } }
    );
    const det = await detRes.json();
    const data = det?.data || {};

    const fromAddress: string = data.fromAddress || m.fromAddress || "";
    const toAddress: string = data.toAddress || m.toAddress || "";
    const ccAddress: string = data.ccAddress || "";
    const subject: string = data.subject || m.subject || "";
    const content: string = data.content || data.summary || m.summary || "";
    const inReplyTo: string | null = data.inReplyTo || null;
    const threadId: string | null = data.threadId || m.threadId || null;
    const fromEmail = pickFirstEmail(fromAddress) || fromAddress || "desconhecido";

    // Match parent outbound
    const token = extractPlusToken(`${toAddress} ${ccAddress}`);
    let parent: any = null;
    if (token) {
      const { data: p } = await admin
        .from("email_invitation_log")
        .select("id, sent_by, opportunity_id, client_id, subject")
        .eq("reply_token", token)
        .maybeSingle();
      parent = p;
    }
    if (!parent && inReplyTo) {
      const { data: p } = await admin
        .from("email_invitation_log")
        .select("id, sent_by, opportunity_id, client_id, subject")
        .eq("zoho_message_id", inReplyTo)
        .maybeSingle();
      parent = p;
    }
    if (!parent && threadId) {
      const { data: p } = await admin
        .from("email_invitation_log")
        .select("id, sent_by, opportunity_id, client_id, subject")
        .eq("thread_id", threadId)
        .order("sent_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      parent = p;
    }

    processed++;
    if (!parent) continue;
    matched++;

    await admin.from("email_invitation_log").insert({
      sent_by: parent.sent_by,
      opportunity_id: parent.opportunity_id,
      client_id: parent.client_id,
      recipients: [pickFirstEmail(toAddress) || tokens.zoho_email].filter(Boolean),
      subject: subject || `Re: ${parent.subject || ""}`,
      body: content,
      status: "received",
      zoho_message_id: messageId,
      direction: "inbound",
      from_email: fromEmail,
      in_reply_to: inReplyTo,
      thread_id: threadId,
      parent_log_id: parent.id,
      received_at: receivedMs ? new Date(receivedMs).toISOString() : new Date().toISOString(),
    });

    if (parent.opportunity_id) {
      await admin.from("opportunity_activities").insert({
        opportunity_id: parent.opportunity_id,
        created_by: parent.sent_by,
        activity_type: "email_received",
        description: `Resposta de ${fromEmail}: "${subject || parent.subject || ""}"`,
      });
    }
  }

  await admin
    .from("zoho_user_tokens")
    .update({ last_inbox_check_at: nowIso })
    .eq("user_id", userId);

  return { processed, matched };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: users } = await admin
      .from("zoho_user_tokens")
      .select("user_id");

    const results: any[] = [];
    for (const u of users || []) {
      try {
        const r = await pullForUser(admin, u.user_id);
        results.push({ user_id: u.user_id, ...r });
      } catch (e: any) {
        console.error("pullForUser failed", u.user_id, e?.message);
        results.push({ user_id: u.user_id, error: e?.message });
      }
    }
    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("zoho-pull-inbox error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
