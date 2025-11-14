import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpjs, userId } = await req.json();

    if (!cnpjs || !Array.isArray(cnpjs) || cnpjs.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Lista de CNPJs é obrigatória' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      total: cnpjs.length,
      processed: 0,
      success: 0,
      failed: 0,
      duplicates: 0,
      errors: [] as string[]
    };

    for (const cnpj of cnpjs) {
      try {
        const cleanCnpj = cnpj.replace(/\D/g, '');
        
        if (cleanCnpj.length !== 14) {
          results.failed++;
          results.errors.push(`CNPJ ${cnpj} inválido (deve ter 14 dígitos)`);
          results.processed++;
          continue;
        }

        // Verifica se já existe no banco
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('cnpj', cleanCnpj)
          .single();

        if (existing) {
          results.duplicates++;
          results.processed++;
          console.log(`CNPJ ${cleanCnpj} já existe no banco`);
          continue;
        }

        // Busca dados na Receita Federal usando o edge function existente
        const response = await fetch(`${supabaseUrl}/functions/v1/buscar-cnpj`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ cnpj: cleanCnpj })
        });

        if (!response.ok) {
          const errorText = await response.text();
          results.failed++;
          results.errors.push(`CNPJ ${cleanCnpj}: ${errorText}`);
          results.processed++;
          continue;
        }

        const companyData = await response.json();

        // Insere o cliente no banco
        const { error: insertError } = await supabase
          .from('clients')
          .insert({
            cnpj: cleanCnpj,
            company_name: companyData.company_name || companyData.razao_social || '',
            trade_name: companyData.trade_name || companyData.nome_fantasia || companyData.company_name || '',
            email: companyData.email || null,
            phone: companyData.phone || companyData.telefone || null,
            address: companyData.address || companyData.logradouro || null,
            city: companyData.city || companyData.municipio || null,
            state: companyData.state || companyData.uf || null,
            zip_code: companyData.zip_code || companyData.cep || null,
            segment: companyData.segment || companyData.cnae_fiscal_descricao || null,
            share_capital: companyData.share_capital || companyData.capital_social || null,
            legal_nature: companyData.legal_nature || companyData.natureza_juridica || null,
            foundation_date: companyData.foundation_date || companyData.data_inicio_atividade || null,
            registration_status: companyData.registration_status || companyData.situacao || null,
            created_by: userId
          });

        if (insertError) {
          results.failed++;
          results.errors.push(`CNPJ ${cleanCnpj}: ${insertError.message}`);
        } else {
          results.success++;
          console.log(`CNPJ ${cleanCnpj} importado com sucesso`);
        }

        results.processed++;

      } catch (error) {
        results.failed++;
        results.errors.push(`CNPJ ${cnpj}: ${error.message}`);
        results.processed++;
      }
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Erro fatal:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
