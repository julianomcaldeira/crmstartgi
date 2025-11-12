import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();
    
    if (!cnpj) {
      throw new Error("CNPJ é obrigatório");
    }

    // Remove non-numeric characters
    const cleanCnpj = cnpj.replace(/\D/g, "");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first
    const { data: cachedData, error: cacheError } = await supabase
      .from("cnpj_cache")
      .select("*")
      .eq("cnpj", cleanCnpj)
      .maybeSingle();

    // If cached data exists and is less than 30 days old, return it
    if (cachedData && !cacheError) {
      const cacheAge = Date.now() - new Date(cachedData.cached_at).getTime();
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      
      if (cacheAge < thirtyDaysInMs) {
        console.log("Returning cached CNPJ data:", cleanCnpj);
        return new Response(JSON.stringify({
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
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Call ReceitaWS API (free public API for CNPJ data)
    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`);
    
    if (!response.ok) {
      throw new Error("Erro ao buscar dados do CNPJ");
    }

    const data = await response.json();

    if (data.status === "ERROR") {
      throw new Error(data.message || "CNPJ não encontrado");
    }

    // Transform the response to match our database structure
    const transformedData = {
      cnpj: data.cnpj,
      company_name: data.nome || "",
      trade_name: data.fantasia || data.nome || "",
      email: data.email || "",
      phone: data.telefone || "",
      address: `${data.logradouro || ""}, ${data.numero || ""} ${data.complemento || ""}`.trim(),
      city: data.municipio || "",
      state: data.uf || "",
      zip_code: data.cep || "",
      segment: data.atividade_principal?.[0]?.text || "",
      share_capital: parseFloat(data.capital_social || "0"),
      legal_nature: data.natureza_juridica || "",
      registration_status: data.situacao || "",
      foundation_date: data.data_situacao || null,
    };

    // Save to cache (upsert to handle updates)
    const { error: upsertError } = await supabase
      .from("cnpj_cache")
      .upsert({
        ...transformedData,
        cached_at: new Date().toISOString(),
      }, {
        onConflict: "cnpj",
      });

    if (upsertError) {
      console.error("Error saving to cache:", upsertError);
      // Continue even if cache save fails
    }

    console.log("CNPJ data fetched from API and cached:", cleanCnpj);

    return new Response(JSON.stringify(transformedData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in buscar-cnpj function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao buscar CNPJ" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});