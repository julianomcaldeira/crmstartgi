-- Create table to store opportunity/proposal history
CREATE TABLE public.opportunity_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL,
  change_type text NOT NULL,
  changed_at timestamp with time zone DEFAULT now(),
  old_data jsonb,
  new_data jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.opportunity_history ENABLE ROW LEVEL SECURITY;

-- Policy to allow system to insert history records
CREATE POLICY "System can insert opportunity history"
ON public.opportunity_history
FOR INSERT
WITH CHECK (true);

-- Policy to allow users to view history of opportunities they have access to
CREATE POLICY "Users can view opportunity history"
ON public.opportunity_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE opportunities.id = opportunity_history.opportunity_id
  )
);

-- Create trigger function to log opportunity changes
CREATE OR REPLACE FUNCTION public.log_opportunity_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Only log if there are actual changes to important fields
    IF (OLD.title IS DISTINCT FROM NEW.title OR
        OLD.description IS DISTINCT FROM NEW.description OR
        OLD.value IS DISTINCT FROM NEW.value OR
        OLD.monthly_value IS DISTINCT FROM NEW.monthly_value OR
        OLD.implementation_value IS DISTINCT FROM NEW.implementation_value OR
        OLD.status IS DISTINCT FROM NEW.status OR
        OLD.probability IS DISTINCT FROM NEW.probability OR
        OLD.expected_close_date IS DISTINCT FROM NEW.expected_close_date OR
        OLD.assigned_to IS DISTINCT FROM NEW.assigned_to OR
        OLD.product_id IS DISTINCT FROM NEW.product_id OR
        OLD.business_type IS DISTINCT FROM NEW.business_type OR
        OLD.loss_reason_id IS DISTINCT FROM NEW.loss_reason_id) THEN
      
      INSERT INTO public.opportunity_history (
        opportunity_id,
        changed_by,
        change_type,
        old_data,
        new_data
      ) VALUES (
        NEW.id,
        COALESCE(auth.uid(), NEW.created_by),
        'UPDATE',
        jsonb_build_object(
          'title', OLD.title,
          'description', OLD.description,
          'value', OLD.value,
          'monthly_value', OLD.monthly_value,
          'implementation_value', OLD.implementation_value,
          'status', OLD.status,
          'probability', OLD.probability,
          'expected_close_date', OLD.expected_close_date,
          'assigned_to', OLD.assigned_to,
          'product_id', OLD.product_id,
          'business_type', OLD.business_type,
          'loss_reason_id', OLD.loss_reason_id
        ),
        jsonb_build_object(
          'title', NEW.title,
          'description', NEW.description,
          'value', NEW.value,
          'monthly_value', NEW.monthly_value,
          'implementation_value', NEW.implementation_value,
          'status', NEW.status,
          'probability', NEW.probability,
          'expected_close_date', NEW.expected_close_date,
          'assigned_to', NEW.assigned_to,
          'product_id', NEW.product_id,
          'business_type', NEW.business_type,
          'loss_reason_id', NEW.loss_reason_id
        )
      );
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Create trigger on opportunities table
CREATE TRIGGER log_opportunity_changes_trigger
AFTER UPDATE ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.log_opportunity_changes();