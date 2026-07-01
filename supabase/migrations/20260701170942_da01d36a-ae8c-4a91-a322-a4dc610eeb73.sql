
DROP POLICY IF EXISTS "Users can view all clients" ON public.clients;
CREATE POLICY "Users can view own or staff can view all clients"
ON public.clients FOR SELECT TO authenticated
USING (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
);

DROP POLICY IF EXISTS "Users can view all contacts" ON public.contacts;
CREATE POLICY "Users can view contacts of accessible clients"
ON public.contacts FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
  OR auth.uid() = created_by
  OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = contacts.client_id AND c.created_by = auth.uid())
);

DROP POLICY IF EXISTS "Users can view all opportunities" ON public.opportunities;
CREATE POLICY "Users can view own or staff view all opportunities"
ON public.opportunities FOR SELECT TO authenticated
USING (
  auth.uid() = created_by
  OR auth.uid() = assigned_to
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
);

DROP POLICY IF EXISTS "Authenticated can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Gestores can view all profiles" ON public.profiles;
CREATE POLICY "Gestores can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'gestor'::app_role));

DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;
CREATE POLICY "Users can view own role or admins view all"
ON public.user_roles FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);

DROP POLICY IF EXISTS "Users can create notes on clients they have access to" ON public.client_notes;
DROP POLICY IF EXISTS "Users can create notes on accessible clients" ON public.client_notes;
CREATE POLICY "Users can create notes on accessible clients"
ON public.client_notes FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_notes.client_id
      AND (
        c.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'gestor'::app_role)
        OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
      )
  )
);

DROP POLICY IF EXISTS "No direct inserts on proposal_views" ON public.proposal_views;
CREATE POLICY "No direct inserts on proposal_views"
ON public.proposal_views FOR INSERT TO authenticated, anon
WITH CHECK (false);

DROP POLICY IF EXISTS "Anyone can read CNPJ cache" ON public.cnpj_cache;
DROP POLICY IF EXISTS "Authenticated can read safe CNPJ cache fields" ON public.cnpj_cache;
CREATE POLICY "Authenticated can read CNPJ cache rows"
ON public.cnpj_cache FOR SELECT TO authenticated
USING (true);

CREATE OR REPLACE VIEW public.cnpj_cache_public
WITH (security_invoker = true)
AS SELECT cnpj, share_capital, city, state, created_at FROM public.cnpj_cache;

REVOKE SELECT ON public.cnpj_cache FROM authenticated;
GRANT SELECT (cnpj, share_capital, city, state, created_at) ON public.cnpj_cache TO authenticated;
GRANT SELECT ON public.cnpj_cache_public TO authenticated;
