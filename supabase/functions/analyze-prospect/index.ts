import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client, opportunities, tasks, contacts } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context for AI analysis
    const clientInfo = `
## Dados do Prospect
- Razão Social: ${client.company_name}
- Nome Fantasia: ${client.trade_name || 'N/A'}
- CNPJ: ${client.cnpj}
- Segmento: ${client.segment || 'N/A'}
- Porte: ${client.company_size || 'N/A'}
- Cidade/Estado: ${client.city || 'N/A'}/${client.state || 'N/A'}
- Capital Social: ${client.share_capital ? `R$ ${Number(client.share_capital).toLocaleString('pt-BR')}` : 'N/A'}
- Concorrentes atuais: ${client.competitors || 'N/A'}
- Distribuidor atual: ${client.distributor || 'N/A'}
`;

    const contactsInfo = contacts?.length > 0 ? `
## Contatos (${contacts.length})
${contacts.map((c: any) => `- ${c.name}${c.role ? ` (${c.role})` : ''}${c.is_primary ? ' [PRINCIPAL]' : ''}`).join('\n')}
` : `## Contatos\nNenhum contato cadastrado.`;

    const opportunitiesInfo = opportunities?.length > 0 ? `
## Oportunidades (${opportunities.length})
${opportunities.map((o: any) => {
  const statusLabels: Record<string, string> = {
    lead: 'Lead',
    contacted: 'Contato Realizado',
    qualified: 'Qualificado',
    apresentacao: 'Apresentação',
    proposal: 'Proposta',
    negotiation: 'Negociação',
    won: 'Ganho',
    lost: 'Perdido'
  };
  const billingLabel = o.billing_type === 'pontual' ? 'Pontual' : 'Recorrente';
  return `- ${o.product?.name || 'Sem produto'}: Status: ${statusLabels[o.status] || o.status}, Valor Mensal: R$ ${(o.monthly_value || 0).toLocaleString('pt-BR')}, Impl: R$ ${(o.implementation_value || 0).toLocaleString('pt-BR')}, Tipo: ${billingLabel}, Probabilidade: ${o.probability}%`;
}).join('\n')}
` : `## Oportunidades\nNenhuma oportunidade cadastrada.`;

    const tasksInfo = tasks?.length > 0 ? `
## Tarefas/Atividades (${tasks.length})
${tasks.slice(0, 15).map((t: any) => {
  const taskTypeLabels: Record<string, string> = {
    ligacao: 'Ligação',
    email: 'E-mail',
    whatsapp: 'WhatsApp',
    linkedin: 'LinkedIn',
    visita_presencial: 'Visita Presencial',
    reuniao_online: 'Reunião Online',
    visita_feira: 'Visita a Feira',
    visita_evento: 'Visita a Evento',
    proposta: 'Proposta',
    apresentacao: 'Apresentação'
  };
  const statusLabels: Record<string, string> = {
    pending: 'Pendente',
    in_progress: 'Em Andamento',
    completed: 'Concluída',
    cancelled: 'Cancelada'
  };
  const dueDate = t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : 'Sem data';
  return `- [${statusLabels[t.status] || t.status}] ${taskTypeLabels[t.task_type] || t.task_type}: "${t.description || t.title}" (${dueDate})`;
}).join('\n')}
${tasks.length > 15 ? `\n... e mais ${tasks.length - 15} tarefas.` : ''}
` : `## Tarefas\nNenhuma tarefa registrada.`;

    const prompt = `${clientInfo}

${contactsInfo}

${opportunitiesInfo}

${tasksInfo}

---

Com base nos dados acima, analise a situação deste prospect e forneça recomendações estratégicas de vendas.`;

    const systemPrompt = `Você é um Especialista em Vendas B2B com mais de 20 anos de experiência. Sua missão é analisar os dados do prospect e fornecer insights acionáveis para ajudar o vendedor a fechar a venda.

IMPORTANTE: Seja direto, objetivo e prático. Foque em ações concretas.

Sua análise deve incluir:

1. **📊 Análise da Situação Atual**
   - Avalie o estágio do funil de vendas
   - Identifique pontos fortes e fracos do relacionamento

2. **🎯 Próximos Passos Recomendados**
   - Liste 3-5 ações específicas e prioritárias
   - Seja específico sobre O QUE fazer e COMO fazer

3. **⚠️ Pontos de Atenção**
   - Riscos identificados
   - Objeções potenciais a preparar

4. **💡 Dicas de Abordagem**
   - Argumentos de venda baseados no perfil da empresa
   - Como usar as informações do prospect a seu favor

5. **📅 Sugestão de Cronograma**
   - Timeline sugerido para próximas ações

Responda em português brasileiro, de forma clara e estruturada usando markdown.`;

    console.log("Calling Lovable AI Gateway for prospect analysis...");
    
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

    console.log("Analysis generated successfully");

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-prospect function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao analisar prospect" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
