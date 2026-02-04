// Perguntas do diagnóstico por cargo

export interface DiagnosticQuestion {
  id: string;
  question: string;
  options: string[];
  multiSelect: boolean;
}

export interface DiagnosticRole {
  id: string;
  label: string;
  description: string;
  icon: string;
  questions: DiagnosticQuestion[];
}

export const diagnosticRoles: DiagnosticRole[] = [
  {
    id: "analista",
    label: "Analista de Licitação",
    description: "Para analistas que trabalham diretamente com editais",
    icon: "FileSearch",
    questions: [
      {
        id: "analista_equipe",
        question: "Quantas pessoas trabalham diretamente com licitações na sua empresa?",
        options: [
          "1 a 2 pessoas",
          "3 a 5 pessoas",
          "6 a 10 pessoas",
          "Mais de 10 pessoas"
        ],
        multiSelect: false
      },
      {
        id: "analista_tempo",
        question: "Em média, quantas horas por semana você gasta buscando e filtrando editais?",
        options: [
          "Menos de 5 horas",
          "5 a 10 horas",
          "10 a 20 horas",
          "Mais de 20 horas"
        ],
        multiSelect: false
      },
      {
        id: "analista_q1",
        question: "Hoje, como normalmente chegam os avisos de licitação pra você?",
        options: [
          "ConLicitação",
          "Effecti",
          "Joinsy",
          "Mais de uma ferramenta",
          "Outros meios (e-mail, portais, etc.)"
        ],
        multiSelect: true
      },
      {
        id: "analista_q2",
        question: "Quando chega um edital novo, como você costuma começar a análise?",
        options: [
          "Já tenho tudo organizado num lugar só",
          "Vou juntando informação de vários lugares",
          "Depende muito do edital"
        ],
        multiSelect: false
      },
      {
        id: "analista_q3",
        question: "Você sente que consegue analisar todos os editais com a calma que gostaria?",
        options: [
          "Sim, quase sempre",
          "Alguns acabam ficando mais superficiais",
          "Muitos ficam pelo caminho"
        ],
        multiSelect: false
      },
      {
        id: "analista_q4",
        question: "Quando você precisa lembrar de uma licitação parecida com outra antiga, isso é…",
        options: [
          "Fácil, tenho tudo registrado",
          "Às vezes consigo, às vezes não",
          "Difícil, depende da memória"
        ],
        multiSelect: false
      },
      {
        id: "analista_q5",
        question: "E a parte de documentação… como vocês costumam lidar com isso?",
        options: [
          "Tudo organizado e fácil de localizar",
          "Parte organizada, parte espalhada",
          "Dá bastante trabalho (CND, atestados, etc.)"
        ],
        multiSelect: false
      },
      {
        id: "analista_q6",
        question: "Hoje, se alguém te pedir um atestado ou uma CND específica…",
        options: [
          "Eu acho rápido",
          "Leva um tempinho",
          "Sempre vira uma correria"
        ],
        multiSelect: false
      },
      {
        id: "analista_q7",
        question: "Durante o pregão, você costuma ter tudo o que precisa à mão?",
        options: [
          "Sim",
          "Nem sempre",
          "Geralmente não"
        ],
        multiSelect: false
      },
      {
        id: "analista_q8",
        question: "Se outra pessoa tivesse que assumir sua operação amanhã…",
        options: [
          "Conseguiria sem grandes problemas",
          "Teria alguma dificuldade",
          "Seria muito difícil"
        ],
        multiSelect: false
      }
    ]
  },
  {
    id: "gerente",
    label: "Gerente / Coordenador",
    description: "Para gerentes e coordenadores da área",
    icon: "Users",
    questions: [
      {
        id: "gerente_equipe",
        question: "Quantas pessoas você gerencia diretamente na área de licitações?",
        options: [
          "1 a 2 pessoas",
          "3 a 5 pessoas",
          "6 a 10 pessoas",
          "Mais de 10 pessoas"
        ],
        multiSelect: false
      },
      {
        id: "gerente_tempo_gestao",
        question: "Quanto tempo por semana você gasta cobrando status e consolidando informações?",
        options: [
          "Menos de 3 horas",
          "3 a 8 horas",
          "8 a 15 horas",
          "Mais de 15 horas"
        ],
        multiSelect: false
      },
      {
        id: "gerente_q1",
        question: "Hoje você consegue saber facilmente em que pé estão as licitações?",
        options: [
          "Sim, com clareza",
          "Em partes",
          "Não muito"
        ],
        multiSelect: false
      },
      {
        id: "gerente_q2",
        question: "A forma de analisar edital é parecida entre os analistas?",
        options: [
          "Sim, bem padronizada",
          "Mais ou menos",
          "Cada um faz de um jeito"
        ],
        multiSelect: false
      },
      {
        id: "gerente_q3",
        question: "A decisão de entrar numa licitação costuma ser baseada em quê?",
        options: [
          "Histórico e dados",
          "Experiência do time",
          "Sensação do momento"
        ],
        multiSelect: true
      },
      {
        id: "gerente_q4",
        question: "Depois que uma licitação acaba, vocês conseguem entender claramente por que ganharam ou perderam?",
        options: [
          "Sim",
          "Às vezes",
          "Raramente"
        ],
        multiSelect: false
      },
      {
        id: "gerente_q5",
        question: "Hoje você sente que a operação escala bem ou começa a virar caos quando aumenta o volume?",
        options: [
          "Escala bem",
          "Começa a ficar pesada",
          "Vira um problema"
        ],
        multiSelect: false
      },
      {
        id: "gerente_q6",
        question: "A área depende muito de algumas pessoas específicas?",
        options: [
          "Pouco",
          "Um pouco",
          "Demais"
        ],
        multiSelect: false
      }
    ]
  },
  {
    id: "diretor",
    label: "Diretor / Executivo",
    description: "Para diretores e executivos",
    icon: "Briefcase",
    questions: [
      {
        id: "diretor_equipe",
        question: "Quantas pessoas trabalham na área de licitações/vendas ao governo?",
        options: [
          "1 a 3 pessoas",
          "4 a 8 pessoas",
          "9 a 15 pessoas",
          "Mais de 15 pessoas"
        ],
        multiSelect: false
      },
      {
        id: "diretor_faturamento",
        question: "Qual a representatividade das vendas ao governo no faturamento total?",
        options: [
          "Menos de 20%",
          "20% a 40%",
          "40% a 70%",
          "Mais de 70%"
        ],
        multiSelect: false
      },
      {
        id: "diretor_q1",
        question: "Hoje, quando você olha para vendas ao governo, você vê…",
        options: [
          "Um processo previsível",
          "Algo parcialmente controlado",
          "Uma aposta"
        ],
        multiSelect: false
      },
      {
        id: "diretor_q2",
        question: "Você confia nos números que recebe da área?",
        options: [
          "Sim",
          "Em parte",
          "Não totalmente"
        ],
        multiSelect: false
      },
      {
        id: "diretor_q3",
        question: "Se a empresa decidisse investir mais em vendas ao governo, a operação aguentaria?",
        options: [
          "Sim",
          "Com ajustes",
          "Provavelmente não"
        ],
        multiSelect: false
      },
      {
        id: "diretor_q4",
        question: "O resultado das licitações hoje depende mais de sistema ou de pessoas?",
        options: [
          "Mais de sistema",
          "Meio a meio",
          "Muito mais de pessoas"
        ],
        multiSelect: false
      },
      {
        id: "diretor_q5",
        question: "A tecnologia atual ajuda mais a registrar o que aconteceu ou a decidir melhor o que fazer?",
        options: [
          "Decidir melhor",
          "Registrar",
          "Nenhum dos dois"
        ],
        multiSelect: false
      }
    ]
  }
];

// Mapeamento de problemas detectados para soluções do i-Ganhei
export const problemSolutionMapping: Record<string, { problem: string; solution: string; benefit: string }> = {
  // Analista - Captação fragmentada
  "analista_q1_multiple": {
    problem: "Captação fragmentada de oportunidades",
    solution: "O i-Ganhei integra automaticamente múltiplas fontes: Comprasnet, portais estaduais, municipais e Diário Oficial",
    benefit: "+300% mais oportunidades identificadas sem esforço manual"
  },
  // Analista - Análise desorganizada
  "analista_q2_scattered": {
    problem: "Processo de análise desorganizado",
    solution: "Plataforma unificada com todas as informações do edital em um só lugar, incluindo IA para filtragem inteligente",
    benefit: "Redução de 80-90% dos editais irrelevantes automaticamente"
  },
  // Analista - Sobrecarga de análise
  "analista_q3_overload": {
    problem: "Sobrecarga na análise de editais",
    solution: "IA elimina editais irrelevantes e prioriza oportunidades com real potencial",
    benefit: "Equipe foca em vender, não em filtrar editais"
  },
  // Analista - Memória institucional
  "analista_q4_memory": {
    problem: "Dependência de memória para histórico",
    solution: "Base de conhecimento completa com histórico de todas as licitações, busca inteligente e relacionamento entre editais",
    benefit: "Acesso instantâneo a qualquer informação histórica"
  },
  // Analista - Documentação
  "analista_q5_docs": {
    problem: "Documentação desorganizada e difícil de localizar",
    solution: "Gestão centralizada de documentos com alertas de vencimento e organização automática",
    benefit: "CNDs, atestados e documentos sempre à mão"
  },
  // Analista - Busca de documentos
  "analista_q6_search": {
    problem: "Demora para localizar documentos específicos",
    solution: "Busca inteligente com categorização automática e alertas proativos",
    benefit: "Documentos encontrados em segundos, não minutos"
  },
  // Analista - Pregão
  "analista_q7_bidding": {
    problem: "Falta de organização durante pregões",
    solution: "Cockpit do pregão com todos os documentos e informações organizados por licitação",
    benefit: "Tudo que você precisa em um clique durante a disputa"
  },
  // Analista - Dependência pessoal
  "analista_q8_dependency": {
    problem: "Alta dependência de pessoas específicas",
    solution: "Processos padronizados e documentados no sistema, facilitando transições",
    benefit: "Conhecimento institucionalizado, não perdido"
  },
  // Gerente - Visibilidade
  "gerente_q1_visibility": {
    problem: "Falta de visibilidade do status das licitações",
    solution: "Dashboard unificado com métricas, conversão e previsão de faturamento em tempo real",
    benefit: "100% de visibilidade do pipeline governamental"
  },
  // Gerente - Padronização
  "gerente_q2_standard": {
    problem: "Falta de padronização nos processos",
    solution: "Fluxos configuráveis e regras de negócio personalizadas para cada tipo de licitação",
    benefit: "Qualidade consistente independente do analista"
  },
  // Gerente - Decisão
  "gerente_q3_decision": {
    problem: "Decisões baseadas em feeling, não em dados",
    solution: "Analytics com histórico de participações, taxas de sucesso e análise de concorrência",
    benefit: "Decisões estratégicas baseadas em dados reais"
  },
  // Gerente - Aprendizado
  "gerente_q4_learning": {
    problem: "Falta de aprendizado com ganhos e perdas",
    solution: "Análise automática de resultados com identificação de padrões de sucesso e fracasso",
    benefit: "Melhoria contínua baseada em dados"
  },
  // Gerente - Escalabilidade
  "gerente_q5_scale": {
    problem: "Operação não escala com volume",
    solution: "Automação inteligente que elimina tarefas repetitivas e mantém qualidade",
    benefit: "-70% de esforço operacional"
  },
  // Gerente - Pessoas
  "gerente_q6_people": {
    problem: "Dependência excessiva de pessoas-chave",
    solution: "Processos sistematizados com backup automático de conhecimento",
    benefit: "Operação resiliente e sustentável"
  },
  // Diretor - Previsibilidade
  "diretor_q1_predictability": {
    problem: "Vendas ao governo como aposta, não processo",
    solution: "Transformação da licitação em processo completo de vendas com previsibilidade",
    benefit: "Faturamento governamental previsível e mensurável"
  },
  // Diretor - Confiança
  "diretor_q2_trust": {
    problem: "Falta de confiança nos números reportados",
    solution: "Métricas automáticas e auditáveis do início ao fim do processo",
    benefit: "ROI mensurável em vendas públicas"
  },
  // Diretor - Crescimento
  "diretor_q3_growth": {
    problem: "Operação não suporta crescimento",
    solution: "Infraestrutura escalável com automação de ponta a ponta",
    benefit: "Crescimento sustentável sem explosão de custos"
  },
  // Diretor - Sistema vs Pessoas
  "diretor_q4_system": {
    problem: "Resultados dependem mais de pessoas que de processos",
    solution: "Sistema que potencializa pessoas com IA e automação",
    benefit: "Excelência replicável, não individual"
  },
  // Diretor - Tecnologia
  "diretor_q5_tech": {
    problem: "Tecnologia apenas registra, não ajuda a decidir",
    solution: "IA que recomenda, prioriza e otimiza decisões em tempo real",
    benefit: "Tecnologia como copiloto estratégico"
  }
};

// Benefícios gerais do i-Ganhei
export const iGanheiBenefits = {
  hero: {
    title: "Não é só sobre licitar. É sobre vender para o governo.",
    subtitle: "O i-Ganhei transforma a licitação em um processo completo de vendas — do primeiro aviso até o último empenho pago."
  },
  stats: [
    { value: "+300%", label: "Mais oportunidades identificadas" },
    { value: "-70%", label: "Redução em trabalho manual" },
    { value: "100%", label: "Visibilidade do pipeline" }
  ],
  differentials: [
    {
      title: "Customização Total",
      description: "Cada implementação é única, adaptada aos processos e necessidades específicas do seu negócio"
    },
    {
      title: "Múltiplas Fontes Integradas",
      description: "Comprasnet, portais estaduais, municipais, Diário Oficial e outras fontes relevantes"
    },
    {
      title: "IA que Filtra e Prioriza",
      description: "Elimina 80-90% dos editais irrelevantes, deixando apenas oportunidades compatíveis"
    },
    {
      title: "Geração Automática de Peças",
      description: "Recursos, impugnações e esclarecimentos com qualidade jurídica em minutos"
    },
    {
      title: "Ciclo Completo",
      description: "Da captação ao pós-venda: contratos, empenhos e pagamentos"
    }
  ]
};
