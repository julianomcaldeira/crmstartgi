-- Add business_type column to opportunities table
CREATE TYPE business_type AS ENUM ('cliente_novo', 'venda_na_base');

ALTER TABLE public.opportunities 
ADD COLUMN business_type business_type DEFAULT 'cliente_novo';