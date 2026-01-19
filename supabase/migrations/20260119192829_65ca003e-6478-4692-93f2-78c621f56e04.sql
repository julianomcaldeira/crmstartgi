-- Create table for market intelligence searches history
CREATE TABLE public.market_intelligence_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  search_terms TEXT[] NOT NULL,
  total_value_12m NUMERIC,
  total_value_24m NUMERIC,
  total_quantity_12m INTEGER,
  total_quantity_24m INTEGER,
  competitors JSONB,
  sample_contracts JSONB,
  ai_analysis TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.market_intelligence_searches ENABLE ROW LEVEL SECURITY;

-- Users can view their own searches
CREATE POLICY "Users can view their own market intelligence searches"
ON public.market_intelligence_searches
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own searches
CREATE POLICY "Users can create their own market intelligence searches"
ON public.market_intelligence_searches
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own searches
CREATE POLICY "Users can delete their own market intelligence searches"
ON public.market_intelligence_searches
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX idx_market_intelligence_user_id ON public.market_intelligence_searches(user_id);
CREATE INDEX idx_market_intelligence_created_at ON public.market_intelligence_searches(created_at DESC);