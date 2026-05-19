// Types and helpers for the Commercial Proposal (i-Ganhei) module.
import { supabase } from "@/integrations/supabase/client";

export type CommercialSectionType =
  | "capa" | "termo" | "cards" | "list" | "benefits"
  | "timeline" | "pricing" | "validade" | "final";

export interface CommercialSection {
  id: string;
  type: CommercialSectionType;
  enabled: boolean;
  title: string;
  content: any;
}

export interface CommercialTheme {
  primary: string;
  primaryDark: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
}

export const DEFAULT_THEME: CommercialTheme = {
  primary: "#4F5BFF",
  primaryDark: "#2434D8",
  accent: "#00E68A",
  bg: "#FFFFFF",
  surface: "#F5F7FA",
  text: "#1F2937",
  muted: "#6B7280",
};

export type ProposalVars = Record<string, string>;

export function interp(text: string, vars: ProposalVars): string {
  if (!text) return text;
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k) =>
    vars[k] != null ? String(vars[k]) : `{{${k}}}`
  );
}

export function formatBRL(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.,-]/g, "").replace(",", ".")) : Number(v);
  if (!isFinite(n) || !n) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Resolve dynamic variables for a proposal row (client + owner profile + own fields). */
export async function resolveVariables(proposal: any): Promise<ProposalVars> {
  const vars: ProposalVars = {};
  const v = proposal.variables || {};

  // own fields
  vars.data_proposta = v.data_proposta || new Date().toLocaleDateString("pt-BR");
  vars.valor_implantacao = formatBRL(v.valor_implantacao ?? proposal.implementation_value);
  vars.valor_mensalidade = formatBRL(v.valor_mensalidade ?? proposal.monthly_value);
  vars.validade_proposta = String(v.validade_proposta ?? proposal.validity_days ?? 30);
  vars.vigencia_inicial = v.vigencia_inicial || "12 meses";
  vars.forma_pagamento = v.forma_pagamento || "Boleto bancário";

  // client
  if (proposal.client_id) {
    const { data: c } = await supabase
      .from("clients")
      .select("company_name, trade_name")
      .eq("id", proposal.client_id).maybeSingle();
    if (c) {
      vars.empresa_cliente = (c as any).company_name || (c as any).trade_name || "";
      vars.logo_cliente = "";
    }
  } else if (proposal.client_company) {
    vars.empresa_cliente = proposal.client_company;
  }

  // seller (created_by profile)
  if (proposal.created_by) {
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name, email, phone, avatar_url")
      .eq("id", proposal.created_by).maybeSingle();
    if (p) {
      vars.nome_vendedor = p.full_name || "";
      vars.email_vendedor = p.email || "";
      vars.telefone_vendedor = (p as any).phone || "";
      vars.foto_vendedor = (p as any).avatar_url || "";
    }
  }

  // any explicit overrides win
  for (const [k, val] of Object.entries(v)) {
    if (val != null && val !== "") vars[k] = String(val);
  }
  return vars;
}

export const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "bg-slate-200 text-slate-700" },
  em_edicao: { label: "Em edição", cls: "bg-yellow-100 text-yellow-800" },
  sent: { label: "Enviada", cls: "bg-green-100 text-green-800" },
  enviada: { label: "Enviada", cls: "bg-green-100 text-green-800" },
  viewed: { label: "Visualizada", cls: "bg-blue-100 text-blue-800" },
  visualizada: { label: "Visualizada", cls: "bg-blue-100 text-blue-800" },
  em_negociacao: { label: "Em negociação", cls: "bg-purple-100 text-purple-800" },
  aprovada: { label: "Aprovada", cls: "bg-orange-100 text-orange-800" },
  accepted: { label: "Aprovada", cls: "bg-orange-100 text-orange-800" },
  reprovada: { label: "Reprovada", cls: "bg-red-100 text-red-800" },
  rejected: { label: "Reprovada", cls: "bg-red-100 text-red-800" },
  expirada: { label: "Expirada", cls: "bg-gray-300 text-gray-700" },
};
