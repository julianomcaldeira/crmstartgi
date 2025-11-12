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
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Webhook data from Zoho when email is sent
    const webhookData = await req.json();
    console.log('Zoho webhook received:', JSON.stringify(webhookData, null, 2));

    // Extract email data
    const { userEmail, subject, to, body, sentTime } = webhookData;

    if (!userEmail || !subject) {
      throw new Error('Missing required webhook data');
    }

    // Find the user by their Zoho email
    const { data: tokenData, error: tokenError } = await supabase
      .from('zoho_oauth_tokens')
      .select('user_id')
      .eq('zoho_account_email', userEmail)
      .single();

    if (tokenError || !tokenData) {
      console.error('User not found for email:', userEmail);
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create task from email
    const taskTitle = `Email enviado: ${subject}`;
    const taskDescription = `Para: ${to}\n\n${body || ''}`;

    const { error: taskError } = await supabase
      .from('tasks')
      .insert({
        title: taskTitle,
        description: taskDescription,
        task_type: 'email',
        status: 'completed',
        assigned_to: tokenData.user_id,
        created_by: tokenData.user_id,
        due_date: new Date(sentTime || Date.now()).toISOString(),
        completed_at: new Date(sentTime || Date.now()).toISOString(),
        email_subject: subject,
        email_body: body,
        email_sent: true,
      });

    if (taskError) {
      console.error('Error creating task:', taskError);
      throw taskError;
    }

    console.log('Task created successfully from Zoho email');

    return new Response(
      JSON.stringify({ success: true, message: 'Task created' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Zoho webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});