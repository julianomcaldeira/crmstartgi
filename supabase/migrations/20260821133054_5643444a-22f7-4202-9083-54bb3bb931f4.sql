CREATE OR REPLACE FUNCTION public.owns_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = _client_id AND c.created_by = _user_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.owns_client(uuid, uuid) TO authenticated, service_role;

-- TASKS
DROP POLICY IF EXISTS "Client owner can update account tasks" ON public.tasks;
CREATE POLICY "Client owner can update account tasks" ON public.tasks
FOR UPDATE TO authenticated
USING (public.owns_client(auth.uid(), client_id))
WITH CHECK (public.owns_client(auth.uid(), client_id));

DROP POLICY IF EXISTS "Client owner can delete account tasks" ON public.tasks;
CREATE POLICY "Client owner can delete account tasks" ON public.tasks
FOR DELETE TO authenticated
USING (public.owns_client(auth.uid(), client_id));

-- OPPORTUNITIES
DROP POLICY IF EXISTS "Client owner can update account opportunities" ON public.opportunities;
CREATE POLICY "Client owner can update account opportunities" ON public.opportunities
FOR UPDATE TO authenticated
USING (public.owns_client(auth.uid(), client_id))
WITH CHECK (public.owns_client(auth.uid(), client_id));

DROP POLICY IF EXISTS "Client owner can delete account opportunities" ON public.opportunities;
CREATE POLICY "Client owner can delete account opportunities" ON public.opportunities
FOR DELETE TO authenticated
USING (public.owns_client(auth.uid(), client_id));

-- CONTACTS
DROP POLICY IF EXISTS "Client owner can update account contacts" ON public.contacts;
CREATE POLICY "Client owner can update account contacts" ON public.contacts
FOR UPDATE TO authenticated
USING (public.owns_client(auth.uid(), client_id))
WITH CHECK (public.owns_client(auth.uid(), client_id));

DROP POLICY IF EXISTS "Client owner can delete account contacts" ON public.contacts;
CREATE POLICY "Client owner can delete account contacts" ON public.contacts
FOR DELETE TO authenticated
USING (public.owns_client(auth.uid(), client_id));

-- TASK NOTES on account tasks
DROP POLICY IF EXISTS "Client owner can add notes on account tasks" ON public.task_notes;
CREATE POLICY "Client owner can add notes on account tasks" ON public.task_notes
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_notes.task_id AND public.owns_client(auth.uid(), t.client_id)
  )
);

-- TASK ATTACHMENTS on account tasks
DROP POLICY IF EXISTS "Client owner can add attachments on account tasks" ON public.task_attachments;
CREATE POLICY "Client owner can add attachments on account tasks" ON public.task_attachments
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id AND public.owns_client(auth.uid(), t.client_id)
  )
);

DROP POLICY IF EXISTS "Client owner can delete attachments on account tasks" ON public.task_attachments;
CREATE POLICY "Client owner can delete attachments on account tasks" ON public.task_attachments
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id AND public.owns_client(auth.uid(), t.client_id)
  )
);

-- OPPORTUNITY ATTACHMENTS
DROP POLICY IF EXISTS "Client owner can delete account opportunity attachments" ON public.opportunity_attachments;
CREATE POLICY "Client owner can delete account opportunity attachments" ON public.opportunity_attachments
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities o
    WHERE o.id = opportunity_attachments.opportunity_id
      AND public.owns_client(auth.uid(), o.client_id)
  )
);

-- CLIENT NOTES: owner can manage notes in the account
DROP POLICY IF EXISTS "Client owner can update account notes" ON public.client_notes;
CREATE POLICY "Client owner can update account notes" ON public.client_notes
FOR UPDATE TO authenticated
USING (public.owns_client(auth.uid(), client_id))
WITH CHECK (public.owns_client(auth.uid(), client_id));

DROP POLICY IF EXISTS "Client owner can delete account notes" ON public.client_notes;
CREATE POLICY "Client owner can delete account notes" ON public.client_notes
FOR DELETE TO authenticated
USING (public.owns_client(auth.uid(), client_id));

-- PROPOSALS
DROP POLICY IF EXISTS "Client owner can update account proposals" ON public.proposals;
CREATE POLICY "Client owner can update account proposals" ON public.proposals
FOR UPDATE TO authenticated
USING (public.owns_client(auth.uid(), client_id))
WITH CHECK (public.owns_client(auth.uid(), client_id));

-- PROSPECT DIAGNOSTICS
DROP POLICY IF EXISTS "Client owner can update account diagnostics" ON public.prospect_diagnostics;
CREATE POLICY "Client owner can update account diagnostics" ON public.prospect_diagnostics
FOR UPDATE TO authenticated
USING (public.owns_client(auth.uid(), client_id))
WITH CHECK (public.owns_client(auth.uid(), client_id));

-- CLIENT CAMPAIGNS
DROP POLICY IF EXISTS "Client owner can update account campaigns" ON public.client_campaigns;
CREATE POLICY "Client owner can update account campaigns" ON public.client_campaigns
FOR UPDATE TO authenticated
USING (public.owns_client(auth.uid(), client_id))
WITH CHECK (public.owns_client(auth.uid(), client_id));

DROP POLICY IF EXISTS "Client owner can delete account campaigns" ON public.client_campaigns;
CREATE POLICY "Client owner can delete account campaigns" ON public.client_campaigns
FOR DELETE TO authenticated
USING (public.owns_client(auth.uid(), client_id));