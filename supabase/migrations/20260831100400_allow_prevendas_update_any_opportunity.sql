-- Garante que Pré-Vendas pode alterar status de qualquer oportunidade aberta, inclusive PERDIDO
-- RLS já tinha a policy em 20260506222629, mas recria caso tenha sido sobrescrita

DROP POLICY IF EXISTS "Pre vendas can update opportunities" ON public.opportunities;
CREATE POLICY "Pre vendas can update opportunities"
  ON public.opportunities FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'pre_vendas'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pre_vendas'::app_role));

-- Garante também que a policy geral inclui pre_vendas (caso tenha sido recriada sem)
DROP POLICY IF EXISTS "Users can update assigned opportunities or admins" ON public.opportunities;
DROP POLICY IF EXISTS "Users can update opportunities" ON public.opportunities;
CREATE POLICY "Users can update opportunities"
  ON public.opportunities FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = assigned_to
    OR auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
  )
  WITH CHECK (
    auth.uid() = assigned_to
    OR auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
  );
