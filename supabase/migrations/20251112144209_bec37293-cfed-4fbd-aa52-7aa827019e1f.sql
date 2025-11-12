-- Fix RLS policies for opportunity-attachments bucket
-- Drop ALL existing policies for the bucket first
DO $$ 
BEGIN
  -- Drop all existing policies on storage.objects for opportunity-attachments
  DROP POLICY IF EXISTS "Users can view opportunity attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload opportunity attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own opportunity attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own opportunity attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Users can view attachments of opportunities they have access to" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload attachments to opportunities" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
END $$;

-- Create new corrected policies

-- Policy for viewing attachments
CREATE POLICY "Users can view opportunity attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'opportunity-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy for uploading attachments
CREATE POLICY "Users can upload opportunity attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'opportunity-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy for updating attachments
CREATE POLICY "Users can update their own opportunity attachments"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'opportunity-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy for deleting attachments
CREATE POLICY "Users can delete their own opportunity attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'opportunity-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);