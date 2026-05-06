
-- Table for pre-sales agenda requests
CREATE TABLE public.pre_vendas_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  requested_by uuid NOT NULL,
  assigned_pre_vendas uuid,
  desired_datetime timestamptz,
  scheduled_datetime timestamptz,
  meeting_link text,
  status text NOT NULL DEFAULT 'solicitada',
  feedback text,
  quality_rating integer,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pvr_requested_by ON public.pre_vendas_requests(requested_by);
CREATE INDEX idx_pvr_assigned ON public.pre_vendas_requests(assigned_pre_vendas);
CREATE INDEX idx_pvr_status ON public.pre_vendas_requests(status);

ALTER TABLE public.pre_vendas_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PV requests select"
ON public.pre_vendas_requests FOR SELECT TO authenticated
USING (
  auth.uid() = requested_by
  OR auth.uid() = assigned_pre_vendas
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'pre_vendas'::app_role)
);

CREATE POLICY "PV requests insert"
ON public.pre_vendas_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "PV requests update"
ON public.pre_vendas_requests FOR UPDATE TO authenticated
USING (
  auth.uid() = requested_by
  OR auth.uid() = assigned_pre_vendas
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'pre_vendas'::app_role)
);

CREATE POLICY "PV requests delete"
ON public.pre_vendas_requests FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = requested_by);

CREATE TRIGGER trg_pvr_updated_at
BEFORE UPDATE ON public.pre_vendas_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend update permissions for pre_vendas role on opportunities (propostas/anexos)
CREATE POLICY "Pre vendas can update opportunities"
ON public.opportunities FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'pre_vendas'::app_role));

-- Allow pre_vendas to upload attachments (already permissive on insert via uploaded_by)
-- Allow pre_vendas to view tasks of any vendedor
CREATE POLICY "Pre vendas can view all tasks"
ON public.tasks FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'pre_vendas'::app_role));

-- Allow pre_vendas to create tasks (insert policy already requires auth.uid() = created_by, OK)

-- Allow pre_vendas to view all profiles (for assignment dropdowns)
CREATE POLICY "Pre vendas can view profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'pre_vendas'::app_role));
