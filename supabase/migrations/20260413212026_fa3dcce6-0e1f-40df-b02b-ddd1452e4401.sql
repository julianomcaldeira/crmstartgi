
ALTER TABLE public.campaign_task_templates
  ADD COLUMN start_day_offset integer NOT NULL DEFAULT 0,
  ADD COLUMN end_day_offset integer NOT NULL DEFAULT 0,
  ADD COLUMN instructions text;

-- Migrate existing data
UPDATE public.campaign_task_templates
SET start_day_offset = day_offset, end_day_offset = day_offset;

-- Drop old column
ALTER TABLE public.campaign_task_templates DROP COLUMN day_offset;
