
CREATE OR REPLACE FUNCTION public.is_crm_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = _user_id
      AND COALESCE(p.is_deleted, false) = false
      AND ur.role IN ('admin','gestor','vendedor','pre_vendas')
  )
$$;

REVOKE ALL ON FUNCTION public.is_crm_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_crm_member(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated can view all client notes" ON public.client_notes;
CREATE POLICY "CRM members can view client notes" ON public.client_notes FOR SELECT TO authenticated USING (public.is_crm_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view all clients" ON public.clients;
CREATE POLICY "CRM members can view clients" ON public.clients FOR SELECT TO authenticated USING (public.is_crm_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read CNPJ cache rows" ON public.cnpj_cache;
CREATE POLICY "CRM members can read CNPJ cache" ON public.cnpj_cache FOR SELECT TO authenticated USING (public.is_crm_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view all contacts" ON public.contacts;
CREATE POLICY "CRM members can view contacts" ON public.contacts FOR SELECT TO authenticated USING (public.is_crm_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view all opportunities" ON public.opportunities;
CREATE POLICY "CRM members can view opportunities" ON public.opportunities FOR SELECT TO authenticated USING (public.is_crm_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view all opportunity activities" ON public.opportunity_activities;
CREATE POLICY "CRM members can view opportunity activities" ON public.opportunity_activities FOR SELECT TO authenticated USING (public.is_crm_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view all opportunity attachments" ON public.opportunity_attachments;
CREATE POLICY "CRM members can view opportunity attachments" ON public.opportunity_attachments FOR SELECT TO authenticated USING (public.is_crm_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view all proposals" ON public.proposals;
CREATE POLICY "CRM members can view proposals" ON public.proposals FOR SELECT TO authenticated USING (public.is_crm_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view all diagnostic answers" ON public.prospect_diagnostic_answers;
CREATE POLICY "CRM members can view diagnostic answers" ON public.prospect_diagnostic_answers FOR SELECT TO authenticated USING (public.is_crm_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view all diagnostics" ON public.prospect_diagnostics;
CREATE POLICY "CRM members can view diagnostics" ON public.prospect_diagnostics FOR SELECT TO authenticated USING (public.is_crm_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view all task attachments" ON public.task_attachments;
CREATE POLICY "CRM members can view task attachments" ON public.task_attachments FOR SELECT TO authenticated USING (public.is_crm_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view all task notes" ON public.task_notes;
CREATE POLICY "CRM members can view task notes" ON public.task_notes FOR SELECT TO authenticated USING (public.is_crm_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view all tasks" ON public.tasks;
CREATE POLICY "CRM members can view tasks" ON public.tasks FOR SELECT TO authenticated USING (public.is_crm_member(auth.uid()));
