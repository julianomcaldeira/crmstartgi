import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Busca dados do BNDES - operações de financiamento
// Usa a API CKAN do portal de dados abertos + download de CSV como fallback
async function fetchBNDESData() {
  console.log('[BNDES] Iniciando busca de dados...');
  
  try {
    // Resource ID do dataset "Operações não automáticas" (mais completo)
    const resourceId = '6f56b78c-510f-44b6-8274-78a5b7e931f4';
    
    // URL para buscar via CKAN API
    const ckanApiUrl = 'https://dadosabertos.bndes.gov.br/api/3/action/datastore_search';
    
    // Calcular ano de referência (último ano completo)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const yearFilter = oneYearAgo.getFullYear().toString();
    
    console.log(`[BNDES] Buscando operações desde ${yearFilter}...`);
    
    // Fazer requisição para CKAN API
    const response = await fetch(
      `${ckanApiUrl}?resource_id=${resourceId}&limit=500`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'StartGi-CRM/1.0',
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.error('[BNDES] Erro na requisição CKAN:', response.status);
      
      // Fallback: tentar baixar CSV diretamente e processar
      console.log('[BNDES] Tentando download direto do CSV...');
      const csvUrl = `https://dadosabertos.bndes.gov.br/dataset/10e21ad1-568e-45e5-a8af-43f2c05ef1a2/resource/${resourceId}/download/operacoes-financiamento-operacoes-nao-automaticas.csv`;
      
      const csvResponse = await fetch(csvUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'StartGi-CRM/1.0',
        },
      });
      
      if (!csvResponse.ok) {
        return { success: false, leads: [], error: `HTTP ${csvResponse.status}` };
      }
      
      const csvText = await csvResponse.text();
      const leads = parseCSVBNDES(csvText, yearFilter);
      
      console.log(`[BNDES] ${leads.length} operações encontradas via CSV`);
      return { success: true, leads, error: null };
    }
    
    const data = await response.json();
    const records = data.result?.records || [];
    console.log(`[BNDES] ${records.length} registros encontrados via CKAN`);
    
    // Mapear dados diretamente (sem descartar por ano ainda, para garantir base robusta)
    const leads = records
      .map((record: any) => {
        // Extrair CNPJ com diferentes possíveis formatos
        const cnpj = (record.CNPJ || record.cnpj || record['CNPJ do Cliente'] || '')
          .toString()
          .replace(/\D/g, ''); // Remove tudo que não é dígito
        
        return {
          cnpj,
          company_name: record.Cliente || record.cliente || record.nome_empresa || 
                       record['Nome do Cliente'] || record.NomeCliente || '',
          source: 'bndes',
          source_data: record,
          contract_value: parseFloat(
            String(record['Custo BNDES'] || record.custo_bndes || record['Custo do BNDES'] || 
                   record.valor || record.Valor || 0)
              .replace(/\./g, '')
              .replace(',', '.')
          ) || null,
          contract_date: record['Data da Contratação'] || record['Data de Contratação'] || 
                        record.data_contratacao || null,
          segment: record.Setor || record.setor || record.segmento || 
                  record['Setor CNAE'] || null,
          city: record.Município || record.municipio || record['Município do Projeto'] || null,
          state: record.UF || record.uf || record.Estado || null,
        };
      })
      .filter((lead: any) => lead.cnpj && lead.cnpj.length >= 14 && lead.company_name);
    
    console.log(`[BNDES] ${leads.length} leads válidos após filtros`);
    return { success: true, leads, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[BNDES] Erro ao buscar dados:', error);
    return { success: false, leads: [], error: errorMessage };
  }
}

// Parser de CSV do BNDES
function parseCSVBNDES(csvText: string, yearFilter: string): any[] {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
  const leads: any[] = [];
  
  for (let i = 1; i < Math.min(lines.length, 501); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(';').map(v => v.trim().replace(/"/g, ''));
    const record: any = {};
    
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    
    const dataContratacao = record['Data da Contratação'] || record['Data de Contratação'] || '';
    
    const cnpj = (record.CNPJ || '').toString().replace(/\D/g, '');
    const cliente = record.Cliente || '';
    
    if (cnpj && cnpj.length >= 14 && cliente) {
      leads.push({
        cnpj,
        company_name: cliente,
        source: 'bndes',
        source_data: record,
        contract_value: parseFloat(
          String(record['Custo BNDES'] || 0).replace(/\./g, '').replace(',', '.')
        ) || null,
        contract_date: dataContratacao || null,
        segment: record.Setor || null,
        city: record.Município || record['Município'] || null,
        state: record.UF || null,
      });
    }
  }
  
  return leads;
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
