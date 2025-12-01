import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Busca dados do BNDES - operações de financiamento recentes
async function fetchBNDESData() {
  console.log('[BNDES] Iniciando busca de dados...');
  
  try {
    // BNDES disponibiliza dados via portal de dados abertos
    // URL base: https://dadosabertos.bndes.gov.br/dataset/
    const bndesApiUrl = 'https://dadosabertos.bndes.gov.br/api/3/action/datastore_search';
    
    // Dataset de operações de financiamento (exemplo)
    const response = await fetch(
      `${bndesApiUrl}?resource_id=operacoes-financiamento&limit=100`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'StartGi-CRM/1.0',
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.error('[BNDES] Erro na requisição:', response.status);
      return { success: false, leads: [], error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    console.log(`[BNDES] ${data.result?.records?.length || 0} registros encontrados`);
    
    const leads = (data.result?.records || []).map((record: any) => ({
      cnpj: record.cnpj || record.CNPJ || '',
      company_name: record.cliente || record.nome_empresa || '',
      source: 'bndes',
      source_data: record,
      contract_value: parseFloat(record.valor_contratado || record.valor || 0),
      contract_date: record.data_contratacao || null,
      segment: record.setor || record.segmento || null,
      city: record.municipio || null,
      state: record.uf || null,
    })).filter((lead: any) => lead.cnpj && lead.company_name);
    
    return { success: true, leads, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[BNDES] Erro ao buscar dados:', error);
    return { success: false, leads: [], error: errorMessage };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[BNDES Sync] Iniciando sincronização...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Registrar início da sincronização
    const { data: syncRecord, error: syncError } = await supabase
      .from('radar_sync_history')
      .insert({
        source: 'bndes',
        sync_started_at: new Date().toISOString(),
        status: 'running',
      })
      .select()
      .single();

    if (syncError) {
      console.error('[BNDES Sync] Erro ao criar registro de sync:', syncError);
      throw syncError;
    }

    // Buscar dados do BNDES
    const { success, leads, error } = await fetchBNDESData();

    if (!success) {
      await supabase
        .from('radar_sync_history')
        .update({
          status: 'failed',
          sync_completed_at: new Date().toISOString(),
          error_message: error,
        })
        .eq('id', syncRecord.id);

      return new Response(
        JSON.stringify({ error: `Falha ao buscar dados BNDES: ${error}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let leadsNew = 0;
    let leadsUpdated = 0;

    // Processar cada lead
    for (const lead of leads) {
      if (!lead.cnpj) continue;

      // Verificar se já existe
      const { data: existing } = await supabase
        .from('radar_leads')
        .select('id')
        .eq('cnpj', lead.cnpj)
        .eq('source', 'bndes')
        .single();

      if (existing) {
        // Atualizar lead existente
        await supabase
          .from('radar_leads')
          .update({
            ...lead,
            last_sync_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        leadsUpdated++;
      } else {
        // Inserir novo lead
        await supabase.from('radar_leads').insert(lead);
        leadsNew++;
      }
    }

    // Atualizar histórico de sincronização
    await supabase
      .from('radar_sync_history')
      .update({
        status: 'completed',
        sync_completed_at: new Date().toISOString(),
        leads_found: leads.length,
        leads_new: leadsNew,
        leads_updated: leadsUpdated,
      })
      .eq('id', syncRecord.id);

    console.log(`[BNDES Sync] Concluído: ${leadsNew} novos, ${leadsUpdated} atualizados`);

    return new Response(
      JSON.stringify({
        success: true,
        source: 'bndes',
        leads_found: leads.length,
        leads_new: leadsNew,
        leads_updated: leadsUpdated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[BNDES Sync] Erro fatal:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});