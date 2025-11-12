-- Create table for loss reasons
CREATE TABLE public.loss_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.loss_reasons ENABLE ROW LEVEL SECURITY;

-- Everyone can view loss reasons
CREATE POLICY "Everyone can view loss reasons"
ON public.loss_reasons
FOR SELECT
USING (true);

-- Only admins can manage loss reasons
CREATE POLICY "Admins can manage loss reasons"
ON public.loss_reasons
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add loss_reason_id to opportunities table
ALTER TABLE public.opportunities
ADD COLUMN loss_reason_id UUID REFERENCES public.loss_reasons(id);

-- Add index for better performance
CREATE INDEX idx_opportunities_loss_reason ON public.opportunities(loss_reason_id);