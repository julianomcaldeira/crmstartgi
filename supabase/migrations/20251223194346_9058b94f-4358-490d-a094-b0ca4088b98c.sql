-- Drop existing restrictive DELETE policy
DROP POLICY IF EXISTS "Admins and gestores can delete client-feira links" ON public.client_feiras;

-- Create new DELETE policy that allows:
-- 1. Admins and gestores to delete any client-feira link
-- 2. The user who created the link to delete it
-- 3. The user who created the client to delete any of its feira links
CREATE POLICY "Users can delete client-feira links" 
ON public.client_feiras 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gestor'::app_role) OR 
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_feiras.client_id 
    AND clients.created_by = auth.uid()
  )
);