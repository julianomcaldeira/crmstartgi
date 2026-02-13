
-- Drop and recreate the vendedor update policy to allow transferring prospects
DROP POLICY "Vendedores can update own clients" ON public.clients;

CREATE POLICY "Vendedores can update own clients"
ON public.clients
FOR UPDATE
USING ((auth.uid() = created_by) AND has_role(auth.uid(), 'vendedor'::app_role))
WITH CHECK (true);
