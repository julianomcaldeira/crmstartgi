
DROP POLICY IF EXISTS "Users can view opportunity attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own opportunity attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own opportunity attachments" ON storage.objects;

CREATE POLICY "Users can view opportunity attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'opportunity-attachments' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
    OR EXISTS (
      SELECT 1 FROM public.opportunity_attachments oa
      JOIN public.opportunities o ON o.id = oa.opportunity_id
      WHERE oa.file_path = storage.objects.name
        AND (o.assigned_to = auth.uid() OR o.created_by = auth.uid())
    )
  )
);

CREATE POLICY "Users can delete opportunity attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'opportunity-attachments' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
    OR EXISTS (
      SELECT 1 FROM public.opportunity_attachments oa
      JOIN public.opportunities o ON o.id = oa.opportunity_id
      WHERE oa.file_path = storage.objects.name
        AND (o.assigned_to = auth.uid() OR o.created_by = auth.uid())
    )
  )
);

CREATE POLICY "Users can update opportunity attachments"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'opportunity-attachments' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
  )
);
