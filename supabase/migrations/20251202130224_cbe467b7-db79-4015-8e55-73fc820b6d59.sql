
-- Create table for task message templates
CREATE TABLE public.task_message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_message_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can view templates
CREATE POLICY "Everyone can view task message templates"
ON public.task_message_templates
FOR SELECT
USING (true);

-- Authenticated users can create templates
CREATE POLICY "Authenticated users can create templates"
ON public.task_message_templates
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Admins and gestores can update/delete any template
CREATE POLICY "Admins and gestores can manage templates"
ON public.task_message_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Users can update/delete their own templates
CREATE POLICY "Users can manage own templates"
ON public.task_message_templates
FOR ALL
USING (auth.uid() = created_by);

-- Add index for faster lookup by task_type
CREATE INDEX idx_task_message_templates_task_type ON public.task_message_templates(task_type);
