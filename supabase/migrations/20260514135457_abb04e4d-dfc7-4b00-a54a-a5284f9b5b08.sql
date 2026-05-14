
CREATE TABLE public.proposal_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text NOT NULL,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_value numeric DEFAULT 0,
  monthly_value numeric DEFAULT 0,
  implementation_value numeric DEFAULT 0,
  validity_days integer DEFAULT 30,
  snapshot_reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, version)
);

CREATE INDEX idx_proposal_versions_proposal ON public.proposal_versions(proposal_id, version DESC);

ALTER TABLE public.proposal_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View versions if can see proposal"
ON public.proposal_versions FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id
    AND (p.created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
      OR public.has_role(auth.uid(), 'gestor'::app_role)))
);

CREATE POLICY "Insert versions if can edit proposal"
ON public.proposal_versions FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by AND EXISTS (
    SELECT 1 FROM public.proposals p WHERE p.id = proposal_id
      AND (p.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'pre_vendas'::app_role))
  )
);

CREATE POLICY "Admin can delete versions"
ON public.proposal_versions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
