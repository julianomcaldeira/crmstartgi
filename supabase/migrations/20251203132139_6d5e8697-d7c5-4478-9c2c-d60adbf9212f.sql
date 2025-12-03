-- Fix the calculate_close_cycle function to use correct enum values ('won' instead of 'ganho')
CREATE OR REPLACE FUNCTION calculate_close_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If status changed to 'won', calculate days from creation to now
  IF NEW.status = 'won' AND OLD.status != 'won' THEN
    NEW.close_cycle_days = EXTRACT(DAY FROM (NOW() - NEW.created_at))::integer;
  END IF;
  
  RETURN NEW;
END;
$$;