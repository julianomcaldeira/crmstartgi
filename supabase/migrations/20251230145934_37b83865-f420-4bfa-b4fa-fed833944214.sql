-- Create task_attachments table
CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_attachments
CREATE POLICY "Users can view attachments of their tasks"
ON public.task_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_attachments.task_id 
    AND tasks.assigned_to = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'gestor')
  )
);

CREATE POLICY "Users can insert attachments to their tasks"
ON public.task_attachments
FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by AND (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = task_attachments.task_id 
      AND tasks.assigned_to = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'gestor')
    )
  )
);

CREATE POLICY "Users can delete their own attachments"
ON public.task_attachments
FOR DELETE
USING (
  auth.uid() = uploaded_by
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'gestor')
  )
);

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for task-attachments bucket
CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'task-attachments' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view task attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'task-attachments' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own task attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'task-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add trigger for updated_at
CREATE TRIGGER update_task_attachments_updated_at
BEFORE UPDATE ON public.task_attachments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();