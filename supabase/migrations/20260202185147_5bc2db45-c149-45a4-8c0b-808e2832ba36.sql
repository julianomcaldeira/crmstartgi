-- Add optional filters so goals of type 'tasks'/'activities' can count the right things
ALTER TABLE public.goals
ADD COLUMN IF NOT EXISTS task_type_filter text NULL,
ADD COLUMN IF NOT EXISTS activity_type_filter text NULL;

-- Best-effort backfill for existing task goals based on title keywords
UPDATE public.goals
SET task_type_filter = CASE
  WHEN lower(title) LIKE '%liga%' THEN 'ligacao'
  WHEN lower(title) LIKE '%propost%' THEN 'proposta'
  WHEN lower(title) LIKE '%apresent%' THEN 'apresentacao'
  WHEN lower(title) LIKE '%whats%' THEN 'whatsapp'
  WHEN lower(title) LIKE '%email%' THEN 'email'
  WHEN lower(title) LIKE '%linkedin%' THEN 'linkedin'
  WHEN lower(title) LIKE '%visita presenc%' THEN 'visita_presencial'
  WHEN lower(title) LIKE '%reuni%' THEN 'reuniao_online'
  WHEN lower(title) LIKE '%feira%' THEN 'visita_feira'
  ELSE NULL
END
WHERE goal_type = 'tasks'
  AND task_type_filter IS NULL;

-- No backfill for activity_type_filter (depends on how your activity_type values are used)
