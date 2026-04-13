
ALTER TABLE public.campaign_task_templates
  ADD COLUMN start_date date,
  ADD COLUMN end_date date;

-- Drop old columns
ALTER TABLE public.campaign_task_templates
  DROP COLUMN start_day_offset,
  DROP COLUMN end_day_offset;
