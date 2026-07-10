CREATE OR REPLACE FUNCTION public.is_active_profile(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND COALESCE(p.is_deleted, false) = false
  )
$$;

DROP POLICY IF EXISTS "Vendedores can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Gestores and admins can update any client" ON public.clients;

CREATE POLICY "Owners can update own clients and transfer to active users"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by
  AND public.has_role(auth.uid(), 'vendedor'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'vendedor'::public.app_role)
  AND public.is_active_profile(created_by)
);

CREATE POLICY "Admins and gestores can update and transfer any client"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
)
WITH CHECK (
  public.is_active_profile(created_by)
);