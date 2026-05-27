
CREATE OR REPLACE FUNCTION public.snapshot_proposal_on_value_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (COALESCE(OLD.total_value,0) IS DISTINCT FROM COALESCE(NEW.total_value,0))
     OR (COALESCE(OLD.monthly_value,0) IS DISTINCT FROM COALESCE(NEW.monthly_value,0))
     OR (COALESCE(OLD.implementation_value,0) IS DISTINCT FROM COALESCE(NEW.implementation_value,0)) THEN
    INSERT INTO public.proposal_versions (
      proposal_id, version, title, blocks, variables,
      total_value, monthly_value, implementation_value, validity_days,
      snapshot_reason, created_by
    ) VALUES (
      OLD.id, OLD.version, OLD.title, OLD.blocks, OLD.variables,
      OLD.total_value, OLD.monthly_value, OLD.implementation_value, OLD.validity_days,
      'value_change', COALESCE(auth.uid(), OLD.created_by)
    )
    ON CONFLICT (proposal_id, version) DO NOTHING;
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_proposal_on_value_change ON public.proposals;
CREATE TRIGGER trg_snapshot_proposal_on_value_change
BEFORE UPDATE ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.snapshot_proposal_on_value_change();
