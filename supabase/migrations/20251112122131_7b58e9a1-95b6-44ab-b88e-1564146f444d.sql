-- Add product_id to opportunities table
ALTER TABLE opportunities 
ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE SET NULL;