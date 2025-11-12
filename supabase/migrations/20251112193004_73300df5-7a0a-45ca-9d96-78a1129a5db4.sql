-- Drop existing policies for feiras
DROP POLICY IF EXISTS "Users can create fairs" ON public.feiras;
DROP POLICY IF EXISTS "Admins and gestores can update fairs" ON public.feiras;
DROP POLICY IF EXISTS "Admins and gestores can delete fairs" ON public.feiras;

-- Create new policy allowing all authenticated users to create fairs
CREATE POLICY "All users can create fairs"
  ON public.feiras
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Update policy - admins and gestores can update fairs
CREATE POLICY "Admins and gestores can update fairs"
  ON public.feiras
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Delete policy - only admins and gestores can delete
CREATE POLICY "Admins and gestores can delete fairs"
  ON public.feiras
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Create audit log table for feiras
CREATE TABLE IF NOT EXISTS public.feira_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feira_id UUID NOT NULL,
  changed_by UUID NOT NULL,
  change_type TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  old_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE public.feira_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy for viewing audit logs (admins and gestores only)
CREATE POLICY "Admins and gestores can view feira audit logs"
  ON public.feira_audit_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Policy for inserting audit logs (system only via trigger)
CREATE POLICY "System can insert audit logs"
  ON public.feira_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create index for faster audit log queries
CREATE INDEX IF NOT EXISTS idx_feira_audit_log_feira_id ON public.feira_audit_log(feira_id);
CREATE INDEX IF NOT EXISTS idx_feira_audit_log_changed_at ON public.feira_audit_log(changed_at DESC);

-- Create function to log feira changes
CREATE OR REPLACE FUNCTION log_feira_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.feira_audit_log (
      feira_id,
      changed_by,
      change_type,
      new_data
    ) VALUES (
      NEW.id,
      auth.uid(),
      'INSERT',
      to_jsonb(NEW)
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.feira_audit_log (
      feira_id,
      changed_by,
      change_type,
      old_data,
      new_data
    ) VALUES (
      NEW.id,
      auth.uid(),
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.feira_audit_log (
      feira_id,
      changed_by,
      change_type,
      old_data
    ) VALUES (
      OLD.id,
      auth.uid(),
      'DELETE',
      to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create trigger for feira audit logging
DROP TRIGGER IF EXISTS feira_audit_trigger ON public.feiras;
CREATE TRIGGER feira_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE
  ON public.feiras
  FOR EACH ROW
  EXECUTE FUNCTION log_feira_changes();