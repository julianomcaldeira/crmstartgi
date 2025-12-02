-- Add category field to task_templates
ALTER TABLE public.task_templates 
ADD COLUMN category text DEFAULT 'geral';

-- Create index for better category filtering
CREATE INDEX idx_task_templates_category ON public.task_templates(category);