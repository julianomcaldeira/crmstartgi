import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://evoluacrm.com.br";

function escape(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

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

    const { revision_id, event } = await req.json(); // event: 'submitted' | 'reviewed'
    if (!revision_id || !event) {
      return new Response(JSON.stringify({ error: "revision_id e event são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: rev } = await admin
      .from("contract_clause_revisions")
      .select("*, contracts(id, title, created_by, opportunity_id, clients(company_name))")
      .eq("id", revision_id)
      .single();
    if (!rev) throw new Error("Revisão não encontrada");

    const contract: any = rev.contracts;
    const { data: decisions } = await admin
      .from("contract_clause_decisions")
      .select("*")
      .eq("revision_id", revision_id)
      .order("position", { ascending: true });

    // E-mails
    const { data: vendedor } = await admin.from("profiles").select("email, full_name").eq("id", contract.created_by).single();
    const { data: requester } = await admin.from("profiles").select("email, full_name").eq("id", rev.requested_by).single();

    const { data: adminRoles } = await admin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "pre_vendas"]);
    const adminIds = (adminRoles || []).map((r: any) => r.user_id);
    const { data: adminProfiles } = adminIds.length
      ? await admin.from("profiles").select("email").in("id", adminIds)
      : { data: [] as any[] };
    const adminEmails = (adminProfiles || []).map((p: any) => p.email).filter(Boolean);

    const link = `${APP_URL}/contratos/${contract.id}`;

    let subject = "";
    let html = "";
    let to: string[] = [];

    if (event === "submitted") {
      subject = `📝 Nova revisão de contrato: ${contract.title}`;
      const changesList = (rev.extracted_changes as any[] || []).map((c, i) =>
        `<li><strong>${escape(c.clause_reference || `Cláusula ${i+1}`)}</strong>: ${escape(c.proposed_change || "")}</li>`
      ).join("");
      html = `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1a1a">
          <div style="background:#22c55e;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
            <h2 style="margin:0;font-size:18px">Nova revisão de contrato solicitada</h2>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:0;padding:20px;border-radius:0 0 8px 8px">
            <p>Solicitada por <strong>${escape(requester?.full_name || "Vendedor")}</strong></p>
            <p><strong>Contrato:</strong> ${escape(contract.title)}<br/>
               <strong>Cliente:</strong> ${escape(contract.clients?.company_name || "—")}</p>
            ${changesList ? `<h3 style="font-size:14px">Cláusulas extraídas pela IA (${(rev.extracted_changes as any[] || []).length})</h3><ul>${changesList}</ul>` : "<p><em>A IA não extraiu cláusulas — favor revisar manualmente.</em></p>"}
            <p style="margin-top:24px"><a href="${link}" style="background:#22c55e;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;display:inline-block">Abrir contrato</a></p>
          </div>
        </div>`;
      to = Array.from(new Set([...adminEmails, vendedor?.email].filter(Boolean) as string[]));
    } else if (event === "reviewed") {
      subject = `✅ Revisão concluída: ${contract.title}`;
      const list = (decisions || []).map((d: any, i: number) => {
        const tag = d.decision === "accepted" ? "✅ Aceita"
          : d.decision === "rejected" ? "❌ Rejeitada"
          : d.decision === "counter_proposal" ? "🔄 Contraproposta" : "⏳ Pendente";
        return `<tr>
          <td style="padding:6px;border-bottom:1px solid #eee;font-weight:600">${i+1}. ${escape(d.clause_reference)}</td>
          <td style="padding:6px;border-bottom:1px solid #eee">${tag}</td>
        </tr>
        <tr><td colspan="2" style="padding:6px 6px 14px;color:#555">
          <em>Pedido:</em> ${escape(d.proposed_change)}
          ${d.admin_comment ? `<br/><em>Parecer:</em> ${escape(d.admin_comment)}` : ""}
          ${d.counter_text ? `<br/><em>Contraproposta:</em> ${escape(d.counter_text)}` : ""}
        </td></tr>`;
      }).join("");
      html = `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1a1a">
          <div style="background:#16a34a;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
            <h2 style="margin:0;font-size:18px">Devolutiva de revisão de contrato</h2>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:0;padding:20px;border-radius:0 0 8px 8px">
            <p><strong>Contrato:</strong> ${escape(contract.title)}<br/>
               <strong>Cliente:</strong> ${escape(contract.clients?.company_name || "—")}</p>
            ${rev.admin_summary ? `<div style="background:#f9fafb;border-left:3px solid #22c55e;padding:10px 12px;margin:12px 0"><strong>Resumo:</strong> ${escape(rev.admin_summary)}</div>` : ""}
            <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:14px">${list}</table>
            ${rev.negotiation_docx_url ? `<p style="margin-top:18px"><a href="${rev.negotiation_docx_url}">📎 Baixar devolutiva (.docx)</a></p>` : ""}
            <p style="margin-top:18px"><a href="${link}" style="background:#16a34a;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;display:inline-block">Abrir contrato</a></p>
          </div>
        </div>`;
      to = Array.from(new Set([vendedor?.email, requester?.email].filter(Boolean) as string[]));
    } else {
      return new Response(JSON.stringify({ error: "event inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!to.length) return new Response(JSON.stringify({ ok: true, skipped: "no recipients" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY ausente — notificação não enviada", { to, subject });
      return new Response(JSON.stringify({ ok: true, warning: "RESEND_API_KEY não configurada" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "CRM StartGI <onboarding@resend.dev>",
        to,
        subject,
        html,
      }),
    });
    const j = await resp.json();
    if (!resp.ok) {
      console.error("Resend error", j);
      return new Response(JSON.stringify({ error: "Falha ao enviar e-mail", detail: j }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, id: j.id, to }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("notify-contract-revision error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
