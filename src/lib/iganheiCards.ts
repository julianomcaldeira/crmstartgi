// Lista de cards selecionáveis para o slide 2 (Cenários e Desafios)
// do template "i-Ganhei — Apresentação em Slides".
export interface IGanheiCard {
  id: string;
  title: string;
  description: string;
}

export const IGANHEI_SLIDE2_CARDS: IGanheiCard[] = [
  { id: "excesso_operacional", title: "Excesso Operacional", description: "Grande volume de atividades manuais e repetitivas." },
  { id: "retrabalho", title: "Retrabalho", description: "Informações descentralizadas gerando duplicidade de tarefas." },
  { id: "descentralizacao", title: "Descentralização", description: "Dados e processos distribuídos em múltiplos locais." },
  { id: "baixa_produtividade", title: "Baixa Produtividade", description: "Tempo excessivo dedicado a tarefas operacionais." },
  { id: "dif_acompanhamento", title: "Dificuldade de Acompanhamento", description: "Baixa visibilidade sobre andamento e prioridades." },
  { id: "perda_oportunidades", title: "Perda de Oportunidades", description: "Oportunidades relevantes sem acompanhamento adequado." },
  { id: "baixa_previsibilidade", title: "Baixa Previsibilidade", description: "Dificuldade para acompanhar evolução da operação." },
  { id: "dif_priorizacao", title: "Dificuldade de Priorização", description: "Baixa clareza sobre oportunidades mais estratégicas." },
  { id: "baixa_inteligencia", title: "Baixa Inteligência Comercial", description: "Decisões comerciais pouco orientadas por dados." },
  { id: "falta_indicadores", title: "Falta de Indicadores", description: "Ausência de métricas consolidadas da operação." },
  { id: "baixa_visibilidade", title: "Baixa Visibilidade Operacional", description: "Dificuldade para visualizar cenários e resultados." },
  { id: "dif_gestao", title: "Dificuldade de Gestão", description: "Controle limitado sobre processos e responsáveis." },
  { id: "crescimento_desestruturado", title: "Crescimento Desestruturado", description: "Expansão operacional sem padronização e organização." },
  { id: "volume_editais", title: "Volume de editais", description: "Milhares de oportunidades diárias dispersas em múltiplos portais." },
  { id: "analise_manual_lenta", title: "Análise manual lenta", description: "Equipe consome horas filtrando, lendo e qualificando editais." },
  { id: "perda_prazos", title: "Perda de prazos", description: "Oportunidades estratégicas escapam por falhas de monitoramento." },
  { id: "baixa_conversao", title: "Baixa taxa de conversão", description: "Falta de critério aumenta participações sem aderência real." },
];

export const IGANHEI_SLIDE2_DEFAULT_IDS = [
  "volume_editais",
  "analise_manual_lenta",
  "perda_prazos",
  "baixa_conversao",
];

export const IGANHEI_SLIDE2_PLACEHOLDER = "{{slide2_cards_html}}";

export function buildSlide2CardsHtml(ids: string[]): string {
  const cards = ids
    .map((id) => IGANHEI_SLIDE2_CARDS.find((c) => c.id === id))
    .filter(Boolean) as IGanheiCard[];
  return cards
    .map(
      (c) =>
        `<div style="position:relative;background:linear-gradient(135deg,#ffffff 0%,#f0fdf4 100%);border:1px solid #bbf7d0;border-radius:12px;padding:14px 16px 14px 20px;box-shadow:0 2px 6px -2px rgba(16,185,129,.18),0 1px 2px rgba(15,23,42,.04);overflow:hidden;height:100%;min-height:96px;box-sizing:border-box;display:flex;flex-direction:column;"><span style="position:absolute;top:0;left:0;bottom:0;width:4px;background:linear-gradient(180deg,#22c55e,#16a34a);"></span><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:#22c55e;color:#fff;font-size:12px;font-weight:800;box-shadow:0 2px 4px rgba(34,197,94,.35);flex-shrink:0;">✓</span><div style="font-weight:700;font-size:13px;color:#064e3b;letter-spacing:-.01em;">${c.title}</div></div><div style="font-size:12px;line-height:1.5;color:#475569;flex:1;">${c.description}</div></div>`
    )
    .join("");
}
