
-- 1) RPC para buscar dono de cliente por CNPJ (bypassa RLS de profiles)
CREATE OR REPLACE FUNCTION public.get_client_owner_by_cnpj(_cnpj text)
RETURNS TABLE(client_id uuid, company_name text, trade_name text, owner_name text, owner_email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.company_name, c.trade_name, p.full_name, p.email
  FROM public.clients c
  LEFT JOIN public.profiles p ON p.id = c.created_by
  WHERE c.cnpj = _cnpj
  LIMIT 1
$$;

-- 2) Templates de proposta
CREATE TABLE public.proposal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text DEFAULT 'geral',
  thumbnail_color text DEFAULT '#22c55e',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.proposal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view templates"
  ON public.proposal_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin and pre_vendas insert templates"
  ON public.proposal_templates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pre_vendas'::app_role)));
CREATE POLICY "Admin and pre_vendas update templates"
  ON public.proposal_templates FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pre_vendas'::app_role));
CREATE POLICY "Admin and pre_vendas delete templates"
  ON public.proposal_templates FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pre_vendas'::app_role));

CREATE TRIGGER update_proposal_templates_updated_at
  BEFORE UPDATE ON public.proposal_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Propostas geradas
CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL,
  client_id uuid NOT NULL,
  template_id uuid REFERENCES public.proposal_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  share_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  total_value numeric DEFAULT 0,
  monthly_value numeric DEFAULT 0,
  implementation_value numeric DEFAULT 0,
  validity_days integer DEFAULT 30,
  pdf_url text,
  sent_at timestamptz,
  viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_proposals_opportunity ON public.proposals(opportunity_id);
CREATE INDEX idx_proposals_client ON public.proposals(client_id);
CREATE INDEX idx_proposals_share_token ON public.proposals(share_token);

CREATE POLICY "Authenticated view proposals"
  ON public.proposals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert proposals"
  ON public.proposals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner admin pre_vendas update proposals"
  ON public.proposals FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pre_vendas'::app_role));
CREATE POLICY "Owner admin pre_vendas delete proposals"
  ON public.proposals FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pre_vendas'::app_role));

CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) RPC público para visualizar proposta por token (sem auth)
CREATE OR REPLACE FUNCTION public.get_proposal_by_token(_token uuid)
RETURNS TABLE(
  id uuid, title text, blocks jsonb, variables jsonb, status text,
  total_value numeric, monthly_value numeric, implementation_value numeric,
  validity_days integer, created_at timestamptz, sent_at timestamptz,
  client_company text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.title, p.blocks, p.variables, p.status,
         p.total_value, p.monthly_value, p.implementation_value,
         p.validity_days, p.created_at, p.sent_at,
         c.company_name
  FROM public.proposals p
  LEFT JOIN public.clients c ON c.id = p.client_id
  WHERE p.share_token = _token
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_proposal_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_owner_by_cnpj(text) TO authenticated;

-- 5) Registrar visualização pública da proposta
CREATE OR REPLACE FUNCTION public.register_proposal_view(_token uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.proposals
     SET view_count = view_count + 1,
         viewed_at = COALESCE(viewed_at, now())
   WHERE share_token = _token;
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_proposal_view(uuid) TO anon, authenticated;

-- 6) Storage bucket para PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('proposals', 'proposals', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read proposals"
  ON storage.objects FOR SELECT USING (bucket_id = 'proposals');
CREATE POLICY "Authenticated upload proposals"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proposals' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owner update proposals files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'proposals' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owner delete proposals files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'proposals' AND auth.uid()::text = (storage.foldername(name))[1]);
