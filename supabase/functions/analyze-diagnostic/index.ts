import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const systemPrompt = `Você é um consultor objetivo e direto em vendas governamentais. Analise as respostas e gere um relatório CURTO e IMPACTANTE.

REGRAS:
- Seja EXTREMAMENTE objetivo e conciso
- NO MÁXIMO 3 problemas principais identificados
- Para cada problema, UMA solução específica do i-Ganhei
- Use frases curtas e diretas
- NÃO use emojis no texto
- NÃO repita informações
- Foque apenas nos problemas REAIS identificados nas respostas
- IMPORTANTE: Quando o vendedor incluir observações, considere essas percepções comerciais na análise. As observações do vendedor trazem contexto do campo que é valioso.

${knowledgeBase}`;

    const prompt = `Empresa: "${clientName}" | Cargo: ${role}

Respostas:
${answersContext}

Gere um relatório OBJETIVO com exatamente este formato:

PROBLEMAS IDENTIFICADOS
• [Problema 1 em 1 linha]
• [Problema 2 em 1 linha]  
• [Problema 3 em 1 linha - se houver]

SOLUÇÕES i-GANHEI
• [Para problema 1]: [Solução em 1 linha]
• [Para problema 2]: [Solução em 1 linha]
• [Para problema 3]: [Solução em 1 linha - se houver]

IMPACTO ESPERADO
• [Resultado 1 com número/percentual]
• [Resultado 2 com número/percentual]
• [Resultado 3 com número/percentual]

PRÓXIMO PASSO
[Uma única ação recomendada em 1 linha]`;

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
