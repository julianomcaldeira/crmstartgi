DROP POLICY IF EXISTS "Admins and gestores can update and transfer any client" ON public.clients;
CREATE POLICY "Admins gestores and pre_vendas can update and transfer any client"
ON public.clients FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'pre_vendas'::app_role))
WITH CHECK (is_active_profile(created_by));