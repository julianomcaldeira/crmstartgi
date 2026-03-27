import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProposalRequest {
  opportunityId: string;
}

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { opportunityId }: ProposalRequest = await req.json();

    console.log("Generating proposal for opportunity:", opportunityId);

    // Fetch opportunity data with all related information
    const { data: opportunity, error: oppError } = await supabase
      .from("opportunities")
      .select(`
        *,
        client:clients(*),
        product:products(*),
        assigned:profiles!opportunities_assigned_to_fkey(full_name, email, phone),
        created_by_profile:profiles!opportunities_created_by_fkey(full_name, email)
      `)
      .eq("id", opportunityId)
      .single();

    if (oppError) throw oppError;
    if (!opportunity) throw new Error("Oportunidade não encontrada");

    console.log("Opportunity data fetched:", opportunity.title);

    // Generate HTML proposal
    const proposalHtml = generateProposalHtml(opportunity);

    // Log activity
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("Authorization")?.replace("Bearer ", "") || ""
    );

    if (user) {
      await supabase.from("opportunity_activities").insert({
        opportunity_id: opportunityId,
        activity_type: "edit",
        description: "Proposta comercial gerada",
        created_by: user.id,
      });
    }

    // Return HTML (can be converted to PDF on client side or using a PDF service)
    return new Response(
      JSON.stringify({ 
        html: proposalHtml,
        success: true 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error generating proposal:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

function generateProposalHtml(opportunity: any): string {
  const currentDate = new Date().toLocaleDateString("pt-BR");
  const stages: Record<string, string> = {
    lead: "Lead",
    contacted: "Contactado",
    qualified: "Qualificado",
    proposal: "Proposta",
    negotiation: "Negociação",
    won: "Ganho",
    lost: "Perdido",
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proposta Comercial - ${opportunity.client?.company_name || "Cliente"}</title>
    <style>
        @page { margin: 2cm; }
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
        }
        .header h1 {
            color: #2563eb;
            margin: 0;
            font-size: 28px;
        }
        .header p {
            color: #666;
            margin: 10px 0 0 0;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            color: #2563eb;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
        }
        .info-item {
            padding: 15px;
            background: #f9fafb;
            border-radius: 8px;
        }
        .info-item label {
            font-weight: bold;
            color: #666;
            display: block;
            margin-bottom: 5px;
            font-size: 12px;
            text-transform: uppercase;
        }
        .info-item value {
            color: #111;
            font-size: 16px;
        }
        .product-box {
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            color: white;
            padding: 25px;
            border-radius: 12px;
            margin: 20px 0;
        }
        .product-box h3 {
            margin: 0 0 15px 0;
            font-size: 24px;
        }
        .product-box p {
            margin: 10px 0;
            opacity: 0.95;
        }
        .pricing {
            background: #f0f9ff;
            border: 2px solid #2563eb;
            border-radius: 12px;
            padding: 25px;
            margin: 20px 0;
        }
        .pricing-item {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #ddd;
        }
        .pricing-item:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 18px;
            color: #2563eb;
            padding-top: 15px;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        .status-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            background: #10b981;
            color: white;
        }
        @media print {
            body { padding: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>PROPOSTA COMERCIAL</h1>
        <p>StartGi - Soluções em Tecnologia</p>
        <p style="font-size: 14px; margin-top: 15px;">Data: ${currentDate}</p>
    </div>

    <div class="section">
        <h2>Dados do Cliente</h2>
        <div class="info-grid">
            <div class="info-item">
                <label>Razão Social</label>
                <value>${opportunity.client?.company_name || "N/A"}</value>
            </div>
            <div class="info-item">
                <label>Nome Fantasia</label>
                <value>${opportunity.client?.trade_name || "N/A"}</value>
            </div>
            <div class="info-item">
                <label>CNPJ</label>
                <value>${opportunity.client?.cnpj || "N/A"}</value>
            </div>
            <div class="info-item">
                <label>Email</label>
                <value>${opportunity.client?.email || "N/A"}</value>
            </div>
        </div>
    </div>

    ${opportunity.product ? `
    <div class="section">
        <h2>Solução Proposta</h2>
        <div class="product-box">
            <h3>${opportunity.product.name}</h3>
            <p>${opportunity.product.description || "Solução completa e personalizada para suas necessidades."}</p>
        </div>
    </div>
    ` : ""}

    <div class="section">
        <h2>Investimento</h2>
        <div class="pricing">
            ${opportunity.implementation_value ? `
            <div class="pricing-item">
                <span>Implantação (One-time)</span>
                <span>${formatCurrency(opportunity.implementation_value)}</span>
            </div>
            ` : ""}
            ${opportunity.monthly_value ? `
            <div class="pricing-item">
                <span>Mensalidade</span>
                <span>${formatCurrency(opportunity.monthly_value)}</span>
            </div>
            ` : ""}
            <div class="pricing-item">
                <span>Valor Total do Investimento</span>
                <span>${formatCurrency(opportunity.value || 0)}</span>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Informações da Proposta</h2>
        <div class="info-grid">
            <div class="info-item">
                <label>Status</label>
                <value><span class="status-badge">${stages[opportunity.status] || opportunity.status}</span></value>
            </div>
            <div class="info-item">
                <label>Probabilidade de Fechamento</label>
                <value>${opportunity.probability}%</value>
            </div>
            ${opportunity.expected_close_date ? `
            <div class="info-item">
                <label>Data Prevista de Fechamento</label>
                <value>${new Date(opportunity.expected_close_date).toLocaleDateString("pt-BR")}</value>
            </div>
            ` : ""}
            <div class="info-item">
                <label>Consultor Responsável</label>
                <value>${opportunity.assigned?.full_name || "N/A"}</value>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Próximos Passos</h2>
        <ol>
            <li>Análise e aprovação da proposta comercial</li>
            <li>Assinatura do contrato</li>
            <li>Início da implementação</li>
            <li>Treinamento da equipe</li>
            <li>Go-live e acompanhamento</li>
        </ol>
    </div>

    <div class="footer">
        <p><strong>StartGi - Soluções em Tecnologia</strong></p>
        <p>Esta proposta é válida por 30 dias a partir da data de emissão.</p>
        <p>Contato: ${opportunity.assigned?.email || "contato@startgi.com.br"} | ${opportunity.assigned?.phone || "Telefone não informado"}</p>
    </div>
</body>
</html>
  `;
}