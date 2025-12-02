
-- Create table for complete task templates
CREATE TABLE public.task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  description TEXT,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can view global templates or their own
CREATE POLICY "Users can view global or own templates"
ON public.task_templates
FOR SELECT
USING (is_global = true OR auth.uid() = created_by);

-- Users can create templates
CREATE POLICY "Users can create templates"
ON public.task_templates
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Users can update their own templates
CREATE POLICY "Users can update own templates"
ON public.task_templates
FOR UPDATE
USING (auth.uid() = created_by);

-- Users can delete their own templates, admins can delete global
CREATE POLICY "Users can delete own templates"
ON public.task_templates
FOR DELETE
USING (auth.uid() = created_by OR (is_global = true AND has_role(auth.uid(), 'admin'::app_role)));

-- Add usage tracking and personal flag to message templates
ALTER TABLE public.task_message_templates 
ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT false;

-- Update RLS for message templates to include personal messages
DROP POLICY IF EXISTS "Everyone can view task message templates" ON public.task_message_templates;
CREATE POLICY "Users can view global or own message templates"
ON public.task_message_templates
FOR SELECT
USING (is_personal = false OR auth.uid() = created_by);

-- Add index for faster lookup
CREATE INDEX idx_task_templates_task_type ON public.task_templates(task_type);
CREATE INDEX idx_task_templates_is_global ON public.task_templates(is_global);
CREATE INDEX idx_task_message_templates_usage ON public.task_message_templates(usage_count DESC);
