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

      // ========== AI ANALYSIS ==========
      console.log("Parsing AI analysis for PDF:", analysis?.substring(0, 200));
      
      // Parse the Markdown format from the AI
      const parseMarkdownAnalysis = (markdown: string) => {
        const lines = markdown.split("\n");
        let diagnosticSummary = "";
        let problems: { name: string; situation: string; impact: string }[] = [];
        let solutionsTable: { problem: string; solution: string; result: string }[] = [];
        let projectedGains: string[] = [];
        let recommendation = "";
        
        let currentSection = "";
        let currentProblem: { name: string; situation: string; impact: string } | null = null;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Detect sections by keywords
          if (line.includes("DIAGNÓSTICO DA OPERAÇÃO") || line.includes("DIAGNOSTICO DA OPERACAO")) {
            currentSection = "summary";
            continue;
          } else if (line.includes("PROBLEMAS IDENTIFICADOS")) {
            currentSection = "problems";
            continue;
          } else if ((line.includes("SOLUÇÕES") || line.includes("SOLUCOES")) && (line.includes("I-GANHEI") || line.includes("IGANHEI"))) {
            currentSection = "solutions";
            continue;
          } else if (line.includes("GANHOS PROJETADOS")) {
            currentSection = "gains";
            continue;
          } else if (line.includes("RECOMENDAÇÃO") || line.includes("RECOMENDACAO")) {
            currentSection = "recommendation";
            continue;
          }
          
          // Skip empty lines and main section headers
          if (!line) continue;
          if (line.startsWith("## ") && !line.startsWith("### ")) continue;
          
          // Parse content based on section
          if (currentSection === "summary" && !line.startsWith("#")) {
            if (diagnosticSummary) diagnosticSummary += " ";
            diagnosticSummary += line.replace(/\*\*/g, "");
          } else if (currentSection === "problems") {
            // Detect problem titles (### 1. Problem Name or just "1. Problem Name")
            if (line.startsWith("###") || /^\d+\.\s/.test(line)) {
              if (currentProblem && currentProblem.name) problems.push(currentProblem);
              const name = line.replace(/^###\s*/, "").replace(/^\d+\.\s*/, "").replace(/\*\*/g, "").replace(/\[|\]/g, "").trim();
              currentProblem = { name, situation: "", impact: "" };
            } else if (currentProblem) {
              const cleanLine = line.replace(/\*\*/g, "").trim();
              if (cleanLine.toLowerCase().includes("situação atual:") || cleanLine.toLowerCase().includes("situacao atual:")) {
                currentProblem.situation = cleanLine.replace(/situação atual:\s*/i, "").replace(/situacao atual:\s*/i, "").trim();
              } else if (cleanLine.toLowerCase().includes("impacto")) {
                currentProblem.impact = cleanLine.replace(/impacto no negócio:\s*/i, "").replace(/impacto:\s*/i, "").trim();
              }
            }
          } else if (currentSection === "solutions") {
            // Parse table rows (| Problem | Solution | Result |)
            if (line.startsWith("|") && !line.includes("---") && !line.toLowerCase().includes("problema")) {
              const cells = line.split("|").map(c => c.trim()).filter(c => c);
              if (cells.length >= 3) {
                solutionsTable.push({
                  problem: cells[0].replace(/\[|\]/g, ""),
                  solution: cells[1].replace(/\[|\]/g, ""),
                  result: cells[2].replace(/\[|\]/g, "")
                });
              }
            }
          } else if (currentSection === "gains") {
            if (line.startsWith("-") || line.startsWith("*")) {
              const gain = line.replace(/^[-*]\s*/, "").replace(/\*\*/g, "").trim();
              if (gain) projectedGains.push(gain);
            }
          } else if (currentSection === "recommendation") {
            if (!line.startsWith("#")) {
              if (recommendation) recommendation += " ";
              recommendation += line.replace(/\*\*/g, "").trim();
            }
          }
        }
        
        // Push last problem
        if (currentProblem && currentProblem.name) problems.push(currentProblem);
        
        return { diagnosticSummary, problems, solutionsTable, projectedGains, recommendation };
      };

      const parsedAnalysis = parseMarkdownAnalysis(analysis);
      console.log("Parsed analysis:", {
        problemCount: parsedAnalysis.problems.length,
        solutionCount: parsedAnalysis.solutionsTable.length,
        hasRecommendation: !!parsedAnalysis.recommendation
      });
      
      // Build display arrays
      let problems: string[] = [];
      let solutions: string[] = [];
      
      if (parsedAnalysis.problems.length > 0) {
        // New format: use parsed problems with details
        problems = parsedAnalysis.problems.map(p => {
          if (p.situation) return `${p.name}: ${p.situation}`;
          if (p.impact) return `${p.name}: ${p.impact}`;
          return p.name;
        });
        solutions = parsedAnalysis.solutionsTable.length > 0 
          ? parsedAnalysis.solutionsTable.map(s => `${s.solution} → ${s.result}`)
          : parsedAnalysis.projectedGains;
      }
      
      // Fallback: try legacy bullet point format
      if (problems.length === 0) {
        console.log("Using legacy parser for old format");
        const sections = analysis.split("\n").filter(line => line.trim());
        let currentSection = "";
        sections.forEach(line => {
          const trimmed = line.trim();
          if (trimmed.includes("PROBLEMAS") || trimmed.includes("DESAFIOS")) {
            currentSection = "problems";
          } else if (trimmed.includes("SOLUÇÕES") || trimmed.includes("SOLUCOES")) {
            currentSection = "solutions";
          } else if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) {
            const text = trimmed.replace(/^[•\-*]\s*/, "").replace(/\*\*/g, "");
            if (currentSection === "problems" && text) problems.push(text);
            else if (currentSection === "solutions" && text) solutions.push(text);
          }
        });
      }
      
      console.log("Final problems count:", problems.length);
      console.log("Final solutions count:", solutions.length);
      
      const nextStep = parsedAnalysis.recommendation || "Agende uma demonstração personalizada do i-Ganhei";

      // ========== PROBLEMS SECTION ==========
      checkPageBreak(60);
      pdf.setFillColor(254, 242, 242);
      const problemsHeight = 15 + (problems.length * 12);
      pdf.roundedRect(margin, y, contentWidth / 2 - 5, Math.max(problemsHeight, 50), 3, 3, "F");
      
      pdf.setFontSize(11);
      pdf.setTextColor(153, 27, 27);
      pdf.text("DESAFIOS IDENTIFICADOS", margin + 5, y + 10);
      
      pdf.setFontSize(10);
      pdf.setTextColor(...darkGray);
      let problemY = y + 20;
      problems.forEach((p) => {
        const lines = pdf.splitTextToSize(`• ${p}`, contentWidth / 2 - 15);
        lines.forEach((line: string) => {
          if (problemY > pageHeight - margin - 10) return;
          pdf.text(line, margin + 5, problemY);
          problemY += 6;
        });
      });

      // ========== SOLUTIONS SECTION ==========
      const solutionsX = margin + contentWidth / 2 + 5;
      pdf.setFillColor(236, 253, 245);
      const solutionsHeight = 15 + (solutions.length * 12);
      pdf.roundedRect(solutionsX, y, contentWidth / 2 - 5, Math.max(solutionsHeight, 50), 3, 3, "F");
      
      pdf.setFontSize(11);
      pdf.setTextColor(6, 95, 70);
      pdf.text("SOLUÇÕES I-GANHEI", solutionsX + 5, y + 10);
      
      pdf.setFontSize(10);
      pdf.setTextColor(...darkGray);
      let solutionY = y + 20;
      solutions.forEach((s) => {
        const lines = pdf.splitTextToSize(`• ${s}`, contentWidth / 2 - 15);
        lines.forEach((line: string) => {
          if (solutionY > pageHeight - margin - 10) return;
          pdf.text(line, solutionsX + 5, solutionY);
          solutionY += 6;
        });
      });

      y += Math.max(problemsHeight, solutionsHeight, 50) + 15;

      // ========== IMPACT SECTION ==========
      checkPageBreak(50);
      pdf.setFillColor(238, 242, 255);
      pdf.roundedRect(margin, y, contentWidth, 45, 3, 3, "F");
      
      pdf.setFontSize(11);
      pdf.setTextColor(55, 48, 163);
      pdf.text("IMPACTO ESPERADO", margin + 5, y + 10);

      // Impact stats
      const impactStats = [
        { value: "+300%", label: "Oportunidades" },
        { value: "-70%", label: "Esforço Operacional" },
        { value: "-90%", label: "Tempo em Peças" },
      ];

      const impactColWidth = contentWidth / 3;
      impactStats.forEach((stat, i) => {
        const colX = margin + (i * impactColWidth) + (impactColWidth / 2);
        pdf.setFontSize(18);
        pdf.setTextColor(...emerald);
        pdf.text(stat.value, colX, y + 28, { align: "center" });
        pdf.setFontSize(9);
        pdf.setTextColor(...gray);
        pdf.text(stat.label, colX, y + 36, { align: "center" });
      });

      y += 55;

      // ========== NEXT STEP ==========
      checkPageBreak(35);
      pdf.setFillColor(...emerald);
      pdf.roundedRect(margin, y, contentWidth, 25, 3, 3, "F");
      
      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      pdf.text("Próximo Passo Recomendado", pageWidth / 2, y + 10, { align: "center" });
      pdf.setFontSize(10);
      pdf.text(nextStep || "Agende uma demonstração personalizada do i-Ganhei", pageWidth / 2, y + 18, { align: "center" });

      y += 35;

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
