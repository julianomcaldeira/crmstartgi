-- Add logo_url to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS logo_url text;

-- Create storage bucket for product logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-logos', 'product-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for product logos
CREATE POLICY "Product logos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'product-logos');

CREATE POLICY "Admins can upload product logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'product-logos' 
  AND (SELECT has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admins can update product logos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'product-logos' 
  AND (SELECT has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admins can delete product logos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'product-logos' 
  AND (SELECT has_role(auth.uid(), 'admin'))
);