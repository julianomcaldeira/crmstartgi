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
  legal_nature?: string;
  services?: string;
  distributor?: string;
  competitors?: string;
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
    
    const totalRows = jsonData.length - 1;

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

    // Start background processing and wait for it
    try {
      await processImport(supabase, jsonData, mappings, userId, sessionId, totalRows);
    } catch (error: any) {
      console.error("Erro no processamento:", error);
      await supabase
        .from("import_progress")
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq("session_id", sessionId);
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: "Importação concluída",
        sessionId: sessionId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Erro ao iniciar importação:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

async function processImport(
  supabase: any,
  jsonData: any[],
  mappings: Record<number, string>,
  userId: string,
  sessionId: string,
  totalRows: number
) {
  console.log("=== INICIANDO PROCESSAMENTO ===");
  
  const { data: sellers } = await supabase
    .from("profiles")
    .select("id, full_name");
  
  const sellerMap = new Map(
    (sellers || []).map((s: any) => [s.full_name.toLowerCase().trim(), s.id])
  );

  const prospects: ProspectData[] = [];
  const errors: string[] = [];

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i] as any[];
    
    try {
      const prospect: any = {};
      let skipRow = false;
      
      for (const [colIndex, fieldName] of Object.entries(mappings)) {
        const value = row[parseInt(colIndex)];
        
        if (fieldName === 'cnpj') {
          const cnpjRaw = String(value || '').replace(/\D/g, '');
          // Apenas pegar o CNPJ se ainda não tiver (evita duplicação de mapeamento)
          if (!prospect.cnpj && cnpjRaw.length > 0) {
            if (cnpjRaw.length !== 14) {
              console.log(`⚠️ CNPJ com tamanho inválido na linha ${i + 1}: ${cnpjRaw} (${cnpjRaw.length} dígitos) - pulando linha`);
              skipRow = true;
              break;
            }
            prospect.cnpj = cnpjRaw;
          }
        } else if (fieldName === 'company_name') {
          const companyName = String(value || '').trim();
          if (!companyName) {
            console.log(`⚠️ Razão Social ausente na linha ${i + 1} - pulando linha`);
            skipRow = true;
            break;
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
            if (typeof value === 'number') {
              const excelEpoch = new Date(1899, 11, 30);
              const date = new Date(excelEpoch.getTime() + value * 86400000);
              prospect.foundation_date = date.toISOString().split('T')[0];
            } else {
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
          if (value !== null && value !== undefined && value !== '') {
            prospect.seller_name = String(value).trim();
          }
        } else if (fieldName !== 'ignore' && value !== null && value !== undefined && value !== '') {
          prospect[fieldName] = String(value).trim();
        }
      }

      // Se devemos pular esta linha devido a erros de validação
      if (skipRow) {
        errors.push(`Linha ${i + 1}: dados inválidos ou ausentes`);
        continue;
      }

      if (prospect.cnpj && prospect.company_name) {
        // Map seller name to seller ID if provided
        if (prospect.seller_name) {
          const sellerNameLower = prospect.seller_name.toLowerCase().trim();
          const mappedSellerId = sellerMap.get(sellerNameLower);
          if (mappedSellerId) {
            prospect.seller_id = mappedSellerId;
            console.log(`Vendedor mapeado: ${prospect.seller_name} -> ${mappedSellerId}`);
          } else {
            console.log(`⚠️ Vendedor não encontrado: ${prospect.seller_name}`);
            prospect.seller_id = null;
          }
        } else {
          // No seller in spreadsheet = leave null for any seller to claim
          prospect.seller_id = null;
        }
        prospects.push(prospect);
      } else {
        errors.push(`Linha ${i + 1}: CNPJ ou Razão Social ausente`);
      }
    } catch (error: any) {
      errors.push(`Linha ${i + 1}: ${error.message}`);
      console.error(`Erro na linha ${i + 1}:`, error);
    }
  }

  console.log(`Prospects parseados: ${prospects.length}`);

  const BATCH_SIZE = 50;
  let successCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < prospects.length; i += BATCH_SIZE) {
    const batch = prospects.slice(i, i + BATCH_SIZE);
    
    for (const prospect of batch) {
      try {
        // Check for duplicates using maybeSingle (safer than single)
        const { data: existing, error: checkError } = await supabase
          .from("clients")
          .select("id")
          .eq("cnpj", prospect.cnpj)
          .maybeSingle();

        if (checkError) {
          throw checkError;
        }

        if (existing) {
          duplicateCount++;
          console.log(`⚠️ CNPJ duplicado ignorado: ${prospect.cnpj} - ${prospect.company_name}`);
        } else {
          // Insert with seller_id or userId as fallback ONLY if seller_id exists
          // If seller_id is null, use userId so the prospect has an owner
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
              legal_nature: prospect.legal_nature,
              services: prospect.services,
              distributor: prospect.distributor,
              competitors: prospect.competitors,
              created_by: prospect.seller_id || userId,
            });

          if (insertError) {
            throw insertError;
          }

          successCount++;
          const sellerInfo = prospect.seller_id ? `(vendedor: ${prospect.seller_name})` : '(sem vendedor)';
          console.log(`✅ Importado: ${prospect.company_name} ${sellerInfo}`);
        }
      } catch (error: any) {
        errorCount++;
        errors.push(`${prospect.company_name}: ${error.message}`);
        console.error(`Erro ao importar ${prospect.company_name}:`, error);
      }
    }

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
}
