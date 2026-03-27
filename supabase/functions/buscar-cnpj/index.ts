import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const _authHeader = req.headers.get('Authorization');
    if (!_authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const _authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: _authHeader } } });
    const { data: { user }, error: _authError } = await _authClient.auth.getUser();
    if (_authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log("=== BUSCAR-CNPJ: Iniciando requisição ===");
    const requestBody = await req.json();
    console.log("Request body:", requestBody);
    
    const { cnpj, leadId } = requestBody;
    
    if (!cnpj) {
      console.error("CNPJ não fornecido");
      throw new Error("CNPJ é obrigatório");
    }

    // Remove non-numeric characters
    const cleanCnpj = cnpj.replace(/\D/g, "");
    console.log("CNPJ limpo:", cleanCnpj);

    if (cleanCnpj.length !== 14) {
      console.error("CNPJ com tamanho inválido:", cleanCnpj.length);
      throw new Error("CNPJ deve conter 14 dígitos");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const syncRadarLeadLocation = async (radarLeadId?: string, location?: { city?: string | null; state?: string | null }) => {
      if (!radarLeadId) return;

      const { error: radarLeadError } = await supabase
        .from("radar_leads")
        .update({
          city: location?.city || null,
          state: location?.state || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", radarLeadId);

      if (radarLeadError) {
        console.error("⚠️ Erro ao sincronizar cidade/estado no radar_leads:", radarLeadError);
      }
    };

    console.log("Verificando cache...");
    // Check cache first
    const { data: cachedData, error: cacheError } = await supabase
      .from("cnpj_cache")
      .select("*")
      .eq("cnpj", cleanCnpj)
      .maybeSingle();

    if (cacheError) {
      console.error("Erro ao verificar cache:", cacheError);
    }

    // If cached data exists and is less than 30 days old, return it
    if (cachedData && !cacheError) {
      const cacheAge = Date.now() - new Date(cachedData.cached_at).getTime();
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      
        if (cacheAge < thirtyDaysInMs) {
          await syncRadarLeadLocation(leadId, {
            city: cachedData.city,
            state: cachedData.state,
          });

        console.log("✅ Retornando dados do cache (idade:", Math.floor(cacheAge / (1000 * 60 * 60 * 24)), "dias)");
        return new Response(JSON.stringify({
          source: "cache",
          cnpj: cachedData.cnpj,
          company_name: cachedData.company_name,
          trade_name: cachedData.trade_name,
          email: cachedData.email,
          phone: cachedData.phone,
          address: cachedData.address,
          city: cachedData.city,
          state: cachedData.state,
          zip_code: cachedData.zip_code,
          segment: cachedData.segment,
          share_capital: cachedData.share_capital,
          legal_nature: cachedData.legal_nature,
          registration_status: cachedData.registration_status,
          foundation_date: cachedData.foundation_date,
          cnae_principal: cachedData.cnae_principal,
          cnae_description: cachedData.cnae_description,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        console.log("Cache expirado, buscando nova informação...");
      }
    } else {
      console.log("Nenhum dado em cache, buscando na API...");
    }

    // Call publica.cnpj.ws API with timeout
    console.log("Chamando publica.cnpj.ws para CNPJ:", cleanCnpj);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
      response = await fetch(`https://publica.cnpj.ws/cnpj/${cleanCnpj}`, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json",
        },
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        console.error("Timeout ao consultar publica.cnpj.ws");
        throw new Error("Timeout ao buscar dados do CNPJ. Tente novamente em instantes.");
      }
      throw fetchError;
    }

    const data = await response.json();
    console.log("Resposta da publica.cnpj.ws:", { status: response.status, message: data?.message });

    if (!response.ok) {
      console.error("publica.cnpj.ws retornou status não OK:", response.status, data);
      throw new Error(data?.message || `Erro ao buscar dados do CNPJ (Status: ${response.status})`);
    }

    console.log("✅ Dados obtidos da publica.cnpj.ws com sucesso");

    const establishment = data?.estabelecimento || {};
    const foundationDateISO = establishment?.data_inicio_atividade || null;
    const primaryActivity = establishment?.atividade_principal || {};
    const phone = establishment?.ddd1 && establishment?.telefone1
      ? `${establishment.ddd1}${establishment.telefone1}`
      : "";

    // Transform the response to match our database structure
    const transformedData = {
      source: "api",
      cnpj: establishment?.cnpj || cleanCnpj,
      company_name: data?.razao_social || "",
      trade_name: establishment?.nome_fantasia || data?.razao_social || "",
      email: establishment?.email || "",
      phone,
      address: `${establishment?.logradouro || ""}, ${establishment?.numero || ""} ${establishment?.complemento || ""}`.trim(),
      city: establishment?.cidade?.nome || "",
      state: establishment?.estado?.sigla || "",
      zip_code: establishment?.cep || "",
      segment: primaryActivity?.descricao || "",
      share_capital: parseFloat(data?.capital_social || "0"),
      legal_nature: data?.natureza_juridica?.descricao || "",
      registration_status: establishment?.situacao_cadastral || "",
      foundation_date: foundationDateISO,
      cnae_principal: primaryActivity?.id || "",
      cnae_description: primaryActivity?.descricao || "",
    };

    console.log("Salvando no cache...");
    // Save to cache (upsert to handle updates)
    const { error: upsertError } = await supabase
      .from("cnpj_cache")
      .upsert({
        cnpj: cleanCnpj,
        company_name: transformedData.company_name,
        trade_name: transformedData.trade_name,
        email: transformedData.email,
        phone: transformedData.phone,
        address: transformedData.address,
        city: transformedData.city,
        state: transformedData.state,
        zip_code: transformedData.zip_code,
        segment: transformedData.segment,
        share_capital: transformedData.share_capital,
        legal_nature: transformedData.legal_nature,
        registration_status: transformedData.registration_status,
        foundation_date: transformedData.foundation_date,
        cnae_principal: transformedData.cnae_principal,
        cnae_description: transformedData.cnae_description,
        cached_at: new Date().toISOString(),
      }, {
        onConflict: "cnpj",
      });

    if (upsertError) {
      console.error("⚠️ Erro ao salvar no cache:", upsertError);
      // Continue even if cache save fails
    } else {
      console.log("✅ Dados salvos no cache com sucesso");
    }

    await syncRadarLeadLocation(leadId, transformedData);

    console.log("=== BUSCAR-CNPJ: Requisição concluída com sucesso ===");

    return new Response(JSON.stringify(transformedData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("❌ ERRO na buscar-cnpj function:", error);
    console.error("Stack trace:", error.stack);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao buscar CNPJ. Tente novamente." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});