-- ============================================
-- CONTRACT TEMPLATES
-- ============================================
CREATE TABLE public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view contract templates"
  ON public.contract_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and pre_vendas can insert contract templates"
  ON public.contract_templates FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
    )
  );

CREATE POLICY "Admin and pre_vendas can update contract templates"
  ON public.contract_templates FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
  );

CREATE POLICY "Admin can delete contract templates"
  ON public.contract_templates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- CONTRACTS
-- ============================================
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  opportunity_id uuid NOT NULL,
  client_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  parent_contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  share_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  pdf_url text,
  sent_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contracts_status_check CHECK (status IN ('draft','sent','under_negotiation','approved','final','cancelled'))
);

CREATE INDEX idx_contracts_opportunity ON public.contracts(opportunity_id);
CREATE INDEX idx_contracts_client ON public.contracts(client_id);
CREATE INDEX idx_contracts_created_by ON public.contracts(created_by);
CREATE INDEX idx_contracts_parent ON public.contracts(parent_contract_id);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own contracts or admin/pre_vendas/gestor see all"
  ON public.contracts FOR SELECT TO authenticated
  USING (
    auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
  );

CREATE POLICY "Authenticated can insert contracts"
  ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owner or admin/pre_vendas can update contracts"
  ON public.contracts FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
  );

CREATE POLICY "Admin can delete contracts"
  ON public.contracts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- CONTRACT CLAUSE REVISIONS
-- ============================================
CREATE TABLE public.contract_clause_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  prospect_input text,
  attachment_url text,
  attachment_name text,
  extracted_changes jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending_extraction',
  notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  admin_summary text,
  negotiation_docx_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clause_revisions_status_check CHECK (status IN ('pending_extraction','pending_admin_review','reviewed','final_consolidated','cancelled'))
);

CREATE INDEX idx_clause_revisions_contract ON public.contract_clause_revisions(contract_id);

ALTER TABLE public.contract_clause_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible to contract owner and admin/pre_vendas/gestor"
  ON public.contract_clause_revisions FOR SELECT TO authenticated
  USING (
    auth.uid() = requested_by
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND c.created_by = auth.uid())
  );

CREATE POLICY "Owner can create clause revision"
  ON public.contract_clause_revisions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requested_by
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_id
        AND (c.created_by = auth.uid()
             OR public.has_role(auth.uid(), 'admin'::app_role)
             OR public.has_role(auth.uid(), 'pre_vendas'::app_role))
    )
  );

CREATE POLICY "Admin/pre_vendas or owner can update clause revision"
  ON public.contract_clause_revisions FOR UPDATE TO authenticated
  USING (
    auth.uid() = requested_by
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
  );

CREATE TRIGGER update_clause_revisions_updated_at
  BEFORE UPDATE ON public.contract_clause_revisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- CONTRACT CLAUSE DECISIONS
-- ============================================
CREATE TABLE public.contract_clause_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES public.contract_clause_revisions(id) ON DELETE CASCADE,
  clause_reference text NOT NULL,
  original_text text,
  proposed_change text NOT NULL,
  decision text,
  admin_comment text,
  counter_text text,
  decided_at timestamptz,
  decided_by uuid,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clause_decisions_decision_check CHECK (decision IS NULL OR decision IN ('accepted','rejected','counter_proposal'))
);

CREATE INDEX idx_clause_decisions_revision ON public.contract_clause_decisions(revision_id);

ALTER TABLE public.contract_clause_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Decisions follow revision visibility"
  ON public.contract_clause_decisions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contract_clause_revisions r
      WHERE r.id = revision_id
        AND (
          r.requested_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
          OR public.has_role(auth.uid(), 'gestor'::app_role)
        )
    )
  );

CREATE POLICY "Authenticated can insert clause decisions"
  ON public.contract_clause_decisions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contract_clause_revisions r
      WHERE r.id = revision_id
        AND (
          r.requested_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
        )
    )
  );

CREATE POLICY "Admin/pre_vendas can update clause decisions"
  ON public.contract_clause_decisions FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
  );

CREATE TRIGGER update_clause_decisions_updated_at
  BEFORE UPDATE ON public.contract_clause_decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- CONTRACT FILES
-- ============================================
CREATE TABLE public.contract_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  revision_id uuid REFERENCES public.contract_clause_revisions(id) ON DELETE SET NULL,
  kind text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  mime_type text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_files_kind_check CHECK (kind IN ('generated_pdf','negotiation_docx','final_pdf','prospect_attachment','other'))
);

CREATE INDEX idx_contract_files_contract ON public.contract_files(contract_id);

ALTER TABLE public.contract_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Files follow contract visibility"
  ON public.contract_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_id
        AND (
          c.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
          OR public.has_role(auth.uid(), 'gestor'::app_role)
        )
    )
  );

CREATE POLICY "Authenticated can insert contract files"
  ON public.contract_files FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_id
        AND (
          c.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
        )
    )
  );

CREATE POLICY "Admin can delete contract files"
  ON public.contract_files FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can read contract files in storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contracts');

CREATE POLICY "Authenticated can upload contract files in storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contracts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Authenticated can update own contract files in storage"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'contracts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admin can delete contract files in storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'contracts'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );