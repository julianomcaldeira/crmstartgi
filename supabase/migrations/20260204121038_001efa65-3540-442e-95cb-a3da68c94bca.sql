-- Tabela para armazenar diagnósticos de prospects
CREATE TABLE public.prospect_diagnostics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  contact_role TEXT NOT NULL, -- 'analista', 'gerente', 'diretor'
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed'
  ai_analysis TEXT, -- Análise gerada pela IA
  pdf_url TEXT, -- URL do PDF gerado
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Tabela para armazenar as respostas do diagnóstico
CREATE TABLE public.prospect_diagnostic_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id UUID NOT NULL REFERENCES public.prospect_diagnostics(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL, -- Identificador único da pergunta (ex: 'analista_q1')
  question_text TEXT NOT NULL, -- Texto da pergunta
  selected_options TEXT[] NOT NULL DEFAULT '{}', -- Opções selecionadas (múltipla escolha)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_prospect_diagnostics_client_id ON public.prospect_diagnostics(client_id);
CREATE INDEX idx_prospect_diagnostics_created_by ON public.prospect_diagnostics(created_by);
CREATE INDEX idx_prospect_diagnostic_answers_diagnostic_id ON public.prospect_diagnostic_answers(diagnostic_id);

-- Enable RLS
ALTER TABLE public.prospect_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_diagnostic_answers ENABLE ROW LEVEL SECURITY;

-- Policies para prospect_diagnostics
CREATE POLICY "Users can view all diagnostics" 
ON public.prospect_diagnostics 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create diagnostics" 
ON public.prospect_diagnostics 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own diagnostics" 
ON public.prospect_diagnostics 
FOR UPDATE 
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins and gestores can delete diagnostics" 
ON public.prospect_diagnostics 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role) OR auth.uid() = created_by);

-- Policies para prospect_diagnostic_answers
CREATE POLICY "Users can view diagnostic answers" 
ON public.prospect_diagnostic_answers 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.prospect_diagnostics 
  WHERE id = prospect_diagnostic_answers.diagnostic_id
));

CREATE POLICY "Users can create diagnostic answers" 
ON public.prospect_diagnostic_answers 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.prospect_diagnostics 
  WHERE id = prospect_diagnostic_answers.diagnostic_id 
  AND created_by = auth.uid()
));

CREATE POLICY "Users can update diagnostic answers" 
ON public.prospect_diagnostic_answers 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.prospect_diagnostics 
  WHERE id = prospect_diagnostic_answers.diagnostic_id 
  AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
));

CREATE POLICY "Users can delete diagnostic answers" 
ON public.prospect_diagnostic_answers 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.prospect_diagnostics 
  WHERE id = prospect_diagnostic_answers.diagnostic_id 
  AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_prospect_diagnostics_updated_at
BEFORE UPDATE ON public.prospect_diagnostics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();