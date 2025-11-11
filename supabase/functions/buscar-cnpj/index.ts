import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    console.log("CNPJ data fetched successfully:", cleanCnpj);

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