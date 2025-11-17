import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting opportunity alerts check...');

    // Fetch active opportunities with activities
    const { data: opportunities, error: oppsError } = await supabase
      .from('opportunities')
      .select(`
        *,
        client:clients(company_name, trade_name),
        activities:opportunity_activities(created_at)
      `)
      .not('status', 'in', '("won","lost")');

    if (oppsError) throw oppsError;

    const now = new Date();
    const alerts: any[] = [];

    for (const opp of opportunities || []) {
      const oppId = opp.id;
      const assignedTo = opp.assigned_to;
      
      // Check 1: Close date approaching (within 7 days) with no recent activity
      if (opp.expected_close_date) {
        const closeDate = new Date(opp.expected_close_date);
        const daysUntilClose = Math.floor((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilClose >= 0 && daysUntilClose <= 7) {
          // Check for recent activity (last 3 days)
          const activities = opp.activities || [];
          const recentActivity = activities.some((act: any) => {
            const actDate = new Date(act.created_at);
            const daysSinceActivity = Math.floor((now.getTime() - actDate.getTime()) / (1000 * 60 * 60 * 24));
            return daysSinceActivity <= 3;
          });

          if (!recentActivity) {
            // Check if alert already exists
            const { data: existingAlert } = await supabase
              .from('opportunity_alerts')
              .select('id')
              .eq('opportunity_id', oppId)
              .eq('alert_type', 'close_date_approaching')
              .eq('is_read', false)
              .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .single();

            if (!existingAlert) {
              alerts.push({
                opportunity_id: oppId,
                assigned_to: assignedTo,
                alert_type: 'close_date_approaching',
                severity: daysUntilClose <= 3 ? 'critical' : 'high',
                title: `Fechamento próximo: ${opp.client?.trade_name || opp.client?.company_name}`,
                message: `Oportunidade fecha em ${daysUntilClose} dia${daysUntilClose !== 1 ? 's' : ''} sem atividade recente`,
                metadata: {
                  days_until_close: daysUntilClose,
                  opportunity_value: opp.value,
                  expected_close_date: opp.expected_close_date
                },
                expires_at: closeDate.toISOString()
              });
            }
          }
        }
      }

      // Check 2: No recent activity (stagnant for more than 14 days)
      const activities = opp.activities || [];
      if (activities.length > 0) {
        const lastActivity = activities.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        const daysSinceLastActivity = Math.floor((now.getTime() - new Date(lastActivity.created_at).getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastActivity >= 14) {
          const { data: existingAlert } = await supabase
            .from('opportunity_alerts')
            .select('id')
            .eq('opportunity_id', oppId)
            .eq('alert_type', 'no_recent_activity')
            .eq('is_read', false)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .single();

          if (!existingAlert) {
            alerts.push({
              opportunity_id: oppId,
              assigned_to: assignedTo,
              alert_type: 'no_recent_activity',
              severity: daysSinceLastActivity >= 30 ? 'high' : 'medium',
              title: `Oportunidade sem atividade: ${opp.client?.trade_name || opp.client?.company_name}`,
              message: `Nenhuma atividade há ${daysSinceLastActivity} dias`,
              metadata: {
                days_since_activity: daysSinceLastActivity,
                last_activity_date: lastActivity.created_at,
                opportunity_value: opp.value
              }
            });
          }
        }
      }

      // Check 3: Opportunity in same stage for too long
      const oppCreated = new Date(opp.updated_at || opp.created_at);
      const daysInCurrentStage = Math.floor((now.getTime() - oppCreated.getTime()) / (1000 * 60 * 60 * 24));
      
      const stageThresholds: Record<string, number> = {
        'lead': 7,
        'contacted': 14,
        'qualified': 14,
        'apresentacao': 21,
        'proposal': 21,
        'negotiation': 14
      };

      const threshold = stageThresholds[opp.status];
      if (threshold && daysInCurrentStage >= threshold) {
        const { data: existingAlert } = await supabase
          .from('opportunity_alerts')
          .select('id')
          .eq('opportunity_id', oppId)
          .eq('alert_type', 'stagnant_stage')
          .eq('is_read', false)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .single();

        if (!existingAlert) {
          alerts.push({
            opportunity_id: oppId,
            assigned_to: assignedTo,
            alert_type: 'stagnant_stage',
            severity: 'medium',
            title: `Oportunidade estagnada: ${opp.client?.trade_name || opp.client?.company_name}`,
            message: `Na fase "${opp.status}" há ${daysInCurrentStage} dias`,
            metadata: {
              days_in_stage: daysInCurrentStage,
              current_stage: opp.status,
              threshold_days: threshold
            }
          });
        }
      }
    }

    // Insert all alerts
    if (alerts.length > 0) {
      const { error: insertError } = await supabase
        .from('opportunity_alerts')
        .insert(alerts);

      if (insertError) {
        console.error('Error inserting alerts:', insertError);
        throw insertError;
      }

      console.log(`Created ${alerts.length} new alerts`);
    } else {
      console.log('No new alerts to create');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        alerts_created: alerts.length,
        message: `Successfully checked opportunities and created ${alerts.length} alerts`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in check-opportunity-alerts:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});