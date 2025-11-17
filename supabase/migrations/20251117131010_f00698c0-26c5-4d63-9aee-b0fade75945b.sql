-- Create storage bucket for feira visit photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('feira-visit-photos', 'feira-visit-photos', true);

-- Create table to store photo metadata
CREATE TABLE IF NOT EXISTS public.client_feira_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_feira_id UUID NOT NULL REFERENCES public.client_feiras(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT
);

-- Create index for better query performance
CREATE INDEX idx_client_feira_photos_client_feira_id ON public.client_feira_photos(client_feira_id);

-- Enable RLS
ALTER TABLE public.client_feira_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_feira_photos table
CREATE POLICY "Users can view all photos"
  ON public.client_feira_photos
  FOR SELECT
  USING (true);

CREATE POLICY "Users can upload photos"
  ON public.client_feira_photos
  FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete own photos"
  ON public.client_feira_photos
  FOR DELETE
  USING (auth.uid() = uploaded_by);

-- Storage policies for feira-visit-photos bucket
CREATE POLICY "Anyone can view feira visit photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'feira-visit-photos');

CREATE POLICY "Authenticated users can upload feira visit photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'feira-visit-photos' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own feira visit photos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'feira-visit-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );