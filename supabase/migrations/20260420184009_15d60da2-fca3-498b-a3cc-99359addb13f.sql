
-- ============ knowledge_base: remove overly permissive policies ============
DROP POLICY IF EXISTS "Everyone can update knowledge items" ON public.knowledge_base;
DROP POLICY IF EXISTS "Users can update knowledge base items" ON public.knowledge_base;
DROP POLICY IF EXISTS "Users can delete knowledge base items" ON public.knowledge_base;
DROP POLICY IF EXISTS "Everyone can view knowledge base" ON public.knowledge_base;

CREATE POLICY "Admin and gestor can update knowledge items"
ON public.knowledge_base FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

-- ============ knowledge_base_history: restrict to authenticated ============
DROP POLICY IF EXISTS "Everyone can view knowledge base history" ON public.knowledge_base_history;
DROP POLICY IF EXISTS "System can insert history" ON public.knowledge_base_history;

CREATE POLICY "Authenticated can view knowledge base history"
ON public.knowledge_base_history FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert knowledge base history"
ON public.knowledge_base_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() = changed_by);

-- ============ prospect_diagnostics: restrict to owner/admin/gestor ============
DROP POLICY IF EXISTS "Users can view diagnostics" ON public.prospect_diagnostics;
DROP POLICY IF EXISTS "Users can view all diagnostics" ON public.prospect_diagnostics;
DROP POLICY IF EXISTS "Everyone can view diagnostics" ON public.prospect_diagnostics;

CREATE POLICY "Owners admins and gestores can view diagnostics"
ON public.prospect_diagnostics FOR SELECT TO authenticated
USING (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);

-- ============ prospect_diagnostic_answers: restrict to authenticated + owner ============
DROP POLICY IF EXISTS "Users can view diagnostic answers" ON public.prospect_diagnostic_answers;
DROP POLICY IF EXISTS "Everyone can view diagnostic answers" ON public.prospect_diagnostic_answers;

CREATE POLICY "Owners admins and gestores can view diagnostic answers"
ON public.prospect_diagnostic_answers FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.prospect_diagnostics d
    WHERE d.id = prospect_diagnostic_answers.diagnostic_id
      AND (
        d.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'gestor'::app_role)
      )
  )
);

-- ============ client_notes: restrict reads to author/admin/gestor ============
DROP POLICY IF EXISTS "Users can view notes of clients they have access to" ON public.client_notes;

CREATE POLICY "Authors admins and gestores can view client notes"
ON public.client_notes FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);

-- ============ task_history: harden insert ============
DROP POLICY IF EXISTS "System can insert task history" ON public.task_history;

CREATE POLICY "Authenticated can insert task history"
ON public.task_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() = changed_by);

-- ============ opportunity_history: harden insert ============
DROP POLICY IF EXISTS "System can insert opportunity history" ON public.opportunity_history;

CREATE POLICY "Authenticated can insert opportunity history"
ON public.opportunity_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() = changed_by);

-- ============ opportunity_activities: harden insert ============
DROP POLICY IF EXISTS "System can insert activity logs" ON public.opportunity_activities;

CREATE POLICY "Authenticated can insert activity logs"
ON public.opportunity_activities FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

-- ============ opportunity_alerts: harden insert ============
DROP POLICY IF EXISTS "System can insert alerts" ON public.opportunity_alerts;

CREATE POLICY "Authenticated can insert alerts"
ON public.opportunity_alerts FOR INSERT TO authenticated
WITH CHECK (true);

-- ============ feira_audit_log: harden insert ============
DROP POLICY IF EXISTS "System can insert audit logs" ON public.feira_audit_log;

CREATE POLICY "Authenticated can insert feira audit logs"
ON public.feira_audit_log FOR INSERT TO authenticated
WITH CHECK (auth.uid() = changed_by);

-- ============ Function search_path hardening ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_close_cycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'won' AND OLD.status != 'won' THEN
    NEW.close_cycle_days = EXTRACT(DAY FROM (NOW() - NEW.created_at))::integer;
  END IF;
  RETURN NEW;
END;
$function$;
