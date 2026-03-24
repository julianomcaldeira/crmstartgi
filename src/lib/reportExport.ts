import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { ReportConfig } from "@/components/reports/ReportBuilder";

type ExportFormat = "pdf" | "excel" | "csv";

interface ReportExportData {
  totalClients?: number;
  totalOpportunities?: number;
  wonOpportunities?: number;
  lostOpportunities?: number;
  totalValue?: number;
  conversionRate?: number;
  avgDealSize?: number;
  avgCloseCycle?: number;
  totalTasks?: number;
  completedTasks?: number;
  pendingTasks?: number;
  overdueTasks?: number;
  tasksByType?: Array<{ type: string; label: string; count: number }>;
  topProducts?: Array<{ name: string; quantity: number; value: number }>;
  sellersPerformance?: Array<{
    id: string;
    name: string;
    clients: number;
    opportunities: number;
    won: number;
    value: number;
    conversionRate: number;
    tasks: number;
    completedTasks: number;
  }>;
  feirasReport?: Array<{
    id: string;
    name: string;
    city?: string;
    state?: string;
    clientsCount: number;
    clients: Array<{ id: string; companyName: string; createdAt: string }>;
  }>;
  opportunitiesByStatus?: Array<{ status: string; count: number; value: number }>;
  aiAnalysis?: string;
  startDate?: string;
  endDate?: string;
}

const formatCurrency = (value?: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);

const formatPercent = (value?: number) => `${(value || 0).toFixed(1)}%`;

const formatDate = (value?: string) => {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
};

const sanitizeFileName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const shouldInclude = (config: ReportConfig, sectionIds: string[]) =>
  config.type === "completo" || sectionIds.some((sectionId) => config.sections.includes(sectionId));

const getFileBaseName = (config: ReportConfig, data: ReportExportData) =>
  sanitizeFileName(`relatorio-${config.type}-${data.startDate || "inicio"}-${data.endDate || "fim"}`);

const addSheet = (workbook: XLSX.WorkBook, name: string, rows: (string | number)[][]) => {
  if (rows.length <= 1) return;
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = rows[0].map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
};

const buildSummaryRows = (data: ReportExportData) => [
  ["Período inicial", formatDate(data.startDate)],
  ["Período final", formatDate(data.endDate)],
  ["Total de clientes", data.totalClients || 0],
  ["Total de oportunidades", data.totalOpportunities || 0],
  ["Oportunidades ganhas", data.wonOpportunities || 0],
  ["Oportunidades perdidas", data.lostOpportunities || 0],
  ["Valor total", formatCurrency(data.totalValue)],
  ["Taxa de conversão", formatPercent(data.conversionRate)],
  ["Ticket médio", formatCurrency(data.avgDealSize)],
  ["Ciclo médio", `${data.avgCloseCycle || 0} dias`],
  ["Total de tarefas", data.totalTasks || 0],
  ["Tarefas concluídas", data.completedTasks || 0],
  ["Tarefas pendentes", data.pendingTasks || 0],
  ["Tarefas atrasadas", data.overdueTasks || 0],
];

const exportExcel = (config: ReportConfig, data: ReportExportData) => {
  const workbook = XLSX.utils.book_new();

  addSheet(workbook, "Resumo", [["Indicador", "Valor"], ...buildSummaryRows(data)]);

  if (shouldInclude(config, ["kpis_tarefas", "tarefas_tipo", "tarefas_atrasadas"]) && data.tasksByType?.length) {
    addSheet(workbook, "Tarefas", [
      ["Tipo", "Quantidade"],
      ...data.tasksByType.map((item) => [item.label, item.count]),
    ]);
  }

  if (shouldInclude(config, ["top_produtos"]) && data.topProducts?.length) {
    addSheet(workbook, "Produtos", [
      ["Produto", "Quantidade", "Valor"],
      ...data.topProducts.map((item) => [item.name, item.quantity, item.value]),
    ]);
  }

  if (shouldInclude(config, ["ranking_equipe", "performance_individual"]) && data.sellersPerformance?.length) {
    addSheet(workbook, "Equipe", [
      ["Vendedor", "Clientes", "Oportunidades", "Ganhos", "Valor", "Conversão", "Tarefas", "Concluídas"],
      ...data.sellersPerformance.map((item) => [
        item.name,
        item.clients,
        item.opportunities,
        item.won,
        item.value,
        item.conversionRate,
        item.tasks,
        item.completedTasks,
      ]),
    ]);
  }

  if (shouldInclude(config, ["leads_feira", "visitas_feira"]) && data.feirasReport?.length) {
    addSheet(workbook, "Feiras", [
      ["Feira", "Cidade", "Estado", "Clientes"],
      ...data.feirasReport.map((item) => [item.name, item.city || "-", item.state || "-", item.clientsCount]),
    ]);
  }

  if (shouldInclude(config, ["oportunidades_status"]) && data.opportunitiesByStatus?.length) {
    addSheet(workbook, "Oportunidades", [
      ["Status", "Quantidade", "Valor"],
      ...data.opportunitiesByStatus.map((item) => [item.status, item.count, item.value]),
    ]);
  }

  XLSX.writeFile(workbook, `${getFileBaseName(config, data)}.xlsx`);
};

const escapeCsvCell = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const exportCsv = (config: ReportConfig, data: ReportExportData) => {
  const rows: (string | number)[][] = [["Indicador", "Valor"], ...buildSummaryRows(data)];

  if (shouldInclude(config, ["top_produtos"]) && data.topProducts?.length) {
    rows.push([], ["Top Produtos", "", ""] as unknown as (string | number)[]);
    rows.push(["Produto", "Quantidade", "Valor"]);
    data.topProducts.forEach((item) => rows.push([item.name, item.quantity, formatCurrency(item.value)]));
  }

  if (shouldInclude(config, ["oportunidades_status"]) && data.opportunitiesByStatus?.length) {
    rows.push([], ["Oportunidades por Status", "", ""] as unknown as (string | number)[]);
    rows.push(["Status", "Quantidade", "Valor"]);
    data.opportunitiesByStatus.forEach((item) => rows.push([item.status, item.count, formatCurrency(item.value)]));
  }

  const csv = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${getFileBaseName(config, data)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const exportPdf = (config: ReportConfig, data: ReportExportData) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = 56;

  const ensureSpace = (requiredHeight = 120) => {
    if (currentY + requiredHeight > pageHeight - 48) {
      doc.addPage();
      currentY = 48;
    }
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(40);
    doc.setFontSize(14);
    doc.text(title, 40, currentY);
    currentY += 16;
  };

  doc.setFontSize(18);
  doc.text("Relatório Comercial", 40, currentY);
  currentY += 20;
  doc.setFontSize(10);
  doc.text(`Período: ${formatDate(data.startDate)} até ${formatDate(data.endDate)}`, 40, currentY);
  currentY += 18;

  autoTable(doc, {
    startY: currentY,
    head: [["Indicador", "Valor"]],
    body: buildSummaryRows(data),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [31, 41, 55] },
    margin: { left: 40, right: 40 },
  });
  currentY = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || currentY) + 24;

  if (shouldInclude(config, ["tarefas_tipo"]) && data.tasksByType?.length) {
    addSectionTitle("Tarefas por tipo");
    autoTable(doc, {
      startY: currentY,
      head: [["Tipo", "Quantidade"]],
      body: data.tasksByType.map((item) => [item.label, item.count]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [31, 41, 55] },
      margin: { left: 40, right: 40 },
    });
    currentY = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || currentY) + 24;
  }

  if (shouldInclude(config, ["top_produtos"]) && data.topProducts?.length) {
    addSectionTitle("Top produtos");
    autoTable(doc, {
      startY: currentY,
      head: [["Produto", "Quantidade", "Valor"]],
      body: data.topProducts.map((item) => [item.name, item.quantity, formatCurrency(item.value)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [31, 41, 55] },
      margin: { left: 40, right: 40 },
    });
    currentY = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || currentY) + 24;
  }

  if (shouldInclude(config, ["ranking_equipe", "performance_individual"]) && data.sellersPerformance?.length) {
    addSectionTitle("Performance da equipe");
    autoTable(doc, {
      startY: currentY,
      head: [["Vendedor", "Clientes", "Oportunidades", "Ganhos", "Valor", "Conversão"]],
      body: data.sellersPerformance.map((item) => [
        item.name,
        item.clients,
        item.opportunities,
        item.won,
        formatCurrency(item.value),
        formatPercent(item.conversionRate),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [31, 41, 55] },
      margin: { left: 40, right: 40 },
    });
    currentY = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || currentY) + 24;
  }

  if (shouldInclude(config, ["oportunidades_status"]) && data.opportunitiesByStatus?.length) {
    addSectionTitle("Oportunidades por status");
    autoTable(doc, {
      startY: currentY,
      head: [["Status", "Quantidade", "Valor"]],
      body: data.opportunitiesByStatus.map((item) => [item.status, item.count, formatCurrency(item.value)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [31, 41, 55] },
      margin: { left: 40, right: 40 },
    });
    currentY = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || currentY) + 24;
  }

  if (shouldInclude(config, ["leads_feira", "visitas_feira"]) && data.feirasReport?.length) {
    addSectionTitle("Feiras");
    autoTable(doc, {
      startY: currentY,
      head: [["Feira", "Cidade", "Estado", "Clientes"]],
      body: data.feirasReport.map((item) => [item.name, item.city || "-", item.state || "-", item.clientsCount]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [31, 41, 55] },
      margin: { left: 40, right: 40 },
    });
    currentY = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || currentY) + 24;
  }

  if (data.aiAnalysis && config.includeAIAnalysis) {
    addSectionTitle("Análise de IA");
    const lines = doc.splitTextToSize(data.aiAnalysis, 515);
    ensureSpace(lines.length * 12 + 32);
    doc.setFontSize(10);
    doc.text(lines, 40, currentY);
  }

  doc.save(`${getFileBaseName(config, data)}.pdf`);
};

export const exportReport = async ({
  format,
  config,
  data,
}: {
  format: ExportFormat;
  config: ReportConfig;
  data: ReportExportData;
}) => {
  if (format === "pdf") {
    exportPdf(config, data);
    return;
  }

  if (format === "excel") {
    exportExcel(config, data);
    return;
  }

  exportCsv(config, data);
};