import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { read, utils } from "https://deno.land/x/sheetjs/xlsx.mjs";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Campo mapeamentos possíveis
const fieldMappings: Record<string, string[]> = {
  cnpj: ["cnpj", "cpf/cnpj", "documento"],
  company_name: ["razão social", "razao social", "empresa", "nome empresa", "company name"],
  trade_name: ["nome fantasia", "fantasia", "trade name"],
  phone: ["telefone", "fone", "phone", "celular"],
  email: ["email", "e-mail", "mail"],
  address: ["endereço", "endereco", "address", "rua"],
  city: ["cidade", "city", "município", "municipio"],
  state: ["estado", "state", "uf"],
  zip_code: ["cep", "zip", "código postal", "codigo postal"],
  segment: ["segmento", "segment", "setor", "área", "area"],
  company_size: ["porte", "porte da empresa", "tamanho", "size"],
  region: ["região", "regiao", "region"],
  share_capital: ["capital social", "capital", "share capital"],
  registration_status: ["situação", "situacao", "status", "registration status"],
  foundation_date: ["data de abertura", "data abertura", "abertura", "foundation date", "data fundação", "data fundacao"],
  cnae_principal: ["cnae principal", "cnae", "codigo cnae", "código cnae"],
  cnae_description: ["cnae descrição", "cnae descricao", "descrição cnae", "descricao cnae", "atividade principal"],
  seller_name: ["vendedor", "responsável", "responsavel", "seller", "representante"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Requer sessão válida (mesmo padrão das demais funções de importação)
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("=== ANALYZE-IMPORT-HEADERS: Analisando cabeçalhos ===");
    
    
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      throw new Error("Arquivo não fornecido");
    }

    console.log("Arquivo recebido:", file.name);

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      throw new Error("Planilha vazia");
    }

    // Get headers from first row
    const headers = (jsonData[0] as any[]).map((h, index) => ({
      index,
      original: String(h || `Coluna ${index + 1}`).trim(),
      normalized: String(h || '').toLowerCase().trim(),
    }));

    console.log("Cabeçalhos encontrados:", headers);

    // Try to auto-map headers
    const mappings: Record<number, string> = {};
    const unmappedHeaders: typeof headers = [];

    headers.forEach(header => {
      let mapped = false;
      
      for (const [fieldName, possibleNames] of Object.entries(fieldMappings)) {
        if (possibleNames.some(name => header.normalized.includes(name))) {
          mappings[header.index] = fieldName;
          mapped = true;
          console.log(`Auto-mapeado: "${header.original}" -> ${fieldName}`);
          break;
        }
      }

      if (!mapped) {
        unmappedHeaders.push(header);
        console.log(`Não mapeado: "${header.original}"`);
      }
    });

    const totalRows = jsonData.length - 1; // Subtract header row

    return new Response(
      JSON.stringify({
        headers: headers.map(h => h.original),
        autoMappings: mappings,
        unmappedHeaders: unmappedHeaders.map(h => ({
          index: h.index,
          name: h.original,
        })),
        totalRows,
        requiresManualMapping: unmappedHeaders.length > 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Erro ao analisar cabeçalhos:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
