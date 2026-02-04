-- Add commission_percentage column to opportunities table
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS commission_percentage numeric DEFAULT 0;