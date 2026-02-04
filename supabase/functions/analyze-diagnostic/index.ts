import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Answer {
  questionId: string;
  questionText: string;
  selectedOptions: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientName, role, answers } = await req.json() as {
      clientName: string;
      role: string;
      answers: Answer[];
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the context from answers
    const answersContext = answers.map((a, i) => 
      `${i + 1}. ${a.questionText}\n   Resposta: ${a.selectedOptions.join(", ")}`
    ).join("\n\n");

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

    const systemPrompt = `Você é um consultor especialista em vendas para o governo e licitações públicas. Você representa o i-Ganhei, a plataforma mais completa de gestão de vendas governamentais impulsionada por IA.

Sua missão é analisar as respostas do diagnóstico e:
1. Identificar os problemas e dores do prospect com base nas respostas
2. Mostrar como o i-Ganhei resolve cada problema identificado
3. Ser específico e conectar cada problema com uma solução concreta

${knowledgeBase}

IMPORTANTE:
- Seja direto e objetivo
- Use emojis para tornar a leitura mais agradável
- Estruture em seções claras
- Destaque os benefícios quantitativos quando possível
- Personalize a análise com base nas respostas específicas
- Use linguagem persuasiva mas profissional
- Foque nos problemas que realmente apareceram nas respostas`;

    const prompt = `Analise o diagnóstico de licitações para a empresa "${clientName}".

**Perfil do Contato:** ${role}

**Respostas do Diagnóstico:**
${answersContext}

---

Com base nas respostas acima, gere uma análise estruturada com:

## 🔍 Problemas Identificados
Liste os principais problemas/dores que você identificou com base nas respostas.

## 💡 Como o i-Ganhei Resolve
Para cada problema, explique como o i-Ganhei resolve de forma específica.

## 🎯 Benefícios Esperados
Liste os benefícios concretos que a empresa pode esperar ao adotar o i-Ganhei.

## 📈 Próximos Passos Recomendados
Sugira os próximos passos para avançar com a solução.`;

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
