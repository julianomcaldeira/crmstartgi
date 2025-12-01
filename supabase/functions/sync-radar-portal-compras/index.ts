import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Busca dados do Portal de Compras Governamentais (inclui SICAF)
async function fetchPortalComprasData() {
  console.log('[Portal Compras] Iniciando busca de dados...');
  
  try {
    // API de Compras Governamentais
    // Documentação: https://compras.dados.gov.br/docs/home.html
    const apiUrl = 'http://compras.dados.gov.br/contratos/v1/contratos.json';
    
    // Buscar contratos recentes (últimos 30 dias)
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 30);
    const dataFim = new Date();
    
    const params = new URLSearchParams({
      data_assinatura_min: dataInicio.toISOString().split('T')[0],
      data_assinatura_max: dataFim.toISOString().split('T')[0],
      offset: '0',
      limit: '100',
    });
    
    const response = await fetch(
      `${apiUrl}?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'StartGi-CRM/1.0',
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.error('[Portal Compras] Erro na requisição:', response.status);
      return { success: false, leads: [], error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const contratos = data._embedded?.contratos || data.contratos || [];
    console.log(`[Portal Compras] ${contratos.length} contratos encontrados`);
    
    const leads = contratos.map((contrato: any) => ({
      cnpj: contrato.cnpj_contratada || contrato.cnpjContratada || '',
      company_name: contrato.nome_contratada || contrato.nomeContratada || '',
      source: 'portal_compras',
      source_data: contrato,
      contract_value: parseFloat(contrato.valor_inicial || contrato.valorInicial || 0),
      contract_date: contrato.data_assinatura || contrato.dataAssinatura || null,
      segment: (contrato.objeto || '')?.substring(0, 100) || null,
      city: null,
      state: null,
    })).filter((lead: any) => lead.cnpj && lead.company_name);
    
    return { success: true, leads, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Portal Compras] Erro ao buscar dados:', error);
    return { success: false, leads: [], error: errorMessage };
  }
}

// Busca dados do SICAF (Sistema de Cadastramento de Fornecedores)
async function fetchSICAFData() {
  console.log('[SICAF] Iniciando busca de dados...');
  
  try {
    // SICAF/Fornecedores está na API de Compras Governamentais
    // Documentação: https://compras.dados.gov.br/docs/lista-metodos-fornecedores.html
    const apiUrl = 'http://compras.dados.gov.br/fornecedores/v1/fornecedores.json';
    
    const params = new URLSearchParams({
      offset: '0',
      limit: '100',
    });
    
    const response = await fetch(
      `${apiUrl}?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'StartGi-CRM/1.0',
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.error('[SICAF] Erro na requisição:', response.status);
      return { success: false, leads: [], error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const fornecedores = data._embedded?.fornecedores || data.fornecedores || [];
    console.log(`[SICAF] ${fornecedores.length} fornecedores encontrados`);
    
    const leads = fornecedores.map((fornecedor: any) => ({
      cnpj: fornecedor.cnpj || fornecedor.cpfCnpj || '',
      company_name: fornecedor.nome || fornecedor.razao_social || '',
      source: 'sicaf',
      source_data: fornecedor,
      email: fornecedor.email || null,
      phone: fornecedor.telefone || null,
      city: fornecedor.municipio || fornecedor.cidade || null,
      state: fornecedor.uf || fornecedor.estado || null,
    })).filter((lead: any) => lead.cnpj && lead.company_name);
    
    return { success: true, leads, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[SICAF] Erro ao buscar dados:', error);
    return { success: false, leads: [], error: errorMessage };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Portal Compras Sync] Iniciando sincronização...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados do Portal de Compras e SICAF
    const [comprasResult, sicafResult] = await Promise.all([
      fetchPortalComprasData(),
      fetchSICAFData(),
    ]);

    const allLeads = [...comprasResult.leads, ...sicafResult.leads];
    let leadsNew = 0;
    let leadsUpdated = 0;

    // Registrar sincronização
    const { data: syncRecord } = await supabase
      .from('radar_sync_history')
      .insert({
        source: 'portal_compras',
        sync_started_at: new Date().toISOString(),
        status: 'running',
      })
      .select()
      .single();

    // Processar cada lead
    for (const lead of allLeads) {
      if (!lead.cnpj) continue;

      const { data: existing } = await supabase
        .from('radar_leads')
        .select('id')
        .eq('cnpj', lead.cnpj)
        .eq('source', lead.source)
        .single();

      if (existing) {
        await supabase
          .from('radar_leads')
          .update({
            ...lead,
            last_sync_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        leadsUpdated++;
      } else {
        await supabase.from('radar_leads').insert(lead);
        leadsNew++;
      }
    }

    // Atualizar histórico
    if (syncRecord) {
      await supabase
        .from('radar_sync_history')
        .update({
          status: 'completed',
          sync_completed_at: new Date().toISOString(),
          leads_found: allLeads.length,
          leads_new: leadsNew,
          leads_updated: leadsUpdated,
        })
        .eq('id', syncRecord.id);
    }

    console.log(`[Portal Compras Sync] Concluído: ${leadsNew} novos, ${leadsUpdated} atualizados`);

    return new Response(
      JSON.stringify({
        success: true,
        source: 'portal_compras',
        leads_found: allLeads.length,
        leads_new: leadsNew,
        leads_updated: leadsUpdated,
        portal_compras: comprasResult.leads.length,
        sicaf: sicafResult.leads.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Portal Compras Sync] Erro fatal:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});