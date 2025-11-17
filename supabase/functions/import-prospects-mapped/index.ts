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
  registration_status?: string;
  foundation_date?: string;
  cnae_principal?: string;
  cnae_description?: string;
  seller_name?: string;
  seller_id?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== IMPORT-PROSPECTS-MAPPED: Iniciando importação ===");
    
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;
    const sessionId = formData.get("sessionId") as string;
    const mappingsJson = formData.get("mappings") as string;
    
    if (!file || !userId || !sessionId || !mappingsJson) {
      throw new Error("Parâmetros obrigatórios ausentes");
    }

    const mappings: Record<number, string> = JSON.parse(mappingsJson);
    console.log("Mapeamentos recebidos:", mappings);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = utils.sheet_to_json(worksheet, { header: 1 });
    
    const totalRows = jsonData.length - 1; // Exclude header

    // Create initial progress record
    await supabase.from("import_progress").insert({
      user_id: userId,
      session_id: sessionId,
      total_rows: totalRows,
      processed_rows: 0,
      success_count: 0,
      error_count: 0,
      duplicate_count: 0,
      status: 'processing',
    });

    console.log(`Total de linhas: ${totalRows}`);

    // Fetch sellers for mapping
    const { data: sellers } = await supabase
      .from("profiles")
      .select("id, full_name");
    
    const sellerMap = new Map(
      (sellers || []).map((s: any) => [s.full_name.toLowerCase().trim(), s.id])
    );

    // Parse prospects using mappings
    const prospects: ProspectData[] = [];
    const errors: string[] = [];

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      
      try {
        const prospect: any = {};
        
        // Apply mappings
        for (const [colIndex, fieldName] of Object.entries(mappings)) {
          const value = row[parseInt(colIndex)];
          
          if (fieldName === 'cnpj') {
            const cnpjRaw = String(value || '').replace(/\D/g, '');
            if (cnpjRaw.length !== 14) {
              throw new Error("CNPJ inválido");
            }
            prospect.cnpj = cnpjRaw;
          } else if (fieldName === 'company_name') {
            const companyName = String(value || '').trim();
            if (!companyName) {
              throw new Error("Razão Social obrigatória");
            }
            prospect.company_name = companyName;
          } else if (fieldName === 'share_capital') {
            if (value !== null && value !== undefined && value !== '') {
              const parsed = parseFloat(String(value).replace(/[^\d.,]/g, '').replace(',', '.'));
              if (!isNaN(parsed)) {
                prospect.share_capital = parsed;
              }
            }
          } else if (fieldName === 'foundation_date') {
            if (value !== null && value !== undefined && value !== '') {
              // Handle Excel serial date numbers
              if (typeof value === 'number') {
                const excelEpoch = new Date(1899, 11, 30);
                const date = new Date(excelEpoch.getTime() + value * 86400000);
                prospect.foundation_date = date.toISOString().split('T')[0];
              } else {
                // Handle string dates
                const dateStr = String(value).trim();
                if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  prospect.foundation_date = dateStr;
                } else if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                  const [day, month, year] = dateStr.split('/');
                  prospect.foundation_date = `${year}-${month}-${day}`;
                }
              }
            }
          } else if (fieldName === 'seller_name') {
            prospect.seller_name = value ? String(value).trim() : undefined;
          } else if (value) {
            prospect[fieldName] = String(value).trim();
          }
        }

        // Validate required fields
        if (!prospect.cnpj || !prospect.company_name) {
          throw new Error("CNPJ e Razão Social são obrigatórios");
        }

        // Map seller
        if (prospect.seller_name) {
          const sellerId = sellerMap.get(prospect.seller_name.toLowerCase().trim());
          prospect.seller_id = sellerId || null;
        }

        prospects.push(prospect);
      } catch (error: any) {
        errors.push(`Linha ${i + 1}: ${error.message}`);
        console.error(`Erro na linha ${i + 1}:`, error.message);
      }
    }

    console.log(`Prospects válidos: ${prospects.length}`);

    // Import prospects in batches
    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = errors.length;

    const BATCH_SIZE = 50;
    for (let i = 0; i < prospects.length; i += BATCH_SIZE) {
      const batch = prospects.slice(i, i + BATCH_SIZE);
      
      for (const prospect of batch) {
        try {
          // Check for duplicate
          const { data: existing } = await supabase
            .from("clients")
            .select("id")
            .eq("cnpj", prospect.cnpj)
            .maybeSingle();

          if (existing) {
            duplicateCount++;
            console.log(`Duplicado: CNPJ ${prospect.cnpj}`);
          } else {
            // Insert new prospect
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
                registration_status: prospect.registration_status,
                foundation_date: prospect.foundation_date,
                cnae_principal: prospect.cnae_principal,
                cnae_description: prospect.cnae_description,
                created_by: prospect.seller_id || userId,
              });

            if (insertError) {
              throw insertError;
            }

            successCount++;
            console.log(`✅ Importado: ${prospect.company_name}`);
          }
        } catch (error: any) {
          errorCount++;
          errors.push(`${prospect.company_name}: ${error.message}`);
          console.error(`Erro ao importar ${prospect.company_name}:`, error);
        }
      }

      // Update progress
      await supabase
        .from("import_progress")
        .update({
          processed_rows: Math.min(i + BATCH_SIZE, prospects.length),
          success_count: successCount,
          error_count: errorCount,
          duplicate_count: duplicateCount,
        })
        .eq("session_id", sessionId);

      console.log(`Progresso: ${i + BATCH_SIZE}/${prospects.length}`);
    }

    // Mark as completed
    await supabase
      .from("import_progress")
      .update({
        processed_rows: totalRows,
        success_count: successCount,
        error_count: errorCount,
        duplicate_count: duplicateCount,
        status: 'completed',
      })
      .eq("session_id", sessionId);

    console.log("=== IMPORTAÇÃO CONCLUÍDA ===");
    console.log(`Sucessos: ${successCount}`);
    console.log(`Duplicados: ${duplicateCount}`);
    console.log(`Erros: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        total: totalRows,
        successCount: successCount,
        duplicates: duplicateCount,
        errors: errorCount,
        errorDetails: errors,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Erro fatal na importação:", error);
    
    // Try to update progress with error
    try {
      const formData = await req.formData();
      const sessionId = formData.get("sessionId") as string;
      if (sessionId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from("import_progress")
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq("session_id", sessionId);
      }
    } catch (e) {
      console.error("Erro ao atualizar progresso:", e);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
