-- Fix the knowledge_base trigger to use NEW.created_by/NEW.updated_by instead of auth.uid()
-- This allows the trigger to work correctly in edge function contexts

CREATE OR REPLACE FUNCTION public.log_knowledge_base_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      NEW.created_by,  -- Use NEW.created_by instead of auth.uid()
      'created',
      to_jsonb(NEW)
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update updated_by field
    NEW.updated_by = COALESCE(NEW.updated_by, auth.uid(), NEW.created_by);
    
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
      COALESCE(NEW.updated_by, auth.uid(), NEW.created_by),  -- Use NEW.updated_by with fallbacks
      'updated',
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;