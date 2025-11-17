-- Add cnae_principal column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cnae_principal TEXT;