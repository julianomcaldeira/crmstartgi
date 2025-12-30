-- Create table for AI analysis history
CREATE TABLE public.prospect_ai_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  analysis TEXT NOT NULL,
  opportunities_count INTEGER DEFAULT 0,
  tasks_count INTEGER DEFAULT 0,
  contacts_count INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prospect_ai_analyses ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Users can view all AI analyses" 
ON public.prospect_ai_analyses 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can create AI analyses" 
ON public.prospect_ai_analyses 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own analyses" 
ON public.prospect_ai_analyses 
FOR DELETE 
TO authenticated
USING (auth.uid() = created_by);

-- Add index for faster queries
CREATE INDEX idx_prospect_ai_analyses_client_id ON public.prospect_ai_analyses(client_id);
CREATE INDEX idx_prospect_ai_analyses_created_at ON public.prospect_ai_analyses(created_at DESC);