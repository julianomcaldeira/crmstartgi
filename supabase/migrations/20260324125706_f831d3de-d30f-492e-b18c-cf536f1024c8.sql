ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS has_negotiated_fees boolean DEFAULT false;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS negotiated_fee_values jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS negotiated_fee_average numeric DEFAULT null;