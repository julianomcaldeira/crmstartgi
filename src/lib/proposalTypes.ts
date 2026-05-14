// Tipos e utilitários para o construtor de propostas

export type BlockType =
  | "richtext"
  | "cover"
  | "text"
  | "about"
  | "scope"
  | "pricing"
  | "timeline"
  | "terms"
  | "signature"
  | "image"
  | "gallery"
  | "cta";

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface CoverBlock extends BaseBlock {
  type: "cover";
  title: string;
  subtitle?: string;
  backgroundColor?: string;
  textColor?: string;
}
export interface TextBlock extends BaseBlock {
  type: "text" | "about" | "terms";
  title?: string;
  content: string;
  bgColor?: string;
  titleColor?: string;
  textColor?: string;
  align?: "left" | "center" | "right" | "justify";
  padding?: "compact" | "normal" | "spacious";
  fontSize?: number;
}
export interface ScopeItem { name: string; description?: string }
export interface ScopeBlock extends BaseBlock {
  type: "scope";
  title: string;
  items: ScopeItem[];
}
export type Recurrence = "unica" | "mensal" | "anual";
export interface PricingItem { name: string; qty: number; unit_price: number; recurrence: Recurrence; description?: string }
export interface PricingBlock extends BaseBlock {
  type: "pricing";
  title: string;
  items: PricingItem[];
  showTotals?: boolean;
}
export interface TimelinePhase { phase: string; duration?: string; description?: string }
export interface TimelineBlock extends BaseBlock {
  type: "timeline";
  title: string;
  items: TimelinePhase[];
}
export interface SignatureBlock extends BaseBlock {
  type: "signature";
  name?: string;
  role?: string;
  company?: string;
  showClientLine?: boolean;
}
export interface ImageBlock extends BaseBlock {
  type: "image";
  url: string;
  caption?: string;
  width?: "small" | "medium" | "full";
}
export interface GalleryImage { url: string; caption?: string }
export interface GalleryBlock extends BaseBlock {
  type: "gallery";
  title?: string;
  images: GalleryImage[];
  columns?: 2 | 3;
}
export interface CtaBlock extends BaseBlock {
  type: "cta";
  title: string;
  buttonText: string;
  buttonUrl?: string;
}
export interface RichTextBlock extends BaseBlock {
  type: "richtext";
  html: string;
}

export type ProposalBlock =
  | RichTextBlock | CoverBlock | TextBlock | ScopeBlock | PricingBlock
  | TimelineBlock | SignatureBlock | ImageBlock | GalleryBlock | CtaBlock;

export const BLOCK_LABELS: Record<BlockType, string> = {
  richtext: "Texto Livre (Rich)",
  cover: "Capa",
  text: "Texto",
  about: "Sobre nós",
  scope: "Escopo",
  pricing: "Investimento",
  timeline: "Cronograma",
  terms: "Termos & Condições",
  signature: "Assinatura",
  image: "Imagem",
  gallery: "Galeria de imagens",
  cta: "Chamada para ação",
};

export function newBlock(type: BlockType): ProposalBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case "richtext":
      return { id, type, html: "<p></p>" };
    case "cover":
      return { id, type, title: "Proposta Comercial", subtitle: "Para {{client.company_name}}", backgroundColor: "#22c55e", textColor: "#ffffff" };
    case "about":
      return { id, type, title: "Sobre nós", content: "Conte aqui sobre sua empresa, cases e diferenciais." };
    case "text":
      return { id, type, title: "Seção", content: "Escreva o conteúdo aqui. Use {{variáveis}}." };
    case "terms":
      return { id, type, title: "Termos & Condições", content: "Validade da proposta: {{validity_days}} dias.\nPagamento: a combinar." };
    case "scope":
      return { id, type, title: "Escopo do Projeto", items: [{ name: "Item 1", description: "Descrição" }] };
    case "pricing":
      return { id, type, title: "Investimento", items: [{ name: "Plano", qty: 1, unit_price: 0, recurrence: "mensal" }], showTotals: true };
    case "timeline":
      return { id, type, title: "Cronograma", items: [{ phase: "Kick-off", duration: "1 semana", description: "Alinhamento inicial" }] };
    case "signature":
      return { id, type, name: "{{seller.name}}", role: "Consultor Comercial", company: "StartGi", showClientLine: true };
    case "image":
      return { id, type, url: "", caption: "", width: "full" };
    case "gallery":
      return { id, type, title: "Imagens", images: [], columns: 2 };
    case "cta":
      return { id, type, title: "Pronto para começar?", buttonText: "Falar com consultor", buttonUrl: "" };
  }
}

// ============ Variable interpolation ============
export type VariableContext = Record<string, any>;

export function interpolate(text: string | undefined, vars: VariableContext): string {
  if (!text) return "";
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const parts = path.split(".");
    let cur: any = vars;
    for (const p of parts) {
      if (cur == null) return "";
      cur = cur[p];
    }
    if (cur == null) return "";
    return String(cur);
  });
}

export function buildVariableContext(opts: {
  client?: any;
  opportunity?: any;
  seller?: any;
  validity_days?: number;
}): VariableContext {
  const today = new Date();
  const fmtDate = today.toLocaleDateString("pt-BR");
  return {
    client: {
      company_name: opts.client?.company_name || "",
      trade_name: opts.client?.trade_name || "",
      cnpj: opts.client?.cnpj || "",
      city: opts.client?.city || "",
      state: opts.client?.state || "",
      email: opts.client?.email || "",
      phone: opts.client?.phone || "",
    },
    opportunity: {
      title: opts.opportunity?.title || "",
      value: opts.opportunity?.value
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(opts.opportunity.value)
        : "",
      monthly_value: opts.opportunity?.monthly_value
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(opts.opportunity.monthly_value)
        : "",
    },
    seller: {
      name: opts.seller?.full_name || "",
      email: opts.seller?.email || "",
      phone: opts.seller?.phone || "",
    },
    date: { today: fmtDate, year: today.getFullYear() },
    validity_days: opts.validity_days ?? 30,
  };
}

export const AVAILABLE_VARIABLES: { key: string; label: string }[] = [
  { key: "{{client.company_name}}", label: "Cliente: Razão Social" },
  { key: "{{client.trade_name}}", label: "Cliente: Nome Fantasia" },
  { key: "{{client.cnpj}}", label: "Cliente: CNPJ" },
  { key: "{{client.city}}", label: "Cliente: Cidade" },
  { key: "{{client.state}}", label: "Cliente: Estado" },
  { key: "{{opportunity.title}}", label: "Oportunidade: Título" },
  { key: "{{opportunity.value}}", label: "Oportunidade: Valor total" },
  { key: "{{opportunity.monthly_value}}", label: "Oportunidade: Mensalidade" },
  { key: "{{seller.name}}", label: "Vendedor: Nome" },
  { key: "{{seller.email}}", label: "Vendedor: E-mail" },
  { key: "{{seller.phone}}", label: "Vendedor: Telefone" },
  { key: "{{date.today}}", label: "Data de hoje" },
  { key: "{{validity_days}}", label: "Validade (dias)" },
];

export function calcPricingTotals(blocks: ProposalBlock[]) {
  let unica = 0, mensal = 0, anual = 0;
  for (const b of blocks) {
    if (b.type !== "pricing") continue;
    for (const it of b.items) {
      const total = (Number(it.qty) || 0) * (Number(it.unit_price) || 0);
      if (it.recurrence === "mensal") mensal += total;
      else if (it.recurrence === "anual") anual += total;
      else unica += total;
    }
  }
  return { unica, mensal, anual, total: unica + mensal + anual };
}

export const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
