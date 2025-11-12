-- Add new fields to clients table
ALTER TABLE public.clients 
ADD COLUMN company_size text,
ADD COLUMN region text,
ADD COLUMN competitors text;