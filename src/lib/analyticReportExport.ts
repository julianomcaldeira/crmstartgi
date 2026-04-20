import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import {
  ANALYTIC_TABLES,
  AnalyticColumn,
  AnalyticTable,
  getAnalyticTable,
} from "./analyticReportSchema";

export interface AnalyticTableConfig {
  tableId: string;
  selectedColumns: string[];
  filters: Record<string, any>; // valores informados pelo usuário (ex: { status: "won", created_at: { from, to } })
}

export interface AnalyticReportConfig {
  mode: "analitico" | "hibrido";
  tables: AnalyticTableConfig[];
  globalDateFrom?: string;
  globalDateTo?: string;
  globalSeller?: string; // 'all' ou id do vendedor
  fileName?: string;
}

const formatValue = (value: any, format?: AnalyticColumn["format"]): any => {
  if (value === null || value === undefined || value === "") return "";
  switch (format) {
    case "currency":
      return Number(value);
    case "boolean":
      return value === true ? "Sim" : value === false ? "Não" : "";
    case "date":
      return value ? new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR") : "";
    case "datetime":
      return value ? new Date(value).toLocaleString("pt-BR") : "";
    default:
      return value;
  }
};

const getNested = (obj: any, path: string): any => {
  return path.split(".").reduce((acc, part) => (acc == null ? acc : acc[part]), obj);
};

const applyQueryFilters = (
  query: any,
  table: AnalyticTable,
  filters: Record<string, any>,
  globalDateFrom?: string,
  globalDateTo?: string,
  globalSeller?: string
) => {
  // Filtro global de período sobre o dateField da tabela
  if (table.dateField && (globalDateFrom || globalDateTo)) {
    if (globalDateFrom) query = query.gte(table.dateField, globalDateFrom);
    if (globalDateTo) query = query.lte(table.dateField, `${globalDateTo}T23:59:59`);
  }

  // Filtro global de vendedor
  if (table.sellerField && globalSeller && globalSeller !== "all") {
    query = query.eq(table.sellerField, globalSeller);
  }

  // Filtros específicos da tabela
  for (const filter of table.filters) {
    const val = filters?.[filter.key];
    if (val === undefined || val === null || val === "") continue;

    switch (filter.type) {
      case "text":
      case "select":
        query = query.eq(filter.key, val);
        break;
      case "date_range":
        if (val.from) query = query.gte(filter.key, val.from);
        if (val.to) query = query.lte(filter.key, `${val.to}T23:59:59`);
        break;
      case "number_min":
        query = query.gte(filter.key, Number(val));
        break;
      case "number_max":
        query = query.lte(filter.key, Number(val));
        break;
    }
  }

  return query;
};

const fetchAllPaged = async (table: AnalyticTable, applyFilters: (q: any) => any) => {
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
  while (true) {
    let q = (supabase as any).from(table.table).select(table.select).range(from, from + pageSize - 1);
    q = applyFilters(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
};

const buildSheetRows = (table: AnalyticTable, columns: string[], rows: any[]) => {
  const cols = columns
    .map((key) => table.columns.find((c) => c.key === key))
    .filter((c): c is AnalyticColumn => Boolean(c));

  const header = cols.map((c) => c.label);
  const body = rows.map((row) => cols.map((c) => formatValue(getNested(row, c.key), c.format)));
  return [header, ...body];
};

const buildSummaryRows = (table: AnalyticTable, rows: any[]): (string | number)[][] => {
  const out: (string | number)[][] = [["Indicador", "Valor"], ["Total de registros", rows.length]];

  // Resumos automáticos por colunas conhecidas
  const numericFields = table.columns.filter((c) => c.format === "currency");
  for (const col of numericFields) {
    const sum = rows.reduce((acc, r) => acc + (Number(getNested(r, col.key)) || 0), 0);
    if (sum > 0) out.push([`Soma — ${col.label}`, sum]);
  }

  // Agrupamento por status (se existir)
  if (table.columns.some((c) => c.key === "status")) {
    const groups = new Map<string, number>();
    rows.forEach((r) => {
      const s = String(r.status ?? "—");
      groups.set(s, (groups.get(s) || 0) + 1);
    });
    out.push([], ["Status", "Quantidade"]);
    Array.from(groups.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([s, q]) => out.push([s, q]));
  }

  return out;
};

const sanitizeSheetName = (name: string) =>
  name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);

export const exportAnalyticReport = async (config: AnalyticReportConfig) => {
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const tableCfg of config.tables) {
    const table = getAnalyticTable(tableCfg.tableId);
    if (!table) continue;

    const rows = await fetchAllPaged(table, (q) =>
      applyQueryFilters(
        q,
        table,
        tableCfg.filters || {},
        config.globalDateFrom,
        config.globalDateTo,
        config.globalSeller
      )
    );

    // Aba analítica
    const sheetData = buildSheetRows(table, tableCfg.selectedColumns, rows);
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    if (sheetData[0]) ws["!cols"] = sheetData[0].map(() => ({ wch: 22 }));
    let name = sanitizeSheetName(table.label);
    let i = 2;
    while (usedNames.has(name)) name = sanitizeSheetName(`${table.label} ${i++}`);
    usedNames.add(name);
    XLSX.utils.book_append_sheet(workbook, ws, name);

    // Aba resumo (modo híbrido)
    if (config.mode === "hibrido") {
      const summary = buildSummaryRows(table, rows);
      const sws = XLSX.utils.aoa_to_sheet(summary);
      sws["!cols"] = [{ wch: 32 }, { wch: 18 }];
      let sname = sanitizeSheetName(`Resumo ${table.label}`);
      let j = 2;
      while (usedNames.has(sname)) sname = sanitizeSheetName(`Resumo ${table.label} ${j++}`);
      usedNames.add(sname);
      XLSX.utils.book_append_sheet(workbook, sws, sname);
    }
  }

  if (workbook.SheetNames.length === 0) {
    throw new Error("Nenhuma tabela selecionada para exportação.");
  }

  const fileName = config.fileName || `relatorio-analitico-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export { ANALYTIC_TABLES };
