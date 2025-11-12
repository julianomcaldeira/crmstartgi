-- Create activity log table for opportunities
CREATE TABLE public.opportunity_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'status_change', 'edit', 'attachment_added', 'attachment_removed', 'created'
  description TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.opportunity_activities ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view activity logs of opportunities they have access to"
ON public.opportunity_activities
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE id = opportunity_activities.opportunity_id
  )
);

CREATE POLICY "System can insert activity logs"
ON public.opportunity_activities
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Create index for performance
CREATE INDEX idx_opportunity_activities_opportunity_id 
ON public.opportunity_activities(opportunity_id);

CREATE INDEX idx_opportunity_activities_created_at 
ON public.opportunity_activities(created_at DESC);