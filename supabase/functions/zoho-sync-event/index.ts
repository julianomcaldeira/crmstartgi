import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getValidTokens, calendarBase, mailBase, toZohoDateTime, buildIcs } from "../_shared/zoho.ts";

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

    const { eventId, sendInvite = true } = await req.json();
    if (!eventId) throw new Error("eventId obrigatório");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Carrega evento
    const { data: ev, error: evErr } = await admin
      .from("pre_vendas_agenda").select("*").eq("id", eventId).maybeSingle();
    if (evErr || !ev) throw new Error("Evento não encontrado");

    // Usa tokens do dono do evento (pre_vendas_user_id)
    const tokens = await getValidTokens(admin, ev.pre_vendas_user_id);
    if (!tokens.primary_calendar_id) throw new Error("Calendário primário do Zoho não definido");

    const attendees: string[] = (ev.attendees || []).filter((a: string) => a && a.includes("@"));

    // Auto-incluir o e-mail do pré-vendas (dono do evento) se ainda não estiver presente
    const { data: pvProfile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", ev.pre_vendas_user_id)
      .maybeSingle();
    if (pvProfile?.email && !attendees.includes(pvProfile.email)) {
      attendees.push(pvProfile.email);
    }

    // Carrega dados do solicitante (vendedor) e da oportunidade/cliente (se houver)
    const { data: requesterProfile } = await admin
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", ev.created_by)
      .maybeSingle();

    let opportunityInfo: any = null;
    let clientInfo: any = null;
    if (ev.opportunity_id) {
      const { data: opp } = await admin
        .from("opportunities")
        .select("id, title, value, monthly_value, client_id")
        .eq("id", ev.opportunity_id)
        .maybeSingle();
      opportunityInfo = opp;
      if (opp?.client_id) {
        const { data: cli } = await admin
          .from("clients")
          .select("company_name, trade_name, cnpj")
          .eq("id", opp.client_id)
          .maybeSingle();
        clientInfo = cli;
      }
    }

    // Monta evento Zoho Calendar
    const eventData: any = {
      title: ev.title,
      dateandtime: {
        timezone: "America/Sao_Paulo",
        start: toZohoDateTime(ev.start_datetime),
        end: toZohoDateTime(ev.end_datetime),
      },
      isprivate: ev.is_private,
    };
    if (ev.description) eventData.description = ev.description;
    if (ev.location) eventData.location = ev.location;
    if (attendees.length) {
      eventData.attendees = attendees.map((email) => ({ email, status: "NEEDS-ACTION" }));
    }

    const calUrl = `${calendarBase(tokens.data_center)}/api/v1/calendars/${tokens.primary_calendar_id}/events`;
    const headersZoho = {
      Authorization: `Zoho-oauthtoken ${tokens.access_token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    let zohoEventId = ev.zoho_event_id as string | null;
    let zohoRes: Response;

    if (zohoEventId) {
      // Update
      zohoRes = await fetch(`${calUrl}/${zohoEventId}`, {
        method: "PUT",
        headers: headersZoho,
        body: new URLSearchParams({ eventdata: JSON.stringify(eventData) }),
      });
    } else {
      // Create
      zohoRes = await fetch(calUrl, {
        method: "POST",
        headers: headersZoho,
        body: new URLSearchParams({ eventdata: JSON.stringify(eventData) }),
      });
    }
    const zohoBody = await zohoRes.json();
    if (!zohoRes.ok) {
      console.error("Zoho calendar error", zohoBody);
      throw new Error(`Zoho Calendar: ${JSON.stringify(zohoBody)}`);
    }
    const created = zohoBody?.events?.[0] || zohoBody;
    if (!zohoEventId) {
      zohoEventId = created?.uid || created?.eventid || null;
    }

    await admin.from("pre_vendas_agenda").update({
      zoho_event_id: zohoEventId,
      last_synced_at: new Date().toISOString(),
      sync_status: "synced",
    }).eq("id", ev.id);

    // Envio de convite por Zoho Mail
    let invitationLog: any = null;
    if (sendInvite && attendees.length && tokens.zoho_email) {
      const ics = buildIcs({
        uid: zohoEventId || ev.id,
        title: ev.title,
        description: ev.description,
        location: ev.location,
        startISO: ev.start_datetime,
        endISO: ev.end_datetime,
        organizerEmail: tokens.zoho_email,
        attendees,
      });

      const subject = `[Pré-Vendas] ${ev.title} — ${new Date(ev.start_datetime).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
      const startFmt = new Date(ev.start_datetime).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "full", timeStyle: "short" });
      const endFmt = new Date(ev.end_datetime).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", timeStyle: "short" });
      const escapeHtml = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const fmtBRL = (v: number | null | undefined) =>
        typeof v === "number" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;

      const locationHtml = ev.location
        ? (/^https?:\/\//i.test(ev.location)
          ? `<a href="${escapeHtml(ev.location)}" style="color:#22c55e;text-decoration:none;font-weight:600;">${escapeHtml(ev.location)}</a>`
          : escapeHtml(ev.location))
        : null;

      const rows: string[] = [];
      const row = (label: string, value: string) => `
        <tr>
          <td style="padding:10px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;width:38%;vertical-align:top;">${label}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;vertical-align:top;">${value}</td>
        </tr>`;

      rows.push(row("Início", escapeHtml(startFmt)));
      rows.push(row("Término", escapeHtml(endFmt)));
      if (locationHtml) rows.push(row("Local / Link", locationHtml));
      if (requesterProfile?.full_name) {
        const r = `${escapeHtml(requesterProfile.full_name)}${requesterProfile.email ? ` &lt;${escapeHtml(requesterProfile.email)}&gt;` : ""}${requesterProfile.phone ? `<br/><span style="color:#64748b;font-size:13px;">${escapeHtml(requesterProfile.phone)}</span>` : ""}`;
        rows.push(row("Solicitado por", r));
      }
      if (pvProfile?.full_name) rows.push(row("Pré-Vendas", escapeHtml(pvProfile.full_name)));
      if (clientInfo) {
        const cli = `<strong>${escapeHtml(clientInfo.company_name || clientInfo.trade_name || "")}</strong>${clientInfo.cnpj ? `<br/><span style="color:#64748b;font-size:13px;">CNPJ: ${escapeHtml(clientInfo.cnpj)}</span>` : ""}`;
        rows.push(row("Cliente", cli));
      }
      if (opportunityInfo) {
        const valStr = fmtBRL(opportunityInfo.value) || fmtBRL(opportunityInfo.monthly_value);
        rows.push(row("Oportunidade", `${escapeHtml(opportunityInfo.title || "")}${valStr ? `<br/><span style="color:#22c55e;font-weight:600;">${valStr}</span>` : ""}`));
      }

      const descriptionHtml = ev.description
        ? `<div style="margin-top:24px;padding:16px 20px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px;">
             <div style="font-size:12px;color:#15803d;text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin-bottom:8px;">Descrição / Briefing</div>
             <div style="font-size:14px;color:#0f172a;line-height:1.6;white-space:pre-wrap;">${escapeHtml(ev.description)}</div>
           </div>`
        : "";

      const htmlBody = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;color:#0f172a;">
          <div style="background:linear-gradient(135deg,#16a34a 0%,#22c55e 100%);padding:24px 28px;border-radius:8px 8px 0 0;">
            <div style="color:#ffffff;font-size:13px;text-transform:uppercase;letter-spacing:1px;opacity:.9;">Evolua CRM • Pré-Vendas</div>
            <h1 style="color:#ffffff;font-size:22px;margin:6px 0 0;font-weight:700;line-height:1.3;">${escapeHtml(ev.title)}</h1>
          </div>
          <div style="padding:24px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
            <p style="margin:0 0 20px;font-size:15px;color:#334155;">
              Olá! Você foi convidado(a) para um compromisso de pré-vendas. Confira os detalhes abaixo e adicione o evento à sua agenda usando o anexo <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:13px;">invite.ics</code>.
            </p>
            <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
              ${rows.join("")}
            </table>
            ${descriptionHtml}
            <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">
              Este convite foi enviado automaticamente pelo <strong style="color:#16a34a;">Evolua CRM</strong>.<br/>
              Para responder, basta replicar este e-mail diretamente para o solicitante.
            </div>
          </div>
        </div>
      `;

      // Buscar account_id do Zoho Mail
      let accountId: string | null = null;
      try {
        const accRes = await fetch(`${mailBase(tokens.data_center)}/api/accounts`, {
          headers: { Authorization: `Zoho-oauthtoken ${tokens.access_token}` },
        });
        const accData = await accRes.json();
        accountId = accData?.data?.[0]?.accountId || null;
      } catch (e) { console.warn("mail accounts fail", e); }

      let mailStatus = "failed";
      let mailErr: string | null = null;
      let mailMsgId: string | null = null;
      if (!accountId) {
        mailErr = "Não foi possível obter accountId do Zoho Mail";
      } else {
        try {
          const sendRes = await fetch(`${mailBase(tokens.data_center)}/api/accounts/${accountId}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Zoho-oauthtoken ${tokens.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fromAddress: tokens.zoho_email,
              toAddress: attendees.join(","),
              subject,
              content: htmlBody,
              mailFormat: "html",
              attachments: [{
                attachmentName: "invite.ics",
                content: btoa(unescape(encodeURIComponent(ics))),
                mimeType: "text/calendar; method=REQUEST",
              }],
            }),
          });
          const sendData = await sendRes.json();
          if (!sendRes.ok) { mailErr = JSON.stringify(sendData); }
          else { mailStatus = "sent"; mailMsgId = sendData?.data?.messageId || null; }
        } catch (e: any) { mailErr = e.message; }
      }

      const { data: logRow } = await admin.from("email_invitation_log").insert({
        agenda_event_id: ev.id,
        opportunity_id: ev.opportunity_id,
        sent_by: user.id,
        recipients: attendees,
        subject,
        body: htmlBody,
        status: mailStatus,
        zoho_message_id: mailMsgId,
        error_message: mailErr,
      }).select().single();
      invitationLog = logRow;

      // Log na atividade da oportunidade se vinculada
      if (ev.opportunity_id) {
        await admin.from("opportunity_activities").insert({
          opportunity_id: ev.opportunity_id,
          created_by: user.id,
          activity_type: "email_invitation",
          description: `Convite "${ev.title}" enviado para ${attendees.length} convidado(s) via Zoho Mail (${mailStatus})`,
        });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      zoho_event_id: zohoEventId,
      invitation: invitationLog,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("zoho-sync-event error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
