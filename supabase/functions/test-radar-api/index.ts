import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();
    
    if (!cnpj) {
      return new Response(
        JSON.stringify({ error: 'CNPJ é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Test API] Testando APIs para CNPJ: ${cnpj}`);
    
    const results: any = {
      cnpj,
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // 1. Testar SICAF
    console.log('[Test API] Testando SICAF...');
    try {
      const sicafUrl = `https://api.comprasnet.gov.br/sicaf/v1/fornecedor/${cnpj}`;
      console.log(`[Test API] URL SICAF: ${sicafUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const sicafRes = await fetch(sicafUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      results.tests.sicaf = {
        url: sicafUrl,
        status: sicafRes.status,
        ok: sicafRes.ok,
        statusText: sicafRes.statusText
      };

      if (sicafRes.ok) {
        const sicafData = await sicafRes.json();
        results.tests.sicaf.data = sicafData;
        console.log('[Test API] SICAF: Dados retornados com sucesso');
      } else {
        const errorText = await sicafRes.text();
        results.tests.sicaf.error = errorText.substring(0, 500);
        console.error(`[Test API] SICAF: HTTP ${sicafRes.status}`, errorText.substring(0, 200));
      }
    } catch (error: any) {
      results.tests.sicaf = {
        error: error.message,
        type: 'exception'
      };
      console.error('[Test API] SICAF Exception:', error);
    }

    // 2. Testar Fornecedores Portal
    console.log('[Test API] Testando Portal Fornecedores...');
    try {
      const fornecedorUrl = `https://compras.dados.gov.br/fornecedores/v1/fornecedores/${cnpj}.json`;
      console.log(`[Test API] URL Fornecedor: ${fornecedorUrl}`);
      
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 10000);
      
      const fornecedorRes = await fetch(fornecedorUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        signal: controller2.signal
      });
      
      clearTimeout(timeoutId2);
      
      results.tests.fornecedor = {
        url: fornecedorUrl,
        status: fornecedorRes.status,
        ok: fornecedorRes.ok,
        statusText: fornecedorRes.statusText
      };

      if (fornecedorRes.ok) {
        const fornecedorData = await fornecedorRes.json();
        results.tests.fornecedor.data = fornecedorData;
        console.log('[Test API] Fornecedor: Dados retornados com sucesso');
      } else {
        const errorText = await fornecedorRes.text();
        results.tests.fornecedor.error = errorText.substring(0, 500);
        console.error(`[Test API] Fornecedor: HTTP ${fornecedorRes.status}`);
      }
    } catch (error: any) {
      results.tests.fornecedor = {
        error: error.message,
        type: 'exception'
      };
      console.error('[Test API] Fornecedor Exception:', error);
    }

    // 3. Testar Contratos Portal
    console.log('[Test API] Testando Portal Contratos...');
    try {
      const contratosUrl = `https://compras.dados.gov.br/contratos/v1/contratos.json?cnpj_contratada=${cnpj}`;
      console.log(`[Test API] URL Contratos: ${contratosUrl}`);
      
      const controller3 = new AbortController();
      const timeoutId3 = setTimeout(() => controller3.abort(), 10000);
      
      const contratosRes = await fetch(contratosUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        signal: controller3.signal
      });
      
      clearTimeout(timeoutId3);
      
      results.tests.contratos = {
        url: contratosUrl,
        status: contratosRes.status,
        ok: contratosRes.ok,
        statusText: contratosRes.statusText
      };

      if (contratosRes.ok) {
        const contratosData = await contratosRes.json();
        results.tests.contratos.data = contratosData;
        results.tests.contratos.count = contratosData?._embedded?.contratos?.length || 
                                        contratosData?.contratos?.length || 
                                        contratosData?.data?.length || 0;
        console.log(`[Test API] Contratos: ${results.tests.contratos.count} contratos encontrados`);
      } else {
        const errorText = await contratosRes.text();
        results.tests.contratos.error = errorText.substring(0, 500);
        console.error(`[Test API] Contratos: HTTP ${contratosRes.status}`);
      }
    } catch (error: any) {
      results.tests.contratos = {
        error: error.message,
        type: 'exception'
      };
      console.error('[Test API] Contratos Exception:', error);
    }

    // 4. Testar Participações
    console.log('[Test API] Testando Portal Participações...');
    try {
      const participacoesUrl = `https://compras.dados.gov.br/licitacoes/v1/itens_licitacao.json?cnpj_contratada=${cnpj}`;
      console.log(`[Test API] URL Participações: ${participacoesUrl}`);
      
      const controller4 = new AbortController();
      const timeoutId4 = setTimeout(() => controller4.abort(), 10000);
      
      const participacoesRes = await fetch(participacoesUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        signal: controller4.signal
      });
      
      clearTimeout(timeoutId4);
      
      results.tests.participacoes = {
        url: participacoesUrl,
        status: participacoesRes.status,
        ok: participacoesRes.ok,
        statusText: participacoesRes.statusText
      };

      if (participacoesRes.ok) {
        const participacoesData = await participacoesRes.json();
        results.tests.participacoes.data = participacoesData;
        results.tests.participacoes.count = participacoesData?._embedded?.itens_licitacao?.length || 
                                            participacoesData?.itens_licitacao?.length || 
                                            participacoesData?.data?.length || 0;
        console.log(`[Test API] Participações: ${results.tests.participacoes.count} participações encontradas`);
      } else {
        const errorText = await participacoesRes.text();
        results.tests.participacoes.error = errorText.substring(0, 500);
        console.error(`[Test API] Participações: HTTP ${participacoesRes.status}`);
      }
    } catch (error: any) {
      results.tests.participacoes = {
        error: error.message,
        type: 'exception'
      };
      console.error('[Test API] Participações Exception:', error);
    }

    console.log('[Test API] Testes concluídos');
    
    return new Response(
      JSON.stringify(results, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Test API] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
