import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching knowledge base items for export...');

    // Fetch all knowledge base items
    const { data: items, error } = await supabase
      .from('knowledge_base')
      .select('title, content, type, url, category, created_at, updated_at')
      .order('title', { ascending: true });

    if (error) {
      console.error('Error fetching knowledge items:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar itens', details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${items?.length || 0} items to export`);

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum item encontrado para exportar' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare data for Excel
    const excelData = items.map(item => ({
      'Título': item.title,
      'Conteúdo': item.content,
      'Tipo': item.type === 'article' ? 'Artigo' : item.type === 'video' ? 'Vídeo' : 'Link',
      'URL': item.url || '',
      'Categoria': item.category,
      'Criado em': new Date(item.created_at).toLocaleString('pt-BR'),
      'Atualizado em': new Date(item.updated_at).toLocaleString('pt-BR'),
    }));

    console.log('Creating Excel workbook...');

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Base de Conhecimento');

    // Set column widths for better readability
    worksheet['!cols'] = [
      { wch: 40 },  // Título
      { wch: 80 },  // Conteúdo
      { wch: 15 },  // Tipo
      { wch: 50 },  // URL
      { wch: 15 },  // Categoria
      { wch: 20 },  // Criado em
      { wch: 20 },  // Atualizado em
    ];

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    console.log('Excel file generated successfully');

    // Return the Excel file
    return new Response(excelBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="base-conhecimento-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });

  } catch (error) {
    console.error('Error in export-knowledge-base function:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
