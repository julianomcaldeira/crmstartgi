
-- 1. Function search_path
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;

-- 2. Tighten always-true RLS checks
DROP POLICY IF EXISTS "Anyone can insert CNPJ cache" ON public.cnpj_cache;
CREATE POLICY "Authenticated can insert CNPJ cache" ON public.cnpj_cache
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can insert alerts" ON public.opportunity_alerts;
CREATE POLICY "Authenticated can insert alerts" ON public.opportunity_alerts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated pode inserir leads" ON public.radar_leads;
CREATE POLICY "Authenticated pode inserir leads" ON public.radar_leads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated pode inserir histórico" ON public.radar_sync_history;
CREATE POLICY "Authenticated pode inserir histórico" ON public.radar_sync_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Vendedores can update own clients" ON public.clients;
CREATE POLICY "Vendedores can update own clients" ON public.clients
  FOR UPDATE TO authenticated
  USING ((auth.uid() = created_by) AND has_role(auth.uid(), 'vendedor'::app_role))
  WITH CHECK ((auth.uid() = created_by) AND has_role(auth.uid(), 'vendedor'::app_role));

-- 3. opportunity_activities: scope reads to opportunities the user owns/manages
DROP POLICY IF EXISTS "Authenticated users can view activity logs of opportunities" ON public.opportunity_activities;
DROP POLICY IF EXISTS "Users can view activity logs of opportunities they have access " ON public.opportunity_activities;
CREATE POLICY "Users can view activity logs of accessible opportunities"
  ON public.opportunity_activities FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'pre_vendas'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_activities.opportunity_id
        AND (o.created_by = auth.uid() OR o.assigned_to = auth.uid())
    )
  );

-- 4. opportunity_history: same scoping
DROP POLICY IF EXISTS "Authenticated users can view opportunity history" ON public.opportunity_history;
CREATE POLICY "Users can view history of accessible opportunities"
  ON public.opportunity_history FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'pre_vendas'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_history.opportunity_id
        AND (o.created_by = auth.uid() OR o.assigned_to = auth.uid())
    )
  );

-- 5. Storage: contracts bucket SELECT scoped to owner folder or privileged roles
DROP POLICY IF EXISTS "Authenticated can read contract files in storage" ON storage.objects;
CREATE POLICY "Contract files read scoped to owner or staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contracts'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gestor'::app_role)
      OR has_role(auth.uid(), 'pre_vendas'::app_role)
    )
  );

-- 6. Storage: feira-visit-photos INSERT must be in own folder
DROP POLICY IF EXISTS "Authenticated users can upload feira visit photos" ON storage.objects;
CREATE POLICY "Users can upload feira photos to own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feira-visit-photos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 7. Storage: task-attachments SELECT + INSERT scoped to own folder
DROP POLICY IF EXISTS "Authenticated users can view task attachments" ON storage.objects;
CREATE POLICY "Users can view task attachments in own folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gestor'::app_role)
    )
  );

DROP POLICY IF EXISTS "Authenticated users can upload task attachments" ON storage.objects;
CREATE POLICY "Users can upload task attachments to own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
