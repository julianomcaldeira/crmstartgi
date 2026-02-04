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
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FileSearch,
  Users,
  Briefcase,
  ChevronRight,
  ChevronLeft,
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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { diagnosticRoles, DiagnosticRole, DiagnosticQuestion, iGanheiBenefits } from "@/lib/diagnosticQuestions";
import logoIGanhei from "@/assets/logo-iganhei.jpg";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentSelections, setCurrentSelections] = useState<string[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosticId, setDiagnosticId] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("role");
      setSelectedRole(null);
      setCurrentQuestionIndex(0);
      setAnswers([]);
      setCurrentSelections([]);
      setAiAnalysis("");
      setDiagnosticId(null);
    }
  }, [open]);

  const getRoleIcon = (iconName: string) => {
    switch (iconName) {
      case "FileSearch": return <FileSearch className="h-8 w-8" />;
      case "Users": return <Users className="h-8 w-8" />;
      case "Briefcase": return <Briefcase className="h-8 w-8" />;
      default: return <FileSearch className="h-8 w-8" />;
    }
  };

  const handleRoleSelect = async (role: DiagnosticRole) => {
    setSelectedRole(role);
    setStep("questions");
    
    // Create diagnostic record in database
    try {
      const { data: { user } } = await supabase.auth.getUser();
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

  const currentQuestion = selectedRole?.questions[currentQuestionIndex];
  const progress = selectedRole 
    ? ((currentQuestionIndex + 1) / selectedRole.questions.length) * 100 
    : 0;

  const handleOptionToggle = (option: string) => {
    if (currentQuestion?.multiSelect) {
      setCurrentSelections(prev => 
        prev.includes(option) 
          ? prev.filter(o => o !== option)
          : [...prev, option]
      );
    } else {
      setCurrentSelections([option]);
    }
  };

  const handleNextQuestion = async () => {
    if (currentSelections.length === 0) {
      toast.error("Selecione pelo menos uma opção");
      return;
    }

    // Save answer
    const newAnswer: Answer = {
      questionId: currentQuestion!.id,
      questionText: currentQuestion!.question,
      selectedOptions: currentSelections,
    };
    
    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);
    
    // Save to database
    if (diagnosticId) {
      try {
        await supabase.from("prospect_diagnostic_answers").insert({
          diagnostic_id: diagnosticId,
          question_id: currentQuestion!.id,
          question_text: currentQuestion!.question,
          selected_options: currentSelections,
        });
      } catch (error) {
        console.error("Error saving answer:", error);
      }
    }

    // Move to next question or finish
    if (currentQuestionIndex < selectedRole!.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setCurrentSelections([]);
    } else {
      // All questions answered - generate AI analysis
      setStep("analyzing");
      await generateAnalysis(updatedAnswers);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      // Restore previous answer
      const previousAnswer = answers[currentQuestionIndex - 1];
      if (previousAnswer) {
        setCurrentSelections(previousAnswer.selectedOptions);
        setAnswers(prev => prev.slice(0, -1));
      }
    }
  };

  const generateAnalysis = async (finalAnswers: Answer[]) => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke("analyze-diagnostic", {
        body: {
          clientName,
          role: selectedRole?.label,
          answers: finalAnswers,
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
      setCurrentQuestionIndex(0);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = async () => {
    try {
      toast.info("Gerando PDF...");
      
      // Create a hidden container for the PDF content
      const container = document.createElement("div");
      container.id = "pdf-content";
      container.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 794px;
        background: white;
        padding: 40px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      `;
      
      // Parse AI analysis into sections
      const sections = aiAnalysis.split('\n').filter(line => line.trim());
      let problemsHtml = '';
      let solutionsHtml = '';
      let impactHtml = '';
      let nextStepHtml = '';
      
      let currentSection = '';
      sections.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.includes('PROBLEMAS IDENTIFICADOS')) {
          currentSection = 'problems';
        } else if (trimmed.includes('SOLUÇÕES') || trimmed.includes('SOLUCOES')) {
          currentSection = 'solutions';
        } else if (trimmed.includes('IMPACTO')) {
          currentSection = 'impact';
        } else if (trimmed.includes('PRÓXIMO PASSO') || trimmed.includes('PROXIMO PASSO')) {
          currentSection = 'next';
        } else if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
          const text = trimmed.replace(/^[•\-]\s*/, '');
          if (currentSection === 'problems') {
            problemsHtml += `<div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
              <div style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%; margin-top: 6px; flex-shrink: 0;"></div>
              <span style="color: #374151; font-size: 14px; line-height: 1.5;">${text}</span>
            </div>`;
          } else if (currentSection === 'solutions') {
            problemsHtml += `<div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
              <div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; margin-top: 6px; flex-shrink: 0;"></div>
              <span style="color: #374151; font-size: 14px; line-height: 1.5;">${text}</span>
            </div>`;
          } else if (currentSection === 'impact') {
            impactHtml += `<div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
              <div style="width: 8px; height: 8px; background: #6366f1; border-radius: 50%; margin-top: 6px; flex-shrink: 0;"></div>
              <span style="color: #374151; font-size: 14px; line-height: 1.5;">${text}</span>
            </div>`;
          }
        } else if (currentSection === 'next' && trimmed.length > 0) {
          nextStepHtml = trimmed;
        }
      });

      container.innerHTML = `
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 3px solid #10b981;">
          <img src="${logoIGanhei}" alt="i-Ganhei" style="height: 60px; object-fit: contain;" crossorigin="anonymous" />
          <div style="text-align: right;">
            <div style="font-size: 12px; color: #6b7280;">Diagnóstico de Licitações</div>
            <div style="font-size: 14px; color: #111827; font-weight: 600; margin-top: 4px;">${new Date().toLocaleDateString("pt-BR")}</div>
          </div>
        </div>

        <!-- Title -->
        <div style="margin-bottom: 32px;">
          <h1 style="font-size: 28px; font-weight: 700; color: #111827; margin: 0 0 8px 0;">Diagnóstico Personalizado</h1>
          <div style="font-size: 16px; color: #6b7280;">
            <span style="font-weight: 600; color: #10b981;">${clientName}</span>
            <span style="margin: 0 8px;">|</span>
            <span>${selectedRole?.label}</span>
          </div>
        </div>

        <!-- Two Column Layout -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px;">
          
          <!-- Problems -->
          <div style="background: #fef2f2; border-radius: 12px; padding: 24px; border-left: 4px solid #ef4444;">
            <h3 style="font-size: 14px; font-weight: 700; color: #991b1b; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">
              Desafios Identificados
            </h3>
            ${problemsHtml || '<p style="color: #6b7280; font-size: 14px;">Nenhum problema crítico identificado.</p>'}
          </div>

          <!-- Solutions -->
          <div style="background: #ecfdf5; border-radius: 12px; padding: 24px; border-left: 4px solid #10b981;">
            <h3 style="font-size: 14px; font-weight: 700; color: #065f46; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">
              Soluções i-Ganhei
            </h3>
            ${solutionsHtml || problemsHtml.replace(/#ef4444/g, '#10b981').replace(/#fef2f2/g, '#ecfdf5')}
          </div>
        </div>

        <!-- Impact Section -->
        <div style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border-radius: 12px; padding: 24px; margin-bottom: 32px;">
          <h3 style="font-size: 14px; font-weight: 700; color: #3730a3; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">
            Impacto Esperado
          </h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            ${impactHtml || `
              <div style="text-align: center; padding: 16px; background: white; border-radius: 8px;">
                <div style="font-size: 28px; font-weight: 800; color: #10b981;">+300%</div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Oportunidades</div>
              </div>
              <div style="text-align: center; padding: 16px; background: white; border-radius: 8px;">
                <div style="font-size: 28px; font-weight: 800; color: #10b981;">-70%</div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Esforço Operacional</div>
              </div>
              <div style="text-align: center; padding: 16px; background: white; border-radius: 8px;">
                <div style="font-size: 28px; font-weight: 800; color: #10b981;">-90%</div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Tempo em Peças</div>
              </div>
            `}
          </div>
        </div>

        <!-- Next Step CTA -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
          <h3 style="font-size: 16px; font-weight: 700; color: white; margin: 0 0 8px 0;">
            Próximo Passo Recomendado
          </h3>
          <p style="font-size: 14px; color: rgba(255,255,255,0.9); margin: 0;">
            ${nextStepHtml || 'Agende uma demonstração personalizada do i-Ganhei para ver a plataforma em ação.'}
          </p>
        </div>

        <!-- Footer -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          <div style="font-size: 12px; color: #6b7280;">
            © ${new Date().getFullYear()} i-Ganhei - Gestão Inteligente de Licitações
          </div>
          <div style="font-size: 12px; color: #10b981; font-weight: 600;">
            www.iganhei.com.br
          </div>
        </div>
      `;

      document.body.appendChild(container);

      // Wait for images to load
      await new Promise(resolve => setTimeout(resolve, 500));

      // Render to canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // Remove container
      document.body.removeChild(container);

      // Create PDF
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

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
          {step === "questions" && currentQuestion && (
            <div className="space-y-6 p-4">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Pergunta {currentQuestionIndex + 1} de {selectedRole?.questions.length}</span>
                  <span>{Math.round(progress)}% completo</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Question Card */}
              <Card className="border-2 border-primary/20">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shrink-0">
                      <span className="font-bold text-lg">{currentQuestionIndex + 1}</span>
                    </div>
                    <div>
                      <CardTitle className="text-lg leading-relaxed">
                        {currentQuestion.question}
                      </CardTitle>
                      {currentQuestion.multiSelect && (
                        <Badge variant="outline" className="mt-2">
                          Múltipla escolha
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {currentQuestion.multiSelect ? (
                      currentQuestion.options.map((option, index) => (
                        <label
                          key={index}
                          className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            currentSelections.includes(option)
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <Checkbox
                            checked={currentSelections.includes(option)}
                            onCheckedChange={() => handleOptionToggle(option)}
                          />
                          <span className="flex-1">{option}</span>
                        </label>
                      ))
                    ) : (
                      <RadioGroup
                        value={currentSelections[0] || ""}
                        onValueChange={(value) => setCurrentSelections([value])}
                      >
                        {currentQuestion.options.map((option, index) => (
                          <label
                            key={index}
                            className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              currentSelections.includes(option)
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <RadioGroupItem value={option} />
                            <span className="flex-1">{option}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Anterior
                </Button>
                <Button
                  onClick={handleNextQuestion}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                >
                  {currentQuestionIndex === selectedRole!.questions.length - 1 ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Gerar Diagnóstico
                    </>
                  ) : (
                    <>
                      Próxima
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
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
