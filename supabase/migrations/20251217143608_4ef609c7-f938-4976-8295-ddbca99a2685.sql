-- Permitir que vendedores removam (DELETE) contatos criados por eles mesmos
-- Isso evita que o app “não consiga deletar” (RLS) e acabe reinserindo/duplicando contatos

CREATE POLICY "Vendedores podem deletar seus próprios contatos"
ON public.contacts
FOR DELETE
USING (
  auth.uid() = created_by
  AND public.has_role(auth.uid(), 'vendedor'::app_role)
);
