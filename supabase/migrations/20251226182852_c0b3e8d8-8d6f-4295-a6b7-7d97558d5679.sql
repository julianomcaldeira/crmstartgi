-- Add billing_type column to opportunities table
ALTER TABLE public.opportunities 
ADD COLUMN billing_type TEXT DEFAULT 'recorrente' CHECK (billing_type IN ('pontual', 'recorrente'));