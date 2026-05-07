// Public webhook endpoint for Zoho Mail "Incoming Email Notification".
// Configure in Zoho Mail Admin: Mail Settings -> Notifications -> Add a webhook
// Payload (typical fields): fromAddress, toAddress, ccAddress, subject, summary,
// content / html, messageId, inReplyTo, threadId, receivedTime, deliveredTo
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-zoho-signature",
};

function extractPlusToken(addresses: string): string | null {
  // Match user+TOKEN@domain → return TOKEN if it is a UUID
  const re = /[\w.+-]+\+([0-9a-f-]{36})@/gi;
  const m = re.exec(addresses || "");
  return m ? m[1] : null;
}

function pickFirstEmail(input: string): string | null {
  if (!input) return null;
  const m = input.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Optional shared-secret validation
    const expectedSecret = Deno.env.get("ZOHO_WEBHOOK_SECRET");
    if (expectedSecret) {
      const got = req.headers.get("x-webhook-secret") || new URL(req.url).searchParams.get("secret");
      if (got !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const raw = await req.text();
    let body: any = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }

    // Normalize fields (Zoho field names vary by webhook version)
    const fromAddress: string = body.fromAddress || body.from || body.sender || "";
    const toAddress: string = body.toAddress || body.to || body.deliveredTo || "";
    const ccAddress: string = body.ccAddress || body.cc || "";
    const subject: string = body.subject || "";
    const content: string = body.content || body.html || body.summary || body.bodyText || "";
    const messageId: string | null = body.messageId || body.messageID || null;
    const inReplyTo: string | null = body.inReplyTo || body.in_reply_to || null;
    const threadId: string | null = body.threadId || body.thread_id || null;
    const receivedTime: string | null = body.receivedTime || body.received_at || null;

    // Find original outbound by reply_token (plus-addressing) or thread_id or in_reply_to
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const allTo = `${toAddress} ${ccAddress}`;
    const token = extractPlusToken(allTo);

    let parent: any = null;
    if (token) {
      const { data } = await admin
        .from("email_invitation_log")
        .select("id, sent_by, opportunity_id, client_id, subject")
        .eq("reply_token", token)
        .maybeSingle();
      parent = data;
    }
    if (!parent && inReplyTo) {
      const { data } = await admin
        .from("email_invitation_log")
        .select("id, sent_by, opportunity_id, client_id, subject")
        .eq("zoho_message_id", inReplyTo)
        .maybeSingle();
      parent = data;
    }
    if (!parent && threadId) {
      const { data } = await admin
        .from("email_invitation_log")
        .select("id, sent_by, opportunity_id, client_id, subject")
        .eq("thread_id", threadId)
        .order("sent_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      parent = data;
    }

    const fromEmail = pickFirstEmail(fromAddress) || fromAddress || "desconhecido";

    if (!parent) {
      // Save anyway as orphan inbound for audit; sent_by left null is not allowed,
      // so we skip when no owner can be inferred.
      console.warn("Inbound email without matching outbound; ignored", { fromEmail, subject, threadId });
      return new Response(JSON.stringify({ ok: true, matched: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inserted, error: insErr } = await admin.from("email_invitation_log").insert({
      sent_by: parent.sent_by,
      opportunity_id: parent.opportunity_id,
      client_id: parent.client_id,
      recipients: [pickFirstEmail(toAddress) || ""].filter(Boolean),
      subject: subject || `Re: ${parent.subject || ""}`,
      body: content,
      status: "received",
      zoho_message_id: messageId,
      direction: "inbound",
      from_email: fromEmail,
      in_reply_to: inReplyTo,
      thread_id: threadId,
      parent_log_id: parent.id,
      received_at: receivedTime ? new Date(receivedTime).toISOString() : new Date().toISOString(),
    }).select("id").single();

    if (insErr) throw insErr;

    if (parent.opportunity_id) {
      await admin.from("opportunity_activities").insert({
        opportunity_id: parent.opportunity_id,
        created_by: parent.sent_by,
        activity_type: "email_received",
        description: `Resposta de ${fromEmail}: "${subject || parent.subject || ""}"`,
      });
    }

    return new Response(JSON.stringify({ ok: true, matched: true, id: inserted?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("zoho-email-webhook error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
