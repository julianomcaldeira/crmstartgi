-- Restrict proposals visibility: vendedor sees only own; admin, pre_vendas and gestor see all
DROP POLICY IF EXISTS "Authenticated view proposals" ON public.proposals;

CREATE POLICY "View own proposals or admin pre_vendas gestor"
ON public.proposals FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);

-- Align proposal_events / proposal_views to also include pre_vendas
DROP POLICY IF EXISTS "Owners and admins read events" ON public.proposal_events;
CREATE POLICY "Read events if can see proposal"
ON public.proposal_events FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.proposals p
  WHERE p.id = proposal_events.proposal_id
    AND (
      p.created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
      OR public.has_role(auth.uid(), 'gestor'::app_role)
    )
));

DROP POLICY IF EXISTS "Owners and admins read views" ON public.proposal_views;
CREATE POLICY "Read views if can see proposal"
ON public.proposal_views FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.proposals p
  WHERE p.id = proposal_views.proposal_id
    AND (
      p.created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
      OR public.has_role(auth.uid(), 'gestor'::app_role)
    )
));