-- Add cnae_principal column to cnpj_cache table
ALTER TABLE cnpj_cache ADD COLUMN IF NOT EXISTS cnae_principal TEXT;