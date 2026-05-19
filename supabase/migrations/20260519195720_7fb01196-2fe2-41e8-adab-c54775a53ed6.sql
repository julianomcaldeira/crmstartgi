
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS sections jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS theme jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tracking jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_proposals_template_key ON public.proposals(template_key);

CREATE TABLE IF NOT EXISTS public.commercial_proposal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  product text NOT NULL,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_proposal_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cpt_select" ON public.commercial_proposal_templates;
CREATE POLICY "cpt_select" ON public.commercial_proposal_templates
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'gestor'::app_role)
    OR public.has_role(auth.uid(),'pre_vendas'::app_role)
  );

DROP POLICY IF EXISTS "cpt_admin_write" ON public.commercial_proposal_templates;
CREATE POLICY "cpt_admin_write" ON public.commercial_proposal_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP TRIGGER IF EXISTS trg_cpt_updated_at ON public.commercial_proposal_templates;
CREATE TRIGGER trg_cpt_updated_at
  BEFORE UPDATE ON public.commercial_proposal_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP FUNCTION IF EXISTS public.get_proposal_by_token(uuid);
CREATE OR REPLACE FUNCTION public.get_proposal_by_token(_token uuid)
RETURNS TABLE(
  id uuid, title text, blocks jsonb, variables jsonb, status text,
  total_value numeric, monthly_value numeric, implementation_value numeric,
  validity_days integer, created_at timestamptz, sent_at timestamptz,
  client_company text, expires_at timestamptz,
  template_key text, sections jsonb, theme jsonb, tracking jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.title, p.blocks, p.variables, p.status,
         p.total_value, p.monthly_value, p.implementation_value,
         p.validity_days, p.created_at, p.sent_at,
         c.company_name, p.expires_at,
         p.template_key, p.sections, p.theme, p.tracking
  FROM public.proposals p
  LEFT JOIN public.clients c ON c.id = p.client_id
  WHERE p.share_token = _token
    AND (p.expires_at IS NULL OR p.expires_at > now())
  LIMIT 1
$$;

INSERT INTO public.commercial_proposal_templates (key, name, product, sections, theme, is_active)
VALUES (
  'iganhei_v1',
  'Proposta i-Ganhei (Premium)',
  'i-Ganhei',
  '[
    {"id":"section-capa","type":"capa","enabled":true,"title":"Capa","content":{"eyebrow":"Proposta Comercial","headline":"Solução i-Ganhei para {{empresa_cliente}}","subheadline":"Inteligência de mercado e gestão de oportunidades para o setor público."}},
    {"id":"section-termo","type":"termo","enabled":true,"title":"Termo de Confidencialidade","content":{"body":"Este documento contém informações estratégicas e confidenciais destinadas exclusivamente a {{empresa_cliente}}. Sua reprodução, divulgação ou utilização por terceiros sem autorização formal da StartGi é expressamente proibida."}},
    {"id":"section-startgi","type":"cards","enabled":true,"title":"A StartGi","content":{"intro":"Quem somos e por que somos referência.","cards":[{"icon":"Building2","title":"+12 anos de mercado","text":"Especialistas em inteligência comercial para o setor público."},{"icon":"Users","title":"+500 clientes","text":"Empresas de todos os portes confiam na StartGi."},{"icon":"Award","title":"Reconhecimento","text":"Tecnologia premiada e suporte consultivo dedicado."}]}},
    {"id":"section-contexto","type":"cards","enabled":true,"title":"Contexto e Desafios do Cliente","content":{"intro":"Mapeamos os principais desafios enfrentados por empresas que atuam com vendas governamentais.","cards":[{"icon":"AlertTriangle","title":"Volume de oportunidades","text":"Milhares de editais publicados diariamente em diferentes portais."},{"icon":"Clock","title":"Tempo de resposta","text":"Janela curta entre publicação e disputa exige agilidade."},{"icon":"TrendingDown","title":"Conversão baixa","text":"Falta de inteligência reduz taxa de sucesso em licitações."}]}},
    {"id":"section-objetivos","type":"list","enabled":true,"title":"Objetivos da Solução","content":{"items":[{"icon":"Target","title":"Centralizar inteligência","text":"Reunir todas as oportunidades em um único radar."},{"icon":"Zap","title":"Aumentar conversão","text":"Priorizar editais com maior fit estratégico."},{"icon":"BarChart3","title":"Medir resultados","text":"Métricas claras para decisão executiva."}]}},
    {"id":"section-sobre-iganhei","type":"list","enabled":true,"title":"Sobre o i-Ganhei","content":{"intro":"A plataforma de inteligência comercial pública mais completa do mercado.","items":[{"icon":"Radar","title":"Radar de Leads","text":"Monitoramento contínuo de oportunidades públicas."},{"icon":"BrainCircuit","title":"IA aplicada","text":"Análise automática de fit e probabilidade de vitória."},{"icon":"LineChart","title":"Dashboards executivos","text":"Visão consolidada de pipeline e performance."}]}},
    {"id":"section-estrutura","type":"cards","enabled":true,"title":"Estrutura Operacional da Solução","content":{"cards":[{"icon":"Database","title":"Coleta","text":"Integração nativa com PNCP e principais portais."},{"icon":"Filter","title":"Qualificação","text":"Filtros inteligentes por CNAE, região e valor."},{"icon":"Bell","title":"Distribuição","text":"Alertas em tempo real para o time comercial."}]}},
    {"id":"section-beneficios","type":"benefits","enabled":true,"title":"Benefícios Esperados","content":{"items":[{"title":"Mais oportunidades qualificadas","text":"Aumento médio de 3x no volume de leads relevantes."},{"title":"Redução de tempo operacional","text":"Até 70% menos horas em busca manual."},{"title":"Decisões baseadas em dados","text":"Indicadores em tempo real para a liderança."},{"title":"Crescimento sustentável","text":"Pipeline previsível e escalável."}]}},
    {"id":"section-implantacao","type":"timeline","enabled":true,"title":"Implantação e Acompanhamento","content":{"steps":[{"title":"Kick-off","text":"Alinhamento de objetivos e configuração inicial."},{"title":"Treinamento","text":"Capacitação do time em até 2 semanas."},{"title":"Go-live","text":"Operação assistida nos primeiros 30 dias."},{"title":"Acompanhamento","text":"Reuniões mensais de sucesso do cliente."}]}},
    {"id":"section-investimento","type":"pricing","enabled":true,"title":"Investimento","content":{"cards":[{"label":"Implantação da Solução","value_key":"valor_implantacao","note":"Pagamento único."},{"label":"Plataforma i-Ganhei","value_key":"valor_mensalidade","note":"Mensalidade recorrente.","monthly":true}]}},
    {"id":"section-validade","type":"validade","enabled":true,"title":"Validade da Proposta","content":{"body":"Esta proposta é válida por {{validade_proposta}} dias a partir de {{data_proposta}}. Vigência inicial sugerida: {{vigencia_inicial}}. Forma de pagamento: {{forma_pagamento}}."}},
    {"id":"section-consideracoes","type":"final","enabled":true,"title":"Considerações Finais","content":{"headline":"Pronto para evoluir com a StartGi?","body":"Estamos à disposição para apresentar a solução em detalhes e desenhar o plano ideal para {{empresa_cliente}}.","next_steps":["Validação interna da proposta","Reunião de aprofundamento","Assinatura do contrato","Kick-off do projeto"]}}
  ]'::jsonb,
  '{"primary":"#4F5BFF","primaryDark":"#2434D8","accent":"#00E68A","bg":"#FFFFFF","surface":"#F5F7FA","text":"#1F2937","muted":"#6B7280"}'::jsonb,
  true
)
ON CONFLICT (key) DO UPDATE SET
  sections = EXCLUDED.sections,
  theme = EXCLUDED.theme,
  updated_at = now();
