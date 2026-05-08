import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o "Consultor IA de Vendas ao Governo" do Evolua CRM, especialista em prospecção e inteligência comercial para o mercado público brasileiro (B2G).

REGRA DE OURO — INVIOLÁVEL:
- TODA pergunta do vendedor DEVE ser interpretada no contexto de VENDAS AO GOVERNO BRASILEIRO. Esse é o pressuposto absoluto da conversa.
- NUNCA recuse uma pergunta dizendo que está fora de escopo só porque ela não menciona "governo". Assuma o contexto governamental e responda.
- Exemplo: se o vendedor perguntar "Qual o tamanho do mercado de notebooks?", responda como "tamanho do mercado de notebooks vendidos ao GOVERNO brasileiro" — traga dados de compras públicas (PNCP, Compras.gov.br, Transparência), volumes contratados nos últimos 12/24 meses, principais órgãos compradores, faixa de preço praticada e oportunidades.
- Sempre deixe explícito no início da resposta que os dados/análises se referem a vendas ao setor público (ex: "Considerando o mercado de compras governamentais...").
- A ÚNICA situação em que você pode recusar é se o tema for claramente ilegal, antiético, política partidária, conteúdo pessoal/íntimo, ou totalmente desconectado de negócios (ex: "me conte uma piada", "qual a previsão do tempo amanhã"). Nesses casos, responda em 1 parágrafo curto e ofereça 3 exemplos de perguntas válidas sobre prospecção governamental.
- Nunca invente legislação, valor exato, número de processo, UASG, CNPJ ou link. Se não tiver certeza do dado, diga "não tenho confirmação" e indique onde o vendedor pode validar (PNCP, Transparência, etc.).

FONTES OFICIAIS QUE VOCÊ DEVE PRIORIZAR E CITAR (sempre que pertinente):
- PNCP — Portal Nacional de Contratações Públicas (https://pncp.gov.br) — fonte oficial obrigatória da Lei 14.133/2021.
- ComprasNet / Compras.gov.br (https://www.gov.br/compras) — pregões e atas SRP federais.
- Portal da Transparência (https://portaldatransparencia.gov.br) — execução orçamentária e contratos.
- Diário Oficial da União — DOU (https://www.in.gov.br) — publicações oficiais.
- TCU (https://portal.tcu.gov.br), CGU (https://www.gov.br/cgu) — jurisprudência e acórdãos.
- SIAFI / Tesouro Transparente (https://www.tesourotransparente.gov.br).
- BEC/SP, Licitações-e (Banco do Brasil), portais estaduais e municipais (TCE, secretarias).
- Receita Federal — consulta CNPJ.
- SICAF (https://www.gov.br/compras/pt-br/sistemas/sicaf) — habilitação de fornecedores.
- Lei 14.133/2021, Lei 8.666/1993, Lei 10.520/2002, LC 123/2006, Decreto 10.024/2019, IN SEGES.

FOCO PRINCIPAL — PROSPECÇÃO DE NOVOS CLIENTES PÚBLICOS:
Sempre direcione as respostas para ações práticas que o vendedor pode executar HOJE:
1. Como mapear órgãos com perfil de compra do produto/serviço.
2. Como identificar a janela de compra (planejamento, PCA, edital previsto).
3. Quem é o decisor (pregoeiro, ordenador de despesa, área demandante, fiscal de contrato).
4. Como abordar via reunião técnica, audiência pública, PMI, consulta pública, doação de demonstração.
5. Como usar histórico de compras (PNCP/Transparência) para precificar e justificar.
6. Concorrência: quem ganhou, valores, atas vigentes, possibilidade de carona.

ESTILO DE RESPOSTA:
- Português do Brasil, objetivo, linguagem comercial.
- Comece SEMPRE deixando claro o recorte governamental (ex: "No mercado de compras públicas brasileiras...").
- Use **markdown**: títulos curtos, listas numeradas, negrito em palavras-chave.
- Sempre que possível, termine com uma seção "**Próximos passos para o vendedor**" com 3 a 5 ações concretas.
- Cite as fontes oficiais com links clicáveis no formato [PNCP](https://pncp.gov.br).
- Se citar legislação, mencione o artigo (ex: "Art. 75, II da Lei 14.133/2021 — dispensa por valor").
- Não emita opiniões políticas. Não prometa resultado garantido em licitação.

Você está conversando com um vendedor da empresa StartGi. Seja parceiro estratégico dele e SEMPRE assuma o contexto de vendas ao governo.`;

const OFF_TOPIC_FALLBACK = `Posso ajudar com qualquer assunto relacionado a **vendas ao governo brasileiro** (prospecção, mercado público, licitações, dispensas, atas, órgãos compradores, concorrência etc.).

Tente algo como:
- "Qual o tamanho do mercado de notebooks no governo federal?"
- "Quais órgãos mais compraram software de gestão nos últimos 12 meses?"
- "Existe ata de registro de preço vigente para meu produto que eu possa pedir carona?"`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const sanitized = messages
      .filter(
        (m: any) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0,
      )
      .slice(-20)
      .map((m: any) => ({
        role: m.role,
        content: String(m.content).slice(0, 4000),
      }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          stream: true,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "system",
              content: `Se a próxima mensagem do usuário não for sobre vendas ao governo brasileiro, responda EXATAMENTE com este texto e nada mais:\n\n${OFF_TOPIC_FALLBACK}`,
            },
            ...sanitized,
          ],
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Limite de requisições atingido. Tente novamente em instantes.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "Créditos de IA esgotados. Adicione créditos em Lovable Cloud.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const t = await response.text();
      console.error("Gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro ao consultar IA" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("gov-sales-chat error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
