-- Adicionar política para permitir que vendedores deletem leads que estão convertendo
-- (leads não atribuídos ou atribuídos a eles mesmos)
CREATE POLICY "Vendedores podem deletar leads não atribuídos ou próprios" 
ON public.radar_leads 
FOR DELETE 
USING (
  (auth.uid() IN (
    SELECT user_roles.user_id
    FROM user_roles
    WHERE user_roles.role = 'vendedor'::app_role
  ))
  AND (assigned_to IS NULL OR assigned_to = auth.uid())
);

-- Adicionar política para gestores e admins deletarem qualquer lead
CREATE POLICY "Gestores e admins podem deletar leads" 
ON public.radar_leads 
FOR DELETE 
USING (
  auth.uid() IN (
    SELECT user_roles.user_id
    FROM user_roles
    WHERE user_roles.role = ANY (ARRAY['gestor'::app_role, 'admin'::app_role])
  )
);