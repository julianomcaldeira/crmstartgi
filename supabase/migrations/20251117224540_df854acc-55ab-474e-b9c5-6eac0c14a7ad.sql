-- Add cnae_description column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cnae_description TEXT;

-- Add cnae_description column to cnpj_cache table
ALTER TABLE cnpj_cache ADD COLUMN IF NOT EXISTS cnae_description TEXT;