import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketData {
  totalValue12Months: number;
  totalValue24Months: number;
  totalQuantity12Months: number;
  totalQuantity24Months: number;
  competitors: Array<{
    name: string;
    cnpj: string;
    totalValue: number;
    contractCount: number;
    period: string;
  }>;
  sampleContracts: Array<{
    title: string;
    value: number;
    date: string;
    organ: string;
    link: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { marketData, searchTerms } = await req.json();

    if (!marketData) {
      return new Response(
        JSON.stringify({ error: 'marketData é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "Configuração de IA não encontrada" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = marketData as MarketData;
    const terms = (searchTerms as string[]) || [];

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    // Construir prompt estruturado
    const prompt = `
Você é um especialista em vendas B2B para o setor público brasileiro. Analise os dados de mercado abaixo e forneça uma análise estratégica completa.

## PRODUTOS/SERVIÇOS PESQUISADOS:
${terms.join(', ')}

## DADOS DE MERCADO - ÚLTIMOS 12 MESES:
- Valor Total de Compras: ${formatCurrency(data.totalValue12Months)}
- Quantidade de Contratos: ${data.totalQuantity12Months}

## DADOS DE MERCADO - ÚLTIMOS 24 MESES:
- Valor Total de Compras: ${formatCurrency(data.totalValue24Months)}
- Quantidade de Contratos: ${data.totalQuantity24Months}

## PRINCIPAIS CONCORRENTES (${data.competitors.length} identificados):
${data.competitors.slice(0, 10).map((c, i) => 
  `${i + 1}. ${c.name} (CNPJ: ${c.cnpj})
   - Valor Total: ${formatCurrency(c.totalValue)}
   - Contratos: ${c.contractCount}
   - Período: ${c.period}`
).join('\n')}

## EXEMPLOS DE EDITAIS/CONTRATOS:
${data.sampleContracts.slice(0, 3).map((c, i) => 
  `${i + 1}. ${c.title}
   - Valor: ${formatCurrency(c.value)}
   - Data: ${c.date}
   - Órgão: ${c.organ}`
).join('\n')}

---

Por favor, forneça sua análise seguindo EXATAMENTE esta estrutura:

## 📊 RESUMO DO MERCADO
[Faça um resumo executivo do potencial de mercado para estes produtos/serviços no setor público. Inclua insights sobre tendências de crescimento ou retração baseado na comparação 12m vs 24m.]

## 💰 OPORTUNIDADE DE NEGÓCIO
[Analise o valor potencial de mercado e oportunidades identificadas. Destaque os órgãos que mais compram e os valores médios de contrato.]

## 🏆 ANÁLISE DA CONCORRÊNCIA
[Analise os principais concorrentes identificados. Destaque pontos fortes e fracos observáveis, market share estimado e estratégias aparentes.]

## 🎯 ESTRATÉGIA DE ABORDAGEM
[Forneça recomendações específicas de como o vendedor pode abordar este mercado, incluindo:
- Órgãos prioritários para prospectar
- Diferenciação competitiva sugerida
- Timing ideal (baseado em ciclos de compra observados)
- Argumentos de venda relevantes]

## ⚠️ PONTOS DE ATENÇÃO
[Liste riscos, barreiras de entrada e cuidados que o vendedor deve ter ao abordar este mercado.]

## ✅ PRÓXIMOS PASSOS RECOMENDADOS
[Liste 3-5 ações concretas e imediatas que o vendedor deve tomar para capitalizar nestas oportunidades.]
`;

    const systemPrompt = `Você é um consultor especialista em vendas B2B para o setor público brasileiro, com profundo conhecimento em licitações, pregões eletrônicos e contratações governamentais. 

Sua análise deve ser:
- PRÁTICA e ACIONÁVEL - foque em insights que o vendedor pode usar imediatamente
- ESPECÍFICA - evite generalidades, seja direto e objetivo
- BASEADA EM DADOS - referencie os números apresentados
- ORIENTADA A RESULTADOS - foque em como converter estas informações em vendas

Responda sempre em português brasileiro, de forma profissional mas acessível.`;

    console.log('Enviando para análise de IA...');

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro na API de IA:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao processar análise de IA" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || aiData.content || '';

    if (!analysis) {
      return new Response(
        JSON.stringify({ error: "Não foi possível gerar a análise" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Análise gerada com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        searchTerms: terms
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função analyze-market-intelligence:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro ao analisar dados de mercado'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
