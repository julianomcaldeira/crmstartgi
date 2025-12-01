import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Busca dados do BNDES - operações de financiamento recentes
// NOTA: BNDES não possui API REST pública. Os dados estão disponíveis em datasets
// no portal de dados abertos que precisam ser baixados manualmente.
// Por enquanto, retornamos lista vazia até implementar scraping ou download de datasets.
async function fetchBNDESData() {
  console.log('[BNDES] Iniciando busca de dados...');
  console.log('[BNDES] API REST não disponível - usando fonte alternativa futura');
  
  try {
    // TODO: Implementar download/scraping de datasets do portal de dados abertos
    // Portal: https://dadosabertos.bndes.gov.br/
    // Os dados de operações de financiamento estão disponíveis como datasets para download
    // não como endpoints REST
    
    console.log('[BNDES] Retornando lista vazia - implementação futura necessária');
    return { success: true, leads: [], error: null };
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

    // Processar cada lead (array pode estar vazio, cast para any para evitar erro TypeScript)
    const typedLeads = leads as any[];
    for (const lead of typedLeads) {
      if (!lead || typeof lead !== 'object' || !lead.cnpj) continue;

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