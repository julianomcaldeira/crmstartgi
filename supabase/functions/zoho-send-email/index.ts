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

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || "application/octet-stream" });
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
    let content: string = (body.content || "").toString();
    const mailFormat: string = body.mailFormat === "plaintext" ? "plaintext" : "html";
    const opportunityId: string | null = body.opportunityId || null;
    const clientId: string | null = body.clientId || null;
    const attachments: Array<{ name: string; mimeType: string; base64: string }> = Array.isArray(body.attachments) ? body.attachments : [];

    if (!to.length) throw new Error("Pelo menos um destinatário é obrigatório");
    if (!subject) throw new Error("Assunto é obrigatório");
    if (!content.trim()) throw new Error("Corpo do e-mail é obrigatório");
    if (subject.length > 500) throw new Error("Assunto muito longo");
    if (content.length > 200000) throw new Error("Corpo muito longo");
    if (attachments.length > 10) throw new Error("Máximo 10 anexos");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Append signature if enabled
    const { data: sig } = await admin
      .from("email_signatures")
      .select("signature_html, enabled")
      .eq("user_id", user.id)
      .maybeSingle();
    if (sig?.enabled && sig.signature_html?.trim()) {
      if (mailFormat === "html") {
        content = `${content}<br><br>${sig.signature_html}`;
      } else {
        content = `${content}\n\n${sig.signature_html.replace(/<[^>]+>/g, "")}`;
      }
    }

    const tokens = await getValidTokens(admin, user.id);
    if (!tokens.zoho_email) throw new Error("Conta Zoho sem e-mail associado");

    // Get Zoho Mail accountId
    const accRes = await fetch(`${mailBase(tokens.data_center)}/api/accounts`, {
      headers: { Authorization: `Zoho-oauthtoken ${tokens.access_token}` },
    });
    const accData = await accRes.json();
    const accountId = accData?.data?.[0]?.accountId;
    if (!accountId) throw new Error("Não foi possível obter accountId do Zoho Mail");

    // Upload attachments to Zoho first
    const zohoAttachments: any[] = [];
    for (const att of attachments) {
      if (!att.base64 || !att.name) continue;
      const blob = base64ToBlob(att.base64, att.mimeType);
      const fd = new FormData();
      fd.append("attach", blob, att.name);
      const upRes = await fetch(
        `${mailBase(tokens.data_center)}/api/accounts/${accountId}/messages/attachments?uploadType=multipart`,
        {
          method: "POST",
          headers: { Authorization: `Zoho-oauthtoken ${tokens.access_token}` },
          body: fd,
        }
      );
      const upData = await upRes.json();
      if (!upRes.ok) {
        console.error("Zoho attachment upload error", upData);
        throw new Error(`Falha ao enviar anexo "${att.name}": ${JSON.stringify(upData)}`);
      }
      const info = Array.isArray(upData?.data) ? upData.data[0] : upData?.data;
      if (info) {
        zohoAttachments.push({
          storeName: info.storeName,
          attachmentName: info.attachmentName,
          attachmentPath: info.attachmentPath,
        });
      }
    }

    // Reply tracking token via plus-addressing on Reply-To
    const replyToken = crypto.randomUUID();
    const [zohoLocal, zohoDomain] = (tokens.zoho_email || "").split("@");
    const replyToAddress = zohoLocal && zohoDomain
      ? `${zohoLocal}+${replyToken}@${zohoDomain}`
      : tokens.zoho_email;

    const payload: Record<string, any> = {
      fromAddress: tokens.zoho_email,
      toAddress: to.join(","),
      subject,
      content,
      mailFormat,
      replyTo: replyToAddress,
    };
    if (cc.length) payload.ccAddress = cc.join(",");
    if (bcc.length) payload.bccAddress = bcc.join(",");
    if (zohoAttachments.length) payload.attachments = zohoAttachments;

    const doSend = async (p: Record<string, any>) => {
      const r = await fetch(`${mailBase(tokens.data_center)}/api/accounts/${accountId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${tokens.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(p),
      });
      const d = await r.json();
      return { r, d };
    };

    let { r: sendRes, d: sendData } = await doSend(payload);
    // Zoho requires the ReplyTo address to be verified. If not verified, retry without replyTo.
    if (!sendRes.ok && JSON.stringify(sendData || {}).toLowerCase().includes("replyto")) {
      console.warn("Retrying Zoho send without replyTo (address not verified)");
      const { replyTo: _omit, ...fallback } = payload;
      ({ r: sendRes, d: sendData } = await doSend(fallback));
    }
    if (!sendRes.ok) {
      console.error("Zoho Mail send error", sendData);
      throw new Error(`Zoho Mail: ${JSON.stringify(sendData)}`);
    }

    const messageId = sendData?.data?.messageId || null;
    const threadId = sendData?.data?.threadId || null;
    const allRecipients = [...to, ...cc, ...bcc];

    await admin.from("email_invitation_log").insert({
      agenda_event_id: null,
      opportunity_id: opportunityId,
      client_id: clientId,
      sent_by: user.id,
      recipients: allRecipients,
      subject,
      body: content,
      status: "sent",
      zoho_message_id: messageId,
      direction: "outbound",
      reply_token: replyToken,
      from_email: tokens.zoho_email,
      thread_id: threadId,
    });

    if (opportunityId) {
      await admin.from("opportunity_activities").insert({
        opportunity_id: opportunityId,
        created_by: user.id,
        activity_type: "email_sent",
        description: `E-mail "${subject}" enviado para ${to.length} destinatário(s)${zohoAttachments.length ? ` com ${zohoAttachments.length} anexo(s)` : ""} via Zoho Mail`,
      });
    }

    return new Response(JSON.stringify({ ok: true, messageId, attachmentsSent: zohoAttachments.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("zoho-send-email error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
