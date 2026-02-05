import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileSearch,
  Users,
  Briefcase,
  Sparkles,
  Loader2,
  CheckCircle2,
  FileDown,
  ArrowRight,
  Trophy,
  Target,
  Zap,
  BarChart3,
  Clock,
  Award,
  TrendingDown,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { diagnosticRoles, DiagnosticRole, iGanheiBenefits } from "@/lib/diagnosticQuestions";
import { DiagnosticQuestionnaire } from "@/components/diagnostic/DiagnosticQuestionnaire";
import logoIGanhei from "@/assets/logo-iganhei.png";
import jsPDF from "jspdf";

interface ProspectDiagnosticDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  onComplete?: () => void;
}

type Step = "role" | "questions" | "analyzing" | "result";

interface Answer {
  questionId: string;
  questionText: string;
  selectedOptions: string[];
  observation?: string;
}

export function ProspectDiagnosticDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  onComplete,
}: ProspectDiagnosticDialogProps) {
  const [step, setStep] = useState<Step>("role");
  const [selectedRole, setSelectedRole] = useState<DiagnosticRole | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [estimatedLosses, setEstimatedLosses] = useState<{
    daily: number;
    monthly: number;
    teamSize: number;
    hoursWeek: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosticId, setDiagnosticId] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("role");
      setSelectedRole(null);
      setAiAnalysis("");
      setEstimatedLosses(null);
      setDiagnosticId(null);
      setIsLoading(false);
    }
  }, [open]);

  const getRoleIcon = (iconName: string) => {
    switch (iconName) {
      case "FileSearch":
        return <FileSearch className="h-8 w-8" />;
      case "Users":
        return <Users className="h-8 w-8" />;
      case "Briefcase":
        return <Briefcase className="h-8 w-8" />;
      default:
        return <FileSearch className="h-8 w-8" />;
    }
  };

  const handleRoleSelect = async (role: DiagnosticRole) => {
    setSelectedRole(role);
    setStep("questions");
    setAiAnalysis("");
    setEstimatedLosses(null);
    setDiagnosticId(null);

    // Create diagnostic record in database
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("prospect_diagnostics")
        .insert({
          client_id: clientId,
          created_by: user.id,
          contact_role: role.id,
          status: "in_progress",
        })
        .select()
        .single();

      if (error) throw error;
      setDiagnosticId(data.id);
    } catch (error) {
      console.error("Error creating diagnostic:", error);
    }
  };

  const handleSubmitAnswers = async (finalAnswers: Answer[]) => {
    if (!diagnosticId) {
      toast.error("Aguarde um instante e tente novamente.");
      return;
    }

    // Save all answers in one batch
    try {
      const { error } = await supabase.from("prospect_diagnostic_answers").insert(
        finalAnswers.map((a) => ({
          diagnostic_id: diagnosticId,
          question_id: a.questionId,
          question_text: a.questionText,
          selected_options: a.selectedOptions,
        })),
      );

      if (error) throw error;
    } catch (error) {
      console.error("Error saving answers:", error);
      toast.error("Não foi possível salvar as respostas. Tente novamente.");
      return;
    }

    setStep("analyzing");
    await generateAnalysis(finalAnswers);
  };

  // Calculate estimated losses based on team size, time spent, and answers
  const calculateEstimatedLosses = (role: string, answersData: Answer[]): { daily: number; monthly: number; teamSize: number; hoursWeek: number } => {
    // Extract team size from answers
    let teamSize = 3; // Default
    const teamAnswer = answersData.find(a => 
      a.questionId.includes('_equipe') || a.questionId.includes('_faturamento')
    );
    if (teamAnswer) {
      const option = teamAnswer.selectedOptions[0] || "";
      if (option.includes("1 a 2") || option.includes("1 a 3")) teamSize = 2;
      else if (option.includes("3 a 5") || option.includes("4 a 8")) teamSize = 4;
      else if (option.includes("6 a 10") || option.includes("9 a 15")) teamSize = 8;
      else if (option.includes("Mais de 10") || option.includes("Mais de 15")) teamSize = 15;
    }

    // Extract weekly hours from answers (analyst and manager have time questions)
    let hoursWeek = 10; // Default
    const timeAnswer = answersData.find(a => 
      a.questionId.includes('_tempo')
    );
    if (timeAnswer) {
      const option = timeAnswer.selectedOptions[0] || "";
      if (option.includes("Menos de 5") || option.includes("Menos de 3")) hoursWeek = 4;
      else if (option.includes("5 a 10") || option.includes("3 a 8")) hoursWeek = 8;
      else if (option.includes("10 a 20") || option.includes("8 a 15")) hoursWeek = 15;
      else if (option.includes("Mais de 20") || option.includes("Mais de 15")) hoursWeek = 25;
    }

    // Calculate efficiency loss based on problem severity
    let inefficiencyMultiplier = 1.0;
    answersData.forEach(answer => {
      // Skip the quantitative questions for this calculation
      if (answer.questionId.includes('_equipe') || 
          answer.questionId.includes('_tempo') || 
          answer.questionId.includes('_faturamento')) {
        return;
      }
      
      const optionIndices = answer.selectedOptions.map(opt => {
        const question = diagnosticRoles
          .find(r => r.id === role)
          ?.questions.find(q => q.id === answer.questionId);
        return question?.options.indexOf(opt) ?? 0;
      });
      
      // Last options indicate worse scenarios, add to inefficiency
      optionIndices.forEach(idx => {
        if (idx >= 1) inefficiencyMultiplier += 0.1;
        if (idx >= 2) inefficiencyMultiplier += 0.15;
      });
      
      // If observation was provided, add extra weight
      if (answer.observation) {
        inefficiencyMultiplier += 0.1;
      }
    });

    // Cap the multiplier at reasonable levels
    inefficiencyMultiplier = Math.min(inefficiencyMultiplier, 2.5);

    // Average cost per hour of a professional in the area (R$ 35-50/hour average)
    const avgHourlyCost = 42;
    
    // Calculate time that could be saved (assuming 40-60% efficiency gain with i-Ganhei)
    const efficiencyGain = 0.5; // 50% time savings
    const hoursRecoveredPerWeek = hoursWeek * efficiencyGain * teamSize;
    
    // Base weekly savings from recovered time
    const weeklyTimeSavings = hoursRecoveredPerWeek * avgHourlyCost;
    
    // Additional opportunity cost (missed bids, poor analysis, etc.)
    const opportunityCostPerPerson = 150 * inefficiencyMultiplier; // R$ per week per person
    const weeklyOpportunityCost = opportunityCostPerPerson * teamSize;
    
    // Total weekly loss
    const weeklyLoss = weeklyTimeSavings + weeklyOpportunityCost;
    
    // Convert to daily (5 working days)
    const dailyLoss = Math.round(weeklyLoss / 5);
    const monthlyLoss = Math.round(weeklyLoss * 4.3); // 4.3 weeks per month

    return {
      daily: dailyLoss,
      monthly: monthlyLoss,
      teamSize,
      hoursWeek: Math.round(hoursWeek * teamSize),
    };
  };

  const generateAnalysis = async (finalAnswers: Answer[]) => {
    setIsLoading(true);
    try {
      // Calculate estimated losses
      const losses = calculateEstimatedLosses(selectedRole?.id || "analista", finalAnswers);
      setEstimatedLosses(losses);

      const response = await supabase.functions.invoke("analyze-diagnostic", {
        body: {
          clientName,
          role: selectedRole?.label,
          roleId: selectedRole?.id,
          answers: finalAnswers.map(a => ({
            questionId: a.questionId,
            questionText: a.questionText,
            selectedOptions: a.selectedOptions,
            observation: a.observation,
          })),
          estimatedLosses: losses,
        },
      });

      if (response.error) throw response.error;

      const analysis = response.data?.analysis || "";
      setAiAnalysis(analysis);

      // Update diagnostic in database
      if (diagnosticId) {
        await supabase
          .from("prospect_diagnostics")
          .update({
            status: "completed",
            ai_analysis: analysis,
            completed_at: new Date().toISOString(),
          })
          .eq("id", diagnosticId);
      }

      setStep("result");
    } catch (error: any) {
      console.error("Error generating analysis:", error);
      toast.error("Erro ao gerar análise. Tente novamente.");
      setStep("questions");
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = async () => {
    try {
      toast.info("Gerando PDF...");
      
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let y = margin;

      // Colors
      const emerald = [16, 185, 129] as [number, number, number];
      const red = [220, 38, 38] as [number, number, number];
      const gray = [107, 114, 128] as [number, number, number];
      const darkGray = [55, 65, 81] as [number, number, number];

      // Helper to check page break
      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin) {
          pdf.addPage();
          y = margin;
          return true;
        }
        return false;
      };

      // Format currency
      const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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
      pdf.setFontSize(12);
      pdf.setTextColor(...darkGray);
      pdf.text(new Date().toLocaleDateString("pt-BR"), pageWidth - margin, margin + 12, { align: "right" });

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
      pdf.text(` | ${selectedRole?.label}`, margin + pdf.getTextWidth(clientNameText) + 3, y);
      y += 18;

      // ========== ESTIMATED LOSSES BOX ==========
      const lossBoxHeight = 60;
      checkPageBreak(lossBoxHeight + 10);

      // Red gradient background effect
      pdf.setFillColor(254, 242, 242);
      pdf.roundedRect(margin, y, contentWidth, lossBoxHeight, 4, 4, "F");
      pdf.setDrawColor(...red);
      pdf.setLineWidth(0.8);
      pdf.roundedRect(margin, y, contentWidth, lossBoxHeight, 4, 4, "S");

      // Warning icon and title
      pdf.setFontSize(16);
      pdf.setTextColor(153, 27, 27);
      pdf.text("⚠ Quanto você está deixando na mesa?", margin + 10, y + 14);
      
      pdf.setFontSize(10);
      pdf.setTextColor(185, 28, 28);
      const teamSize = estimatedLosses?.teamSize || 3;
      const hoursWeek = estimatedLosses?.hoursWeek || 10;
      pdf.text(`Baseado em ${teamSize} pessoa(s) gastando ~${hoursWeek}h/semana em processos manuais`, margin + 10, y + 24);

      // Loss values
      const colWidth = contentWidth / 3;
      const lossY = y + 38;
      
      const dailyLoss = estimatedLosses?.daily || 0;
      const monthlyLoss = estimatedLosses?.monthly || 0;
      const yearlyLoss = monthlyLoss * 12;

      const lossData = [
        { label: "POR DIA", value: dailyLoss },
        { label: "POR MÊS", value: monthlyLoss },
        { label: "POR ANO", value: yearlyLoss },
      ];

      lossData.forEach((item, i) => {
        const colX = margin + (i * colWidth) + (colWidth / 2);
        pdf.setFontSize(9);
        pdf.setTextColor(...gray);
        pdf.text(item.label, colX, lossY, { align: "center" });
        pdf.setFontSize(16);
        pdf.setTextColor(...red);
        pdf.text(formatCurrency(item.value), colX, lossY + 10, { align: "center" });
      });

      y += lossBoxHeight + 15;

      // ========== AI ANALYSIS - Render Markdown exactly as shown on screen ==========
      if (aiAnalysis) {
        const lines = aiAnalysis.split("\n");
        
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
      pdf.save(`diagnostico-${clientName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    onComplete?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Target className="h-5 w-5" />
            </div>
            Diagnóstico de Licitações - {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step: Role Selection */}
          {step === "role" && (
            <div className="space-y-6 p-4">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Selecione o cargo do contato</h3>
                <p className="text-muted-foreground">
                  As perguntas serão adaptadas conforme o perfil selecionado
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {diagnosticRoles.map((role) => (
                  <Card
                    key={role.id}
                    className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 hover:scale-[1.02]"
                    onClick={() => handleRoleSelect(role)}
                  >
                    <CardHeader className="text-center pb-2">
                      <div className="mx-auto p-4 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-600 dark:text-emerald-400 mb-2">
                        {getRoleIcon(role.icon)}
                      </div>
                      <CardTitle className="text-lg">{role.label}</CardTitle>
                      <CardDescription>{role.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                      <Badge variant="secondary">
                        {role.questions.length} perguntas
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step: Questions */}
          {step === "questions" && selectedRole && (
            <DiagnosticQuestionnaire
              role={selectedRole}
              onSubmit={handleSubmitAnswers}
              submitDisabled={!diagnosticId || isLoading}
              submitDisabledReason={!diagnosticId ? "Preparando o diagnóstico..." : undefined}
            />
          )}

          {/* Step: Analyzing */}
          {step === "analyzing" && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-25" />
                <div className="relative p-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                  <Sparkles className="h-12 w-12 animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Analisando respostas...</h3>
                <p className="text-muted-foreground">
                  Nossa IA está identificando os problemas e gerando recomendações personalizadas
                </p>
              </div>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* Step: Result */}
          {step === "result" && (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-6 p-4">
                {/* Success Header */}
                <div className="text-center space-y-4 pb-4">
                  <div className="mx-auto p-4 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 w-fit">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Diagnóstico Concluído!</h3>
                    <p className="text-muted-foreground">
                      Identificamos os principais desafios e como o i-Ganhei pode resolver
                    </p>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4">
                  {iGanheiBenefits.stats.map((stat, index) => (
                    <Card key={index} className="text-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800">
                      <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                          {stat.value}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {stat.label}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* AI Analysis */}
                <Card className="border-2 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Análise Personalizada
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {aiAnalysis.split("\n").map((line, index) => {
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

                {/* Estimated Losses Card */}
                {estimatedLosses && (
                  <Card className="border-2 border-destructive/30 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-destructive">
                        <TrendingDown className="h-5 w-5" />
                        Quanto você está deixando na mesa?
                      </CardTitle>
                      <CardDescription className="text-destructive/70">
                        Baseado em {estimatedLosses.teamSize} pessoa(s) gastando ~{estimatedLosses.hoursWeek}h/semana em processos manuais
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-white dark:bg-background rounded-lg shadow-sm">
                          <div className="text-sm text-muted-foreground mb-1">Por Dia</div>
                          <div className="text-2xl font-bold text-destructive">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(estimatedLosses.daily)}
                          </div>
                        </div>
                        <div className="text-center p-4 bg-white dark:bg-background rounded-lg shadow-sm">
                          <div className="text-sm text-muted-foreground mb-1">Por Mês</div>
                          <div className="text-2xl font-bold text-destructive">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(estimatedLosses.monthly)}
                          </div>
                        </div>
                        <div className="text-center p-4 bg-white dark:bg-background rounded-lg shadow-sm">
                          <div className="text-sm text-muted-foreground mb-1">Por Ano</div>
                          <div className="text-2xl font-bold text-destructive">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(estimatedLosses.monthly * 12)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-destructive/5 rounded-lg">
                        <p className="text-xs text-muted-foreground">
                          <strong>Metodologia:</strong> Custo médio/hora R$42 × {estimatedLosses.hoursWeek}h/semana × 50% economia de tempo estimada + custos de oportunidades perdidas por ineficiências detectadas no diagnóstico.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Differentials */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-amber-500" />
                      Diferenciais do i-Ganhei
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {iGanheiBenefits.differentials.map((diff, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0">
                            {index === 0 && <Zap className="h-4 w-4" />}
                            {index === 1 && <Target className="h-4 w-4" />}
                            {index === 2 && <Sparkles className="h-4 w-4" />}
                            {index === 3 && <Clock className="h-4 w-4" />}
                            {index === 4 && <BarChart3 className="h-4 w-4" />}
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm">{diff.title}</h4>
                            <p className="text-xs text-muted-foreground">{diff.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex justify-center gap-4 pt-4">
                  <Button
                    size="lg"
                    onClick={generatePDF}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  >
                    <FileDown className="h-5 w-5 mr-2" />
                    Baixar PDF do Diagnóstico
                  </Button>
                  <Button size="lg" variant="outline" onClick={handleClose}>
                    Fechar
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
