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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ZOHO_CLIENT_ID = Deno.env.get('ZOHO_CLIENT_ID');
    const ZOHO_CLIENT_SECRET = Deno.env.get('ZOHO_CLIENT_SECRET');
    
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    console.log('Starting Zoho email sync...');

    // Get all users with Zoho tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('zoho_oauth_tokens')
      .select('*');

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      throw tokensError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('No Zoho tokens found, skipping sync');
      return new Response(JSON.stringify({ message: 'No users connected' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalEmailsSynced = 0;
    let totalErrors = 0;

    // Process each user
    for (const tokenData of tokens) {
      try {
        console.log(`Processing user ${tokenData.user_id}`);

        // Check if token is expired and refresh if needed
        let accessToken = tokenData.access_token;
        const expiresAt = new Date(tokenData.expires_at);
        
        if (expiresAt < new Date()) {
          console.log('Token expired, refreshing...');
          
          const refreshResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              refresh_token: tokenData.refresh_token,
              client_id: ZOHO_CLIENT_ID!,
              client_secret: ZOHO_CLIENT_SECRET!,
              grant_type: 'refresh_token',
            }),
          });

          if (!refreshResponse.ok) {
            console.error('Failed to refresh token for user', tokenData.user_id);
            totalErrors++;
            continue;
          }

          const refreshData = await refreshResponse.json();
          accessToken = refreshData.access_token;

          // Update token in database
          await supabase
            .from('zoho_oauth_tokens')
            .update({
              access_token: accessToken,
              expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', tokenData.user_id);

          console.log('Token refreshed successfully');
        }

        // Fetch sent emails from last 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).getTime();
        
        const emailsResponse = await fetch(
          `https://mail.zoho.com/api/accounts/messages?folderName=Sent&limit=50&fromDate=${twentyFourHoursAgo}`,
          {
            headers: {
              'Authorization': `Zoho-oauthtoken ${accessToken}`,
            },
          }
        );

        if (!emailsResponse.ok) {
          console.error('Failed to fetch emails for user', tokenData.user_id);
          totalErrors++;
          continue;
        }

        const emailsData = await emailsResponse.json();
        const emails = emailsData.data || [];

        console.log(`Found ${emails.length} emails for user ${tokenData.user_id}`);

        // Process each email
        for (const email of emails) {
          try {
            // Check if task already exists for this email
            const { data: existingTask } = await supabase
              .from('tasks')
              .select('id')
              .eq('created_by', tokenData.user_id)
              .eq('email_subject', email.subject)
              .eq('task_type', 'email')
              .gte('created_at', new Date(email.sentTime).toISOString())
              .maybeSingle();

            if (existingTask) {
              console.log('Task already exists for email:', email.subject);
              continue;
            }

            // Create task from email
            const taskTitle = `Email enviado: ${email.subject || '(sem assunto)'}`;
            const recipients = email.toAddress ? email.toAddress.join(', ') : '';
            const taskDescription = `Para: ${recipients}\n\nEmail enviado via Zoho Mail`;

            const { error: taskError } = await supabase
              .from('tasks')
              .insert({
                title: taskTitle,
                description: taskDescription,
                task_type: 'email',
                status: 'completed',
                assigned_to: tokenData.user_id,
                created_by: tokenData.user_id,
                due_date: new Date(email.sentTime).toISOString(),
                completed_at: new Date(email.sentTime).toISOString(),
                email_subject: email.subject || '(sem assunto)',
                email_body: email.summary || '',
                email_sent: true,
              });

            if (taskError) {
              console.error('Error creating task:', taskError);
              totalErrors++;
            } else {
              console.log('Task created for email:', email.subject);
              totalEmailsSynced++;
            }
          } catch (emailError) {
            console.error('Error processing email:', emailError);
            totalErrors++;
          }
        }
      } catch (userError) {
        console.error('Error processing user:', userError);
        totalErrors++;
      }
    }

    console.log(`Sync complete. Synced: ${totalEmailsSynced}, Errors: ${totalErrors}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailsSynced: totalEmailsSynced,
        errors: totalErrors,
        usersProcessed: tokens.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});