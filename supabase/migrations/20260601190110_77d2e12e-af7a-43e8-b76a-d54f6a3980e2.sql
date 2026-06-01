DROP POLICY IF EXISTS "Agenda select" ON public.pre_vendas_agenda;

CREATE POLICY "Agenda select"
ON public.pre_vendas_agenda
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'pre_vendas'::app_role)
  OR created_by = auth.uid()
  OR pre_vendas_user_id = auth.uid()
);