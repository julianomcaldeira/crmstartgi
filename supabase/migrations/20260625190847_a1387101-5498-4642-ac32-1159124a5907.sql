-- Permitir que vendedores transfiram seus próprios prospects para outro vendedor.
-- A política anterior bloqueava qualquer UPDATE que mudasse created_by para outro usuário,
-- porque o WITH CHECK exigia auth.uid() = created_by no novo registro.

DROP POLICY IF EXISTS "Vendedores can update own clients" ON public.clients;

CREATE POLICY "Vendedores can update own clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by
  AND public.has_role(auth.uid(), 'vendedor'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'vendedor'::app_role)
  AND (
    -- edição normal: continua sendo o dono
    auth.uid() = created_by
    -- ou transferência: novo dono precisa ser um usuário ativo
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = clients.created_by
        AND (p.is_deleted IS NULL OR p.is_deleted = false)
    )
  )
);