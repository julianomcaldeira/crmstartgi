import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { canAccessContract, forbidden } from "../_shared/contract-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { contract_id, to, cc, subject, html_body, attachment_url, attachment_name } = await req.json();
    if (!contract_id || !to || !subject || !html_body) {
      return new Response(JSON.stringify({ error: "contract_id, to, subject e html_body são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: contract } = await admin
      .from("contracts")
      .select("id, title, opportunity_id, client_id")
      .eq("id", contract_id)
      .single();
    if (!contract) throw new Error("Contrato não encontrado");

    const recipients: string[] = Array.isArray(to) ? to : [to];
    const ccList: string[] = Array.isArray(cc) ? cc : (cc ? [cc] : []);

    const finalHtml = `
      <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;color:#1a1a1a">
        ${html_body}
        ${attachment_url ? `<p style="margin-top:20px"><a href="${attachment_url}">📎 ${attachment_name || "Baixar contrato"}</a></p>` : ""}
      </div>`;

    let logStatus = "sent";
    let errorMessage: string | null = null;
    let providerId: string | null = null;

    if (RESEND_API_KEY) {
      // Build attachment if provided (must be inline base64 for Resend)
      let attachments: any[] | undefined;
      if (attachment_url) {
        try {
          const fileResp = await fetch(attachment_url);
          if (fileResp.ok) {
            const buf = new Uint8Array(await fileResp.arrayBuffer());
            const b64 = btoa(String.fromCharCode(...buf));
            attachments = [{ filename: attachment_name || "contrato.pdf", content: b64 }];
          }
        } catch (e) { console.warn("Falha anexar arquivo", e); }
      }

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "CRM StartGI <onboarding@resend.dev>",
          to: recipients,
          cc: ccList,
          subject,
          html: finalHtml,
          attachments,
        }),
      });
      const j = await resp.json();
      if (!resp.ok) {
        logStatus = "failed";
        errorMessage = JSON.stringify(j);
        console.error("Resend error", j);
      } else {
        providerId = j.id;
      }
    } else {
      logStatus = "failed";
      errorMessage = "RESEND_API_KEY não configurada";
    }

    // Log no histórico de e-mails da oportunidade
    if (contract.opportunity_id) {
      await admin.from("email_invitation_log").insert({
        opportunity_id: contract.opportunity_id,
        client_id: contract.client_id,
        sent_by: user.id,
        recipients,
        subject,
        body: finalHtml,
        status: logStatus,
        direction: "outbound",
        error_message: errorMessage,
        zoho_message_id: providerId,
      });
    }

    if (logStatus === "failed") {
      return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Marca contrato como enviado se ainda for draft
    await admin.from("contracts")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", contract_id)
      .eq("status", "draft");

    return new Response(JSON.stringify({ ok: true, id: providerId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("send-contract-email error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
