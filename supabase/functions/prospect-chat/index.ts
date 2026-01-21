import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, client, opportunities, tasks, contacts, previousAnalysis, conversationHistory } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!client || !client.company_name) {
      throw new Error("Dados do cliente são obrigatórios");
    }

    if (!question || question.trim() === "") {
      throw new Error("Pergunta é obrigatória");
    }

    // Build context about the client
    const clientContext = `
## Dados do Prospect/Cliente em Análise
- Razão Social: ${client.company_name}
- Nome Fantasia: ${client.trade_name || 'N/A'}
- CNPJ: ${client.cnpj}
- Segmento: ${client.segment || 'N/A'}
- Porte: ${client.company_size || 'N/A'}
- Cidade/Estado: ${client.city || 'N/A'}/${client.state || 'N/A'}
- Capital Social: ${client.share_capital ? `R$ ${Number(client.share_capital).toLocaleString('pt-BR')}` : 'N/A'}
- Concorrentes atuais: ${client.competitors || 'N/A'}
- Distribuidor atual: ${client.distributor || 'N/A'}
- Website: ${client.website || 'N/A'}
- E-mail: ${client.email || 'N/A'}
- Telefone: ${client.phone || 'N/A'}
`;

    const contactsContext = contacts?.length > 0 ? `
## Contatos (${contacts.length})
${contacts.map((c: any) => `- ${c.name}${c.role ? ` (${c.role})` : ''}${c.is_primary ? ' [PRINCIPAL]' : ''} - Email: ${c.email || 'N/A'}, Tel: ${c.phone || c.mobile || 'N/A'}`).join('\n')}
` : `## Contatos\nNenhum contato cadastrado.`;

    const opportunitiesContext = opportunities?.length > 0 ? `
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
  return `- ${o.product?.name || o.title || 'Sem produto'}: Status: ${statusLabels[o.status] || o.status}, Valor Mensal: R$ ${(o.monthly_value || 0).toLocaleString('pt-BR')}, Impl: R$ ${(o.implementation_value || 0).toLocaleString('pt-BR')}, Tipo: ${billingLabel}, Probabilidade: ${o.probability}%${o.description ? `, Descrição: ${o.description}` : ''}`;
}).join('\n')}
` : `## Oportunidades\nNenhuma oportunidade cadastrada.`;

    const tasksContext = tasks?.length > 0 ? `
## Últimas Tarefas/Atividades (${tasks.length})
${tasks.slice(0, 20).map((t: any) => {
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
` : `## Tarefas\nNenhuma tarefa registrada.`;

    const previousAnalysisContext = previousAnalysis ? `
## Última Análise Estratégica Realizada
${previousAnalysis}
` : '';

    const fullContext = `${clientContext}\n${contactsContext}\n${opportunitiesContext}\n${tasksContext}\n${previousAnalysisContext}`;

    const systemPrompt = `Você é um Consultor de Vendas B2B altamente experiente, com mais de 25 anos atuando em vendas consultivas, negociação complexa e estratégia comercial. Você foi contratado para ajudar o vendedor a fechar negócios com este prospect específico.

CONTEXTO DA CONTA EM ANÁLISE:
${fullContext}

REGRAS IMPORTANTES:
1. Você SÓ pode responder perguntas relacionadas a esta conta/prospect específico.
2. Se o vendedor fizer perguntas que NÃO estejam relacionadas a esta conta, recuse educadamente e redirecione para questões sobre o prospect.
3. Seja direto, prático e orientado a resultados.
4. Dê conselhos específicos baseados nos dados disponíveis.
5. Sugira abordagens, argumentos e táticas de vendas.
6. Ajude a identificar objeções e como contorná-las.
7. Forneça scripts de abordagem quando solicitado.
8. Responda sempre em português brasileiro.

EXEMPLOS DE PERGUNTAS VÁLIDAS:
- "Como devo abordar o decisor nesta conta?"
- "Qual a melhor estratégia para avançar a oportunidade X?"
- "Como contornar a objeção de preço neste caso?"
- "Que argumentos usar considerando o segmento desta empresa?"

EXEMPLOS DE PERGUNTAS INVÁLIDAS (recuse educadamente):
- "Me conte uma piada"
- "Qual a capital da França?"
- "Como fazer um bolo de chocolate?"
- Qualquer assunto não relacionado a esta conta específica`;

    // Build messages array with conversation history
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt }
    ];

    // Add conversation history if exists
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    // Add the new question
    messages.push({ role: "user", content: question });

    console.log("Calling Lovable AI Gateway for prospect chat...");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: messages,
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
    const answer = data.choices?.[0]?.message?.content;

    if (!answer) {
      throw new Error("No answer generated");
    }

    console.log("Chat response generated successfully");

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in prospect-chat function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao processar pergunta" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
