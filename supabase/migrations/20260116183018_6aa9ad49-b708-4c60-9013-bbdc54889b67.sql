-- Criar tabela para indicadores do fundo
CREATE TABLE public.indicadores_fundo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_referencia DATE NOT NULL,
  vendas NUMERIC DEFAULT 0,
  leads_novos_qualificados INTEGER DEFAULT 0,
  propostas_enviadas INTEGER DEFAULT 0,
  leads_negociacao INTEGER DEFAULT 0,
  contratos_assinados INTEGER DEFAULT 0,
  venda_na_base NUMERIC DEFAULT 0,
  gasto_midia NUMERIC DEFAULT 0,
  custo_comercial NUMERIC DEFAULT 0,
  cac NUMERIC GENERATED ALWAYS AS (
    CASE 
      WHEN contratos_assinados > 0 THEN (gasto_midia + custo_comercial) / contratos_assinados
      ELSE 0
    END
  ) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(mes_referencia)
);

-- Habilitar RLS
ALTER TABLE public.indicadores_fundo ENABLE ROW LEVEL SECURITY;

-- Política para admin visualizar
CREATE POLICY "Admins can view indicadores_fundo"
ON public.indicadores_fundo
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Política para admin inserir
CREATE POLICY "Admins can insert indicadores_fundo"
ON public.indicadores_fundo
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Política para admin atualizar
CREATE POLICY "Admins can update indicadores_fundo"
ON public.indicadores_fundo
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Política para admin deletar
CREATE POLICY "Admins can delete indicadores_fundo"
ON public.indicadores_fundo
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_indicadores_fundo_updated_at
BEFORE UPDATE ON public.indicadores_fundo
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();