-- Public bucket for email signature images
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-signatures', 'email-signatures', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read
CREATE POLICY "Email signature images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-signatures');

-- Users manage their own folder
CREATE POLICY "Users can upload own signature images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'email-signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own signature images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'email-signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own signature images"
ON storage.objects FOR DELETE
USING (bucket_id = 'email-signatures' AND auth.uid()::text = (storage.foldername(name))[1]);
