import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function buscarSituacaoSICAF(cnpj: string) {
  try {
    const url = `https://api.comprasnet.gov.br/sicaf/v1/fornecedor/${cnpj}`;
    console.log(`[SICAF] Buscando: ${url}`);
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'StartGI-CRM/1.0' }
    });
    
    if (!response.ok) {
      console.log(`[SICAF] HTTP ${response.status} para CNPJ ${cnpj}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`[SICAF] Dados obtidos para ${cnpj}`);
    return data;
  } catch (error: any) {
    console.error(`[SICAF] Erro para ${cnpj}:`, error.message);
    return null;
  }
}

async function buscarContratosPortal(cnpj: string) {
  try {
    const url = `https://compras.dados.gov.br/contratos/v1/contratos.json?cnpj_contratada=${cnpj}&limit=10`;
    console.log(`[Portal Contratos] Buscando: ${url}`);
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'StartGI-CRM/1.0' }
    });
    
    if (!response.ok) {
      console.log(`[Portal Contratos] HTTP ${response.status} para CNPJ ${cnpj}`);
      return null;
    }
    
    const data = await response.json();
    const contratos = data?._embedded?.contratos || data?.contratos || data?.data || [];
    console.log(`[Portal Contratos] ${contratos.length} contratos encontrados para ${cnpj}`);
    return contratos;
  } catch (error: any) {
    console.error(`[Portal Contratos] Erro para ${cnpj}:`, error.message);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Enrich] Iniciando enriquecimento de leads BNDES...');

    // Buscar leads BNDES existentes
    const { data: bndesLeads, error: fetchError } = await supabase
      .from('radar_leads')
      .select('cnpj, company_name')
      .eq('source', 'bndes')
      .limit(50); // Processar 50 por vez para evitar timeout

    if (fetchError) {
      throw new Error(`Erro ao buscar leads BNDES: ${fetchError.message}`);
    }

    if (!bndesLeads || bndesLeads.length === 0) {
      console.log('[Enrich] Nenhum lead BNDES encontrado para enriquecer');
      return new Response(
        JSON.stringify({ 
          message: 'Nenhum lead BNDES encontrado',
          enriched: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Enrich] ${bndesLeads.length} leads BNDES encontrados para processar`);

    let enrichedCount = 0;
    let sicafCount = 0;
    let portalCount = 0;

    // Processar cada CNPJ
    for (const lead of bndesLeads) {
      const cnpj = lead.cnpj;
      console.log(`\n[Enrich] Processando CNPJ: ${cnpj}`);

      // 1. Tentar enriquecer com SICAF
      const sicafData = await buscarSituacaoSICAF(cnpj);
      if (sicafData) {
        // Verificar se já existe lead SICAF para este CNPJ
        const { data: existingSicaf } = await supabase
          .from('radar_leads')
          .select('id')
          .eq('cnpj', cnpj)
          .eq('source', 'sicaf')
          .single();

        if (!existingSicaf) {
          // Criar novo lead SICAF
          const { error: insertError } = await supabase
            .from('radar_leads')
            .insert({
              cnpj: cnpj,
              company_name: sicafData.nome || lead.company_name,
              source: 'sicaf',
              source_data: sicafData,
              city: sicafData.endereco?.cidade,
              state: sicafData.endereco?.uf,
              status: 'novo',
              last_sync_at: new Date().toISOString()
            });

          if (!insertError) {
            sicafCount++;
            enrichedCount++;
            console.log(`[Enrich] ✓ Lead SICAF criado para ${cnpj}`);
          } else {
            console.error(`[Enrich] Erro ao inserir SICAF para ${cnpj}:`, insertError.message);
          }
        } else {
          console.log(`[Enrich] Lead SICAF já existe para ${cnpj}`);
        }
      }

      // 2. Tentar enriquecer com Portal de Compras
      const contratos = await buscarContratosPortal(cnpj);
      if (contratos && contratos.length > 0) {
        // Verificar se já existe lead Portal para este CNPJ
        const { data: existingPortal } = await supabase
          .from('radar_leads')
          .select('id')
          .eq('cnpj', cnpj)
          .eq('source', 'portal_compras')
          .single();

        if (!existingPortal) {
          // Pegar o contrato mais recente
          const contratoRecente = contratos[0];
          
          // Criar novo lead Portal
          const { error: insertError } = await supabase
            .from('radar_leads')
            .insert({
              cnpj: cnpj,
              company_name: contratoRecente.contratada_nome || lead.company_name,
              source: 'portal_compras',
              source_data: { contratos: contratos },
              contract_value: contratoRecente.valor_global,
              contract_date: contratoRecente.data_assinatura,
              status: 'novo',
              last_sync_at: new Date().toISOString()
            });

          if (!insertError) {
            portalCount++;
            enrichedCount++;
            console.log(`[Enrich] ✓ Lead Portal criado para ${cnpj} (${contratos.length} contratos)`);
          } else {
            console.error(`[Enrich] Erro ao inserir Portal para ${cnpj}:`, insertError.message);
          }
        } else {
          console.log(`[Enrich] Lead Portal já existe para ${cnpj}`);
        }
      }

      // Pequeno delay para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n[Enrich] Enriquecimento concluído:`);
    console.log(`  - Total processado: ${bndesLeads.length} CNPJs`);
    console.log(`  - Novos leads SICAF: ${sicafCount}`);
    console.log(`  - Novos leads Portal: ${portalCount}`);
    console.log(`  - Total enriquecido: ${enrichedCount}`);

    return new Response(
      JSON.stringify({
        message: 'Enriquecimento concluído',
        processed: bndesLeads.length,
        enriched: enrichedCount,
        sicaf_leads: sicafCount,
        portal_leads: portalCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Enrich] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
