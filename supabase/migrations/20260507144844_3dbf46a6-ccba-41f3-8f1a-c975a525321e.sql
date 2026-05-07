
-- Tokens Zoho por usuário
CREATE TABLE public.zoho_user_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  data_center text NOT NULL DEFAULT 'com',
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  zoho_account_id text,
  zoho_email text,
  primary_calendar_id text,
  scopes text,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zoho_user_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own zoho tokens"
ON public.zoho_user_tokens FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own zoho tokens"
ON public.zoho_user_tokens FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own zoho tokens"
ON public.zoho_user_tokens FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own zoho tokens"
ON public.zoho_user_tokens FOR DELETE TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_zoho_tokens_updated
BEFORE UPDATE ON public.zoho_user_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Log de convites
CREATE TABLE public.email_invitation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_event_id uuid,
  opportunity_id uuid,
  sent_by uuid NOT NULL,
  recipients text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'pending',
  zoho_message_id text,
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_invitation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own invitations or admin/gestor"
ON public.email_invitation_log FOR SELECT TO authenticated
USING (
  auth.uid() = sent_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);

CREATE POLICY "Authenticated insert invitations"
ON public.email_invitation_log FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sent_by);

CREATE INDEX idx_email_inv_event ON public.email_invitation_log(agenda_event_id);
CREATE INDEX idx_email_inv_opp ON public.email_invitation_log(opportunity_id);

-- Campos extras na agenda
ALTER TABLE public.pre_vendas_agenda
  ADD COLUMN IF NOT EXISTS attendees text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS opportunity_id uuid,
  ADD COLUMN IF NOT EXISTS zoho_event_id text,
  ADD COLUMN IF NOT EXISTS zoho_etag text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'not_synced';

CREATE INDEX IF NOT EXISTS idx_pv_agenda_zoho ON public.pre_vendas_agenda(zoho_event_id) WHERE zoho_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pv_agenda_opp ON public.pre_vendas_agenda(opportunity_id) WHERE opportunity_id IS NOT NULL;
