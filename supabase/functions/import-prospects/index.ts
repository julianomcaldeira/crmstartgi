import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { read, utils } from "https://deno.land/x/sheetjs/xlsx.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
// Helper function to convert date from DD/MM/YYYY to YYYY-MM-DD format
function convertDateToISO(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  
  // Check if already in ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Convert from DD/MM/YYYY to YYYY-MM-DD
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (day && month && year && !isNaN(Number(day)) && !isNaN(Number(month)) && !isNaN(Number(year))) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
  return null;
}

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

    console.log("=== IMPORT-PROSPECTS: Iniciando importação ===");
    
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = _claimsData.claims.sub as string;
    const startIndex = parseInt(formData.get("startIndex") as string || "0");
    
    if (!file) {
      throw new Error("Arquivo não fornecido");
    }

    console.log("Arquivo recebido:", file.name);
    console.log("Usuário:", userId);
    console.log("Começando do índice:", startIndex);

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`Total de linhas encontradas: ${jsonData.length}`);
    
    // Extract CNPJs from column A (skip header if exists)
    const cnpjs: string[] = [];
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (row[0]) {
        const cnpjValue = String(row[0]).replace(/\D/g, '');
        if (cnpjValue.length === 14) {
          cnpjs.push(cnpjValue);
        }
      }
    }
    
    console.log(`Total de CNPJs válidos encontrados: ${cnpjs.length}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      total: cnpjs.length,
      success: 0,
      duplicates: 0,
      errors: 0,
      errorDetails: [] as string[],
    };

    // Process each CNPJ starting from startIndex
    for (let i = startIndex; i < cnpjs.length; i++) {
      const cnpj = cnpjs[i];
      console.log(`\n[${i + 1}/${cnpjs.length}] Processando CNPJ: ${cnpj}`);
      
      try {
        // Check if CNPJ already exists
        const { data: existingClient, error: checkError } = await supabase
          .from("clients")
          .select("id")
          .eq("cnpj", cnpj)
          .maybeSingle();

        if (checkError) {
          console.error("Erro ao verificar duplicata:", checkError);
        }

        if (existingClient) {
          console.log(`CNPJ ${cnpj} já existe no sistema`);
          results.duplicates++;
          continue;
        }

        // Check cache first
        const { data: cachedData, error: cacheError } = await supabase
          .from("cnpj_cache")
          .select("*")
          .eq("cnpj", cnpj)
          .maybeSingle();

        let companyData;

        if (cachedData && !cacheError) {
          const cacheAge = Date.now() - new Date(cachedData.cached_at).getTime();
          const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
          
          if (cacheAge < thirtyDaysInMs) {
            console.log(`Usando dados do cache para CNPJ ${cnpj}`);
            companyData = cachedData;
          }
        }

        // If no valid cache, fetch from ReceitaWS
        if (!companyData) {
          console.log(`Buscando dados da ReceitaWS para CNPJ ${cnpj}`);
          
          let retryCount = 0;
          const maxRetries = 3;
          let fetchSuccess = false;
          
          while (!fetchSuccess && retryCount < maxRetries) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000);
              
              const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, {
                signal: controller.signal,
                headers: {
                  'User-Agent': 'Mozilla/5.0',
                }
              });
              clearTimeout(timeoutId);

              if (response.status === 429) {
                retryCount++;
                if (retryCount < maxRetries) {
                  const backoffDelay = 3000 * Math.pow(2, retryCount - 1); // 3s, 6s, 12s
                  console.log(`Rate limit atingido. Tentativa ${retryCount}/${maxRetries}. Aguardando ${backoffDelay/1000}s...`);
                  await new Promise(resolve => setTimeout(resolve, backoffDelay));
                  continue;
                } else {
                  throw new Error("Limite de requisições atingido após múltiplas tentativas");
                }
              }

              if (!response.ok) {
                throw new Error(`ReceitaWS retornou status ${response.status}`);
              }

              const data = await response.json();
              
              if (data.status === "ERROR") {
                throw new Error(data.message || "Erro ao buscar dados");
              }

              // Transform data
              companyData = {
                cnpj: cnpj,
                company_name: data.nome || "",
                trade_name: data.fantasia || data.nome || "",
                email: data.email || "",
                phone: data.telefone || "",
                address: `${data.logradouro || ""}, ${data.numero || ""} ${data.complemento || ""}`.trim(),
                city: data.municipio || "",
                state: data.uf || "",
                zip_code: (data.cep || "").replace(/\D/g, ""),
                segment: data.atividade_principal?.[0]?.text || "",
                share_capital: data.capital_social || "",
                legal_nature: data.natureza_juridica || "",
                registration_status: data.situacao || "",
                foundation_date: convertDateToISO(data.abertura),
              };

              // Save to cache
              await supabase
                .from("cnpj_cache")
                .upsert({
                  ...companyData,
                  cached_at: new Date().toISOString(),
                });

              fetchSuccess = true;
              
              // Delay between successful requests to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (fetchError: any) {
              if (fetchError.name === 'AbortError') {
                throw new Error("Timeout ao buscar dados da ReceitaWS");
              }
              
              if (retryCount >= maxRetries - 1) {
                throw fetchError;
              }
              
              retryCount++;
              const backoffDelay = 3000 * Math.pow(2, retryCount - 1);
              console.log(`Erro na requisição. Tentativa ${retryCount}/${maxRetries}. Aguardando ${backoffDelay/1000}s...`);
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
          }
        }

        // Insert client
        const { error: insertError } = await supabase
          .from("clients")
          .insert({
            cnpj: cnpj,
            company_name: companyData.company_name,
            trade_name: companyData.trade_name,
            email: companyData.email,
            phone: companyData.phone,
            address: companyData.address,
            city: companyData.city,
            state: companyData.state,
            zip_code: companyData.zip_code,
            segment: companyData.segment,
            share_capital: companyData.share_capital,
            legal_nature: companyData.legal_nature,
            company_size: "",
            region: "",
            competitors: "",
            created_by: userId,
          });

        if (insertError) {
          throw insertError;
        }

        results.success++;
        console.log(`✅ CNPJ ${cnpj} importado com sucesso`);
      } catch (error: any) {
        console.error(`❌ Erro ao processar CNPJ ${cnpj}:`, error);
        results.errors++;
        results.errorDetails.push(`${cnpj}: ${error.message}`);
      }
    }

    console.log("\n=== IMPORT-PROSPECTS: Importação concluída ===");
    console.log("Resumo:", results);

    return new Response(JSON.stringify({
      ...results,
      lastProcessedIndex: cnpjs.length - 1,
      completed: true
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Erro fatal na importação:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      total: 0,
      success: 0,
      duplicates: 0,
      errors: 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
