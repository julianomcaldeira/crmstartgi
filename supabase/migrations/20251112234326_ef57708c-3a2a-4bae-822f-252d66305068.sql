-- Add updated_by column to knowledge_base
ALTER TABLE public.knowledge_base 
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Create knowledge_base_history table for tracking changes
CREATE TABLE IF NOT EXISTS public.knowledge_base_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_base(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated')),
  old_data JSONB,
  new_data JSONB
);

-- Enable RLS on history table
ALTER TABLE public.knowledge_base_history ENABLE ROW LEVEL SECURITY;

-- Everyone can view history
CREATE POLICY "Everyone can view knowledge base history"
  ON public.knowledge_base_history
  FOR SELECT
  USING (true);

-- System can insert history (via trigger)
CREATE POLICY "System can insert history"
  ON public.knowledge_base_history
  FOR INSERT
  WITH CHECK (true);

-- Update RLS policies for knowledge_base to allow everyone to update
DROP POLICY IF EXISTS "Admin and gestor can update knowledge items" ON public.knowledge_base;

CREATE POLICY "Everyone can update knowledge items"
  ON public.knowledge_base
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Create function to log knowledge base changes
CREATE OR REPLACE FUNCTION public.log_knowledge_base_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.knowledge_base_history (
      knowledge_base_id,
      title,
      content,
      category,
      type,
      url,
      changed_by,
      change_type,
      new_data
    ) VALUES (
      NEW.id,
      NEW.title,
      NEW.content,
      NEW.category,
      NEW.type,
      NEW.url,
      auth.uid(),
      'created',
      to_jsonb(NEW)
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update updated_by field
    NEW.updated_by = auth.uid();
    
    INSERT INTO public.knowledge_base_history (
      knowledge_base_id,
      title,
      content,
      category,
      type,
      url,
      changed_by,
      change_type,
      old_data,
      new_data
    ) VALUES (
      NEW.id,
      NEW.title,
      NEW.content,
      NEW.category,
      NEW.type,
      NEW.url,
      auth.uid(),
      'updated',
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create trigger for knowledge_base changes
DROP TRIGGER IF EXISTS knowledge_base_changes_trigger ON public.knowledge_base;

CREATE TRIGGER knowledge_base_changes_trigger
  BEFORE INSERT OR UPDATE ON public.knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.log_knowledge_base_changes();