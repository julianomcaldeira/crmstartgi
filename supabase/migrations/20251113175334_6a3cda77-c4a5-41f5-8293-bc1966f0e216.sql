-- Drop the audit trigger temporarily
DROP TRIGGER IF EXISTS feira_audit_trigger ON public.feiras;

-- Recreate it after import (will be done in next step)
CREATE TRIGGER feira_audit_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.feiras
  FOR EACH ROW
  EXECUTE FUNCTION public.log_feira_changes();