-- Create storage bucket for opportunity attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('opportunity-attachments', 'opportunity-attachments', false);

-- Create attachments table for opportunities
CREATE TABLE public.opportunity_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on attachments table
ALTER TABLE public.opportunity_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for attachments
CREATE POLICY "Users can view attachments of opportunities they have access to"
ON public.opportunity_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE id = opportunity_attachments.opportunity_id
  )
);

CREATE POLICY "Users can upload attachments to opportunities"
ON public.opportunity_attachments
FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own attachments"
ON public.opportunity_attachments
FOR DELETE
USING (auth.uid() = uploaded_by);

-- Storage policies for opportunity attachments
CREATE POLICY "Users can view opportunity attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'opportunity-attachments');

CREATE POLICY "Users can upload opportunity attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'opportunity-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'opportunity-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Trigger for updated_at
CREATE TRIGGER update_opportunity_attachments_updated_at
BEFORE UPDATE ON public.opportunity_attachments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();