DROP POLICY IF EXISTS "Users can view opportunity attachments" ON storage.objects;
CREATE POLICY "Users can view opportunity attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'opportunity-attachments'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.opportunity_attachments oa
      JOIN public.opportunities o ON o.id = oa.opportunity_id
      WHERE oa.file_path = objects.name
        AND (o.assigned_to = auth.uid() OR o.created_by = auth.uid())
    )
  )
);