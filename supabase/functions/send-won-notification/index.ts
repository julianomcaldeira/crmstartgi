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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
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
    } = body;

    // Regra de ouro: destinatários fixos + vendedor que fechou o contrato
    const fixedRecipients = [
      "financeiro@ganheilicitacao.com.br",
      "andre@startgi.com.br",
      "juliano@startgi.com.br",
      "vanessa@startgi.com.br",
    ];
    const recipients = Array.from(
      new Set(
        [sellerEmail, ...fixedRecipients]
          .filter((e: string | undefined): e is string => !!e && /\S+@\S+\.\S+/.test(e))
          .map((e: string) => e.trim().toLowerCase())
      )
    );

    const templateData = {
      clientName,
      clientCnpj,
      productName,
      billingType,
      implementationValue,
      implBillingDate,
      monthlyValue,
      firstMonthlyDate,
      paymentConditions,
      financialContactName,
      financialContactEmail,
      sellerName,
      sellerEmail,
      attachments: attachments || [],
    };

    // Idempotency base único por venda (cliente+produto+timestamp arredondado por hora)
    const baseKey = `won-${(clientCnpj || clientName || 'sale').toString().replace(/\W+/g, '')}-${Math.floor(Date.now() / 3600000)}`;

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const results: { to: string; ok: boolean; error?: string }[] = [];

    for (const recipient of recipients) {
      const idempotencyKey = `${baseKey}-${recipient}`;
      try {
        const { data, error } = await serviceClient.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'won-notification',
            recipientEmail: recipient,
            idempotencyKey,
            templateData,
          },
        });
        if (error) {
          console.error(`Falha ao enviar para ${recipient}:`, error);
          results.push({ to: recipient, ok: false, error: error.message });
        } else {
          console.log(`Enviado para ${recipient}:`, data);
          results.push({ to: recipient, ok: true });
        }
      } catch (e) {
        console.error(`Exceção ao enviar para ${recipient}:`, e);
        results.push({ to: recipient, ok: false, error: (e as Error).message });
      }
    }

    const anyOk = results.some((r) => r.ok);
    return new Response(
      JSON.stringify({ success: anyOk, results }),
      { status: anyOk ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro em send-won-notification:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
