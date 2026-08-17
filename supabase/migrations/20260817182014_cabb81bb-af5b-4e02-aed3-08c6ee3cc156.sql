-- Restrict public read policies to authenticated users only

DROP POLICY IF EXISTS "Users can view all photos" ON public.client_feira_photos;
CREATE POLICY "Users can view all photos" ON public.client_feira_photos
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view options" ON public.diagnostic_question_options;
CREATE POLICY "Everyone can view options" ON public.diagnostic_question_options
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view active questions" ON public.diagnostic_questions;
CREATE POLICY "Everyone can view active questions" ON public.diagnostic_questions
FOR SELECT TO authenticated USING ((is_active = true) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Everyone can view active roles" ON public.diagnostic_roles;
CREATE POLICY "Everyone can view active roles" ON public.diagnostic_roles
FOR SELECT TO authenticated USING ((is_active = true) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Everyone can view fairs" ON public.feiras;
CREATE POLICY "Everyone can view fairs" ON public.feiras
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can create fairs" ON public.feiras;
CREATE POLICY "Everyone can create fairs" ON public.feiras
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Everyone can view loss reasons" ON public.loss_reasons;
CREATE POLICY "Everyone can view loss reasons" ON public.loss_reasons
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view products" ON public.products;
CREATE POLICY "Everyone can view products" ON public.products
FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.client_feira_photos, public.diagnostic_question_options,
  public.diagnostic_questions, public.diagnostic_roles, public.feiras,
  public.loss_reasons, public.products FROM anon;