import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { canAccessRevision, forbidden } from "../_shared/contract-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedChange {
  clause_reference: string;
  original_text: string;
  proposed_change: string;
  rationale?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { revision_id } = await req.json();
    if (!revision_id) {
      return new Response(JSON.stringify({ error: "revision_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: revision, error: revErr } = await admin
      .from("contract_clause_revisions")
      .select("id, contract_id, prospect_input, attachment_url")
      .eq("id", revision_id)
      .single();
    if (revErr || !revision) throw new Error("Revisão não encontrada");

    const { data: contract } = await admin
      .from("contracts")
      .select("id, title, blocks")
      .eq("id", revision.contract_id)
      .single();

    const contractText = JSON.stringify(contract?.blocks || [], null, 2);
    const prospectInput = revision.prospect_input || "";

    const systemPrompt = `Você é um analista jurídico especialista em contratos comerciais B2B em português do Brasil.
Sua tarefa: comparar o CONTRATO ORIGINAL com as CONSIDERAÇÕES DO PROSPECT e identificar, cláusula por cláusula, todas as mudanças que o prospect está solicitando.
Para cada mudança, retorne:
- clause_reference: identificação curta da cláusula (ex.: "Cláusula 3.2 - Prazo de pagamento")
- original_text: trecho relevante do contrato original (resumido)
- proposed_change: o que o prospect quer mudar (claro e objetivo)
- rationale: motivo declarado pelo prospect (se houver)
Seja exaustivo. Não invente mudanças que o prospect não solicitou.`;

    const userPrompt = `=== CONTRATO ORIGINAL (estrutura JSON dos blocos) ===\n${contractText}\n\n=== CONSIDERAÇÕES DO PROSPECT ===\n${prospectInput}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "register_changes",
            description: "Registra a lista de mudanças solicitadas",
            parameters: {
              type: "object",
              properties: {
                changes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      clause_reference: { type: "string" },
                      original_text: { type: "string" },
                      proposed_change: { type: "string" },
                      rationale: { type: "string" },
                    },
                    required: ["clause_reference", "proposed_change"],
                  },
                },
              },
              required: ["changes"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "register_changes" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace Lovable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Falha ao chamar a IA");
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { changes: [] };
    const changes: ExtractedChange[] = args.changes || [];

    // Persiste extracted_changes + cria decisões pendentes
    await admin
      .from("contract_clause_revisions")
      .update({
        extracted_changes: changes,
        status: "pending_admin_review",
      })
      .eq("id", revision_id);

    // Limpa decisões anteriores (caso reanalise)
    await admin.from("contract_clause_decisions").delete().eq("revision_id", revision_id);

    if (changes.length > 0) {
      const rows = changes.map((c, idx) => ({
        revision_id,
        clause_reference: c.clause_reference || `Cláusula ${idx + 1}`,
        original_text: c.original_text || "",
        proposed_change: c.proposed_change,
        position: idx,
      }));
      await admin.from("contract_clause_decisions").insert(rows);
    }

    return new Response(JSON.stringify({ ok: true, count: changes.length, changes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-contract-changes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
