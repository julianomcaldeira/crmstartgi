ALTER TABLE public.pre_vendas_requests
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendees_roles text,
  ADD COLUMN IF NOT EXISTS expectations text;