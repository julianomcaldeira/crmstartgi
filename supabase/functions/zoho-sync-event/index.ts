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

      const subject = `Convite: ${ev.title}`;
      const dateStr = new Date(ev.start_datetime).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const htmlBody = `
        <p>Você está sendo convidado(a) para o seguinte compromisso:</p>
        <p><strong>${ev.title}</strong><br/>
        Data: ${dateStr}<br/>
        ${ev.location ? `Local: ${ev.location}<br/>` : ""}
        </p>
        ${ev.description ? `<p>${ev.description.replace(/\n/g, "<br/>")}</p>` : ""}
        <p style="color:#666;font-size:12px">Enviado via Evolua CRM</p>
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
