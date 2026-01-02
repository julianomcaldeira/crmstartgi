-- Add unique constraint on feira name to prevent duplicates
ALTER TABLE public.feiras ADD CONSTRAINT feiras_name_unique UNIQUE (name);