import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Busca situação de um fornecedor no SICAF por CNPJ
async function buscarSituacaoSICAF(cnpj: string) {
  console.log(`[SICAF] Buscando situação do CNPJ ${cnpj}...`);
  
  try {
    const apiUrl = `https://api.comprasnet.gov.br/sicaf/v1/fornecedor/${cnpj}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'StartGi-CRM/1.0',
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[SICAF] Erro na requisição para ${cnpj}:`, response.status);
      return null;
    }
    
    const data = await response.json();
    
    return {
      cnpj: data.cnpj || cnpj,
      nome: data.nome || data.razaoSocial || '',
      situacao: {
        habilitado: data.situacao?.habilitado || false,
        nivel: data.situacao?.nivel || null,
        validade: data.situacao?.validade || null,
      },
      endereco: data.endereco || null,
      naturezaJuridica: data.naturezaJuridica || null,
    };
  } catch (error) {
    console.error(`[SICAF] Erro ao buscar CNPJ ${cnpj}:`, error);
    return null;
  }
}

// Busca dados de um fornecedor no Portal de Compras
async function buscarFornecedorComprasGov(cnpj: string) {
  console.log(`[Compras.gov] Buscando fornecedor ${cnpj}...`);
  
  try {
    const apiUrl = `https://compras.dados.gov.br/fornecedores/v1/fornecedores/${cnpj}.json`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'StartGi-CRM/1.0',
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[Compras.gov] Erro na requisição para ${cnpj}:`, response.status);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[Compras.gov] Erro ao buscar fornecedor ${cnpj}:`, error);
    return null;
  }
}

// Busca participações em licitações de um fornecedor
async function buscarParticipacoes(cnpj: string) {
  console.log(`[Compras.gov] Buscando participações do CNPJ ${cnpj}...`);
  
  try {
    const apiUrl = `https://compras.dados.gov.br/licitacoes/v1/itens_licitacao.json?fornecedor=${cnpj}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'StartGi-CRM/1.0',
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[Compras.gov] Erro na busca de participações para ${cnpj}:`, response.status);
      return [];
    }
    
    const data = await response.json();
    return Array.isArray(data) ? data : (data._embedded?.itens_licitacao || []);
  } catch (error) {
    console.error(`[Compras.gov] Erro ao buscar participações ${cnpj}:`, error);
    return [];
  }
}

// Busca contratos de um fornecedor
async function buscarContratos(cnpj: string) {
  console.log(`[Compras.gov] Buscando contratos do CNPJ ${cnpj}...`);
  
  try {
    const apiUrl = `https://compras.dados.gov.br/contratos/v1/contratos.json?fornecedor=${cnpj}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'StartGi-CRM/1.0',
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[Compras.gov] Erro na busca de contratos para ${cnpj}:`, response.status);
      return [];
    }
    
    const data = await response.json();
    return Array.isArray(data) ? data : (data._embedded?.contratos || []);
  } catch (error) {
    console.error(`[Compras.gov] Erro ao buscar contratos ${cnpj}:`, error);
    return [];
  }
}

// Busca lista de contratos recentes para sincronização em massa
async function fetchPortalComprasData() {
  console.log('[Portal Compras] Iniciando busca de contratos...');
  
  try {
    const apiUrl = 'https://compras.dados.gov.br/contratos/v1/contratos.json';
    
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
      console.error('[Portal Compras] Erro na requisição:', response.status);
      return { success: false, leads: [], error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    
    let contratos = [];
    if (data._embedded && data._embedded.contratos) {
      contratos = data._embedded.contratos;
    } else if (Array.isArray(data)) {
      contratos = data;
    }
    
    console.log(`[Portal Compras] ${contratos.length} contratos encontrados`);
    
    const leads = [];
    
    // Processar cada contrato e enriquecer com dados do SICAF
    for (const contrato of contratos) {
      const cnpj = (contrato.fornecedor?.cnpj || contrato.cnpj_contratada || '')
        .toString()
        .replace(/\D/g, '');
      
      if (!cnpj || cnpj.length < 14) continue;
      
      // Buscar dados complementares do SICAF
      const sicafData = await buscarSituacaoSICAF(cnpj);
      
      leads.push({
        cnpj,
        company_name: sicafData?.nome || contrato.fornecedor?.nome || '',
        source: 'portal_compras',
        source_data: {
          ...contrato,
          sicaf: sicafData,
        },
        contract_value: parseFloat(contrato.valorInicial || contrato.valor || 0) || null,
        contract_date: contrato.dataAssinatura || contrato.dataVigenciaInicio || null,
        segment: (contrato.objeto || '')?.substring(0, 200) || null,
        city: sicafData?.endereco?.municipio || null,
        state: sicafData?.endereco?.uf || null,
      });
    }
    
    console.log(`[Portal Compras] ${leads.length} leads válidos após enriquecimento`);
    return { success: true, leads, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Portal Compras] Erro ao buscar dados:', error);
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

    // Buscar dados do Portal de Compras (já enriquecidos com SICAF)
    const comprasResult = await fetchPortalComprasData();

    const allLeads = comprasResult.leads;
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
