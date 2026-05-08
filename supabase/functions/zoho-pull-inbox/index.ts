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

function stripHtml(s: string): string {
  return (s || "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function pullForUser(admin: any, userId: string, debug: boolean) {
  const tokens = await getValidTokens(admin, userId);
  if (!tokens.zoho_email) return { processed: 0, matched: 0, reason: "no zoho_email" };

  const base = mailBase(tokens.data_center);
  const auth = { Authorization: `Zoho-oauthtoken ${tokens.access_token}` };

  // 1. accountId
  const accRes = await fetch(`${base}/api/accounts`, { headers: auth });
  const accData = await accRes.json();
  const accountId = accData?.data?.[0]?.accountId;
  if (!accountId) throw new Error("No Zoho accountId");

  // 2. Find Inbox folder id
  const foldersRes = await fetch(`${base}/api/accounts/${accountId}/folders`, { headers: auth });
  const foldersData = await foldersRes.json();
  const folders: any[] = Array.isArray(foldersData?.data) ? foldersData.data : [];
  if (debug) console.log("folders sample", JSON.stringify(folders.slice(0, 5)));
  const inbox = folders.find((f: any) => {
    const ft = String(f?.folderType || f?.type || "").toLowerCase();
    const fn = String(f?.folderName || f?.name || "").toLowerCase();
    return ft === "inbox" || fn === "inbox" || fn === "caixa de entrada";
  }) || folders[0];
  const inboxId = inbox?.folderId || inbox?.id;
  if (!inboxId) {
    return { processed: 0, matched: 0, error: "Inbox not found", foldersSample: folders.slice(0, 5) } as any;
  }

  // 3. last check timestamp
  const { data: tokRow } = await admin
    .from("zoho_user_tokens")
    .select("last_inbox_check_at")
    .eq("user_id", userId)
    .maybeSingle();
  const sinceMs = tokRow?.last_inbox_check_at
    ? new Date(tokRow.last_inbox_check_at).getTime() - 60_000 // 1 min overlap
    : Date.now() - 24 * 60 * 60 * 1000; // first run: last 24h
  const nowIso = new Date().toISOString();

  // 4. List recent messages from Inbox (most recent first)
  const listRes = await fetch(
    `${base}/api/accounts/${accountId}/messages/view?folderId=${inboxId}&start=1&limit=50&sortorder=false`,
    { headers: auth }
  );
  const listData = await listRes.json();
  const messages: any[] = Array.isArray(listData?.data) ? listData.data : [];

  let processed = 0;
  let matched = 0;
  const debugInfo: any[] = [];

  for (const m of messages) {
    const receivedMs = Number(m.receivedTime || m.sentDateInGMT || 0);
    if (receivedMs && receivedMs < sinceMs) continue;

    const messageId: string = String(m.messageId || m.id || "");
    if (!messageId) continue;

    // Skip if already saved
    const { data: dup } = await admin
      .from("email_invitation_log")
      .select("id")
      .eq("zoho_message_id", messageId)
      .eq("direction", "inbound")
      .maybeSingle();
    if (dup) continue;

    const folderIdForMsg = m.folderId || inboxId;

    // Fetch full content
    const detRes = await fetch(
      `${base}/api/accounts/${accountId}/folders/${folderIdForMsg}/messages/${messageId}/content`,
      { headers: auth }
    );
    const det = await detRes.json();
    const data = det?.data || {};

    const fromAddress: string = data.fromAddress || m.fromAddress || m.sender || "";
    const toAddress: string = data.toAddress || m.toAddress || "";
    const ccAddress: string = data.ccAddress || "";
    const subject: string = data.subject || m.subject || "";
    const contentRaw: string = data.content || data.summary || m.summary || "";
    const inReplyTo: string | null = data.inReplyTo || null;
    const threadId: string | null = data.threadId || m.threadId || null;
    const fromEmail = pickFirstEmail(fromAddress) || fromAddress || "desconhecido";

    // Match parent outbound
    const token = extractPlusToken(`${toAddress} ${ccAddress}`);
    let parent: any = null;
    let matchMethod: string | null = null;

    if (token) {
      const { data: p } = await admin
        .from("email_invitation_log")
        .select("id, sent_by, opportunity_id, client_id, subject")
        .eq("reply_token", token)
        .maybeSingle();
      if (p) { parent = p; matchMethod = "reply_token"; }
    }
    if (!parent && inReplyTo) {
      const { data: p } = await admin
        .from("email_invitation_log")
        .select("id, sent_by, opportunity_id, client_id, subject")
        .eq("zoho_message_id", inReplyTo)
        .maybeSingle();
      if (p) { parent = p; matchMethod = "in_reply_to"; }
    }
    if (!parent && threadId) {
      const { data: p } = await admin
        .from("email_invitation_log")
        .select("id, sent_by, opportunity_id, client_id, subject")
        .eq("thread_id", threadId)
        .order("sent_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (p) { parent = p; matchMethod = "thread_id"; }
    }
    // Fallback: subject Re: match against recent outbound to this from-email
    if (!parent && subject && fromEmail) {
      const cleanSubj = subject.replace(/^(re|fwd?|enc):\s*/gi, "").trim();
      if (cleanSubj.length > 3) {
        const { data: p } = await admin
          .from("email_invitation_log")
          .select("id, sent_by, opportunity_id, client_id, subject, recipients")
          .eq("direction", "outbound")
          .ilike("subject", `%${cleanSubj}%`)
          .contains("recipients", [fromEmail])
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (p) { parent = p; matchMethod = "subject+recipient"; }
      }
    }

    processed++;
    if (debug) debugInfo.push({ messageId, subject, fromEmail, threadId, inReplyTo, matchMethod });
    if (!parent) continue;
    matched++;

    await admin.from("email_invitation_log").insert({
      sent_by: parent.sent_by,
      opportunity_id: parent.opportunity_id,
      client_id: parent.client_id,
      recipients: [pickFirstEmail(toAddress) || tokens.zoho_email].filter(Boolean),
      subject: subject || `Re: ${parent.subject || ""}`,
      body: contentRaw,
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

  return { processed, matched, totalListed: messages.length, ...(debug ? { debugInfo } : {}) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";
    const onlyUser = url.searchParams.get("user_id");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    let q = admin.from("zoho_user_tokens").select("user_id");
    if (onlyUser) q = q.eq("user_id", onlyUser);
    const { data: users } = await q;

    const results: any[] = [];
    for (const u of users || []) {
      try {
        const r = await pullForUser(admin, u.user_id, debug);
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
