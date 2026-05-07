
-- Allow vendedor role to create agenda events
DROP POLICY IF EXISTS "Agenda insert" ON public.pre_vendas_agenda;
CREATE POLICY "Agenda insert" ON public.pre_vendas_agenda
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (
    has_role(auth.uid(), 'pre_vendas'::app_role)
    OR has_role(auth.uid(), 'vendedor'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Update select to allow gestor to see all
DROP POLICY IF EXISTS "Agenda select" ON public.pre_vendas_agenda;
CREATE POLICY "Agenda select" ON public.pre_vendas_agenda
FOR SELECT TO authenticated
USING (
  is_private = false
  OR pre_vendas_user_id = auth.uid()
  OR created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);
