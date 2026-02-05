import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardList,
  Calendar,
  User,
  FileText,
  Eye,
  FileDown,
  Loader2,
  Sparkles,
  TrendingDown,
  ArrowRight,
  Trophy,
  Target,
  Zap,
  Clock,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { diagnosticRoles, iGanheiBenefits } from "@/lib/diagnosticQuestions";
import jsPDF from "jspdf";
import logoIGanhei from "@/assets/logo-iganhei.png";

interface DiagnosticHistoryListProps {
  clientId: string;
  clientName: string;
}

interface DiagnosticRecord {
  id: string;
  contact_role: string;
  status: string;
  ai_analysis: string | null;
  created_at: string;
  completed_at: string | null;
  created_by: string;
  creator?: {
    full_name: string;
  };
  answers?: {
    question_id: string;
    question_text: string;
    selected_options: string[];
  }[];
}

export function DiagnosticHistoryList({ clientId, clientName }: DiagnosticHistoryListProps) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDiagnostic, setSelectedDiagnostic] = useState<DiagnosticRecord | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    fetchDiagnostics();
  }, [clientId]);

  const fetchDiagnostics = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("prospect_diagnostics")
        .select(`
          *,
          creator:profiles!prospect_diagnostics_created_by_fkey(full_name)
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDiagnostics(data || []);
    } catch (error) {
      console.error("Error fetching diagnostics:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiagnosticAnswers = async (diagnosticId: string) => {
    try {
      const { data, error } = await supabase
        .from("prospect_diagnostic_answers")
        .select("*")
        .eq("diagnostic_id", diagnosticId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching answers:", error);
      return [];
    }
  };

  const handleViewDiagnostic = async (diagnostic: DiagnosticRecord) => {
    const answers = await fetchDiagnosticAnswers(diagnostic.id);
    setSelectedDiagnostic({ ...diagnostic, answers });
    setViewDialogOpen(true);
  };

  const getRoleName = (roleId: string) => {
    const role = diagnosticRoles.find(r => r.id === roleId);
    return role?.label || roleId;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculate estimated losses from answers
  const calculateEstimatedLosses = (roleId: string, answers: any[]) => {
    let teamSize = 3;
    let hoursWeek = 10;

    const teamAnswer = answers.find(a => 
      a.question_id?.includes('_equipe') || a.question_id?.includes('_faturamento')
    );
    if (teamAnswer) {
      const option = teamAnswer.selected_options?.[0] || "";
      if (option.includes("1 a 2") || option.includes("1 a 3")) teamSize = 2;
      else if (option.includes("3 a 5") || option.includes("4 a 8")) teamSize = 4;
      else if (option.includes("6 a 10") || option.includes("9 a 15")) teamSize = 8;
      else if (option.includes("Mais de 10") || option.includes("Mais de 15")) teamSize = 15;
    }

    const timeAnswer = answers.find(a => a.question_id?.includes('_tempo'));
    if (timeAnswer) {
      const option = timeAnswer.selected_options?.[0] || "";
      if (option.includes("Menos de 5") || option.includes("Menos de 3")) hoursWeek = 4;
      else if (option.includes("5 a 10") || option.includes("3 a 8")) hoursWeek = 8;
      else if (option.includes("10 a 20") || option.includes("8 a 15")) hoursWeek = 15;
      else if (option.includes("Mais de 20") || option.includes("Mais de 15")) hoursWeek = 25;
    }

    let inefficiencyMultiplier = 1.0;
    answers.forEach(answer => {
      if (answer.question_id?.includes('_equipe') || 
          answer.question_id?.includes('_tempo') || 
          answer.question_id?.includes('_faturamento')) {
        return;
      }
      
      const role = diagnosticRoles.find(r => r.id === roleId);
      const question = role?.questions.find(q => q.id === answer.question_id);
      
      answer.selected_options?.forEach((opt: string) => {
        const idx = question?.options.indexOf(opt) ?? 0;
        if (idx >= 1) inefficiencyMultiplier += 0.1;
        if (idx >= 2) inefficiencyMultiplier += 0.15;
      });
    });

    inefficiencyMultiplier = Math.min(inefficiencyMultiplier, 2.5);

    const avgHourlyCost = 42;
    const efficiencyGain = 0.5;
    const hoursRecoveredPerWeek = hoursWeek * efficiencyGain * teamSize;
    const weeklyTimeSavings = hoursRecoveredPerWeek * avgHourlyCost;
    const opportunityCostPerPerson = 150 * inefficiencyMultiplier;
    const weeklyOpportunityCost = opportunityCostPerPerson * teamSize;
    const weeklyLoss = weeklyTimeSavings + weeklyOpportunityCost;
    const dailyLoss = Math.round(weeklyLoss / 5);
    const monthlyLoss = Math.round(weeklyLoss * 4.3);

    return { daily: dailyLoss, monthly: monthlyLoss, teamSize, hoursWeek: Math.round(hoursWeek * teamSize) };
  };

  const generatePDF = async (diagnostic: DiagnosticRecord) => {
    try {
      toast.info("Gerando PDF...");
      
      const answers = await fetchDiagnosticAnswers(diagnostic.id);
      const losses = calculateEstimatedLosses(diagnostic.contact_role, answers);
      const analysis = diagnostic.ai_analysis || "";
      
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let y = margin;

      // Colors
      const emerald: [number, number, number] = [16, 185, 129];
      const red: [number, number, number] = [220, 38, 38];
      const gray: [number, number, number] = [107, 114, 128];
      const darkGray: [number, number, number] = [55, 65, 81];
      const lightGray: [number, number, number] = [243, 244, 246];

      // Helper to check page break
      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin) {
          pdf.addPage();
          y = margin;
          return true;
        }
        return false;
      };

      // Load logo as base64 with dimensions
      const loadImageWithDimensions = (src: string): Promise<{ base64: string; width: number; height: number }> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const width = img.naturalWidth || img.width;
            const height = img.naturalHeight || img.height;

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);

            resolve({
              base64: canvas.toDataURL("image/png"),
              width,
              height,
            });
          };
          img.onerror = () => resolve({ base64: "", width: 0, height: 0 });
          img.src = src;
        });
      };

      const logoData = await loadImageWithDimensions(logoIGanhei);

      // ========== HEADER ==========
      if (logoData.base64) {
        // Keep aspect ratio (no stretching)
        const logoWidth = 60; // mm
        const logoHeight = (logoWidth * logoData.height) / logoData.width;

        pdf.addImage(logoData.base64, "PNG", margin, y, logoWidth, logoHeight);
        y += logoHeight + 8;
      } else {
        y += 25;
      }
      
      pdf.setFontSize(10);
      pdf.setTextColor(...gray);
      pdf.text("Diagnóstico de Licitações", pageWidth - margin, margin + 5, { align: "right" });
      pdf.setFontSize(11);
      pdf.setTextColor(...darkGray);
      pdf.text(new Date(diagnostic.created_at).toLocaleDateString("pt-BR"), pageWidth - margin, margin + 12, { align: "right" });

      // Separator line
      pdf.setDrawColor(...emerald);
      pdf.setLineWidth(1.5);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 15;

      // ========== TITLE ==========
      pdf.setFontSize(24);
      pdf.setTextColor(...darkGray);
      pdf.text("Diagnóstico Personalizado", margin, y);
      y += 12;

      pdf.setFontSize(14);
      pdf.setTextColor(...emerald);
      const clientNameText = clientName.length > 40 ? clientName.substring(0, 40) + "..." : clientName;
      pdf.text(clientNameText, margin, y);
      pdf.setTextColor(...gray);
      pdf.text(` | ${getRoleName(diagnostic.contact_role)}`, margin + pdf.getTextWidth(clientNameText) + 3, y);
      y += 18;

      // ========== ESTIMATED LOSSES BOX ==========
      const lossBoxHeight = 55;
      checkPageBreak(lossBoxHeight + 10);

      // Red gradient background effect
      pdf.setFillColor(254, 242, 242);
      pdf.roundedRect(margin, y, contentWidth, lossBoxHeight, 4, 4, "F");
      pdf.setDrawColor(...red);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(margin, y, contentWidth, lossBoxHeight, 4, 4, "S");

      // Warning icon and title
      pdf.setFontSize(14);
      pdf.setTextColor(153, 27, 27);
      pdf.text("⚠ Quanto você está deixando na mesa?", margin + 8, y + 12);
      
      pdf.setFontSize(9);
      pdf.setTextColor(185, 28, 28);
      pdf.text(`Baseado em ${losses.teamSize} pessoa(s) gastando ~${losses.hoursWeek}h/semana em processos manuais`, margin + 8, y + 20);

      // Loss values
      const colWidth = contentWidth / 3;
      const lossY = y + 32;
      
      const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
      };

      const lossData = [
        { label: "POR DIA", value: losses.daily },
        { label: "POR MÊS", value: losses.monthly },
        { label: "POR ANO", value: losses.monthly * 12 },
      ];

      lossData.forEach((item, i) => {
        const colX = margin + (i * colWidth) + (colWidth / 2);
        pdf.setFontSize(8);
        pdf.setTextColor(...gray);
        pdf.text(item.label, colX, lossY, { align: "center" });
        pdf.setFontSize(14);
        pdf.setTextColor(...red);
        pdf.text(formatCurrency(item.value), colX, lossY + 8, { align: "center" });
      });

      y += lossBoxHeight + 15;

      // ========== AI ANALYSIS - Render Markdown exactly as shown on screen ==========
      if (analysis) {
        const lines = analysis.split("\n");
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmedLine = line.trim();
          
          if (!trimmedLine) {
            y += 3; // Empty line spacing
            continue;
          }
          
          // Check page break before rendering each line
          checkPageBreak(12);
          
          // Main headers (## HEADER)
          if (trimmedLine.startsWith("## ")) {
            y += 6; // Extra space before headers
            checkPageBreak(15);
            pdf.setFontSize(14);
            pdf.setTextColor(...emerald);
            const headerText = trimmedLine.replace(/^##\s*/, "").replace(/\*\*/g, "");
            pdf.text(headerText, margin, y);
            y += 10;
          }
          // Sub-headers (### 1. Problem Name)
          else if (trimmedLine.startsWith("### ")) {
            y += 4;
            checkPageBreak(12);
            pdf.setFontSize(12);
            pdf.setTextColor(...darkGray);
            const subHeaderText = trimmedLine.replace(/^###\s*/, "").replace(/\*\*/g, "");
            pdf.text(subHeaderText, margin, y);
            y += 8;
          }
          // Bold lines (**text**)
          else if (trimmedLine.startsWith("**") && trimmedLine.endsWith("**")) {
            pdf.setFontSize(10);
            pdf.setTextColor(...darkGray);
            const boldText = trimmedLine.replace(/\*\*/g, "");
            const wrappedLines = pdf.splitTextToSize(boldText, contentWidth);
            wrappedLines.forEach((wl: string) => {
              checkPageBreak(7);
              pdf.text(wl, margin, y);
              y += 6;
            });
          }
          // Inline bold (**label:** text)
          else if (trimmedLine.includes("**")) {
            pdf.setFontSize(10);
            pdf.setTextColor(...darkGray);
            const cleanText = trimmedLine.replace(/\*\*/g, "");
            const wrappedLines = pdf.splitTextToSize(cleanText, contentWidth);
            wrappedLines.forEach((wl: string) => {
              checkPageBreak(7);
              pdf.text(wl, margin, y);
              y += 6;
            });
          }
          // Table rows (| col1 | col2 | col3 |)
          else if (trimmedLine.startsWith("|")) {
            // Skip separator rows
            if (trimmedLine.includes("---")) continue;
            
            const cells = trimmedLine.split("|").map(c => c.trim()).filter(c => c);
            if (cells.length >= 3) {
              const isHeader = trimmedLine.toLowerCase().includes("problema") || 
                               trimmedLine.toLowerCase().includes("solução") ||
                               trimmedLine.toLowerCase().includes("resultado");
              
              // Table header styling
              if (isHeader) {
                y += 4;
                checkPageBreak(12);
                pdf.setFillColor(236, 253, 245); // Light green background
                pdf.roundedRect(margin, y - 5, contentWidth, 10, 1, 1, "F");
                pdf.setFontSize(9);
                pdf.setTextColor(6, 95, 70); // Dark green
              } else {
                pdf.setFontSize(9);
                pdf.setTextColor(...darkGray);
              }
              
              // Draw cells
              const colWidth = contentWidth / 3;
              cells.forEach((cell, idx) => {
                if (idx < 3) {
                  const cellX = margin + (idx * colWidth) + 2;
                  const maxCellWidth = colWidth - 4;
                  const cellLines = pdf.splitTextToSize(cell, maxCellWidth);
                  pdf.text(cellLines[0] || "", cellX, y);
                }
              });
              y += 8;
            }
          }
          // List items (- or • or *)
          else if (trimmedLine.startsWith("-") || trimmedLine.startsWith("•") || trimmedLine.startsWith("*")) {
            pdf.setFontSize(10);
            pdf.setTextColor(...darkGray);
            const itemText = trimmedLine.replace(/^[-•*]\s*/, "").replace(/\*\*/g, "");
            const wrappedLines = pdf.splitTextToSize(`• ${itemText}`, contentWidth - 5);
            wrappedLines.forEach((wl: string) => {
              checkPageBreak(7);
              pdf.text(wl, margin + 3, y);
              y += 6;
            });
          }
          // Regular text
          else {
            pdf.setFontSize(10);
            pdf.setTextColor(...darkGray);
            const cleanText = trimmedLine.replace(/\*\*/g, "");
            const wrappedLines = pdf.splitTextToSize(cleanText, contentWidth);
            wrappedLines.forEach((wl: string) => {
              checkPageBreak(7);
              pdf.text(wl, margin, y);
              y += 6;
            });
          }
        }
      }

      y += 10;

      // ========== IMPACT SECTION ==========
      checkPageBreak(55);
      pdf.setFillColor(238, 242, 255);
      pdf.roundedRect(margin, y, contentWidth, 50, 3, 3, "F");
      
      pdf.setFontSize(11);
      pdf.setTextColor(55, 48, 163);
      pdf.text("IMPACTO ESPERADO COM O I-GANHEI", margin + 6, y + 12);

      // Impact stats
      const impactStats = [
        { value: "+300%", label: "Oportunidades" },
        { value: "-70%", label: "Esforço Operacional" },
        { value: "-90%", label: "Tempo em Peças" },
      ];

      const impactColWidth = contentWidth / 3;
      impactStats.forEach((stat, i) => {
        const colX = margin + (i * impactColWidth) + (impactColWidth / 2);
        pdf.setFontSize(20);
        pdf.setTextColor(...emerald);
        pdf.text(stat.value, colX, y + 32, { align: "center" });
        pdf.setFontSize(9);
        pdf.setTextColor(...gray);
        pdf.text(stat.label, colX, y + 42, { align: "center" });
      });

      y += 60;

      // ========== FOOTER ==========
      const footerY = pageHeight - 15;
      pdf.setFontSize(9);
      pdf.setTextColor(...gray);
      pdf.text(`© ${new Date().getFullYear()} i-Ganhei - Gestão Inteligente de Licitações`, margin, footerY);
      pdf.setTextColor(...emerald);
      pdf.text("www.iganhei.com.br", pageWidth - margin, footerY, { align: "right" });

      // Save
      pdf.save(`diagnostico-${clientName.replace(/\s+/g, "-").toLowerCase()}-${new Date(diagnostic.created_at).toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (diagnostics.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum diagnóstico realizado ainda</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {diagnostics.map((diagnostic) => (
          <Card key={diagnostic.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div className="font-medium">{getRoleName(diagnostic.contact_role)}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {formatDate(diagnostic.created_at)}
                      {diagnostic.creator && (
                        <>
                          <span className="mx-1">•</span>
                          <User className="h-3 w-3" />
                          {diagnostic.creator.full_name}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={diagnostic.status === "completed" ? "default" : "secondary"}>
                    {diagnostic.status === "completed" ? "Concluído" : "Em andamento"}
                  </Badge>
                  {diagnostic.status === "completed" && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewDiagnostic(diagnostic)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => generatePDF(diagnostic)}
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View Diagnostic Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              Diagnóstico - {getRoleName(selectedDiagnostic?.contact_role || "")}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            {selectedDiagnostic && (
              <div className="space-y-6">
                {/* Estimated Losses */}
                {selectedDiagnostic.answers && selectedDiagnostic.answers.length > 0 && (
                  <Card className="border-2 border-destructive/30 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-destructive">
                        <TrendingDown className="h-5 w-5" />
                        Quanto você está deixando na mesa?
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const losses = calculateEstimatedLosses(
                          selectedDiagnostic.contact_role,
                          selectedDiagnostic.answers || []
                        );
                        return (
                          <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-white dark:bg-background rounded-lg">
                              <div className="text-sm text-muted-foreground mb-1">Por Dia</div>
                              <div className="text-xl font-bold text-destructive">
                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(losses.daily)}
                              </div>
                            </div>
                            <div className="text-center p-4 bg-white dark:bg-background rounded-lg">
                              <div className="text-sm text-muted-foreground mb-1">Por Mês</div>
                              <div className="text-xl font-bold text-destructive">
                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(losses.monthly)}
                              </div>
                            </div>
                            <div className="text-center p-4 bg-white dark:bg-background rounded-lg">
                              <div className="text-sm text-muted-foreground mb-1">Por Ano</div>
                              <div className="text-xl font-bold text-destructive">
                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(losses.monthly * 12)}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}

                {/* AI Analysis */}
                <Card className="border-2 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Análise da IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {selectedDiagnostic.ai_analysis?.split("\n").map((line, index) => {
                        if (line.startsWith("##")) {
                          return (
                            <h3 key={index} className="text-lg font-semibold text-primary mt-4 mb-2">
                              {line.replace(/##\s*/g, "")}
                            </h3>
                          );
                        }
                        if (line.startsWith("**")) {
                          return (
                            <p key={index} className="font-semibold mb-1">
                              {line.replace(/\*\*/g, "")}
                            </p>
                          );
                        }
                        if (line.startsWith("-") || line.startsWith("•")) {
                          return (
                            <div key={index} className="flex items-start gap-2 ml-4 mb-1">
                              <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <span>{line.replace(/^[-•]\s*/, "")}</span>
                            </div>
                          );
                        }
                        if (line.trim()) {
                          return <p key={index} className="mb-2">{line}</p>;
                        }
                        return null;
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Answers */}
                {selectedDiagnostic.answers && selectedDiagnostic.answers.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        Respostas do Diagnóstico
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedDiagnostic.answers.map((answer, index) => (
                        <div key={index} className="p-3 rounded-lg bg-muted/50">
                          <div className="font-medium text-sm mb-2">{answer.question_text}</div>
                          <div className="flex flex-wrap gap-2">
                            {answer.selected_options.map((opt, i) => (
                              <Badge key={i} variant="secondary">{opt}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Actions */}
                <div className="flex justify-center gap-4 pt-4">
                  <Button
                    onClick={() => generatePDF(selectedDiagnostic)}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600"
                  >
                    <FileDown className="h-5 w-5 mr-2" />
                    Baixar PDF
                  </Button>
                  <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                    Fechar
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
