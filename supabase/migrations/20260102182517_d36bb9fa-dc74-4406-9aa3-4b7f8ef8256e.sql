-- Allow vendedores to update their own client_feiras records (for notes and visited status)
CREATE POLICY "Vendedores can update own client_feira records" 
ON public.client_feiras 
FOR UPDATE 
USING (
  auth.uid() = created_by AND 
  has_role(auth.uid(), 'vendedor'::app_role)
);