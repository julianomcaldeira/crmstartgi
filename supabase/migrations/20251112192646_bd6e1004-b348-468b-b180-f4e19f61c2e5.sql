-- Create cache table for CNPJ queries
CREATE TABLE IF NOT EXISTS public.cnpj_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT NOT NULL UNIQUE,
  company_name TEXT,
  trade_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  segment TEXT,
  share_capital NUMERIC,
  legal_nature TEXT,
  registration_status TEXT,
  foundation_date TEXT,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.cnpj_cache ENABLE ROW LEVEL SECURITY;

-- Create policy for reading cached CNPJ data (all authenticated users)
CREATE POLICY "Anyone can read CNPJ cache"
  ON public.cnpj_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy for inserting to cache (all authenticated users)
CREATE POLICY "Anyone can insert CNPJ cache"
  ON public.cnpj_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cnpj_cache_cnpj ON public.cnpj_cache(cnpj);

-- Create index for cache expiration queries
CREATE INDEX IF NOT EXISTS idx_cnpj_cache_cached_at ON public.cnpj_cache(cached_at);