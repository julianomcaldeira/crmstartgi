import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Busca dados do Portal de Compras Governamentais - Contratos a partir de 2021
async function fetchPortalComprasData() {
  console.log('[Portal Compras] Iniciando busca de contratos...');
  
  try {
    // Nova API de Compras Governamentais - Contratos a partir de 2021
    const apiUrl = 'https://compras.dados.gov.br/comprasContratos/v1/contratos';
    
    // Buscar contratos recentes (offset 0, limit 200 para ter uma base)
    const params = new URLSearchParams({
      offset: '0',
      limit: '200',
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
    
    // A resposta pode vir como objeto com _embedded ou diretamente como array
    let contratos = [];
    if (data._embedded && data._embedded.contratos) {
      contratos = data._embedded.contratos;
    } else if (Array.isArray(data)) {
      contratos = data;
    } else if (data.contratos) {
      contratos = data.contratos;
    }
    
    console.log(`[Portal Compras] ${contratos.length} contratos encontrados`);
    
    const leads = contratos
      .map((contrato: any) => {
        // Extrair CNPJ removendo formatação
        const cnpj = (contrato.fornecedor?.cpfCnpj || contrato.cnpj_contratada || 
                     contrato.cnpjContratada || '')
          .toString()
          .replace(/\D/g, '');
        
        return {
          cnpj,
          company_name: contrato.fornecedor?.nome || contrato.nome_contratada || 
                       contrato.nomeContratada || '',
          source: 'portal_compras',
          source_data: contrato,
          contract_value: parseFloat(contrato.valorInicial || contrato.valor_inicial || 0) || null,
          contract_date: contrato.dataAssinatura || contrato.data_assinatura || null,
          segment: (contrato.objeto || '')?.substring(0, 200) || null,
          city: contrato.fornecedor?.municipio || null,
          state: contrato.fornecedor?.uf || null,
        };
      })
      .filter((lead: any) => lead.cnpj && lead.cnpj.length >= 14 && lead.company_name);
    
    console.log(`[Portal Compras] ${leads.length} leads válidos após filtros`);
    return { success: true, leads, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Portal Compras] Erro ao buscar dados:', error);
    return { success: false, leads: [], error: errorMessage };
  }
}

// Busca dados do SICAF (Sistema de Cadastramento de Fornecedores)
async function fetchSICAFData() {
  console.log('[SICAF] Iniciando busca de fornecedores...');
  
  try {
    // API de Fornecedores
    const apiUrl = 'https://compras.dados.gov.br/fornecedores/v1/fornecedores';
    
    const params = new URLSearchParams({
      offset: '0',
      limit: '200',
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
    
    // A resposta pode vir como objeto com _embedded ou diretamente como array
    let fornecedores = [];
    if (data._embedded && data._embedded.fornecedores) {
      fornecedores = data._embedded.fornecedores;
    } else if (Array.isArray(data)) {
      fornecedores = data;
    } else if (data.fornecedores) {
      fornecedores = data.fornecedores;
    }
    
    console.log(`[SICAF] ${fornecedores.length} fornecedores encontrados`);
    
    const leads = fornecedores
      .map((fornecedor: any) => {
        // Extrair CNPJ removendo formatação
        const cnpj = (fornecedor.cpfCnpj || fornecedor.cnpj || '')
          .toString()
          .replace(/\D/g, '');
        
        return {
          cnpj,
          company_name: fornecedor.nome || fornecedor.razaoSocial || fornecedor.razao_social || '',
          trade_name: fornecedor.nomeFantasia || fornecedor.nome_fantasia || null,
          source: 'sicaf',
          source_data: fornecedor,
          email: fornecedor.email || null,
          phone: fornecedor.telefone || fornecedor.telefoneComercial || null,
          city: fornecedor.municipio || fornecedor.cidade || null,
          state: fornecedor.uf || fornecedor.estado || null,
        };
      })
      .filter((lead: any) => lead.cnpj && lead.cnpj.length >= 14 && lead.company_name);
    
    console.log(`[SICAF] ${leads.length} leads válidos após filtros`);
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

    // Buscar dados do Portal de Compras e SICAF em paralelo
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
    console.log(`[Portal Compras Sync] Detalhes - Portal: ${comprasResult.leads.length}, SICAF: ${sicafResult.leads.length}`);

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
