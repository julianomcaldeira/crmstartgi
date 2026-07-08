
-- Golden rule: any vendedor can VIEW all sales data, but can only EDIT their own records.
-- Broadens SELECT policies while keeping INSERT/UPDATE/DELETE tied to ownership.

-- clients
DROP POLICY IF EXISTS "Users can view own or staff can view all clients" ON public.clients;
CREATE POLICY "Authenticated can view all clients"
  ON public.clients FOR SELECT TO authenticated USING (true);

-- contacts
DROP POLICY IF EXISTS "Users can view contacts of accessible clients" ON public.contacts;
CREATE POLICY "Authenticated can view all contacts"
  ON public.contacts FOR SELECT TO authenticated USING (true);

-- opportunities
DROP POLICY IF EXISTS "Users can view own or staff view all opportunities" ON public.opportunities;
CREATE POLICY "Authenticated can view all opportunities"
  ON public.opportunities FOR SELECT TO authenticated USING (true);

-- tasks
DROP POLICY IF EXISTS "Users can view assigned tasks or created tasks" ON public.tasks;
DROP POLICY IF EXISTS "Pre vendas can view all tasks" ON public.tasks;
CREATE POLICY "Authenticated can view all tasks"
  ON public.tasks FOR SELECT TO authenticated USING (true);

-- proposals
DROP POLICY IF EXISTS "View own proposals or admin pre_vendas gestor" ON public.proposals;
CREATE POLICY "Authenticated can view all proposals"
  ON public.proposals FOR SELECT TO authenticated USING (true);

-- client_notes
DROP POLICY IF EXISTS "Authors admins and gestores can view client notes" ON public.client_notes;
CREATE POLICY "Authenticated can view all client notes"
  ON public.client_notes FOR SELECT TO authenticated USING (true);

-- opportunity_activities
DROP POLICY IF EXISTS "Users can view activity logs of accessible opportunities" ON public.opportunity_activities;
CREATE POLICY "Authenticated can view all opportunity activities"
  ON public.opportunity_activities FOR SELECT TO authenticated USING (true);

-- opportunity_attachments
DROP POLICY IF EXISTS "View attachments scoped to opportunity ownership" ON public.opportunity_attachments;
CREATE POLICY "Authenticated can view all opportunity attachments"
  ON public.opportunity_attachments FOR SELECT TO authenticated USING (true);

-- task_notes
DROP POLICY IF EXISTS "Users can view notes of tasks they have access to" ON public.task_notes;
CREATE POLICY "Authenticated can view all task notes"
  ON public.task_notes FOR SELECT TO authenticated USING (true);

-- task_attachments
DROP POLICY IF EXISTS "Users can view attachments of their tasks" ON public.task_attachments;
CREATE POLICY "Authenticated can view all task attachments"
  ON public.task_attachments FOR SELECT TO authenticated USING (true);

-- prospect_diagnostics
DROP POLICY IF EXISTS "Owners admins and gestores can view diagnostics" ON public.prospect_diagnostics;
CREATE POLICY "Authenticated can view all diagnostics"
  ON public.prospect_diagnostics FOR SELECT TO authenticated USING (true);

-- prospect_diagnostic_answers
DROP POLICY IF EXISTS "Owners admins and gestores can view diagnostic answers" ON public.prospect_diagnostic_answers;
CREATE POLICY "Authenticated can view all diagnostic answers"
  ON public.prospect_diagnostic_answers FOR SELECT TO authenticated USING (true);
