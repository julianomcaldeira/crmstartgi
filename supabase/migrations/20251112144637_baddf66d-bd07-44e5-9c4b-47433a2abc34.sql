-- Add table to link clients to fairs they attended
CREATE TABLE IF NOT EXISTS public.client_feiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  feira_id UUID NOT NULL REFERENCES public.feiras(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  UNIQUE(client_id, feira_id)
);

-- Enable RLS
ALTER TABLE public.client_feiras ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all client-feira links"
ON public.client_feiras
FOR SELECT
USING (true);

CREATE POLICY "Users can create client-feira links"
ON public.client_feiras
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins and gestores can update client-feira links"
ON public.client_feiras
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins and gestores can delete client-feira links"
ON public.client_feiras
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Create index for better query performance
CREATE INDEX idx_client_feiras_client_id ON public.client_feiras(client_id);
CREATE INDEX idx_client_feiras_feira_id ON public.client_feiras(feira_id);