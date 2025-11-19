import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const sessionId = formData.get('sessionId') as string;
    const importType = formData.get('importType') as string;

    if (!file || !userId || !sessionId || !importType) {
      throw new Error('Parâmetros obrigatórios faltando');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });

    console.log(`Processing ${data.length} rows for import type: ${importType}`);

    // Create progress record
    await supabase.from('import_progress').insert({
      session_id: sessionId,
      user_id: userId,
      total_rows: data.length,
      status: 'processing'
    });

    // Start background processing
    processImport(supabase, data, userId, sessionId, importType);

    return new Response(
      JSON.stringify({ success: true, sessionId, totalRows: data.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in universal-import:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function processImport(
  supabase: any,
  data: any[],
  userId: string,
  sessionId: string,
  importType: string
) {
  let successCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;
  const errors: string[] = [];

  try {
    // Fetch sellers for mapping
    const { data: sellers } = await supabase.from('profiles').select('id, full_name');
    const sellerMap: Map<string, string> = new Map(
      sellers?.map((s: any) => [s.full_name.toLowerCase(), s.id]) || []
    );

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        let result: { success?: boolean; error?: string; duplicate?: boolean } = {};

        switch (importType) {
          case 'prospects':
            result = await importProspect(supabase, row, userId, sellerMap);
            break;
          case 'feiras':
            result = await importFeira(supabase, row, userId);
            break;
          case 'knowledge_base':
            result = await importKnowledgeBase(supabase, row, userId);
            break;
          case 'contacts':
            result = await importContact(supabase, row, userId);
            break;
          case 'opportunities':
            result = await importOpportunity(supabase, row, userId, sellerMap);
            break;
          case 'tasks':
            result = await importTask(supabase, row, userId, sellerMap);
            break;
          default:
            throw new Error(`Tipo de importação não suportado: ${importType}`);
        }

        if (result.duplicate) {
          duplicateCount++;
        } else if (result.success) {
          successCount++;
        } else {
          errorCount++;
          errors.push(`Linha ${i + 2}: ${result.error || 'Erro desconhecido'}`);
        }

        // Update progress every 50 rows
        if ((i + 1) % 50 === 0 || i === data.length - 1) {
          await supabase.from('import_progress').update({
            processed_rows: i + 1,
            success_count: successCount,
            error_count: errorCount,
            duplicate_count: duplicateCount,
            error_message: errors.length > 0 ? JSON.stringify(errors) : null,
            updated_at: new Date().toISOString()
          }).eq('session_id', sessionId);
        }
      } catch (rowError: any) {
        errorCount++;
        errors.push(`Linha ${i + 2}: ${rowError.message}`);
      }
    }

    // Final update
    await supabase.from('import_progress').update({
      status: 'completed',
      processed_rows: data.length,
      success_count: successCount,
      error_count: errorCount,
      duplicate_count: duplicateCount,
      error_message: errors.length > 0 ? JSON.stringify(errors) : null,
      updated_at: new Date().toISOString()
    }).eq('session_id', sessionId);

  } catch (error: any) {
    console.error('Error in processImport:', error);
    await supabase.from('import_progress').update({
      status: 'failed',
      error_message: error.message,
      updated_at: new Date().toISOString()
    }).eq('session_id', sessionId);
  }
}

async function importProspect(supabase: any, row: any, userId: string, sellerMap: Map<string, string>) {
  const cnpj = String(row['CNPJ'] || '').replace(/\D/g, '');
  
  if (!cnpj || !row['Razão Social']) {
    return { success: false, error: 'CNPJ ou Razão Social faltando' };
  }

  // Check duplicate
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('cnpj', cnpj)
    .single();

  if (existing) {
    return { duplicate: true };
  }

  const sellerId = row['Vendedor'] ? sellerMap.get(row['Vendedor'].toLowerCase()) : null;

  const { error } = await supabase.from('clients').insert({
    cnpj,
    company_name: row['Razão Social'],
    trade_name: row['Nome Fantasia'],
    email: row['Email'],
    phone: row['Telefone'],
    address: row['Logradouro'],
    city: row['Cidade'],
    state: row['Estado'],
    zip_code: row['CEP'],
    segment: row['Segmento'],
    company_size: row['Porte'],
    region: row['Região'],
    share_capital: parseFloat(row['Capital Social']) || null,
    cnae_principal: row['CNAE Principal'],
    cnae_description: row['CNAE Descrição'],
    registration_status: row['Situação'],
    foundation_date: row['Data Abertura'] || null,
    legal_nature: row['Natureza Jurídica'],
    created_by: sellerId || userId
  });

  return error ? { success: false, error: error.message } : { success: true };
}

async function importFeira(supabase: any, row: any, userId: string) {
  if (!row['Nome']) {
    return { success: false, error: 'Nome da feira faltando' };
  }

  const { error } = await supabase.from('feiras').insert({
    name: row['Nome'],
    start_date: row['Data Início'] || null,
    end_date: row['Data Fim'] || null,
    segmento: row['Segmento'],
    location: row['Local'],
    status: 'concluida',
    created_by: userId
  });

  return error ? { success: false, error: error.message } : { success: true };
}

async function importKnowledgeBase(supabase: any, row: any, userId: string) {
  if (!row['Título'] || !row['Conteúdo']) {
    return { success: false, error: 'Título ou Conteúdo faltando' };
  }

  // Check duplicate
  const { data: existing } = await supabase
    .from('knowledge_base')
    .select('id')
    .ilike('title', row['Título'])
    .single();

  if (existing) {
    return { duplicate: true };
  }

  const tags = row['Tags'] ? row['Tags'].split(',').map((t: string) => t.trim()) : [];

  const { error } = await supabase.from('knowledge_base').insert({
    title: row['Título'],
    content: row['Conteúdo'],
    category: row['Categoria'] || 'comercial',
    type: row['Tipo'] || 'artigo',
    url: row['URL'],
    tags,
    created_by: userId
  });

  return error ? { success: false, error: error.message } : { success: true };
}

async function importContact(supabase: any, row: any, userId: string) {
  if (!row['CNPJ Cliente'] || !row['Nome']) {
    return { success: false, error: 'CNPJ Cliente ou Nome faltando' };
  }

  const cnpj = String(row['CNPJ Cliente']).replace(/\D/g, '');
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('cnpj', cnpj)
    .single();

  if (!client) {
    return { success: false, error: 'Cliente não encontrado' };
  }

  const { error } = await supabase.from('contacts').insert({
    client_id: client.id,
    name: row['Nome'],
    email: row['Email'],
    phone: row['Telefone'],
    mobile: row['Celular'],
    role: row['Cargo'],
    is_primary: row['Principal'] === 'Sim',
    created_by: userId
  });

  return error ? { success: false, error: error.message } : { success: true };
}

async function importOpportunity(supabase: any, row: any, userId: string, sellerMap: Map<string, string>) {
  if (!row['CNPJ Cliente'] || !row['Produto']) {
    return { success: false, error: 'CNPJ Cliente ou Produto faltando' };
  }

  const cnpj = String(row['CNPJ Cliente']).replace(/\D/g, '');
  const { data: client } = await supabase.from('clients').select('id').eq('cnpj', cnpj).single();
  
  if (!client) {
    return { success: false, error: 'Cliente não encontrado' };
  }

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .ilike('name', row['Produto'])
    .single();

  if (!product) {
    return { success: false, error: 'Produto não encontrado' };
  }

  const sellerId = row['Vendedor'] ? sellerMap.get(row['Vendedor'].toLowerCase()) : userId;

  const { error } = await supabase.from('opportunities').insert({
    client_id: client.id,
    product_id: product.id,
    implementation_value: parseFloat(row['Valor Implementação']) || null,
    monthly_value: parseFloat(row['Valor Mensal']) || null,
    probability: parseInt(row['Probabilidade']) || 10,
    business_type: row['Tipo Negócio'] || 'cliente_novo',
    expected_close_date: row['Data Fechamento'] || null,
    assigned_to: sellerId,
    created_by: userId,
    title: `Oportunidade - ${row['Produto']}`
  });

  return error ? { success: false, error: error.message } : { success: true };
}

async function importTask(supabase: any, row: any, userId: string, sellerMap: Map<string, string>) {
  if (!row['Título']) {
    return { success: false, error: 'Título da tarefa faltando' };
  }

  let clientId = null;
  if (row['CNPJ Cliente']) {
    const cnpj = String(row['CNPJ Cliente']).replace(/\D/g, '');
    const { data: client } = await supabase.from('clients').select('id').eq('cnpj', cnpj).single();
    clientId = client?.id;
  }

  const sellerId = row['Vendedor'] ? sellerMap.get(row['Vendedor'].toLowerCase()) : userId;

  const { error } = await supabase.from('tasks').insert({
    title: row['Título'],
    description: row['Descrição'],
    client_id: clientId,
    task_type: row['Tipo'] || 'ligacao',
    due_date: row['Data Vencimento'] || null,
    priority: row['Prioridade'] || 'medium',
    assigned_to: sellerId,
    created_by: userId
  });

  return error ? { success: false, error: error.message } : { success: true };
}
