-- Criar tabela para armazenar leads captados do radar
CREATE TABLE IF NOT EXISTS public.radar_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj TEXT NOT NULL,
  company_name TEXT NOT NULL,
  trade_name TEXT,
  source TEXT NOT NULL, -- 'bndes', 'sicaf', 'portal_compras'
  source_data JSONB, -- dados completos da fonte
  email TEXT,
  phone TEXT,
  city TEXT,
  state TEXT,
  segment TEXT,
  contract_value NUMERIC,
  contract_date DATE,
  status TEXT DEFAULT 'novo', -- 'novo', 'contatado', 'qualificado', 'descartado'
  assigned_to UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_radar_leads_cnpj ON public.radar_leads(cnpj);
CREATE INDEX IF NOT EXISTS idx_radar_leads_source ON public.radar_leads(source);
CREATE INDEX IF NOT EXISTS idx_radar_leads_status ON public.radar_leads(status);
CREATE INDEX IF NOT EXISTS idx_radar_leads_assigned_to ON public.radar_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_radar_leads_created_at ON public.radar_leads(created_at);

-- Tabela para controlar sincronizações
CREATE TABLE IF NOT EXISTS public.radar_sync_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  sync_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sync_completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL, -- 'running', 'completed', 'failed'
  leads_found INTEGER DEFAULT 0,
  leads_new INTEGER DEFAULT 0,
  leads_updated INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para updated_at
CREATE TRIGGER update_radar_leads_updated_at
  BEFORE UPDATE ON public.radar_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.radar_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_sync_history ENABLE ROW LEVEL SECURITY;

-- Vendedores veem leads não atribuídos ou atribuídos a eles
CREATE POLICY "Vendedores podem ver seus leads ou leads não atribuídos"
  ON public.radar_leads
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.user_roles WHERE role = 'vendedor'::app_role
    )
    AND (assigned_to IS NULL OR assigned_to = auth.uid())
  );

-- Gestores e admins veem todos os leads
CREATE POLICY "Gestores e admins podem ver todos os leads"
  ON public.radar_leads
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.user_roles 
      WHERE role IN ('gestor'::app_role, 'admin'::app_role)
    )
  );

-- Vendedores podem atribuir leads não atribuídos a si mesmos
CREATE POLICY "Vendedores podem se atribuir leads não atribuídos"
  ON public.radar_leads
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.user_roles WHERE role = 'vendedor'::app_role
    )
    AND assigned_to IS NULL
  )
  WITH CHECK (assigned_to = auth.uid());

-- Vendedores podem atualizar seus próprios leads
CREATE POLICY "Vendedores podem atualizar seus leads"
  ON public.radar_leads
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.user_roles WHERE role = 'vendedor'::app_role
    )
    AND assigned_to = auth.uid()
  );

-- Gestores e admins podem atualizar todos os leads
CREATE POLICY "Gestores e admins podem atualizar todos os leads"
  ON public.radar_leads
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.user_roles 
      WHERE role IN ('gestor'::app_role, 'admin'::app_role)
    )
  );

-- Apenas sistema pode inserir leads (via edge function)
CREATE POLICY "Sistema pode inserir leads"
  ON public.radar_leads
  FOR INSERT
  WITH CHECK (true);

-- Admins podem ver histórico de sincronização
CREATE POLICY "Admins podem ver histórico de sincronização"
  ON public.radar_sync_history
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
    )
  );

-- Sistema pode inserir histórico
CREATE POLICY "Sistema pode inserir histórico"
  ON public.radar_sync_history
  FOR INSERT
  WITH CHECK (true);