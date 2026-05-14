import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    const { recipientId, customMessage } = body as {
      recipientId?: string;
      customMessage?: string;
    };

    if (!recipientId || typeof recipientId !== "string") {
      return json({ error: "recipientId é obrigatório" }, 400);
    }
    // Always use the production custom domain for client-facing links.
    const origin = "https://evoluacrm.com.br";

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Fetch recipient + proposal + permission check
    const { data: recipient, error: rErr } = await admin
      .from("proposal_recipients")
      .select("id, name, email, role, proposal_id, invite_count")
      .eq("id", recipientId)
      .maybeSingle();
    if (rErr || !recipient) return json({ error: "Destinatário não encontrado" }, 404);

    const { data: proposal, error: pErr } = await admin
      .from("proposals")
      .select("id, title, share_token, created_by, client_id, total_value, monthly_value, validity_days")
      .eq("id", recipient.proposal_id)
      .maybeSingle();
    if (pErr || !proposal) return json({ error: "Proposta não encontrada" }, 404);

    // Permission: owner / admin / gestor / pre_vendas
    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", user.id);
    const roleSet = new Set((roles || []).map((r: any) => r.role));
    const canSend = proposal.created_by === user.id ||
      roleSet.has("admin") || roleSet.has("gestor") || roleSet.has("pre_vendas");
    if (!canSend) return json({ error: "Sem permissão para enviar convites desta proposta" }, 403);

    // Sender info
    const { data: senderProfile } = await admin
      .from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
    const senderName = senderProfile?.full_name || "Equipe Evolua";

    // Client (for greeting)
    let clientCompany = "";
    if (proposal.client_id) {
      const { data: c } = await admin
        .from("clients").select("company_name").eq("id", proposal.client_id).maybeSingle();
      clientCompany = c?.company_name || "";
    }

    const link = `${origin}/p/${proposal.share_token}?r=${recipient.id}`;
    const greetingName = recipient.name || "Olá";
    const safeMsg = (customMessage || "").toString().slice(0, 1000)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const messageBlock = safeMsg
      ? `<div style="background:#f8fafc;border-left:4px solid #22c55e;padding:12px 16px;margin:16px 0;color:#334155;white-space:pre-wrap;">${safeMsg}</div>`
      : "";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color:#0f172a;">
        <div style="background:#22c55e;color:#fff;padding:20px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:22px;">Sua proposta está pronta</h1>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <p style="margin:0 0 12px 0;">Olá, <strong>${escapeHtml(greetingName)}</strong>${recipient.role ? ` (${escapeHtml(recipient.role)})` : ""}.</p>
          <p style="margin:0 0 12px 0;">${escapeHtml(senderName)} compartilhou com você a proposta <strong>${escapeHtml(proposal.title || "Proposta comercial")}</strong>${clientCompany ? ` referente a <strong>${escapeHtml(clientCompany)}</strong>` : ""}.</p>
          ${messageBlock}
          <p style="margin:16px 0;">Acesse pelo link exclusivo abaixo. Este link é único e usado para acompanhar o andamento da negociação.</p>
          <p style="text-align:center;margin:24px 0;">
            <a href="${link}" style="background:#22c55e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;display:inline-block;">Visualizar proposta</a>
          </p>
          <p style="font-size:12px;color:#64748b;word-break:break-all;">${link}</p>
          ${proposal.validity_days ? `<p style="font-size:12px;color:#64748b;margin-top:16px;">Validade da proposta: ${proposal.validity_days} dias.</p>` : ""}
        </div>
        <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:16px;">Enviado por Evolua CRM</p>
      </div>`;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY não configurada" }, 500);

    const subject = `Proposta: ${proposal.title || "Sua proposta comercial"}`;
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Evolua CRM <onboarding@resend.dev>",
        to: [recipient.email],
        reply_to: senderProfile?.email || undefined,
        subject,
        html,
      }),
    });
    const emailJson = await emailRes.json().catch(() => ({}));
    if (!emailRes.ok) {
      return json({ error: "Falha ao enviar e-mail", details: emailJson }, 502);
    }

    // Update recipient (invited_at + invite_count + status)
    await admin.from("proposal_recipients").update({
      invited_at: new Date().toISOString(),
      invite_count: (recipient.invite_count || 0) + 1,
      status: "invited",
    }).eq("id", recipient.id);

    // Audit event tied to recipient
    await admin.from("proposal_events").insert({
      proposal_id: proposal.id,
      visitor_id: crypto.randomUUID(),
      event_type: "invite_sent",
      recipient_id: recipient.id,
      metadata: {
        sent_by: user.id,
        sent_by_name: senderName,
        to_email: recipient.email,
        provider: "resend",
        provider_id: (emailJson as any)?.id || null,
        link,
        custom_message: safeMsg || null,
      },
    });

    // Mark proposal as sent if still draft
    await admin.from("proposals")
      .update({ sent_at: new Date().toISOString(), status: "sent" })
      .eq("id", proposal.id)
      .in("status", ["draft"]);

    return json({ ok: true, link, provider_id: (emailJson as any)?.id || null });
  } catch (e: any) {
    console.error("send-proposal-invite error", e);
    return json({ error: e?.message || "Erro inesperado" }, 500);
  }
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
