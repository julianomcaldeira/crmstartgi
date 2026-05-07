
ALTER TABLE public.email_invitation_log
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS reply_token UUID,
  ADD COLUMN IF NOT EXISTS from_email TEXT,
  ADD COLUMN IF NOT EXISTS in_reply_to TEXT,
  ADD COLUMN IF NOT EXISTS thread_id TEXT,
  ADD COLUMN IF NOT EXISTS parent_log_id UUID REFERENCES public.email_invitation_log(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

ALTER TABLE public.email_invitation_log
  ADD CONSTRAINT email_invitation_log_direction_check
  CHECK (direction IN ('outbound','inbound'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_inv_reply_token
  ON public.email_invitation_log(reply_token)
  WHERE reply_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_inv_thread ON public.email_invitation_log(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_inv_parent ON public.email_invitation_log(parent_log_id);
CREATE INDEX IF NOT EXISTS idx_email_inv_direction ON public.email_invitation_log(direction);
