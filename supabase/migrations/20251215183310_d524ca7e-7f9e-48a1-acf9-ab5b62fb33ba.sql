-- Add commission field to opportunities table
ALTER TABLE public.opportunities
ADD COLUMN charge_commission boolean DEFAULT false;