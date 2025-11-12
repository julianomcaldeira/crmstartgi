-- Add description field to products and make fees optional
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS description text;

-- Update existing products to have 0 for fees if they don't have values
UPDATE products 
SET implementation_fee = 0 
WHERE implementation_fee IS NULL;

UPDATE products 
SET monthly_fee = 0 
WHERE monthly_fee IS NULL;