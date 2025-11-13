-- Add average close cycle to opportunities
ALTER TABLE opportunities
ADD COLUMN close_cycle_days integer;

-- Add rating fields to clients and contacts
ALTER TABLE clients
ADD COLUMN rating integer CHECK (rating >= 1 AND rating <= 5);

ALTER TABLE contacts
ADD COLUMN rating integer CHECK (rating >= 1 AND rating <= 5);

-- Create function to calculate close cycle when opportunity is won
CREATE OR REPLACE FUNCTION calculate_close_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If status changed to 'ganho', calculate days from creation to now
  IF NEW.status = 'ganho' AND OLD.status != 'ganho' THEN
    NEW.close_cycle_days = EXTRACT(DAY FROM (NOW() - NEW.created_at))::integer;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for close cycle calculation
DROP TRIGGER IF EXISTS calculate_close_cycle_trigger ON opportunities;
CREATE TRIGGER calculate_close_cycle_trigger
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION calculate_close_cycle();

COMMENT ON COLUMN opportunities.close_cycle_days IS 'Number of days from opportunity creation to close (won)';
COMMENT ON COLUMN clients.rating IS 'Prospect rating from 1 to 5 stars';
COMMENT ON COLUMN contacts.rating IS 'Contact rating from 1 to 5 stars';