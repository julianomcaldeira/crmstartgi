
-- Fix 1: opportunity_attachments SELECT - scope to ownership
DROP POLICY IF EXISTS "Authenticated users can view attachments of opportunities" ON public.opportunity_attachments;
CREATE POLICY "View attachments scoped to opportunity ownership"
ON public.opportunity_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities o
    WHERE o.id = opportunity_attachments.opportunity_id
      AND (
        o.created_by = auth.uid()
        OR o.assigned_to = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'gestor'::app_role)
        OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
      )
  )
);

-- Fix 2: goals SELECT - allow gestor
DROP POLICY IF EXISTS "Users can view goals" ON public.goals;
CREATE POLICY "Users can view goals"
ON public.goals
FOR SELECT
TO authenticated
USING (
  auth.uid() = assigned_to
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);

-- Fix 3: proposal_events INSERT - scope to proposal ownership for authenticated clients.
-- (Public visitor tracking goes through record_proposal_event SECURITY DEFINER and bypasses RLS.)
CREATE POLICY "Insert proposal events scoped to ownership"
ON public.proposal_events
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_events.proposal_id
      AND (
        p.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
        OR public.has_role(auth.uid(), 'gestor'::app_role)
      )
  )
);
