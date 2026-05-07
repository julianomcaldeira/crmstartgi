import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getValidTokens, mailBase } from "../_shared/zoho.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseEmails(input: string | string[] | undefined | null): string[] {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : input.split(/[,;\n]/);
  return arr.map((s) => (s || "").trim()).filter((s) => s && /.+@.+\..+/.test(s));
}

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

    const body = await req.json();
    const to = parseEmails(body.to);
    const cc = parseEmails(body.cc);
    const bcc = parseEmails(body.bcc);
    const subject: string = (body.subject || "").toString().trim();
    const content: string = (body.content || "").toString();
    const mailFormat: string = body.mailFormat === "plaintext" ? "plaintext" : "html";
    const opportunityId: string | null = body.opportunityId || null;

    if (!to.length) throw new Error("Pelo menos um destinatário é obrigatório");
    if (!subject) throw new Error("Assunto é obrigatório");
    if (!content.trim()) throw new Error("Corpo do e-mail é obrigatório");
    if (subject.length > 500) throw new Error("Assunto muito longo");
    if (content.length > 200000) throw new Error("Corpo muito longo");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tokens = await getValidTokens(admin, user.id);
    if (!tokens.zoho_email) throw new Error("Conta Zoho sem e-mail associado");

    // Get Zoho Mail accountId
    const accRes = await fetch(`${mailBase(tokens.data_center)}/api/accounts`, {
      headers: { Authorization: `Zoho-oauthtoken ${tokens.access_token}` },
    });
    const accData = await accRes.json();
    const accountId = accData?.data?.[0]?.accountId;
    if (!accountId) throw new Error("Não foi possível obter accountId do Zoho Mail");

    const payload: Record<string, any> = {
      fromAddress: tokens.zoho_email,
      toAddress: to.join(","),
      subject,
      content,
      mailFormat,
    };
    if (cc.length) payload.ccAddress = cc.join(",");
    if (bcc.length) payload.bccAddress = bcc.join(",");

    const sendRes = await fetch(`${mailBase(tokens.data_center)}/api/accounts/${accountId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const sendData = await sendRes.json();
    if (!sendRes.ok) {
      console.error("Zoho Mail send error", sendData);
      throw new Error(`Zoho Mail: ${JSON.stringify(sendData)}`);
    }

    const messageId = sendData?.data?.messageId || null;
    const allRecipients = [...to, ...cc, ...bcc];

    // Log
    await admin.from("email_invitation_log").insert({
      agenda_event_id: null,
      opportunity_id: opportunityId,
      sent_by: user.id,
      recipients: allRecipients,
      subject,
      body: content,
      status: "sent",
      zoho_message_id: messageId,
    });

    if (opportunityId) {
      await admin.from("opportunity_activities").insert({
        opportunity_id: opportunityId,
        created_by: user.id,
        activity_type: "email_sent",
        description: `E-mail "${subject}" enviado para ${to.length} destinatário(s) via Zoho Mail`,
      });
    }

    return new Response(JSON.stringify({ ok: true, messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("zoho-send-email error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
