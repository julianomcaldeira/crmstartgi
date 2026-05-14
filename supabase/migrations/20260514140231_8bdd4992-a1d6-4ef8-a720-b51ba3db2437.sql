ALTER TABLE public.proposal_recipients
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.proposal_events
  DROP CONSTRAINT IF EXISTS proposal_events_event_type_check;

ALTER TABLE public.proposal_events
  ADD CONSTRAINT proposal_events_event_type_check
  CHECK (event_type = ANY (ARRAY['open','section_view','cta_click','download','share','pricing_view','heartbeat','invite_sent']));