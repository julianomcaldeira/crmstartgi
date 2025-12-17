-- Permitir que vendedores excluam oportunidades que eles criaram
CREATE POLICY "Vendedores can delete own opportunities"
ON public.opportunities
FOR DELETE
USING (
  auth.uid() = created_by
  AND public.has_role(auth.uid(), 'vendedor'::app_role)
);