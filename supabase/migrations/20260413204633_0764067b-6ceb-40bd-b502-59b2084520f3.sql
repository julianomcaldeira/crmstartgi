
-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active campaigns" ON public.campaigns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage campaigns" ON public.campaigns
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campaign task templates
CREATE TABLE public.campaign_task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'Ligação',
  priority TEXT NOT NULL DEFAULT 'media',
  day_offset INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view task templates" ON public.campaign_task_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage task templates" ON public.campaign_task_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Client campaigns (linking prospects to campaigns)
CREATE TABLE public.client_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  linked_by UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, campaign_id)
);

ALTER TABLE public.client_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view client campaigns" ON public.client_campaigns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can link own clients to campaigns" ON public.client_campaigns
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = linked_by);

CREATE POLICY "Users can update own client campaigns" ON public.client_campaigns
  FOR UPDATE TO authenticated USING (
    auth.uid() = linked_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role)
  );

CREATE POLICY "Admins can delete client campaigns" ON public.client_campaigns
  FOR DELETE TO authenticated USING (
    auth.uid() = linked_by OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TRIGGER update_client_campaigns_updated_at
  BEFORE UPDATE ON public.client_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
