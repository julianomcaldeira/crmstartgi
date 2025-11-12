-- Add implementation_value and monthly_value columns to opportunities table
ALTER TABLE public.opportunities 
ADD COLUMN implementation_value numeric,
ADD COLUMN monthly_value numeric;