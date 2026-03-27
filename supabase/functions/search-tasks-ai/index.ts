import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const _authHeader = req.headers.get('Authorization');
    if (!_authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const _authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: _authHeader } } });
    const { data: { user }, error: _authError } = await _authClient.auth.getUser();
    if (_authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { query, tasks } = await req.json();
    
    if (!query || !tasks || !Array.isArray(tasks)) {
      return new Response(
        JSON.stringify({ error: "Query and tasks array are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build a compact summary of tasks for AI analysis
    const taskSummaries = tasks.map((t: any, i: number) => {
      const parts = [
        `[${i}] ${t.title || "Sem título"}`,
        t.description ? `Desc: ${t.description.substring(0, 200)}` : "",
        t.client_name ? `Cliente: ${t.client_name}` : "",
        t.task_type ? `Tipo: ${t.task_type}` : "",
        t.status ? `Status: ${t.status}` : "",
        t.notes ? `Notas: ${t.notes.substring(0, 150)}` : "",
      ].filter(Boolean);
      return parts.join(" | ");
    }).join("\n");

    const systemPrompt = `Você é um assistente de busca inteligente para um CRM de vendas. O usuário vai pesquisar tarefas usando linguagem natural. Você deve analisar a consulta e retornar os índices das tarefas que correspondem à busca.

Considere:
- Sinônimos e variações (ex: "ligação" = "telefonema" = "call")
- Menções parciais ou contextuais
- Intenções implícitas (ex: "tarefas urgentes" = prioridade alta ou atrasadas)
- Nomes de clientes, tipos de atividade, descrições
- Busca por conteúdo dentro das notas e descrições

Retorne APENAS os índices das tarefas relevantes.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Tarefas disponíveis:\n${taskSummaries}\n\nBusca: "${query}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_matching_tasks",
              description: "Return the indices of tasks that match the search query",
              parameters: {
                type: "object",
                properties: {
                  matching_indices: {
                    type: "array",
                    items: { type: "integer" },
                    description: "Array of task indices (0-based) that match the search query"
                  },
                  explanation: {
                    type: "string",
                    description: "Brief explanation of why these tasks match (in Portuguese)"
                  }
                },
                required: ["matching_indices", "explanation"],
                additionalProperties: false,
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_matching_tasks" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos na configuração do workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(
        JSON.stringify({ matching_ids: [], explanation: "Não foi possível processar a busca." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);
    const matchingIds = (result.matching_indices || [])
      .filter((idx: number) => idx >= 0 && idx < tasks.length)
      .map((idx: number) => tasks[idx].id);

    return new Response(
      JSON.stringify({ 
        matching_ids: matchingIds, 
        explanation: result.explanation || "" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("search-tasks-ai error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
