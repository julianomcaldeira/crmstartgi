// Lista de cards selecionáveis para o slide 2 (Cenários e Desafios)
// do template "i-Ganhei — Apresentação em Slides".
export interface IGanheiCard {
  id: string;
  title: string;
  description: string;
}

export const IGANHEI_SLIDE2_CARDS: IGanheiCard[] = [
  { id: "baixa_produtividade_equipe", title: "Baixa Produtividade da Equipe", description: "Grande parte do tempo da equipe acaba sendo consumida por atividades operacionais, controles paralelos e tarefas repetitivas. Como consequência, sobra menos tempo para análises estratégicas, acompanhamento das oportunidades e ações que efetivamente contribuem para melhores resultados." },
  { id: "falta_visibilidade_operacao", title: "Falta de Visibilidade da Operação", description: "A ausência de informações consolidadas dificulta o acompanhamento do andamento das oportunidades, das atividades em execução e dos resultados alcançados. Isso reduz a capacidade de identificar gargalos, corrigir desvios e tomar decisões com maior segurança." },
  { id: "dificuldade_escalar", title: "Dificuldade para Escalar", description: "O crescimento da operação costuma trazer mais oportunidades, processos e demandas internas. Sem uma estrutura preparada para absorver esse aumento de volume, a empresa tende a depender cada vez mais de pessoas e controles manuais para sustentar o crescimento." },
  { id: "baixa_velocidade_execucao", title: "Baixa Velocidade de Execução", description: "A demora na análise de oportunidades, na obtenção de informações e na realização de atividades operacionais reduz a capacidade de resposta da empresa. Em um mercado competitivo, pequenas perdas de tempo podem impactar diretamente os resultados obtidos." },
  { id: "dependencia_conhecimento_individual", title: "Dependência de Conhecimento Individual", description: "Informações importantes, histórico de decisões e conhecimento operacional acabam concentrados em poucos profissionais. Essa dependência aumenta riscos, dificulta a continuidade da operação e reduz a previsibilidade dos processos." },
  { id: "falta_priorizacao", title: "Falta de Priorização", description: "Nem todas as oportunidades possuem o mesmo potencial de retorno para a empresa. Quando faltam critérios claros para análise e priorização, a equipe pode direcionar esforços para processos menos relevantes enquanto oportunidades estratégicas recebem menos atenção." },
  { id: "decisoes_sem_informacoes", title: "Decisões Sem Informações Confiáveis", description: "A ausência de dados estruturados e indicadores consistentes dificulta a avaliação do cenário real da operação. Isso aumenta a dependência de percepções individuais e reduz a assertividade na tomada de decisões." },
  { id: "gargalos_ocultos", title: "Gargalos Operacionais Ocultos", description: "Problemas de produtividade, atrasos ou falhas de processo nem sempre são facilmente identificados. Sem acompanhamento adequado, esses gargalos passam a fazer parte da rotina e impactam gradualmente a eficiência da operação." },
  { id: "crescimento_perda_controle", title: "Crescimento com Perda de Controle", description: "Conforme a operação evolui, aumentam também as responsabilidades, atividades e informações que precisam ser acompanhadas. Sem mecanismos adequados de gestão, o crescimento pode gerar perda de controle e aumento da complexidade operacional." },
  { id: "baixa_previsibilidade", title: "Baixa Previsibilidade dos Resultados", description: "A dificuldade em acompanhar indicadores, tendências e desempenho operacional reduz a capacidade de planejamento. Isso limita a construção de estratégias mais consistentes e a previsão de resultados futuros." },
  { id: "dificuldade_medir_performance", title: "Dificuldade em Medir Performance", description: "Sem indicadores claros sobre produtividade, conversão, resultados e eficiência operacional, torna-se mais difícil identificar oportunidades de melhoria e promover a evolução contínua da operação." },
  { id: "excesso_atividades_manuais", title: "Excesso de Atividades Manuais", description: "Muitas rotinas dependem de preenchimentos, conferências, atualizações e controles realizados manualmente. Além de consumir tempo da equipe, esse cenário aumenta a possibilidade de erros e retrabalhos." },
  { id: "perda_eficiencia_operacional", title: "Perda de Eficiência Operacional", description: "O crescimento da demanda nem sempre é acompanhado pela evolução dos processos internos. Com o passar do tempo, atividades simples passam a exigir mais esforço, reduzindo a eficiência geral da operação." },
  { id: "menor_competitividade", title: "Menor Competitividade Comercial", description: "Em um mercado altamente competitivo, eficiência operacional também é um diferencial estratégico. Gargalos internos podem reduzir a capacidade de resposta da empresa e impactar diretamente sua competitividade." },
  { id: "baixa_capacidade_acompanhamento", title: "Baixa Capacidade de Acompanhamento", description: "O aumento do volume de oportunidades, documentos e processos torna cada vez mais difícil manter uma visão clara sobre tudo o que acontece na operação. Isso reduz o controle e dificulta a identificação de prioridades." },
  { id: "falta_integracao_operacao", title: "Falta de Integração da Operação", description: "Quando informações e atividades ficam distribuídas entre diferentes áreas, pessoas e controles, a comunicação se torna mais complexa e a gestão da operação perde eficiência." },
  { id: "dificuldade_aprender_resultados", title: "Dificuldade em Aprender com Resultados", description: "Ganhos, perdas e históricos operacionais representam uma importante fonte de aprendizado para a evolução da estratégia comercial. Sem informações estruturadas, esse conhecimento acaba sendo pouco aproveitado." },
  { id: "tempo_excessivo_administrativo", title: "Tempo Excessivo em Atividades Administrativas", description: "Profissionais qualificados acabam dedicando uma parcela significativa de sua rotina a tarefas administrativas e operacionais, reduzindo o foco em atividades de maior valor estratégico para a empresa." },
  { id: "operacao_reativa", title: "Operação Reativa", description: "Grande parte da rotina passa a ser consumida pela resolução de problemas urgentes e demandas do dia a dia. Isso reduz a capacidade de planejamento, organização e evolução da operação no longo prazo." },
];

export const IGANHEI_SLIDE2_DEFAULT_IDS = [
  "baixa_produtividade_equipe",
  "falta_visibilidade_operacao",
  "dificuldade_escalar",
  "baixa_velocidade_execucao",
];

export const IGANHEI_SLIDE2_PLACEHOLDER = "{{slide2_cards_html}}";

export function buildSlide2CardsHtml(ids: string[]): string {
  const cards = ids
    .map((id) => IGANHEI_SLIDE2_CARDS.find((c) => c.id === id))
    .filter(Boolean) as IGanheiCard[];
  return cards
    .map(
      (c) =>
        `<div style="position:relative;background:linear-gradient(135deg,#ffffff 0%,#f0fdf4 100%);border:1px solid #bbf7d0;border-radius:14px;padding:20px 22px 20px 28px;box-shadow:0 4px 10px -4px rgba(16,185,129,.22),0 1px 2px rgba(15,23,42,.04);overflow:hidden;height:100%;min-height:170px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-start;"><span style="position:absolute;top:0;left:0;bottom:0;width:5px;background:linear-gradient(180deg,#22c55e,#16a34a);"></span><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:#22c55e;color:#fff;font-size:15px;font-weight:800;box-shadow:0 2px 5px rgba(34,197,94,.4);flex-shrink:0;">✓</span><div style="font-weight:800;font-size:16.5px;color:#064e3b;letter-spacing:-.015em;line-height:1.2;">${c.title}</div></div><div style="font-size:13.5px;line-height:1.6;color:#334155;font-weight:500;flex:1;">${c.description}</div></div>`
    )
    .join("");
}
