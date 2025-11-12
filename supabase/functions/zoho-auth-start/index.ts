import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    const ZOHO_CLIENT_ID = Deno.env.get('ZOHO_CLIENT_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

    if (!ZOHO_CLIENT_ID) {
      throw new Error('Zoho credentials not configured');
    }

    const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/zoho-auth-callback`;
    const SCOPE = 'ZohoMail.messages.READ,ZohoMail.accounts.READ';

    const authUrl = `https://accounts.zoho.com/oauth/v2/auth?` +
      `scope=${encodeURIComponent(SCOPE)}` +
      `&client_id=${ZOHO_CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&state=${userId}` +
      `&access_type=offline` +
      `&prompt=consent`;

    console.log('Generated auth URL for user:', userId);

    return new Response(
      JSON.stringify({ authUrl }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Zoho auth start error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
