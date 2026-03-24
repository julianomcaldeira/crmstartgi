import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Answer {
  questionId: string;
  questionText: string;
  selectedOptions: string[];
  observation?: string;
}

interface EstimatedLosses {
  daily: number;
  monthly: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const _authHeader = req.headers.get('Authorization');
    if (!_authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const _authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: _authHeader } } });
    const { data: _claimsData, error: _authError } = await _authClient.auth.getClaims(_authHeader.replace('Bearer ', ''));
    if (_authError || !_claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { clientName, role, roleId, answers, estimatedLosses } = await req.json() as {
      clientName: string;
      role: string;
      roleId: string;
      answers: Answer[];
      estimatedLosses: EstimatedLosses;
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the context from answers including observations
    const answersContext = answers.map((a, i) => {
      let text = `${i + 1}. ${a.questionText}\n   Resposta: ${a.selectedOptions.join(", ")}`;
      if (a.observation) {
        text += `\n   Observação do Vendedor: "${a.observation}"`;
      }
      return text;
    }).join("\n\n");

    // Problem-solution knowledge base based on i-Ganhei differentials
    const knowledgeBase = `
## Conhecimento sobre o i-Ganhei

### Captação de Oportunidades
- Múltiplas fontes integradas: Comprasnet, portais estaduais, municipais, Diário Oficial
- Alcance estratégico: visão completa do mercado
- +300% mais oportunidades identificadas

### Inteligência Artificial
- Filtragem inteligente automática elimina 80-90% dos editais irrelevantes
- Machine learning treinado especificamente para cada negócio
- Equipe foca em vender, não em filtrar editais

### Geração de Peças
- Geração automática de recursos, impugnações e pedidos de esclarecimento
- Qualidade jurídica e contexto específico de cada licitação
- Redução de 90% no tempo de produção

### Processo Completo
- Único no mercado: ciclo completo de vendas governamentais
- Da captação ao pós-venda
- Gestão completa de contratos e empenhos

### Customização
- Totalmente customizado para cada cliente
- Regras de negócio, fluxos de aprovação e critérios configurados sob medida
- O sistema trabalha do jeito do cliente

### Impacto no Negócio
- Redução de até 70% no esforço operacional
- Foco 100% em oportunidades qualificadas
- Visibilidade total do pipeline governamental
- ROI mensurável em vendas públicas
`;

    const systemPrompt = `Você é um consultor especialista em vendas governamentais e licitações. Analise as respostas do diagnóstico e gere um relatório DIRETO, PROFISSIONAL e com SUBSTÂNCIA.

REGRAS:
- Seja objetivo mas não superficial - cada ponto precisa ter contexto suficiente para convencer
- Identifique 3-5 problemas principais com explicação clara do impacto no negócio
- Conecte cada problema com uma solução específica do i-Ganhei
- Use dados e percentuais quando possível para quantificar impactos
- NÃO use emojis
- IMPORTANTE: Considere as observações do vendedor como insights valiosos do campo
- Adapte a linguagem ao cargo do interlocutor (mais estratégico para Diretores, mais operacional para Analistas)

${knowledgeBase}`;

    const prompt = `Empresa: "${clientName}" | Cargo do Interlocutor: ${role}

RESPOSTAS DO DIAGNÓSTICO:
${answersContext}

Gere um relatório de diagnóstico comercial seguindo EXATAMENTE este formato:

## DIAGNÓSTICO DA OPERAÇÃO

Resumo em 2-3 frases do cenário atual identificado, destacando o nível de maturidade e principais desafios.

## PROBLEMAS IDENTIFICADOS

### 1. [Nome do Problema]
**Situação atual:** Descrição objetiva do problema identificado nas respostas (2 linhas)
**Impacto no negócio:** Qual o custo/consequência desse problema (1-2 linhas)

### 2. [Nome do Problema]
**Situação atual:** Descrição objetiva do problema (2 linhas)
**Impacto no negócio:** Consequência mensurável (1-2 linhas)

### 3. [Nome do Problema]
**Situação atual:** Descrição objetiva do problema (2 linhas)
**Impacto no negócio:** Consequência mensurável (1-2 linhas)

## SOLUÇÕES i-GANHEI

Para cada problema identificado, apresente a solução específica:

| Problema | Solução i-Ganhei | Resultado Esperado |
|----------|------------------|-------------------|
| [Problema 1] | [Funcionalidade específica] | [Ganho quantificável] |
| [Problema 2] | [Funcionalidade específica] | [Ganho quantificável] |
| [Problema 3] | [Funcionalidade específica] | [Ganho quantificável] |

## GANHOS PROJETADOS

- **Eficiência Operacional:** [Estimativa de redução de tempo/esforço em %]
- **Aumento de Oportunidades:** [Estimativa de ganho em captação]
- **ROI Esperado:** [Prazo estimado para retorno do investimento]

## RECOMENDAÇÃO

Conclusão em 2-3 frases com a recomendação principal e próximo passo sugerido, adaptada ao cargo do interlocutor.`;

    console.log("Calling Lovable AI Gateway for diagnostic analysis...");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Entre em contato com o administrador." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content;

    if (!analysis) {
      throw new Error("No analysis generated");
    }

    console.log("Diagnostic analysis generated successfully");

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-diagnostic function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao analisar diagnóstico" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
