
CREATE TABLE public.proposal_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  role text,
  status text NOT NULL DEFAULT 'pending',
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  total_time_ms bigint NOT NULL DEFAULT 0,
  engagement_score integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_recipients_proposal ON public.proposal_recipients(proposal_id);

ALTER TABLE public.proposal_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View recipients if can see proposal"
ON public.proposal_recipients FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id
    AND (p.created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'pre_vendas'::app_role)
      OR public.has_role(auth.uid(), 'gestor'::app_role)))
);

CREATE POLICY "Insert recipients if can edit proposal"
ON public.proposal_recipients FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by AND EXISTS (
    SELECT 1 FROM public.proposals p WHERE p.id = proposal_id
      AND (p.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'pre_vendas'::app_role))
  )
);

CREATE POLICY "Update recipients if can edit proposal"
ON public.proposal_recipients FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id
    AND (p.created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'pre_vendas'::app_role)))
);

CREATE POLICY "Admin can delete recipients"
ON public.proposal_recipients FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.created_by = auth.uid())
);

CREATE TRIGGER tr_proposal_recipients_updated_at
BEFORE UPDATE ON public.proposal_recipients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update tracking RPC to also aggregate per recipient.
CREATE OR REPLACE FUNCTION public.record_proposal_event(
  _token uuid, _visitor_id uuid, _event_type text,
  _section_id text DEFAULT NULL::text, _duration_ms integer DEFAULT 0,
  _metadata jsonb DEFAULT '{}'::jsonb, _ip inet DEFAULT NULL::inet,
  _user_agent text DEFAULT NULL::text, _country text DEFAULT NULL::text,
  _city text DEFAULT NULL::text, _device text DEFAULT NULL::text,
  _browser text DEFAULT NULL::text, _recipient_id uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_proposal_id uuid;
  v_expires_at timestamptz;
  v_score int := 0;
  v_unique int := 0;
  v_total_time bigint := 0;
  v_view_count int := 0;
  v_pricing_seen boolean := false;
  v_r_score int := 0;
  v_r_total bigint := 0;
  v_r_views int := 0;
  v_r_pricing boolean := false;
BEGIN
  SELECT id, expires_at INTO v_proposal_id, v_expires_at
  FROM public.proposals WHERE share_token = _token;

  IF v_proposal_id IS NULL THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN RAISE EXCEPTION 'Proposta expirada'; END IF;
  IF _event_type NOT IN ('open','section_view','cta_click','download','share','pricing_view','heartbeat') THEN
    RAISE EXCEPTION 'Tipo de evento inválido';
  END IF;

  -- Validate recipient belongs to proposal
  IF _recipient_id IS NOT NULL THEN
    PERFORM 1 FROM public.proposal_recipients
      WHERE id = _recipient_id AND proposal_id = v_proposal_id;
    IF NOT FOUND THEN _recipient_id := NULL; END IF;
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

  -- Per-recipient aggregates
  IF _recipient_id IS NOT NULL THEN
    SELECT COALESCE(SUM(CASE WHEN event_type = 'open' THEN 1 ELSE 0 END),0)::int,
           COALESCE(SUM(duration_ms),0)
      INTO v_r_views, v_r_total
    FROM public.proposal_events
    WHERE proposal_id = v_proposal_id AND recipient_id = _recipient_id;
    -- Add heartbeat current event time (heartbeats not stored)
    IF _event_type = 'heartbeat' THEN v_r_total := v_r_total + COALESCE(_duration_ms,0); END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.proposal_events
      WHERE proposal_id = v_proposal_id AND recipient_id = _recipient_id AND event_type = 'pricing_view'
    ) INTO v_r_pricing;

    IF v_r_views > 0 THEN v_r_score := v_r_score + 10; END IF;
    IF v_r_views > 3 THEN v_r_score := v_r_score + 20; END IF;
    IF v_r_total > 300000 THEN v_r_score := v_r_score + 30; END IF;
    IF v_r_pricing THEN v_r_score := v_r_score + 40; END IF;

    UPDATE public.proposal_recipients
       SET view_count = v_r_views,
           total_time_ms = v_r_total,
           engagement_score = v_r_score,
           last_viewed_at = now(),
           status = CASE WHEN status = 'pending' THEN 'viewed' ELSE status END
     WHERE id = _recipient_id;
  END IF;

  RETURN jsonb_build_object(
    'proposal_id', v_proposal_id,
    'engagement_score', v_score,
    'unique_visitors', v_unique,
    'total_time_ms', v_total_time,
    'recipient_id', _recipient_id,
    'recipient_score', v_r_score
  );
END;
$function$;
