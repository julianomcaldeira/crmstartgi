import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { read, utils } from "https://deno.land/x/sheetjs/xlsx.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProspectData {
  cnpj: string;
  company_name: string;
  trade_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  segment?: string;
  company_size?: string;
  region?: string;
  share_capital?: number;
  seller_name?: string;
  seller_id?: string | null;
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
    const { data: _claimsData, error: _authError } = await _authClient.auth.getClaims(_authHeader.replace('Bearer ', ''));
    if (_authError || !_claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log("=== IMPORT-PROSPECTS-COMPLETE: Iniciando importação completa ===");
    
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = _claimsData.claims.sub as string;
    
    if (!file) {
      throw new Error("Arquivo não fornecido");
    }

    console.log("Arquivo recebido:", file.name);
    console.log("Usuário:", userId);

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`Total de linhas encontradas: ${jsonData.length}`);
    
    // Parse data from Excel (skip header row)
    const prospects: ProspectData[] = [];
    for (let i = 1; i < jsonData.length; i++) { // Start from 1 to skip header
      const row = jsonData[i] as any[];
      
      // Extract CNPJ (column A)
      const cnpjRaw = String(row[0] || '').replace(/\D/g, '');
      if (!cnpjRaw || cnpjRaw.length !== 14) {
        console.log(`Linha ${i + 1}: CNPJ inválido ou ausente, ignorando...`);
        continue;
      }

      // Extract company_name (column B) - required
      const companyName = String(row[1] || '').trim();
      if (!companyName) {
        console.log(`Linha ${i + 1}: Razão Social ausente, ignorando...`);
        continue;
      }

      // Extract share_capital (column M) and parse as number
      let shareCapital: number | undefined;
      const shareCapitalRaw = row[12];
      if (shareCapitalRaw !== null && shareCapitalRaw !== undefined && shareCapitalRaw !== '') {
        const parsed = parseFloat(String(shareCapitalRaw).replace(/[^\d.,]/g, '').replace(',', '.'));
        if (!isNaN(parsed)) {
          shareCapital = parsed;
        }
      }

      // Extract seller_name (column N - index 13)
      const sellerName = row[13] ? String(row[13]).trim() : undefined;

      prospects.push({
        cnpj: cnpjRaw,
        company_name: companyName,
        trade_name: row[2] ? String(row[2]).trim() : undefined,
        phone: row[3] ? String(row[3]).trim() : undefined,
        email: row[4] ? String(row[4]).trim() : undefined,
        address: row[5] ? String(row[5]).trim() : undefined,
        city: row[6] ? String(row[6]).trim() : undefined,
        state: row[7] ? String(row[7]).trim() : undefined,
        zip_code: row[8] ? String(row[8]).trim() : undefined,
        segment: row[9] ? String(row[9]).trim() : undefined,
        company_size: row[10] ? String(row[10]).trim() : undefined,
        region: row[11] ? String(row[11]).trim() : undefined,
        share_capital: shareCapital,
        seller_name: sellerName,
      });
    }
    
    console.log(`Total de prospects válidos para importar: ${prospects.length}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all sellers to map names to IDs (excluding deleted users)
    console.log("Buscando vendedores...");
    const { data: sellersData, error: sellersError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .or("is_deleted.is.null,is_deleted.eq.false");
    
    if (sellersError) {
      console.error("Erro ao buscar vendedores:", sellersError);
    }
    
    const sellers = sellersData || [];
    console.log(`Total de vendedores encontrados: ${sellers.length}`);
    
    // Map seller names to IDs
    for (const prospect of prospects) {
      if (prospect.seller_name) {
        const seller = sellers.find(s => 
          s.full_name?.toLowerCase() === prospect.seller_name?.toLowerCase() ||
          s.email?.toLowerCase() === prospect.seller_name?.toLowerCase()
        );
        prospect.seller_id = seller ? seller.id : null;
        console.log(`Vendedor "${prospect.seller_name}": ${prospect.seller_id ? 'encontrado' : 'não encontrado'}`);
      } else {
        prospect.seller_id = null;
      }
    }

    const results = {
      total: prospects.length,
      success: 0,
      duplicates: 0,
      errors: 0,
      errorDetails: [] as string[],
    };

    // Process each prospect
    for (let i = 0; i < prospects.length; i++) {
      const prospect = prospects[i];
      console.log(`\n[${i + 1}/${prospects.length}] Processando CNPJ: ${prospect.cnpj}`);
      
      try {
        // Check if CNPJ already exists
        const { data: existingClient, error: checkError } = await supabase
          .from("clients")
          .select("id")
          .eq("cnpj", prospect.cnpj)
          .maybeSingle();

        if (checkError) {
          console.error("Erro ao verificar duplicata:", checkError);
        }

        if (existingClient) {
          console.log(`CNPJ ${prospect.cnpj} já existe no sistema`);
          results.duplicates++;
          continue;
        }

        // Insert into clients table
        // If seller_id is null or undefined, use the importing user's ID
        const finalCreatedBy = prospect.seller_id || userId;
        
        const { error: insertError } = await supabase
          .from("clients")
          .insert({
            cnpj: prospect.cnpj,
            company_name: prospect.company_name,
            trade_name: prospect.trade_name,
            phone: prospect.phone,
            email: prospect.email,
            address: prospect.address,
            city: prospect.city,
            state: prospect.state,
            zip_code: prospect.zip_code,
            segment: prospect.segment,
            company_size: prospect.company_size,
            region: prospect.region,
            share_capital: prospect.share_capital,
            created_by: finalCreatedBy,
          });

        if (insertError) {
          console.error(`Erro ao inserir CNPJ ${prospect.cnpj}:`, insertError);
          results.errors++;
          results.errorDetails.push(`${prospect.cnpj}: ${insertError.message}`);
        } else {
          console.log(`✅ CNPJ ${prospect.cnpj} importado com sucesso`);
          results.success++;
        }
      } catch (error: any) {
        console.error(`Erro ao processar CNPJ ${prospect.cnpj}:`, error);
        results.errors++;
        results.errorDetails.push(`${prospect.cnpj}: ${error.message}`);
      }
    }

    console.log("\n=== RESUMO DA IMPORTAÇÃO ===");
    console.log(`Total: ${results.total}`);
    console.log(`Sucessos: ${results.success}`);
    console.log(`Duplicados: ${results.duplicates}`);
    console.log(`Erros: ${results.errors}`);
    console.log("============================\n");

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error("Erro fatal na importação:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        total: 0,
        success: 0,
        duplicates: 0,
        errors: 1,
        errorDetails: [error.message]
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
