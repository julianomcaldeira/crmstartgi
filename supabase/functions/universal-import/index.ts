import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function convertDateToISO(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (day && month && year && !isNaN(Number(day)) && !isNaN(Number(month)) && !isNaN(Number(year))) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
  return null;
}

type ChunkPayload = {
  rows: any[];
  userId: string;
  sessionId: string;
  importType: string;
  totalRows?: number;
  fileName?: string;
  fileSize?: number;
  historyId?: string;
  rowOffset?: number; // 0-based index offset for correct "Linha X" messages
  isLastChunk?: boolean;
};

type ChunkProcessResult = {
  processed: number;
  success: number;
  errors: number;
  duplicates: number;
  errorMessages: string[];
};

function safeParseErrorMessages(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [value];
    } catch {
      return [value];
    }
  }
  return [String(value)];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let sessionIdForFailUpdate: string | undefined;

  try {
    const contentType = req.headers.get('content-type') ?? '';

    // NEW: JSON payload (preferred) — the browser parses XLSX/CSV and sends rows in chunks
    let payload: ChunkPayload;
    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else {
      // Backward compat (older clients): reject to avoid memory issues on the server
      throw new Error('Formato de requisição inválido. Atualize a tela de importação e tente novamente.');
    }

    const {
      rows,
      userId,
      sessionId,
      importType,
      totalRows,
      fileName,
      fileSize,
      historyId: incomingHistoryId,
      rowOffset = 0,
      isLastChunk = false,
    } = payload;

    sessionIdForFailUpdate = sessionId;

    if (!Array.isArray(rows) || !userId || !sessionId || !importType) {
      throw new Error('Parâmetros obrigatórios faltando');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Ensure progress row exists (chunk-friendly)
    const { data: existingProgress } = await supabase
      .from('import_progress')
      .select('processed_rows, success_count, error_count, duplicate_count, error_message, total_rows')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (!existingProgress) {
      await supabase.from('import_progress').insert({
        session_id: sessionId,
        user_id: userId,
        total_rows: totalRows ?? rows.length,
        processed_rows: 0,
        success_count: 0,
        error_count: 0,
        duplicate_count: 0,
        status: 'processing',
      });
    } else if (typeof totalRows === 'number' && totalRows > 0 && existingProgress.total_rows !== totalRows) {
      await supabase.from('import_progress').update({
        total_rows: totalRows,
        updated_at: new Date().toISOString(),
      }).eq('session_id', sessionId);
    }

    // Ensure history row exists (we pass historyId in subsequent chunks)
    let historyId = incomingHistoryId;
    if (!historyId) {
      const { data: historyRecord, error: historyError } = await supabase
        .from('import_history')
        .insert({
          user_id: userId,
          import_type: importType,
          file_name: fileName ?? 'importacao',
          file_size: fileSize ?? null,
          total_rows: totalRows ?? rows.length,
          status: 'processing',
        })
        .select('id')
        .single();

      if (historyError) throw historyError;
      historyId = historyRecord?.id;
    }

    const result = await processImportChunk(supabase, rows, userId, importType, rowOffset);

    // Update progress cumulatively
    const { data: progressNow } = await supabase
      .from('import_progress')
      .select('processed_rows, success_count, error_count, duplicate_count, error_message, total_rows')
      .eq('session_id', sessionId)
      .maybeSingle();

    const previousErrors = safeParseErrorMessages(progressNow?.error_message);
    const mergedErrors = [...previousErrors, ...result.errorMessages].slice(0, 50);

    const newProcessed = (progressNow?.processed_rows ?? 0) + result.processed;
    const newSuccess = (progressNow?.success_count ?? 0) + result.success;
    const newErrors = (progressNow?.error_count ?? 0) + result.errors;
    const newDuplicates = (progressNow?.duplicate_count ?? 0) + result.duplicates;

    await supabase.from('import_progress').update({
      processed_rows: newProcessed,
      success_count: newSuccess,
      error_count: newErrors,
      duplicate_count: newDuplicates,
      status: isLastChunk ? 'completed' : 'processing',
      error_message: mergedErrors.length ? JSON.stringify(mergedErrors) : null,
      updated_at: new Date().toISOString(),
    }).eq('session_id', sessionId);

    // Update history (counts on every chunk; completed_at only on last)
    if (historyId) {
      await supabase.from('import_history').update({
        success_count: newSuccess,
        error_count: newErrors,
        duplicate_count: newDuplicates,
        error_details: mergedErrors.length
          ? mergedErrors.slice(0, 20).map((e) => ({ erro: e }))
          : null,
        status: isLastChunk ? 'completed' : 'processing',
        completed_at: isLastChunk ? new Date().toISOString() : null,
      }).eq('id', historyId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        historyId,
        chunk: {
          processed: result.processed,
          success: result.success,
          errors: result.errors,
          duplicates: result.duplicates,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in universal-import:', error);

    // Best-effort: mark progress as failed
    try {
      if (sessionIdForFailUpdate) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await supabase.from('import_progress').update({
          status: 'failed',
          error_message: error?.message ? JSON.stringify([String(error.message)]) : JSON.stringify(['Erro desconhecido']),
          updated_at: new Date().toISOString(),
        }).eq('session_id', sessionIdForFailUpdate);
      }
    } catch (e) {
      console.error('Failed to update import_progress to failed:', e);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function processImportChunk(
  supabase: any,
  rows: any[],
  userId: string,
  importType: string,
  rowOffset: number
): Promise<ChunkProcessResult> {
  let success = 0;
  let errors = 0;
  let duplicates = 0;
  const errorMessages: string[] = [];

  // Fetch sellers for mapping (once per chunk)
  const { data: sellers } = await supabase.from('profiles').select('id, full_name');
  const sellerMap: Map<string, string> = new Map(
    sellers?.map((s: any) => [String(s.full_name || '').toLowerCase(), s.id]) || []
  );

  // Optimize Radar Leads (batch duplicate check)
  if (importType === 'radar_leads') {
    const normalize = (v: any) => String(v || '').toLowerCase().trim();

    const prepared: { line: number; cnpj: string; payload: any }[] = [];
    const cnpjs: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const line = rowOffset + i + 2;
      const cnpj = String(row['CNPJ'] || '').replace(/\D/g, '');

      if (!cnpj || !row['Razão Social']) {
        errors++;
        if (errorMessages.length < 50) errorMessages.push(`Linha ${line}: CNPJ ou Razão Social faltando`);
        continue;
      }

      if (!validateCNPJ(cnpj)) {
        errors++;
        if (errorMessages.length < 50) errorMessages.push(`Linha ${line}: CNPJ inválido: ${cnpj}`);
        continue;
      }

      if (row['Email'] && !validateEmail(row['Email'])) {
        errors++;
        if (errorMessages.length < 50) errorMessages.push(`Linha ${line}: Email inválido: ${row['Email']}`);
        continue;
      }

      const sellerId = row['Vendedor'] ? sellerMap.get(normalize(row['Vendedor'])) : null;

      let contractValue = null;
      if (row['Valor Contrato']) {
        const parsedValue = parseFloat(String(row['Valor Contrato']).replace(/[^\d.,]/g, '').replace(',', '.'));
        if (!isNaN(parsedValue)) contractValue = parsedValue;
      }

      const contractDate = row['Data Contrato'] ? convertDateToISO(row['Data Contrato']) : null;

      prepared.push({
        line,
        cnpj,
        payload: {
          cnpj,
          company_name: row['Razão Social'],
          trade_name: row['Nome Fantasia'] || null,
          source: row['Fonte'] || 'Importação',
          email: row['Email'] || null,
          phone: row['Telefone'] || null,
          city: row['Cidade'] || null,
          state: row['Estado'] || null,
          segment: row['Segmento'] || null,
          contract_value: contractValue,
          contract_date: contractDate,
          notes: row['Notas'] || null,
          assigned_to: sellerId,
          status: 'novo',
        },
      });
      cnpjs.push(cnpj);
    }

    // Dedupe inside chunk
    const seen = new Set<string>();
    const uniquePrepared: typeof prepared = [];
    for (const item of prepared) {
      if (seen.has(item.cnpj)) {
        duplicates++;
      } else {
        seen.add(item.cnpj);
        uniquePrepared.push(item);
      }
    }

    // Batch check duplicates in DB
    const uniqueCnpjs = [...new Set(uniquePrepared.map((p) => p.cnpj))];
    const { data: existing } = uniqueCnpjs.length
      ? await supabase.from('radar_leads').select('cnpj').in('cnpj', uniqueCnpjs)
      : { data: [] };

    const existingSet = new Set((existing || []).map((r: any) => String(r.cnpj)));
    const toInsert = uniquePrepared.filter((p) => !existingSet.has(p.cnpj));
    duplicates += uniquePrepared.length - toInsert.length;

    // Try bulk insert; fallback to per-row on error
    if (toInsert.length) {
      const { error: bulkError } = await supabase.from('radar_leads').insert(toInsert.map((x) => x.payload));
      if (!bulkError) {
        success += toInsert.length;
      } else {
        console.warn('Bulk insert radar_leads failed, falling back to per-row:', bulkError.message);
        for (const item of toInsert) {
          const { error } = await supabase.from('radar_leads').insert(item.payload);
          if (error) {
            errors++;
            if (errorMessages.length < 50) errorMessages.push(`Linha ${item.line}: ${error.message}`);
          } else {
            success++;
          }
        }
      }
    }

    return {
      processed: rows.length,
      success,
      errors,
      duplicates,
      errorMessages,
    };
  }

  // Default: row-by-row (kept for other types)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const line = rowOffset + i + 2;

    try {
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
        duplicates++;
      } else if (result.success) {
        success++;
      } else {
        errors++;
        if (errorMessages.length < 50) errorMessages.push(`Linha ${line}: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (e: any) {
      errors++;
      if (errorMessages.length < 50) errorMessages.push(`Linha ${line}: ${e.message || String(e)}`);
    }
  }

  return {
    processed: rows.length,
    success,
    errors,
    duplicates,
    errorMessages,
  };
}


async function importProspect(supabase: any, row: any, userId: string, sellerMap: Map<string, string>) {
  const cnpj = String(row['CNPJ'] || '').replace(/\D/g, '');
  
  if (!cnpj || !row['Razão Social']) {
    return { success: false, error: 'CNPJ ou Razão Social faltando' };
  }

  if (!validateCNPJ(cnpj)) {
    return { success: false, error: `CNPJ inválido: ${cnpj}` };
  }

  if (row['Email'] && !validateEmail(row['Email'])) {
    return { success: false, error: `Email inválido: ${row['Email']}` };
  }

  if (row['Data Abertura'] && !validateDate(row['Data Abertura'])) {
    return { success: false, error: `Data de Abertura inválida: ${row['Data Abertura']}` };
  }

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
  if (!row['Título'] || !row['Conteúdo']) {
    return { success: false, error: 'Título ou Conteúdo faltando' };
  }

  if (row['Título'].trim().length === 0) {
    return { success: false, error: 'Título não pode ser vazio' };
  }

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
  if (!validateCNPJ(cnpj)) {
    return { success: false, error: `CNPJ Cliente inválido: ${row['CNPJ Cliente']}` };
  }

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
  if (!row['CNPJ Cliente'] || !row['Produto']) {
    return { success: false, error: 'CNPJ Cliente ou Produto faltando' };
  }

  const cnpj = String(row['CNPJ Cliente']).replace(/\D/g, '');
  if (!validateCNPJ(cnpj)) {
    return { success: false, error: `CNPJ Cliente inválido: ${row['CNPJ Cliente']}` };
  }

  if (row['Probabilidade']) {
    const validProbs = [10, 25, 50, 80, 90];
    const prob = parseInt(row['Probabilidade']);
    if (!validProbs.includes(prob)) {
      return { success: false, error: `Probabilidade inválida: ${row['Probabilidade']}. Use: 10, 25, 50, 80 ou 90` };
    }
  }

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
  const normalize = (value: any) =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  if (!row['Título']) {
    return { success: false, error: 'Título da tarefa faltando' };
  }

  const rawDueDate = row['Data Vencimento'] || row['Data do Vencimento'] || null;

  if (rawDueDate && !validateDate(rawDueDate)) {
    return { success: false, error: `Data de Vencimento inválida: ${rawDueDate}` };
  }

  let clientId = null;
  if (row['CNPJ Cliente']) {
    const cnpj = String(row['CNPJ Cliente']).replace(/\D/g, '');
    
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
  }

  const rawPriority = normalize(row['Prioridade']);
  let priority: 'low' | 'medium' | 'high' = 'medium';
  if (rawPriority === 'alta' || rawPriority === 'alto' || rawPriority === 'high') {
    priority = 'high';
  } else if (rawPriority === 'baixa' || rawPriority === 'baixo' || rawPriority === 'low') {
    priority = 'low';
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
  
  if (!cnpj || !row['Razão Social']) {
    return { success: false, error: 'CNPJ ou Razão Social faltando' };
  }

  if (!validateCNPJ(cnpj)) {
    return { success: false, error: `CNPJ inválido: ${cnpj}` };
  }

  if (row['Email'] && !validateEmail(row['Email'])) {
    return { success: false, error: `Email inválido: ${row['Email']}` };
  }

  const { data: existing } = await supabase
    .from('radar_leads')
    .select('id')
    .eq('cnpj', cnpj)
    .single();

  if (existing) {
    return { duplicate: true };
  }

  const sellerId = row['Vendedor'] ? sellerMap.get(String(row['Vendedor']).toLowerCase()) : null;

  let contractValue = null;
  if (row['Valor Contrato']) {
    const parsedValue = parseFloat(String(row['Valor Contrato']).replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(parsedValue)) {
      contractValue = parsedValue;
    }
  }

  let contractDate = null;
  if (row['Data Contrato']) {
    contractDate = convertDateToISO(row['Data Contrato']);
  }

  const { error } = await supabase.from('radar_leads').insert({
    cnpj,
    company_name: row['Razão Social'],
    trade_name: row['Nome Fantasia'] || null,
    source: row['Fonte'] || 'Importação',
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
