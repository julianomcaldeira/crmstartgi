import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeiraData {
  name: string;
  start_date: string;
  end_date: string;
  segmento: string;
  location: string;
  status: string;
  created_by: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const _authHeader = req.headers.get('Authorization');
    if (!_authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const _authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: _authHeader } } });
    const { data: { user }, error: _authError } = await _authClient.auth.getUser();
    if (_authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Starting feiras import...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the admin user
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'juliano@startgi.com.br')
      .single();

    if (userError || !userData) {
      console.error('Error finding admin user:', userError);
      throw new Error('Admin user not found');
    }

    const adminUserId = userData.id;
    console.log('Admin user found:', adminUserId);

    // Feiras data
    const feiras: Omit<FeiraData, 'created_by'>[] = [
      { name: "Bio Brazil Fair", start_date: "2024-06-05", end_date: "2024-06-08", segmento: "Orgânicos e Sustentabilidade", location: "São Paulo – SP", status: "concluida" },
      { name: "Bio Brazil Fair", start_date: "2023-06-14", end_date: "2023-06-17", segmento: "Orgânicos e Sustentabilidade", location: "São Paulo – SP", status: "concluida" },
      { name: "Bio Brazil Fair", start_date: "2022-06-22", end_date: "2022-06-25", segmento: "Orgânicos e Sustentabilidade", location: "São Paulo – SP", status: "concluida" },
      { name: "Fispal Tecnologia", start_date: "2024-06-25", end_date: "2024-06-28", segmento: "Equipamentos para Indústria Alimentícia", location: "São Paulo – SP", status: "concluida" },
      { name: "Fispal Tecnologia", start_date: "2023-06-27", end_date: "2023-06-30", segmento: "Equipamentos para Indústria Alimentícia", location: "São Paulo – SP", status: "concluida" },
      { name: "Fispal Tecnologia", start_date: "2022-06-28", end_date: "2022-07-01", segmento: "Equipamentos para Indústria Alimentícia", location: "São Paulo – SP", status: "concluida" },
      { name: "NRF", start_date: "2024-01-14", end_date: "2024-01-16", segmento: "Varejo", location: "Nova York – Estados Unidos", status: "concluida" },
      { name: "NRF", start_date: "2023-01-15", end_date: "2023-01-17", segmento: "Varejo", location: "Nova York – Estados Unidos", status: "concluida" },
      { name: "Automec", start_date: "2024-04-23", end_date: "2024-04-27", segmento: "Automobilística", location: "São Paulo – SP", status: "concluida" },
      { name: "Automec", start_date: "2022-04-26", end_date: "2022-04-30", segmento: "Automobilística", location: "São Paulo – SP", status: "concluida" },
      { name: "HostMilano", start_date: "2023-10-13", end_date: "2023-10-17", segmento: "Hotelaria, Gastronomia e Food Service", location: "Milão – Itália", status: "concluida" },
      { name: "HostMilano", start_date: "2021-10-22", end_date: "2021-10-26", segmento: "Hotelaria, Gastronomia e Food Service", location: "Milão – Itália", status: "concluida" },
      { name: "Equipotel", start_date: "2024-09-16", end_date: "2024-09-19", segmento: "Hotelaria, Gastronomia e Hospitalidade", location: "São Paulo – SP", status: "concluida" },
      { name: "Equipotel", start_date: "2023-09-25", end_date: "2023-09-28", segmento: "Hotelaria, Gastronomia e Hospitalidade", location: "São Paulo – SP", status: "concluida" },
      { name: "Equipotel", start_date: "2022-04-05", end_date: "2022-04-08", segmento: "Hotelaria, Gastronomia e Hospitalidade", location: "São Paulo – SP", status: "concluida" },
      { name: "Anufood Brazil", start_date: "2024-03-19", end_date: "2024-03-21", segmento: "Alimentos e Bebidas", location: "São Paulo – SP", status: "concluida" },
      { name: "Anufood Brazil", start_date: "2023-03-28", end_date: "2023-03-30", segmento: "Alimentos e Bebidas", location: "São Paulo – SP", status: "concluida" },
      { name: "Anufood Brazil", start_date: "2022-03-29", end_date: "2022-03-31", segmento: "Alimentos e Bebidas", location: "São Paulo – SP", status: "concluida" },
      { name: "Expofood", start_date: "2024-03-19", end_date: "2024-03-21", segmento: "Alimentos e Bebidas", location: "São Paulo – SP", status: "concluida" },
      { name: "Expofood", start_date: "2023-03-28", end_date: "2023-03-30", segmento: "Alimentos e Bebidas", location: "São Paulo – SP", status: "concluida" },
      { name: "Expofood", start_date: "2022-03-29", end_date: "2022-03-31", segmento: "Alimentos e Bebidas", location: "São Paulo – SP", status: "concluida" },
      { name: "APAS Show", start_date: "2024-05-13", end_date: "2024-05-16", segmento: "Supermercados e Varejo Alimentar", location: "São Paulo – SP", status: "concluida" },
      { name: "APAS Show", start_date: "2023-05-08", end_date: "2023-05-11", segmento: "Supermercados e Varejo Alimentar", location: "São Paulo – SP", status: "concluida" },
      { name: "APAS Show", start_date: "2022-05-09", end_date: "2022-05-12", segmento: "Supermercados e Varejo Alimentar", location: "São Paulo – SP", status: "concluida" },
      { name: "Natural Tech", start_date: "2024-06-05", end_date: "2024-06-08", segmento: "Tecnologia para Produtos Naturais", location: "São Paulo – SP", status: "concluida" },
      { name: "Natural Tech", start_date: "2023-06-14", end_date: "2023-06-17", segmento: "Tecnologia para Produtos Naturais", location: "São Paulo – SP", status: "concluida" },
      { name: "Natural Tech", start_date: "2022-06-22", end_date: "2022-06-25", segmento: "Tecnologia para Produtos Naturais", location: "São Paulo – SP", status: "concluida" },
      { name: "SuperVarejo", start_date: "2024-08-27", end_date: "2024-08-29", segmento: "Supermercados e Varejo", location: "São Paulo – SP", status: "concluida" },
      { name: "SuperVarejo", start_date: "2023-08-22", end_date: "2023-08-24", segmento: "Supermercados e Varejo", location: "São Paulo – SP", status: "concluida" },
      { name: "SuperVarejo", start_date: "2022-08-23", end_date: "2022-08-25", segmento: "Supermercados e Varejo", location: "São Paulo – SP", status: "concluida" },
      { name: "Mercosuper", start_date: "2024-04-24", end_date: "2024-04-26", segmento: "Supermercados – Regional Sul", location: "Porto Alegre – RS", status: "concluida" },
      { name: "Mercosuper", start_date: "2023-04-26", end_date: "2023-04-28", segmento: "Supermercados – Regional Sul", location: "Porto Alegre – RS", status: "concluida" },
      { name: "Mercosuper", start_date: "2022-04-06", end_date: "2022-04-08", segmento: "Supermercados – Regional Sul", location: "Porto Alegre – RS", status: "concluida" },
      { name: "Wine South America", start_date: "2024-08-28", end_date: "2024-08-30", segmento: "Vitivinicultura", location: "Bento Gonçalves – RS", status: "concluida" },
      { name: "Wine South America", start_date: "2023-09-06", end_date: "2023-09-08", segmento: "Vitivinicultura", location: "Bento Gonçalves – RS", status: "concluida" },
      { name: "Wine South America", start_date: "2022-09-07", end_date: "2022-09-09", segmento: "Vitivinicultura", location: "Bento Gonçalves – RS", status: "concluida" },
      { name: "Vinhopar", start_date: "2024-09-10", end_date: "2024-09-12", segmento: "Vinhos e Bebidas", location: "Curitiba – PR", status: "concluida" },
      { name: "Vinhopar", start_date: "2023-09-05", end_date: "2023-09-07", segmento: "Vinhos e Bebidas", location: "Curitiba – PR", status: "concluida" },
      { name: "Vinhopar", start_date: "2022-09-13", end_date: "2022-09-15", segmento: "Vinhos e Bebidas", location: "Curitiba – PR", status: "concluida" },
      { name: "Expocachaça", start_date: "2024-06-14", end_date: "2024-06-16", segmento: "Cachaça e Destilados", location: "Belo Horizonte – MG", status: "concluida" },
      { name: "Expocachaça", start_date: "2023-06-09", end_date: "2023-06-11", segmento: "Cachaça e Destilados", location: "Belo Horizonte – MG", status: "concluida" },
      { name: "Expocachaça", start_date: "2022-06-10", end_date: "2022-06-12", segmento: "Cachaça e Destilados", location: "Belo Horizonte – MG", status: "concluida" },
      { name: "Supernorte", start_date: "2024-09-18", end_date: "2024-09-20", segmento: "Supermercados – Regional Norte/Nordeste", location: "Recife – PE", status: "concluida" },
      { name: "Supernorte", start_date: "2023-09-13", end_date: "2023-09-15", segmento: "Supermercados – Regional Norte/Nordeste", location: "Recife – PE", status: "concluida" },
      { name: "Supernorte", start_date: "2022-09-14", end_date: "2022-09-16", segmento: "Supermercados – Regional Norte/Nordeste", location: "Recife – PE", status: "concluida" },
      { name: "FoodService Nordeste", start_date: "2024-07-23", end_date: "2024-07-25", segmento: "Alimentação Fora do Lar – Regional", location: "Recife – PE", status: "concluida" },
      { name: "FoodService Nordeste", start_date: "2023-08-01", end_date: "2023-08-03", segmento: "Alimentação Fora do Lar – Regional", location: "Recife – PE", status: "concluida" },
      { name: "FoodService Nordeste", start_date: "2022-08-02", end_date: "2022-08-04", segmento: "Alimentação Fora do Lar – Regional", location: "Recife – PE", status: "concluida" },
      { name: "Fenasucro & Agrocana", start_date: "2024-08-20", end_date: "2024-08-23", segmento: "Agroindústria Sucroenergética", location: "Sertãozinho – SP", status: "concluida" },
      { name: "Fenasucro & Agrocana", start_date: "2023-08-22", end_date: "2023-08-25", segmento: "Agroindústria Sucroenergética", location: "Sertãozinho – SP", status: "concluida" },
      { name: "Fenasucro & Agrocana", start_date: "2022-08-23", end_date: "2022-08-26", segmento: "Agroindústria Sucroenergética", location: "Sertãozinho – SP", status: "concluida" },
      { name: "Feipan", start_date: "2024-07-30", end_date: "2024-08-02", segmento: "Panificação, Confeitaria e Food Service", location: "São Paulo – SP", status: "concluida" },
      { name: "Feipan", start_date: "2023-08-08", end_date: "2023-08-11", segmento: "Panificação, Confeitaria e Food Service", location: "São Paulo – SP", status: "concluida" },
      { name: "Feipan", start_date: "2022-08-09", end_date: "2022-08-12", segmento: "Panificação, Confeitaria e Food Service", location: "São Paulo – SP", status: "concluida" },
      { name: "Alimentária FoodService", start_date: "2024-03-19", end_date: "2024-03-21", segmento: "Alimentação Fora do Lar", location: "São Paulo – SP", status: "concluida" },
      { name: "Alimentária FoodService", start_date: "2023-03-28", end_date: "2023-03-30", segmento: "Alimentação Fora do Lar", location: "São Paulo – SP", status: "concluida" },
      { name: "Alimentária FoodService", start_date: "2022-03-29", end_date: "2022-03-31", segmento: "Alimentação Fora do Lar", location: "São Paulo – SP", status: "concluida" },
      { name: "Fispal Food Service", start_date: "2024-06-25", end_date: "2024-06-28", segmento: "Alimentação Fora do Lar", location: "São Paulo – SP", status: "concluida" },
      { name: "Fispal Food Service", start_date: "2023-06-27", end_date: "2023-06-30", segmento: "Alimentação Fora do Lar", location: "São Paulo – SP", status: "concluida" },
      { name: "Fispal Food Service", start_date: "2022-06-28", end_date: "2022-07-01", segmento: "Alimentação Fora do Lar", location: "São Paulo – SP", status: "concluida" },
      { name: "Vitória Stone Fair", start_date: "2024-02-06", end_date: "2024-02-09", segmento: "Rochas Ornamentais", location: "Vitória – ES", status: "concluida" },
      { name: "Vitória Stone Fair", start_date: "2023-02-07", end_date: "2023-02-10", segmento: "Rochas Ornamentais", location: "Vitória – ES", status: "concluida" },
      { name: "Vitória Stone Fair", start_date: "2022-02-08", end_date: "2022-02-11", segmento: "Rochas Ornamentais", location: "Vitória – ES", status: "concluida" },
      { name: "Fipan Nordeste", start_date: "2024-10-15", end_date: "2024-10-17", segmento: "Panificação – Regional Nordeste", location: "Recife – PE", status: "concluida" },
      { name: "Fipan Nordeste", start_date: "2023-10-10", end_date: "2023-10-12", segmento: "Panificação – Regional Nordeste", location: "Recife – PE", status: "concluida" },
      { name: "Fipan Nordeste", start_date: "2022-10-11", end_date: "2022-10-13", segmento: "Panificação – Regional Nordeste", location: "Recife – PE", status: "concluida" }
    ];

    // Add created_by to all records
    const feirasToInsert: FeiraData[] = feiras.map(feira => ({
      ...feira,
      created_by: adminUserId
    }));

    console.log(`Inserting ${feirasToInsert.length} feiras...`);

    // Insert all feiras at once
    const { data, error } = await supabase
      .from('feiras')
      .insert(feirasToInsert)
      .select();

    if (error) {
      console.error('Error inserting feiras:', error);
      throw error;
    }

    console.log(`Successfully inserted ${data.length} feiras`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: data.length,
        message: `${data.length} feiras importadas com sucesso`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in import-feiras function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
