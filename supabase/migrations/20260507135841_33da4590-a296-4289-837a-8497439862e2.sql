CREATE TABLE public.pre_vendas_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_vendas_user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  location text,
  start_datetime timestamptz NOT NULL,
  end_datetime timestamptz NOT NULL,
  is_private boolean NOT NULL DEFAULT false,
  related_request_id uuid REFERENCES public.pre_vendas_requests(id) ON DELETE SET NULL,
  color text DEFAULT '#22c55e',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pv_agenda_user ON public.pre_vendas_agenda(pre_vendas_user_id);
CREATE INDEX idx_pv_agenda_start ON public.pre_vendas_agenda(start_datetime);

ALTER TABLE public.pre_vendas_agenda ENABLE ROW LEVEL SECURITY;

-- SELECT: non-private visible to all authenticated; private only to owner/admin
CREATE POLICY "Agenda select"
ON public.pre_vendas_agenda FOR SELECT
TO authenticated
USING (
  is_private = false
  OR pre_vendas_user_id = auth.uid()
  OR created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- INSERT: pre_vendas or admin
CREATE POLICY "Agenda insert"
ON public.pre_vendas_agenda FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (has_role(auth.uid(), 'pre_vendas'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- UPDATE: owner or admin
CREATE POLICY "Agenda update"
ON public.pre_vendas_agenda FOR UPDATE
TO authenticated
USING (
  pre_vendas_user_id = auth.uid()
  OR created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- DELETE: owner or admin
CREATE POLICY "Agenda delete"
ON public.pre_vendas_agenda FOR DELETE
TO authenticated
USING (
  pre_vendas_user_id = auth.uid()
  OR created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE TRIGGER update_pv_agenda_updated_at
BEFORE UPDATE ON public.pre_vendas_agenda
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();