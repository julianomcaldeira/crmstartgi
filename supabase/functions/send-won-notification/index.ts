import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const _authHeader = req.headers.get('Authorization');
    if (!_authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const _authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: _authHeader } } });
    const { data: _claimsData, error: _authError } = await _authClient.auth.getClaims(_authHeader.replace('Bearer ', ''));
    if (_authError || !_claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const {
      clientName,
      clientCnpj,
      productName,
      implementationValue,
      implBillingDate,
      paymentConditions,
      financialContactName,
      financialContactEmail,
      monthlyValue,
      firstMonthlyDate,
      sellerName,
      sellerEmail,
      attachments,
      billingType,
    } = await req.json();

    // Format dates for display
    const formatDate = (dateStr: string) => {
      if (!dateStr) return "N/A";
      const [y, m, d] = dateStr.split("-");
      return `${d}/${m}/${y}`;
    };

    const attachmentsList = (attachments || [])
      .map((a: { name: string; url: string }) => `<li><a href="${a.url}">${a.name}</a></li>`)
      .join("");

    const billingTypeLabel = billingType === "pontual" ? "Pontual" : "Recorrente";

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #16a34a; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🎉 Nova Venda Fechada!</h1>
        </div>
        
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #16a34a; padding-bottom: 8px;">Dados do Cliente</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #6b7280; width: 200px;">Cliente:</td><td style="padding: 6px 0; font-weight: bold;">${clientName}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">CNPJ:</td><td style="padding: 6px 0;">${clientCnpj}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Produto:</td><td style="padding: 6px 0;">${productName}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Tipo de Cobrança:</td><td style="padding: 6px 0;">${billingTypeLabel}</td></tr>
          </table>

          <h2 style="color: #1f2937; border-bottom: 2px solid #16a34a; padding-bottom: 8px; margin-top: 20px;">Informações Financeiras</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #6b7280; width: 200px;">Valor de Implantação:</td><td style="padding: 6px 0; font-weight: bold;">${implementationValue}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Data Cobrança Implantação:</td><td style="padding: 6px 0;">${formatDate(implBillingDate)}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Valor da Mensalidade:</td><td style="padding: 6px 0; font-weight: bold;">${monthlyValue}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Data 1ª Mensalidade:</td><td style="padding: 6px 0;">${formatDate(firstMonthlyDate)}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Condições de Pagamento:</td><td style="padding: 6px 0;">${paymentConditions}</td></tr>
          </table>

          <h2 style="color: #1f2937; border-bottom: 2px solid #16a34a; padding-bottom: 8px; margin-top: 20px;">Contato Financeiro</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #6b7280; width: 200px;">Nome:</td><td style="padding: 6px 0;">${financialContactName}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Email:</td><td style="padding: 6px 0;">${financialContactEmail || "N/A"}</td></tr>
          </table>

          <h2 style="color: #1f2937; border-bottom: 2px solid #16a34a; padding-bottom: 8px; margin-top: 20px;">Vendedor</h2>
          <p style="margin: 4px 0;">${sellerName} (${sellerEmail})</p>

          ${attachmentsList ? `
            <h2 style="color: #1f2937; border-bottom: 2px solid #16a34a; padding-bottom: 8px; margin-top: 20px;">Contrato Anexado</h2>
            <ul>${attachmentsList}</ul>
          ` : ""}
        </div>
      </div>
    `;

    // Use Lovable AI to send email via Resend or SMTP
    // For now, we'll use the SUPABASE_SERVICE_ROLE_KEY to call a simple email approach
    // We need to use an email service. Let's use the built-in approach with fetch to a mail API.

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    // Send email using Supabase's built-in email or a simple notification approach
    // Since we can't send arbitrary emails via Supabase Auth, we'll store the notification
    // and log it. For actual email sending, we'd need Resend or similar.
    
    // For now, let's try using Resend if available, otherwise just log
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    if (RESEND_API_KEY) {
      // NOTA: Enquanto o domínio não estiver verificado no Resend, só é possível enviar para o email da conta.
      // Após verificar o domínio startgi.com.br no Resend, altere os destinatários abaixo:
      // const recipients = ["financeiro@ganheilicitacao.com.br", "juliano@startgi.com.br"];
      const recipients = ["juliano.montesino.caldeira@gmail.com"];
      const ccRecipients: string[] = [];

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "CRM StartGI <onboarding@resend.dev>",
          to: recipients,
          cc: ccRecipients,
          subject: `🎉 Nova Venda - ${clientName} | ${productName}`,
          html: htmlBody,
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.text();
        console.error("Resend error:", errorData);
        throw new Error(`Erro ao enviar email: ${errorData}`);
      }

      const emailResult = await emailResponse.json();
      console.log("Email sent successfully:", emailResult);
    } else {
      console.log("RESEND_API_KEY not configured. Email notification logged:");
      console.log("To: financeiro@ganheilicitacao.com.br, juliano@startgi.com.br");
      console.log("CC:", sellerEmail);
      console.log("Subject:", `Nova Venda - ${clientName} | ${productName}`);
      // Return success but warn about missing email config
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: "Email não enviado - chave de API do serviço de email não configurada" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-won-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
