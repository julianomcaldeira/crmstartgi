// Lista de cards selecionáveis para o slide 2 (Cenários e Desafios)
// do template "i-Ganhei — Apresentação em Slides".
export interface IGanheiCard {
  id: string;
  title: string;
  description: string;
}

export const IGANHEI_SLIDE2_CARDS: IGanheiCard[] = [
  { id: "equipe_sobrecarregada", title: "Equipe Sobrecarregada", description: "Grande parte do tempo da equipe é consumida por atividades operacionais, reduzindo a capacidade de análise, planejamento e aproveitamento das melhores oportunidades." },
  { id: "baixa_produtividade", title: "Baixa Produtividade", description: "A operação exige esforço excessivo para executar tarefas rotineiras, comprometendo a eficiência da equipe e a capacidade de gerar mais resultados." },
  { id: "retrabalho_frequente", title: "Retrabalho Frequente", description: "Informações precisam ser revisadas, atualizadas ou preenchidas diversas vezes ao longo dos processos, consumindo tempo e aumentando riscos operacionais." },
  { id: "falta_controle", title: "Falta de Controle", description: "A ausência de acompanhamento estruturado dificulta a gestão das atividades, dos responsáveis e das prioridades da operação." },
  { id: "pouca_visibilidade", title: "Pouca Visibilidade", description: "A liderança encontra dificuldades para acompanhar oportunidades, indicadores, gargalos e a evolução da operação em tempo real." },
  { id: "decisoes_sem_dados", title: "Decisões sem Dados", description: "A falta de informações consolidadas reduz a capacidade de tomar decisões rápidas, seguras e alinhadas aos objetivos do negócio." },
  { id: "analise_demorada", title: "Análise Demorada", description: "A avaliação de oportunidades e requisitos consome tempo excessivo da equipe, reduzindo a velocidade de resposta da operação." },
  { id: "aprovacoes_lentas", title: "Aprovações Lentas", description: "Processos dependentes de e-mails e validações informais aumentam o tempo necessário para avançar etapas importantes." },
  { id: "tempo_mal_aproveitado", title: "Tempo Mal Aproveitado", description: "Profissionais qualificados acabam dedicando horas a atividades operacionais que poderiam ser executadas de forma mais eficiente." },
  { id: "operacao_reativa", title: "Operação Reativa", description: "A equipe passa mais tempo resolvendo urgências do que atuando de forma estratégica para ampliar resultados." },
  { id: "dependencia_pessoas", title: "Dependência de Pessoas", description: "Conhecimentos e informações ficam concentrados em poucos colaboradores, aumentando riscos e dificultando a continuidade da operação." },
  { id: "crescimento_limitado", title: "Crescimento Limitado", description: "O aumento do volume de oportunidades exige mais esforço operacional, dificultando a escalabilidade do negócio." },
  { id: "falta_priorizacao", title: "Falta de Priorização", description: "Sem critérios claros de classificação, a equipe investe tempo em processos com baixo potencial e perde oportunidades estratégicas." },
  { id: "processos_despadronizados", title: "Processos Despadronizados", description: "Cada colaborador executa atividades de maneira diferente, dificultando a gestão, o treinamento e a escalabilidade da operação." },
  { id: "pouca_previsibilidade", title: "Pouca Previsibilidade", description: "A ausência de indicadores e acompanhamento estruturado dificulta o planejamento e a projeção de resultados futuros." },
];

export const IGANHEI_SLIDE2_DEFAULT_IDS = [
  "equipe_sobrecarregada",
  "baixa_produtividade",
  "retrabalho_frequente",
  "falta_controle",
];

export const IGANHEI_SLIDE2_PLACEHOLDER = "{{slide2_cards_html}}";

export function buildSlide2CardsHtml(ids: string[]): string {
  const cards = ids
    .map((id) => IGANHEI_SLIDE2_CARDS.find((c) => c.id === id))
    .filter(Boolean) as IGanheiCard[];
  return cards
    .map(
      (c) =>
        `<div style="position:relative;background:linear-gradient(135deg,#ffffff 0%,#f0fdf4 100%);border:1px solid #bbf7d0;border-radius:14px;padding:18px 20px 18px 26px;box-shadow:0 4px 10px -4px rgba(16,185,129,.22),0 1px 2px rgba(15,23,42,.04);overflow:hidden;height:100%;min-height:130px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;"><span style="position:absolute;top:0;left:0;bottom:0;width:5px;background:linear-gradient(180deg,#22c55e,#16a34a);"></span><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;"><span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:#22c55e;color:#fff;font-size:14px;font-weight:800;box-shadow:0 2px 5px rgba(34,197,94,.4);flex-shrink:0;">✓</span><div style="font-weight:800;font-size:16px;color:#064e3b;letter-spacing:-.015em;line-height:1.2;">${c.title}</div></div><div style="font-size:13.5px;line-height:1.55;color:#334155;font-weight:500;flex:1;">${c.description}</div></div>`
    )
    .join("");
}
