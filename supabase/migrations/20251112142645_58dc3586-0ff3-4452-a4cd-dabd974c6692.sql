-- Create table for managing fairs/events
CREATE TABLE public.feiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  city TEXT,
  state TEXT,
  start_date DATE,
  end_date DATE,
  description TEXT,
  website TEXT,
  status TEXT DEFAULT 'planejada' CHECK (status IN ('planejada', 'confirmada', 'em_andamento', 'concluida', 'cancelada')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feiras ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Everyone can view fairs"
  ON public.feiras
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create fairs"
  ON public.feiras
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins and gestores can update fairs"
  ON public.feiras
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins and gestores can delete fairs"
  ON public.feiras
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_feiras_updated_at
  BEFORE UPDATE ON public.feiras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();