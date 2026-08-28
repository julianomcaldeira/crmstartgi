import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SalesProcessEditor } from "@/components/SalesProcessEditor";
import type { SalesStep } from "@/components/SalesProcessEditor";
import { 
  UserSearch, 
  CheckCircle, 
  FileText, 
  MessageSquare, 
  Handshake, 
  Trophy,
  ArrowRight,
  Clock,
  Target,
  Settings
} from "lucide-react";

const ProcessoVendas = () => {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    fetchUserRole();
  }, []);

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    setUserRole(roleData?.role || "vendedor");
  };

  const [salesSteps, setSalesSteps] = useState([
    {
      id: 1,
      title: "Prospecção",
      icon: UserSearch,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      borderColor: "border-blue-500",
      description: "Identificação e busca de potenciais clientes",
      activities: [
        "Participar de feiras e eventos",
        "Busca ativa no mercado",
        "Networking e indicações",
        "Pesquisa de empresas-alvo"
      ],
      tips: [
        "Mantenha lista de prospects atualizada",
        "Qualifique leads antes de avançar",
        "Use o CRM para registrar todos os contatos"
      ],
      duration: "1-2 dias"
    },
    {
      id: 2,
      title: "Qualificação",
      icon: CheckCircle,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      borderColor: "border-purple-500",
      description: "Validação do fit e interesse do prospect",
      activities: [
        "Primeira ligação ou reunião",
        "Entender necessidades e dores",
        "Validar budget e autoridade",
        "Definir timeline de decisão"
      ],
      tips: [
        "Faça perguntas abertas",
        "Identifique o decisor",
        "Avalie o timing da compra"
      ],
      duration: "2-3 dias"
    },
    {
      id: 3,
      title: "Proposta",
      icon: FileText,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
      borderColor: "border-indigo-500",
      description: "Apresentação da solução e proposta comercial",
      activities: [
        "Elaborar proposta customizada",
        "Apresentar solução técnica",
        "Demonstrar ROI e benefícios",
        "Enviar proposta formal"
      ],
      tips: [
        "Personalize a proposta",
        "Destaque diferenciais",
        "Seja claro nos valores e condições"
      ],
      duration: "3-5 dias"
    },
    {
      id: 4,
      title: "Negociação",
      icon: MessageSquare,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
      borderColor: "border-orange-500",
      description: "Ajustes e alinhamento de expectativas",
      activities: [
        "Responder objeções",
        "Negociar condições comerciais",
        "Ajustar proposta se necessário",
        "Definir próximos passos"
      ],
      tips: [
        "Mantenha flexibilidade com limites",
        "Foque no valor, não no preço",
        "Documente todos os acordos"
      ],
      duration: "3-7 dias"
    },
    {
      id: 5,
      title: "Fechamento",
      icon: Handshake,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      borderColor: "border-green-500",
      description: "Assinatura do contrato e conclusão da venda",
      activities: [
        "Preparar documentação final",
        "Obter assinaturas necessárias",
        "Processar pedido",
        "Comunicar ao time de implementação"
      ],
      tips: [
        "Confirme todos os detalhes",
        "Facilite o processo de assinatura",
        "Celebre a conquista!"
      ],
      duration: "1-3 dias"
    },
    {
      id: 6,
      title: "Pós-Venda",
      icon: Trophy,
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary",
      description: "Garantir sucesso do cliente e novas oportunidades",
      activities: [
        "Acompanhar onboarding",
        "Coletar feedback",
        "Identificar upsell/cross-sell",
        "Solicitar indicações"
      ],
      tips: [
        "Mantenha contato regular",
        "Seja proativo em problemas",
        "Construa relacionamento de longo prazo"
      ],
      duration: "Contínuo"
    }
  ]);

  const handleSaveSteps = (newSteps: SalesStep[]) => {
    setSalesSteps((currentSteps) => newSteps.map((step) => {
      const current = currentSteps.find((item) => item.id === step.id);
      return current ? { ...current, ...step } : { ...salesSteps[0], ...step };
    }));
    // Aqui você poderia salvar no banco de dados se necessário
  };

  const bestPractices = [
    {
      title: "Comunicação Clara",
      description: "Sempre comunique próximos passos e mantenha o cliente informado"
    },
    {
      title: "CRM Atualizado",
      description: "Registre todas interações e atualize status das oportunidades"
    },
    {
      title: "Follow-up Consistente",
      description: "Não deixe leads esfriarem, mantenha contato regular"
    },
    {
      title: "Escuta Ativa",
      description: "Entenda profundamente as necessidades antes de propor soluções"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Processo de Vendas</h1>
          <p className="text-sm text-muted-foreground">
            Guia completo do ciclo de vendas da StartGi
          </p>
        </div>
        
        {(userRole === "admin" || userRole === "gestor") && (
          <Button onClick={() => setEditorOpen(true)} className="gap-2">
            <Settings className="h-4 w-4" />
            Configurar Processo
          </Button>
        )}
      </div>

      {/* Timeline Visual */}
      <Card className="bg-gradient-to-r from-primary/5 to-accent/5">
        <CardHeader>
          <CardTitle className="text-lg">Ciclo de Vendas StartGi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto pb-4">
            {salesSteps.map((step, index) => (
              <div key={step.id} className="flex items-center min-w-fit">
                <div
                  className={`flex flex-col items-center gap-2 cursor-pointer transition-all ${
                    activeStep === step.id ? "scale-110" : "scale-100"
                  }`}
                  onClick={() => setActiveStep(activeStep === step.id ? null : step.id)}
                >
                  <div
                    className={`p-3 rounded-full ${step.bgColor} border-2 ${
                      activeStep === step.id ? step.borderColor : "border-transparent"
                    }`}
                  >
                    <step.icon className={`h-6 w-6 ${step.color}`} />
                  </div>
                  <span className="text-xs font-medium text-center">{step.title}</span>
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {step.duration}
                  </Badge>
                </div>
                {index < salesSteps.length - 1 && (
                  <ArrowRight className="h-5 w-5 text-muted-foreground mx-2" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detalhes da Etapa Selecionada */}
      {activeStep && (
        <Card className="border-l-4" style={{ borderLeftColor: `hsl(var(--primary))` }}>
          {(() => {
            const step = salesSteps.find(s => s.id === activeStep);
            if (!step) return null;
            
            return (
              <>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${step.bgColor}`}>
                      <step.icon className={`h-6 w-6 ${step.color}`} />
                    </div>
                    <div>
                      <CardTitle>{step.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        Atividades Principais
                      </h3>
                      <ul className="space-y-2">
                        {step.activities.map((activity, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span>{activity}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        Dicas de Sucesso
                      </h3>
                      <ul className="space-y-2">
                        {step.tips.map((tip, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            <span className="text-muted-foreground">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </>
            );
          })()}
        </Card>
      )}

      {/* Melhores Práticas */}
      <div>
        <h2 className="text-lg font-bold mb-4">Melhores Práticas</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {bestPractices.map((practice, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-2">{practice.title}</h3>
                <p className="text-sm text-muted-foreground">{practice.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* KPIs Importantes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Métricas de Sucesso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">20-30%</p>
              <p className="text-xs text-muted-foreground mt-1">Taxa de Conversão</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">30-45d</p>
              <p className="text-xs text-muted-foreground mt-1">Ciclo Médio</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">5-7</p>
              <p className="text-xs text-muted-foreground mt-1">Touchpoints</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">80%+</p>
              <p className="text-xs text-muted-foreground mt-1">Satisfação</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editor Dialog */}
      <SalesProcessEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        steps={salesSteps}
        onSave={handleSaveSteps}
      />
    </div>
  );
};

export default ProcessoVendas;
