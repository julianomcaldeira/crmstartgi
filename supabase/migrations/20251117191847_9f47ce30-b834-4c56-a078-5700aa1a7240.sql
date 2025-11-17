-- Create alerts table to store intelligent notifications
CREATE TABLE IF NOT EXISTS public.opportunity_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES public.profiles(id),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('close_date_approaching', 'no_recent_activity', 'probability_drop', 'stagnant_stage')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.opportunity_alerts ENABLE ROW LEVEL SECURITY;

-- Users can view their own alerts
CREATE POLICY "Users can view own alerts"
  ON public.opportunity_alerts
  FOR SELECT
  USING (auth.uid() = assigned_to);

-- Users can update (mark as read/dismiss) their own alerts
CREATE POLICY "Users can update own alerts"
  ON public.opportunity_alerts
  FOR UPDATE
  USING (auth.uid() = assigned_to);

-- System can insert alerts
CREATE POLICY "System can insert alerts"
  ON public.opportunity_alerts
  FOR INSERT
  WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_opportunity_alerts_assigned_to ON public.opportunity_alerts(assigned_to);
CREATE INDEX idx_opportunity_alerts_opportunity_id ON public.opportunity_alerts(opportunity_id);
CREATE INDEX idx_opportunity_alerts_is_read ON public.opportunity_alerts(is_read);
CREATE INDEX idx_opportunity_alerts_created_at ON public.opportunity_alerts(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.opportunity_alerts;