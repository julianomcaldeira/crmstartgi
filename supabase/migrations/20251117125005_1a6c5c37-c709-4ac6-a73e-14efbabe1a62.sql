-- Add visited field to client_feiras table for tracking fair visits
ALTER TABLE public.client_feiras 
ADD COLUMN IF NOT EXISTS visited BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS visited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS visited_by UUID REFERENCES auth.users(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_client_feiras_feira_id ON public.client_feiras(feira_id);
CREATE INDEX IF NOT EXISTS idx_client_feiras_visited ON public.client_feiras(visited);