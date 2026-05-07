ALTER TABLE public.email_invitation_log ADD COLUMN IF NOT EXISTS client_id uuid;
CREATE INDEX IF NOT EXISTS idx_email_invitation_log_client ON public.email_invitation_log(client_id);
CREATE INDEX IF NOT EXISTS idx_email_invitation_log_opportunity ON public.email_invitation_log(opportunity_id);