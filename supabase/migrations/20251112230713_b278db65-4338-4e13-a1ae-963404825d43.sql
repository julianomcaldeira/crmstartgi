-- Add period column to goals table
ALTER TABLE public.goals 
ADD COLUMN period TEXT NOT NULL DEFAULT 'mensal' CHECK (period IN ('mensal', 'semestral', 'anual'));

-- Remove current_value column as it's no longer needed
ALTER TABLE public.goals 
DROP COLUMN current_value;