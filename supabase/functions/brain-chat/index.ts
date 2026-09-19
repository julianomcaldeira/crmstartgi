import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AIProvider = {
  label: string;
  apiKey: string;
  chatUrl: string;
  model: string;
};

// Resolve o provedor de IA. Prioriza a OpenCode Zen (OPENCODE_API_KEY) e,
// na ausência dela, usa o gateway da Lovable (LOVABLE_API_KEY). Também aceita
// um provedor OpenAI-compatível genérico via AI_API_KEY / AI_BASE_URL.
function resolveProvider(): AIProvider | null {
  const opencodeKey = Deno.env.get("OPENCODE_API_KEY");
  if (opencodeKey) {
    return {
      label: "OpenCode Zen",
      apiKey: opencodeKey,
      chatUrl:
        (Deno.env.get("BRAIN_BASE_URL") ?? "https://opencode.ai/zen/v1").replace(/\/$/, "") +
        "/chat/completions",
      model: Deno.env.get("BRAIN_MODEL") ?? "big-pickle",
    };
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    return {
      label: "Lovable AI",
      apiKey: lovableKey,
      chatUrl:
        (Deno.env.get("BRAIN_BASE_URL") ?? "https://ai.gateway.lovable.dev/v1").replace(/\/$/, "") +
        "/chat/completions",
      model: Deno.env.get("BRAIN_MODEL") ?? "google/gemini-2.5-flash",
    };
  }

  const genericKey = Deno.env.get("AI_API_KEY");
  if (genericKey) {
    const baseUrl = Deno.env.get("AI_BASE_URL");
    if (baseUrl) {
      return {
        label: "Custom",
        apiKey: genericKey,
        chatUrl: baseUrl.replace(/\/$/, "") + "/chat/completions",
        model: Deno.env.get("BRAIN_MODEL") ?? "gpt-4o-mini",
      };
    }
  }

  return null;
}

const SCHEMA_CATALOG = `
BANCO DE DADOS (PostgreSQL / Supabase) — sempre use nomes qualificados como public.tabela.

Principais tabelas e colunas:
- public.profiles(id, full_name, email, phone, avatar_url) — usuários do CRM.
- public.user_roles(user_id, role) — role do usuário ('admin' | 'vendedor').
- public.clients(id, cnpj, company_name, trade_name, email, phone, city, state, segment, company_size, share_capital, website) — clientes e prospects.
- public.contacts(id, client_id, name, role, email, phone, mobile, is_primary) — contatos dos clientes.
- public.opportunities(id, client_id, title, description, value, status, probability, expected_close_date, assigned_to, created_by, monthly_value, implementation_value, billing_type, product_id) — oportunidades. status típicos: lead, contacted, qualified, apresentacao, proposal, negotiation, won, lost.
- public.tasks(id, title, description, due_date, priority, status, assigned_to, client_id, opportunity_id, created_by, completed_at) — tarefas. status: pending, in_progress, completed, cancelled; priority: low, medium, high.
- public.goals(id, title, description, goal_type, target_value, current_value, start_date, end_date, assigned_to) — metas.
- public.proposals(id, opportunity_id, client_id, template_id, title, status, total_value, monthly_value, implementation_value, validity_days, sent_at, viewed_at, accepted_at, rejected_at, created_by) — propostas comerciais.
- public.contracts(id, template_id, opportunity_id, client_id, title, status, version, pdf_url, sent_at, finalized_at, created_by) — contratos.
- public.feiras(id, name, location, city, state, start_date, end_date, status, website) — feiras/eventos. status: planejada, confirmada, em_andamento, concluida, cancelada.
- public.campaigns(id, name, description, start_date, end_date, status) — campanhas.
- public.knowledge_base(id, title, content, category, type, url) — base de conhecimento.
- public.market_intelligence_searches(id, user_id, search_terms, total_value_12m, total_value_24m, ai_analysis, created_at) — pesquisas de mercado salvas.
- public.loss_reasons(id, description) — motivos de perda.
- public.pre_vendas_agenda(id, pre_vendas_user_id, title, start_datetime, end_datetime, location) — agenda de pré-vendas.

Ao precisar de colunas exatas de outras tabelas, consulte:
SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='NOME' ORDER BY ordinal_position;
Para relações: SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public';
`;

function buildSystemPrompt(): string {
  return `Você é o "Brain", o agente de inteligência artificial do CRM StartGI/ Evolua CRM.
Seu papel é responder QUALQUER pergunta do usuário sobre os dados do CRM, consultando a base de dados real.

${SCHEMA_CATALOG}

COMO RESPONDER:
- Você TEM acesso somente-leitura ao banco pela ferramenta "brain_query". USE-A sempre que a pergunta envolver dados, números, listas, contagens, clientes, oportunidades, tarefas, propostas, contratos, metas, feiras etc.
- Planeje consultas SQL de forma eficiente: faça agregações (COUNT, SUM, AVG), agrupe (GROUP BY) e ordene (ORDER BY) para entregar respostas diretas.
- Escreva SEMPRE SQL PostgreSQL válido e apenas com SELECT. Nunca tente escrever/alterar dados. Use nomes qualificados (public.tabela) e aspas simples para textos.
- Se não souber uma coluna, consulte information_schema.columns antes de assumir.
- Os dados retornados já respeitam a permissão (RLS) do usuário: você só vê o que ele pode ver. Nunca prometa acessar dados que não vieram.
- Se a consulta retornar vazio, diga claramente que não há registros e sugira o que cadastrar.

ESTILO:
- Português do Brasil, tom de parceiro de negócios, direto e objetivo.
- Use **markdown** com títulos curtos, listas e tabelas quando ajudar.
- Sempre que usar números, formate em padrão brasileiro (R$ 1.234,56 / 1.234).
- Baseie cada número nos resultados das consultas. NUNCA invente dados.
- Termine, quando fizer sentido, com uma seção curta "**Insights / Próximos passos**".`;
}

const BRAIN_TOOL = {
  type: "function",
  function: {
    name: "brain_query",
    description:
      "Executa uma consulta SQL somente-leitura (SELECT) na base do CRM e retorna as linhas em JSON. Use para obter dados reais antes de responder. Sempre limite o número de linhas e evite colunas muito grandes (ex.: content de knowledge_base).",
    parameters: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description:
            "Consulta PostgreSQL SELECT. Ex.: SELECT status, count(*) FROM public.opportunities GROUP BY status ORDER BY 2 DESC",
        },
        max_rows: {
          type: "integer",
          description: "Máximo de linhas retornadas (1 a 100). Padrão 30.",
        },
      },
      required: ["sql"],
      additionalProperties: false,
    },
  },
} as const;

type ChatMessage = {
  role: string;
  content: unknown;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
};

async function callGateway(
  provider: AIProvider,
  body: Record<string, unknown>,
): Promise<Response> {
  return await fetch(provider.chatUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function jsonError(
  status: number,
  message: string,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError(401, "Não autorizado");
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
      return jsonError(401, "Não autorizado");
    }

    const { messages: rawMessages } = await req.json();
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return jsonError(400, "messages é obrigatório");
    }

    const history: ChatMessage[] = rawMessages
      .filter(
        (m: any) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0,
      )
      .slice(-16)
      .map((m: any) => ({
        role: m.role,
        content: String(m.content).slice(0, 4000),
      }));

    const provider = resolveProvider();
    if (!provider) {
      return jsonError(
        500,
        "Nenhuma chave de IA configurada. Defina o segredo OPENCODE_API_KEY (OpenCode Zen) ou LOVABLE_API_KEY.",
      );
    }

    const systemPrompt = buildSystemPrompt();
    const working: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history,
    ];

    const toolResults: string[] = [];
    const MAX_ROUNDS = 4;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const resp = await callGateway(provider, {
        model: provider.model,
        messages: working,
        tools: [BRAIN_TOOL],
        tool_choice: "auto",
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          return jsonError(429, "Muitas requisições. Aguarde alguns segundos.");
        }
        if (resp.status === 402) {
          return jsonError(402, "Créditos de IA esgotados. Contate o administrador.");
        }
        const t = await resp.text();
        console.error("Brain gateway error:", resp.status, t);
        return jsonError(500, "Erro ao consultar a IA");
      }

      const data = await resp.json();
      const choice = data?.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        // Sem mais consultas: encerra a fase de coleta de dados.
        break;
      }

      working.push({
        role: "assistant",
        content: choice.content ?? null,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        const callId = call?.id ?? `call_${Math.random().toString(36).slice(2)}`;
        let toolPayload: unknown;
        try {
          const args = JSON.parse(call?.function?.arguments || "{}");
          const sql = String(args?.sql ?? "").trim();
          const maxRows = Number.isFinite(args?.max_rows)
            ? Math.max(1, Math.min(100, Number(args.max_rows)))
            : 40;

          if (!sql) throw new Error("SQL não informado");

          const { data: rows, error } = await authClient.rpc("brain_query", {
            p_sql: sql,
            p_max_rows: maxRows,
          });

          if (error) {
            toolPayload = { erro: error.message };
          } else if (!rows || (Array.isArray(rows) && rows.length === 0)) {
            toolPayload = { linhas: 0, dados: [] };
          } else {
            toolPayload = rows;
          }
        } catch (err) {
          toolPayload = {
            erro: err instanceof Error ? err.message : "Falha ao executar consulta",
          };
        }

        const serialized = JSON.stringify(toolPayload).slice(0, 12000);
        toolResults.push(serialized);

        working.push({
          role: "tool",
          tool_call_id: callId,
          name: "brain_query",
          content: serialized,
        });
      }
    }

    // Monta o contexto final com os dados coletados e faz a resposta em streaming.
    const dataContext = toolResults.length
      ? `DADOS OBTIDOS DO BANCO DE DADOS (autoritativos, use-os para responder):\n${toolResults
          .join("\n")
          .slice(0, 80000)}`
      : "Nenhuma consulta ao banco foi executada. Responda com seu conhecimento geral do CRM, sem inventar números.";

    const finalMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "system", content: dataContext },
      ...history,
    ];

    const finalResp = await callGateway(provider, {
      model: provider.model,
      stream: true,
      messages: finalMessages,
    });

    if (!finalResp.ok) {
      if (finalResp.status === 429) {
        return jsonError(429, "Muitas requisições. Aguarde alguns segundos.");
      }
      if (finalResp.status === 402) {
        return jsonError(402, "Créditos de IA esgotados. Contate o administrador.");
      }
      const t = await finalResp.text();
      console.error("Brain final gateway error:", finalResp.status, t);
      return jsonError(500, "Erro ao gerar resposta");
    }

    return new Response(finalResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("brain-chat error:", e);
    return jsonError(
      500,
      e instanceof Error ? e.message : "Erro desconhecido",
    );
  }
});
