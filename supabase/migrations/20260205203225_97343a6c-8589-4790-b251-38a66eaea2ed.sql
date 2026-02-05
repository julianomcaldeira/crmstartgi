-- Create table for diagnostic roles
CREATE TABLE public.diagnostic_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  icon text DEFAULT 'FileSearch',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- Create table for diagnostic questions
CREATE TABLE public.diagnostic_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES public.diagnostic_roles(id) ON DELETE CASCADE NOT NULL,
  question_text text NOT NULL,
  multi_select boolean DEFAULT false,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- Create table for question options
CREATE TABLE public.diagnostic_question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES public.diagnostic_questions(id) ON DELETE CASCADE NOT NULL,
  option_text text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.diagnostic_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_question_options ENABLE ROW LEVEL SECURITY;

-- RLS Policies for diagnostic_roles
CREATE POLICY "Everyone can view active roles"
ON public.diagnostic_roles FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage roles"
ON public.diagnostic_roles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for diagnostic_questions
CREATE POLICY "Everyone can view active questions"
ON public.diagnostic_questions FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage questions"
ON public.diagnostic_questions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for diagnostic_question_options
CREATE POLICY "Everyone can view options"
ON public.diagnostic_question_options FOR SELECT
USING (true);

CREATE POLICY "Admins can manage options"
ON public.diagnostic_question_options FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default roles from current static data
INSERT INTO public.diagnostic_roles (role_key, label, description, icon, display_order) VALUES
('analista', 'Analista de Licitação', 'Para analistas que trabalham diretamente com editais', 'FileSearch', 1),
('gerente', 'Gerente / Coordenador', 'Para gerentes e coordenadores da área', 'Users', 2),
('diretor', 'Diretor / Executivo', 'Para diretores e executivos', 'Briefcase', 3);

-- Insert default questions for Analista
WITH analista_role AS (SELECT id FROM public.diagnostic_roles WHERE role_key = 'analista')
INSERT INTO public.diagnostic_questions (role_id, question_text, multi_select, display_order) VALUES
((SELECT id FROM analista_role), 'Quantas pessoas trabalham diretamente com licitações na sua empresa?', false, 1),
((SELECT id FROM analista_role), 'Em média, quantas horas por semana você gasta buscando e filtrando editais?', false, 2),
((SELECT id FROM analista_role), 'Hoje, como normalmente chegam os avisos de licitação pra você?', true, 3),
((SELECT id FROM analista_role), 'Quando chega um edital novo, como você costuma começar a análise?', false, 4),
((SELECT id FROM analista_role), 'Você sente que consegue analisar todos os editais com a calma que gostaria?', false, 5),
((SELECT id FROM analista_role), 'Quando você precisa lembrar de uma licitação parecida com outra antiga, isso é…', false, 6),
((SELECT id FROM analista_role), 'E a parte de documentação… como vocês costumam lidar com isso?', false, 7),
((SELECT id FROM analista_role), 'Hoje, se alguém te pedir um atestado ou uma CND específica…', false, 8),
((SELECT id FROM analista_role), 'Durante o pregão, você costuma ter tudo o que precisa à mão?', false, 9),
((SELECT id FROM analista_role), 'Se outra pessoa tivesse que assumir sua operação amanhã…', false, 10);

-- Insert default questions for Gerente
WITH gerente_role AS (SELECT id FROM public.diagnostic_roles WHERE role_key = 'gerente')
INSERT INTO public.diagnostic_questions (role_id, question_text, multi_select, display_order) VALUES
((SELECT id FROM gerente_role), 'Quantas pessoas você gerencia diretamente na área de licitações?', false, 1),
((SELECT id FROM gerente_role), 'Quanto tempo por semana você gasta cobrando status e consolidando informações?', false, 2),
((SELECT id FROM gerente_role), 'Hoje você consegue saber facilmente em que pé estão as licitações?', false, 3),
((SELECT id FROM gerente_role), 'A forma de analisar edital é parecida entre os analistas?', false, 4),
((SELECT id FROM gerente_role), 'A decisão de entrar numa licitação costuma ser baseada em quê?', true, 5),
((SELECT id FROM gerente_role), 'Depois que uma licitação acaba, vocês conseguem entender claramente por que ganharam ou perderam?', false, 6),
((SELECT id FROM gerente_role), 'Hoje você sente que a operação escala bem ou começa a virar caos quando aumenta o volume?', false, 7),
((SELECT id FROM gerente_role), 'A área depende muito de algumas pessoas específicas?', false, 8);

-- Insert default questions for Diretor
WITH diretor_role AS (SELECT id FROM public.diagnostic_roles WHERE role_key = 'diretor')
INSERT INTO public.diagnostic_questions (role_id, question_text, multi_select, display_order) VALUES
((SELECT id FROM diretor_role), 'Quantas pessoas trabalham na área de licitações/vendas ao governo?', false, 1),
((SELECT id FROM diretor_role), 'Qual a representatividade das vendas ao governo no faturamento total?', false, 2),
((SELECT id FROM diretor_role), 'Hoje, quando você olha para vendas ao governo, você vê…', false, 3),
((SELECT id FROM diretor_role), 'Você confia nos números que recebe da área?', false, 4),
((SELECT id FROM diretor_role), 'Se a empresa decidisse investir mais em vendas ao governo, a operação aguentaria?', false, 5),
((SELECT id FROM diretor_role), 'O resultado das licitações hoje depende mais de sistema ou de pessoas?', false, 6),
((SELECT id FROM diretor_role), 'A tecnologia atual ajuda mais a registrar o que aconteceu ou a decidir melhor o que fazer?', false, 7);