-- Create knowledge_base table
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('article', 'video', 'link')),
  url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Everyone can view knowledge base items
CREATE POLICY "Everyone can view knowledge base"
  ON public.knowledge_base
  FOR SELECT
  USING (true);

-- Admin and gestor can create items
CREATE POLICY "Admin and gestor can create knowledge items"
  ON public.knowledge_base
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor'::app_role)
  );

-- Admin and gestor can update items
CREATE POLICY "Admin and gestor can update knowledge items"
  ON public.knowledge_base
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor'::app_role)
  );

-- Admin and gestor can delete items
CREATE POLICY "Admin and gestor can delete knowledge items"
  ON public.knowledge_base
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor'::app_role)
  );

-- Create trigger for updated_at
CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON public.knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();