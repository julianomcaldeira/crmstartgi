import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // Contains user_id

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    console.log('Zoho OAuth callback received', { code: code.substring(0, 10), state });

    const ZOHO_CLIENT_ID = Deno.env.get('ZOHO_CLIENT_ID');
    const ZOHO_CLIENT_SECRET = Deno.env.get('ZOHO_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET) {
      throw new Error('Zoho credentials not configured');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        redirect_uri: `${SUPABASE_URL}/functions/v1/zoho-auth-callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Zoho token exchange failed:', errorText);
      throw new Error('Failed to exchange code for tokens');
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful');

    // Get user's email from Zoho
    const userInfoResponse = await fetch('https://mail.zoho.com/api/accounts', {
      headers: {
        'Authorization': `Zoho-oauthtoken ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch Zoho account info');
    }

    const userInfo = await userInfoResponse.json();
    const zohoEmail = userInfo.data?.[0]?.emailAddress || 'unknown@zoho.com';

    // Store tokens in database
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    const { error: dbError } = await supabase
      .from('zoho_oauth_tokens')
      .upsert({
        user_id: state,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        zoho_account_email: zohoEmail,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    console.log('Tokens stored successfully');

    // Redirect back to app
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovable.app')}/configuracoes?zoho=success`,
      },
    });

  } catch (error: any) {
    console.error('Zoho auth callback error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});