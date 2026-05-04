import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { formatDateLocaleBR } from "@/lib/dateUtils";

const TASK_TYPE_LABELS: Record<string, string> = {
  ligacao: "Ligação",
  email: "E-mail",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  visita_presencial: "Visita Presencial",
  reuniao_online: "Reunião Online",
  visita_feira: "Visita a Feira",
  visita_evento: "Visita a Evento",
  pesquisa_inicial: "Pesquisa Inicial",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export const exportCampaignToPdf = async (campaign: any) => {
  const { data: templates } = await supabase
    .from("campaign_task_templates")
    .select("*")
    .eq("campaign_id", campaign.id)
    .order("display_order");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeText = (
    text: string,
    opts: { size?: number; bold?: boolean; color?: [number, number, number]; spacing?: number } = {},
  ) => {
    const { size = 10, bold = false, color = [30, 30, 30], spacing = 4 } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, contentWidth);
    lines.forEach((line: string) => {
      ensureSpace(size + spacing);
      doc.text(line, margin, y);
      y += size + spacing;
    });
  };

  // Header bar
  doc.setFillColor(34, 197, 94);
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Passo a Passo da Campanha", margin, 32);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Evolua CRM", margin, 52);
  y = 95;

  // Campaign info
  writeText(campaign.name, { size: 16, bold: true, color: [20, 20, 20], spacing: 8 });
  writeText(
    `Período: ${formatDateLocaleBR(campaign.start_date)} até ${formatDateLocaleBR(campaign.end_date)}`,
    { size: 10, color: [90, 90, 90] },
  );
  if (campaign.description) {
    y += 6;
    writeText("Descrição", { size: 11, bold: true });
    writeText(campaign.description, { size: 10, color: [60, 60, 60] });
  }

  y += 10;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;

  writeText(`Tarefas da Campanha (${templates?.length || 0})`, {
    size: 13,
    bold: true,
    spacing: 8,
  });

  if (!templates || templates.length === 0) {
    writeText("Nenhuma tarefa configurada para esta campanha.", {
      size: 10,
      color: [120, 120, 120],
    });
  } else {
    templates.forEach((tpl, i) => {
      ensureSpace(60);
      y += 4;
      // Step header
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(34, 197, 94);
      const headerY = y - 12;
      doc.roundedRect(margin, headerY, contentWidth, 22, 4, 4, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(22, 101, 52);
      doc.text(`Passo ${i + 1}: ${tpl.title}`, margin + 8, headerY + 15);
      y = headerY + 32;

      const meta = [
        `Tipo: ${TASK_TYPE_LABELS[tpl.task_type] || tpl.task_type}`,
        `Prioridade: ${PRIORITY_LABELS[tpl.priority] || tpl.priority}`,
        tpl.start_date ? `Início: ${formatDateLocaleBR(tpl.start_date)}` : null,
        tpl.end_date ? `Fim: ${formatDateLocaleBR(tpl.end_date)}` : null,
      ]
        .filter(Boolean)
        .join("  •  ");
      writeText(meta, { size: 9, color: [100, 100, 100] });

      if (tpl.description) {
        y += 4;
        writeText("Descrição:", { size: 10, bold: true });
        writeText(tpl.description, { size: 10, color: [60, 60, 60] });
      }

      if (tpl.instructions) {
        y += 4;
        writeText("Orientações para o vendedor:", { size: 10, bold: true });
        writeText(tpl.instructions, { size: 10, color: [60, 60, 60] });
      }

      y += 8;
    });
  }

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${p} de ${pageCount}`,
      pageWidth - margin,
      pageHeight - 20,
      { align: "right" },
    );
    doc.text(
      `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
      margin,
      pageHeight - 20,
    );
  }

  const safeName = campaign.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  doc.save(`campanha_${safeName}.pdf`);
};
