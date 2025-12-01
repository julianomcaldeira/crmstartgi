import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função principal que orquestra todas as sincronizações
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Radar Leads] Iniciando sincronização completa...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Chamar edge functions de cada fonte
    const baseUrl = `${supabaseUrl}/functions/v1`;
    
    const results = await Promise.allSettled([
      // BNDES
      fetch(`${baseUrl}/sync-radar-bndes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }),
      // Portal de Compras (inclui SICAF)
      fetch(`${baseUrl}/sync-radar-portal-compras`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }),
    ]);

    const summary = {
      bndes: { status: 'pending', data: null as any },
      portal_compras: { status: 'pending', data: null as any },
    };

    // Processar resultado BNDES
    if (results[0].status === 'fulfilled') {
      try {
        summary.bndes.data = await results[0].value.json();
        summary.bndes.status = 'success';
      } catch (error) {
        summary.bndes.status = 'error';
        console.error('[Radar] Erro ao processar resposta BNDES:', error);
      }
    } else {
      summary.bndes.status = 'failed';
      console.error('[Radar] BNDES sync falhou:', results[0].reason);
    }

    // Processar resultado Portal de Compras
    if (results[1].status === 'fulfilled') {
      try {
        summary.portal_compras.data = await results[1].value.json();
        summary.portal_compras.status = 'success';
      } catch (error) {
        summary.portal_compras.status = 'error';
        console.error('[Radar] Erro ao processar resposta Portal Compras:', error);
      }
    } else {
      summary.portal_compras.status = 'failed';
      console.error('[Radar] Portal Compras sync falhou:', results[1].reason);
    }

    // Calcular totais
    const totalNew = 
      (summary.bndes.data?.leads_new || 0) +
      (summary.portal_compras.data?.leads_new || 0);
    
    const totalUpdated = 
      (summary.bndes.data?.leads_updated || 0) +
      (summary.portal_compras.data?.leads_updated || 0);

    const totalFound = 
      (summary.bndes.data?.leads_found || 0) +
      (summary.portal_compras.data?.leads_found || 0);

    console.log('[Radar Leads] Sincronização completa:', {
      totalFound,
      totalNew,
      totalUpdated,
    });

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        summary,
        totals: {
          leads_found: totalFound,
          leads_new: totalNew,
          leads_updated: totalUpdated,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Radar Leads] Erro fatal:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});