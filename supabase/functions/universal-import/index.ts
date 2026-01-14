import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation functions
function validateCNPJ(cnpj: string): boolean {
  const cleaned = String(cnpj).replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  let sum = 0;
  let pos = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i)) * pos;
    pos = pos === 2 ? 9 : pos - 1;
  }
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (parseInt(cleaned.charAt(12)) !== digit) return false;
  
  sum = 0;
  pos = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned.charAt(i)) * pos;
    pos = pos === 2 ? 9 : pos - 1;
  }
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return parseInt(cleaned.charAt(13)) === digit;
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateDate(date: string): boolean {
  if (!date) return true;
  const dateObj = new Date(date);
  return !isNaN(dateObj.getTime());
}

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

    // Create import history record
    const { data: historyRecord } = await supabase
      .from('import_history')
      .insert({
        user_id: userId,
        import_type: importType,
        file_name: file.name,
        file_size: file.size,
        total_rows: data.length,
        status: 'processing'
      })
      .select()
      .single();

    // Start background processing
    processImport(supabase, data, userId, sessionId, importType, historyRecord?.id);

    return new Response(
      JSON.stringify({ success: true, sessionId, totalRows: data.length, historyId: historyRecord?.id }),
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
  importType: string,
  historyId?: string
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
          case 'radar_leads':
            result = await importRadarLead(supabase, row, userId, sellerMap);
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

    // Final update to import_progress
    await supabase.from('import_progress').update({
      status: 'completed',
      processed_rows: data.length,
      success_count: successCount,
      error_count: errorCount,
      duplicate_count: duplicateCount,
      error_message: errors.length > 0 ? JSON.stringify(errors) : null,
      updated_at: new Date().toISOString()
    }).eq('session_id', sessionId);

    // Update import history
    if (historyId) {
      const errorDetails = errors.map((err, idx) => {
        const parts = err.split(':');
        return {
          linha: parts[0]?.replace('Linha ', '').trim(),
          erro: parts[1]?.trim() || err
        };
      });

      await supabase
        .from('import_history')
        .update({
          success_count: successCount,
          error_count: errorCount,
          duplicate_count: duplicateCount,
          error_details: errorDetails.length > 0 ? errorDetails : null,
          completed_at: new Date().toISOString(),
          status: 'completed'
        })
        .eq('id', historyId);
    }

  } catch (error: any) {
    console.error('Error in processImport:', error);
    await supabase.from('import_progress').update({
      status: 'failed',
      error_message: error.message,
      updated_at: new Date().toISOString()
    }).eq('session_id', sessionId);

    // Update history on failure
    if (historyId) {
      await supabase
        .from('import_history')
        .update({
          status: 'failed',
          error_details: [{ erro: error.message }],
          completed_at: new Date().toISOString()
        })
        .eq('id', historyId);
    }
  }
}

async function importProspect(supabase: any, row: any, userId: string, sellerMap: Map<string, string>) {
  const cnpj = String(row['CNPJ'] || '').replace(/\D/g, '');
  
  // Validações obrigatórias
  if (!cnpj || !row['Razão Social']) {
    return { success: false, error: 'CNPJ ou Razão Social faltando' };
  }

  // Validação de CNPJ
  if (!validateCNPJ(cnpj)) {
    return { success: false, error: `CNPJ inválido: ${cnpj}` };
  }

  // Validação de email (se fornecido)
  if (row['Email'] && !validateEmail(row['Email'])) {
    return { success: false, error: `Email inválido: ${row['Email']}` };
  }

  // Validação de data (se fornecida)
  if (row['Data Abertura'] && !validateDate(row['Data Abertura'])) {
    return { success: false, error: `Data de Abertura inválida: ${row['Data Abertura']}` };
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
    foundation_date: convertDateToISO(row['Data Abertura']),
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
  // Validações obrigatórias
  if (!row['Título'] || !row['Conteúdo']) {
    return { success: false, error: 'Título ou Conteúdo faltando' };
  }

  // Validação de título (não pode ser vazio ou só espaços)
  if (row['Título'].trim().length === 0) {
    return { success: false, error: 'Título não pode ser vazio' };
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
  // Validações obrigatórias
  if (!row['CNPJ Cliente'] || !row['Nome']) {
    return { success: false, error: 'CNPJ Cliente ou Nome faltando' };
  }

  // Validação de CNPJ
  const cnpj = String(row['CNPJ Cliente']).replace(/\D/g, '');
  if (!validateCNPJ(cnpj)) {
    return { success: false, error: `CNPJ Cliente inválido: ${row['CNPJ Cliente']}` };
  }

  // Validação de email (se fornecido)
  if (row['Email'] && !validateEmail(row['Email'])) {
    return { success: false, error: `Email inválido: ${row['Email']}` };
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('cnpj', cnpj)
    .single();

  if (!client) {
    return { success: false, error: `Cliente não encontrado para CNPJ: ${row['CNPJ Cliente']}` };
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
  // Validações obrigatórias
  if (!row['CNPJ Cliente'] || !row['Produto']) {
    return { success: false, error: 'CNPJ Cliente ou Produto faltando' };
  }

  // Validação de CNPJ
  const cnpj = String(row['CNPJ Cliente']).replace(/\D/g, '');
  if (!validateCNPJ(cnpj)) {
    return { success: false, error: `CNPJ Cliente inválido: ${row['CNPJ Cliente']}` };
  }

  // Validação de probabilidade
  if (row['Probabilidade']) {
    const validProbs = [10, 25, 50, 80, 90];
    const prob = parseInt(row['Probabilidade']);
    if (!validProbs.includes(prob)) {
      return { success: false, error: `Probabilidade inválida: ${row['Probabilidade']}. Use: 10, 25, 50, 80 ou 90` };
    }
  }

  // Validação de data (se fornecida)
  if (row['Data Fechamento'] && !validateDate(row['Data Fechamento'])) {
    return { success: false, error: `Data de Fechamento inválida: ${row['Data Fechamento']}` };
  }

  const { data: client } = await supabase.from('clients').select('id').eq('cnpj', cnpj).single();
  
  if (!client) {
    return { success: false, error: `Cliente não encontrado para CNPJ: ${row['CNPJ Cliente']}` };
  }

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .ilike('name', row['Produto'])
    .single();

  if (!product) {
    return { success: false, error: `Produto não encontrado: ${row['Produto']}` };
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
  // Helper para normalizar strings (minúsculas, sem acentos)
  const normalize = (value: any) =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  // Validações obrigatórias
  if (!row['Título']) {
    return { success: false, error: 'Título da tarefa faltando' };
  }

  // Aceita tanto "Data Vencimento" quanto "Data do Vencimento" no header
  const rawDueDate = row['Data Vencimento'] || row['Data do Vencimento'] || null;

  // Validação de data de vencimento (se fornecida)
  if (rawDueDate && !validateDate(rawDueDate)) {
    return { success: false, error: `Data de Vencimento inválida: ${rawDueDate}` };
  }

  let clientId = null;
  if (row['CNPJ Cliente']) {
    const cnpj = String(row['CNPJ Cliente']).replace(/\D/g, '');
    
    // Validação de CNPJ (se fornecido)
    if (!validateCNPJ(cnpj)) {
      return { success: false, error: `CNPJ Cliente inválido: ${row['CNPJ Cliente']}` };
    }
    
    const { data: client } = await supabase.from('clients').select('id').eq('cnpj', cnpj).single();
    if (!client) {
      return { success: false, error: `Cliente não encontrado para CNPJ: ${row['CNPJ Cliente']}` };
    }
    clientId = client.id;
  }

  const sellerId = row['Vendedor'] ? sellerMap.get(normalize(row['Vendedor'])) : userId;

  // Mapeia tipos de tarefa amigáveis para os enums do banco
  const rawType = normalize(row['Tipo']);
  let taskType: string = 'ligacao';
  if (rawType.includes('whatsapp')) {
    taskType = 'whatsapp';
  } else if (rawType.includes('visita feira')) {
    taskType = 'visita_feira';
  } else if (rawType.includes('visita evento')) {
    taskType = 'visita_evento';
  } else if (rawType.includes('visita') || rawType.includes('presencial')) {
    taskType = 'visita_presencial';
  } else if (rawType.includes('reuniao') || rawType.includes('reunião')) {
    taskType = 'reuniao_online';
  } else if (rawType.includes('linkedin')) {
    taskType = 'linkedin';
  } else if (rawType.includes('email') || rawType.includes('e-mail')) {
    taskType = 'email';
  } else if (rawType) {
    // Qualquer outro valor vira ligação por padrão
    taskType = 'ligacao';
  }

  // Mapeia prioridade em PT-BR para o enum (low/medium/high)
  const rawPriority = normalize(row['Prioridade']);
  let priority: 'low' | 'medium' | 'high' = 'medium';
  if (rawPriority === 'alta' || rawPriority === 'alto' || rawPriority === 'high') {
    priority = 'high';
  } else if (rawPriority === 'baixa' || rawPriority === 'baixo' || rawPriority === 'low') {
    priority = 'low';
  } else if (rawPriority === 'media' || rawPriority === 'média' || rawPriority === 'medium') {
    priority = 'medium';
  }

  const { error } = await supabase.from('tasks').insert({
    title: row['Título'],
    description: row['Descrição'],
    client_id: clientId,
    task_type: taskType,
    due_date: rawDueDate || null,
    priority,
    assigned_to: sellerId,
    created_by: userId
  });

  return error ? { success: false, error: error.message } : { success: true };
}

async function importRadarLead(supabase: any, row: any, userId: string, sellerMap: Map<string, string>) {
  const cnpj = String(row['CNPJ'] || '').replace(/\D/g, '');
  
  // Validações obrigatórias
  if (!cnpj || !row['Razão Social']) {
    return { success: false, error: 'CNPJ ou Razão Social faltando' };
  }

  // Validação de CNPJ
  if (!validateCNPJ(cnpj)) {
    return { success: false, error: `CNPJ inválido: ${cnpj}` };
  }

  // Validação de email (se fornecido)
  if (row['Email'] && !validateEmail(row['Email'])) {
    return { success: false, error: `Email inválido: ${row['Email']}` };
  }

  // Check duplicate by CNPJ
  const { data: existing } = await supabase
    .from('radar_leads')
    .select('id')
    .eq('cnpj', cnpj)
    .single();

  if (existing) {
    return { duplicate: true };
  }

  const sellerId = row['Vendedor'] ? sellerMap.get(String(row['Vendedor']).toLowerCase()) : null;

  // Parse contract value
  let contractValue = null;
  if (row['Valor Contrato']) {
    const parsedValue = parseFloat(String(row['Valor Contrato']).replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(parsedValue)) {
      contractValue = parsedValue;
    }
  }

  // Parse contract date
  let contractDate = null;
  if (row['Data Contrato']) {
    contractDate = convertDateToISO(row['Data Contrato']);
  }

  const { error } = await supabase.from('radar_leads').insert({
    cnpj,
    company_name: row['Razão Social'],
    trade_name: row['Nome Fantasia'] || null,
    source: row['Fonte'],
    email: row['Email'] || null,
    phone: row['Telefone'] || null,
    city: row['Cidade'] || null,
    state: row['Estado'] || null,
    segment: row['Segmento'] || null,
    contract_value: contractValue,
    contract_date: contractDate,
    notes: row['Notas'] || null,
    assigned_to: sellerId,
    status: 'novo'
  });

  return error ? { success: false, error: error.message } : { success: true };
}
