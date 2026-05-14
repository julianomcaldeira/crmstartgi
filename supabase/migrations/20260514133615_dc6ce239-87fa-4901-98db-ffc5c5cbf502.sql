
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS engagement_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_visitors integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_time_ms bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.proposal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  visitor_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('open','section_view','cta_click','download','share','pricing_view','heartbeat')),
  section_id text,
  duration_ms integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip inet,
  user_agent text,
  country text,
  city text,
  device text,
  browser text,
  recipient_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposal_events_proposal ON public.proposal_events(proposal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposal_events_visitor ON public.proposal_events(proposal_id, visitor_id);

ALTER TABLE public.proposal_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and admins read events" ON public.proposal_events;
CREATE POLICY "Owners and admins read events"
ON public.proposal_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_events.proposal_id
      AND (
        p.created_by = auth.uid()
        OR public.has_role(auth.uid(),'admin')
        OR public.has_role(auth.uid(),'gestor')
      )
  )
);

CREATE TABLE IF NOT EXISTS public.proposal_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  visitor_id uuid NOT NULL,
  first_view_at timestamptz NOT NULL DEFAULT now(),
  last_view_at timestamptz NOT NULL DEFAULT now(),
  view_count integer NOT NULL DEFAULT 1,
  total_time_ms bigint NOT NULL DEFAULT 0,
  country text,
  city text,
  device text,
  browser text,
  UNIQUE (proposal_id, visitor_id)
);

ALTER TABLE public.proposal_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and admins read views" ON public.proposal_views;
CREATE POLICY "Owners and admins read views"
ON public.proposal_views FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_views.proposal_id
      AND (
        p.created_by = auth.uid()
        OR public.has_role(auth.uid(),'admin')
        OR public.has_role(auth.uid(),'gestor')
      )
  )
);

DROP FUNCTION IF EXISTS public.get_proposal_by_token(uuid);
CREATE FUNCTION public.get_proposal_by_token(_token uuid)
 RETURNS TABLE(id uuid, title text, blocks jsonb, variables jsonb, status text, total_value numeric, monthly_value numeric, implementation_value numeric, validity_days integer, created_at timestamp with time zone, sent_at timestamp with time zone, client_company text, expires_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, p.title, p.blocks, p.variables, p.status,
         p.total_value, p.monthly_value, p.implementation_value,
         p.validity_days, p.created_at, p.sent_at,
         c.company_name, p.expires_at
  FROM public.proposals p
  LEFT JOIN public.clients c ON c.id = p.client_id
  WHERE p.share_token = _token
    AND (p.expires_at IS NULL OR p.expires_at > now())
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.record_proposal_event(
  _token uuid,
  _visitor_id uuid,
  _event_type text,
  _section_id text DEFAULT NULL,
  _duration_ms integer DEFAULT 0,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _ip inet DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _country text DEFAULT NULL,
  _city text DEFAULT NULL,
  _device text DEFAULT NULL,
  _browser text DEFAULT NULL,
  _recipient_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal_id uuid;
  v_expires_at timestamptz;
  v_score int := 0;
  v_unique int := 0;
  v_total_time bigint := 0;
  v_view_count int := 0;
  v_pricing_seen boolean := false;
BEGIN
  SELECT id, expires_at INTO v_proposal_id, v_expires_at
  FROM public.proposals WHERE share_token = _token;

  IF v_proposal_id IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;
  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RAISE EXCEPTION 'Proposta expirada';
  END IF;
  IF _event_type NOT IN ('open','section_view','cta_click','download','share','pricing_view','heartbeat') THEN
    RAISE EXCEPTION 'Tipo de evento inválido';
  END IF;

  IF _event_type <> 'heartbeat' THEN
    INSERT INTO public.proposal_events
      (proposal_id, visitor_id, event_type, section_id, duration_ms, metadata, ip, user_agent, country, city, device, browser, recipient_id)
    VALUES
      (v_proposal_id, _visitor_id, _event_type, _section_id, COALESCE(_duration_ms,0), COALESCE(_metadata,'{}'::jsonb),
       _ip, _user_agent, _country, _city, _device, _browser, _recipient_id);
  END IF;

  INSERT INTO public.proposal_views (proposal_id, visitor_id, first_view_at, last_view_at, view_count, total_time_ms, country, city, device, browser)
  VALUES (v_proposal_id, _visitor_id, now(), now(),
          CASE WHEN _event_type = 'open' THEN 1 ELSE 0 END,
          COALESCE(_duration_ms,0), _country, _city, _device, _browser)
  ON CONFLICT (proposal_id, visitor_id) DO UPDATE SET
    last_view_at = now(),
    view_count = proposal_views.view_count + CASE WHEN _event_type = 'open' THEN 1 ELSE 0 END,
    total_time_ms = proposal_views.total_time_ms + COALESCE(_duration_ms,0),
    country = COALESCE(EXCLUDED.country, proposal_views.country),
    city = COALESCE(EXCLUDED.city, proposal_views.city),
    device = COALESCE(EXCLUDED.device, proposal_views.device),
    browser = COALESCE(EXCLUDED.browser, proposal_views.browser);

  SELECT COUNT(*)::int, COALESCE(SUM(total_time_ms),0), COALESCE(SUM(view_count),0)
    INTO v_unique, v_total_time, v_view_count
  FROM public.proposal_views WHERE proposal_id = v_proposal_id;

  SELECT EXISTS (
    SELECT 1 FROM public.proposal_events
    WHERE proposal_id = v_proposal_id AND event_type = 'pricing_view'
  ) INTO v_pricing_seen;

  IF v_view_count > 0 THEN v_score := v_score + 10; END IF;
  IF v_view_count > 3 THEN v_score := v_score + 20; END IF;
  IF v_total_time > 300000 THEN v_score := v_score + 30; END IF;
  IF v_pricing_seen THEN v_score := v_score + 40; END IF;

  UPDATE public.proposals
     SET unique_visitors = v_unique,
         total_time_ms = v_total_time,
         view_count = v_view_count,
         engagement_score = v_score,
         viewed_at = COALESCE(viewed_at, now()),
         status = CASE WHEN status = 'sent' AND _event_type = 'open' THEN 'viewed' ELSE status END
   WHERE id = v_proposal_id;

  RETURN jsonb_build_object(
    'proposal_id', v_proposal_id,
    'engagement_score', v_score,
    'unique_visitors', v_unique,
    'total_time_ms', v_total_time
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_proposal_event(uuid,uuid,text,text,integer,jsonb,inet,text,text,text,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_proposal_event(uuid,uuid,text,text,integer,jsonb,inet,text,text,text,text,text,uuid) TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.proposal_events;
