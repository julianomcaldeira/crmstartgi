import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface DiagnosticAnswerDraft {
  questionId: string;
  questionText: string;
  selectedOptions: string[];
  observation?: string;
}

// Types for database-sourced diagnostic data
export interface DbDiagnosticRole {
  id: string;
  role_key: string;
  label: string;
  description: string | null;
  icon: string;
  display_order: number;
  is_active: boolean;
}

export interface DbDiagnosticQuestion {
  id: string;
  role_id: string;
  question_text: string;
  multi_select: boolean;
  display_order: number;
  is_active: boolean;
  options: DbDiagnosticOption[];
}

export interface DbDiagnosticOption {
  id: string;
  question_id: string;
  option_text: string;
  display_order: number;
}

type ResponseState = Record<string, { selectedOptions: string[]; observation: string }>;

interface DiagnosticQuestionnaireProps {
  roleId: string;
  roleLabel: string;
  onSubmit: (answers: DiagnosticAnswerDraft[]) => void | Promise<void>;
  submitDisabled?: boolean;
  submitDisabledReason?: string;
}

export function DiagnosticQuestionnaire({
  roleId,
  roleLabel,
  onSubmit,
  submitDisabled,
  submitDisabledReason,
}: DiagnosticQuestionnaireProps) {
  const [questions, setQuestions] = useState<DbDiagnosticQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<ResponseState>({});
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());

  // Fetch questions from database when role changes
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      setResponses({});
      setMissingIds(new Set());

      try {
        const { data, error } = await supabase
          .from("diagnostic_questions")
          .select(`
            *,
            diagnostic_question_options (*)
          `)
          .eq("role_id", roleId)
          .eq("is_active", true)
          .order("display_order");

        if (error) throw error;

        const formattedQuestions: DbDiagnosticQuestion[] = (data || []).map((q: any) => ({
          ...q,
          options: (q.diagnostic_question_options || []).sort(
            (a: any, b: any) => a.display_order - b.display_order
          ),
        }));

        setQuestions(formattedQuestions);
      } catch (error) {
        console.error("Error fetching diagnostic questions:", error);
        toast.error("Erro ao carregar perguntas do diagnóstico");
      } finally {
        setLoading(false);
      }
    };

    if (roleId) {
      fetchQuestions();
    }
  }, [roleId]);

  const answeredCount = useMemo(() => {
    return questions.reduce((count, q) => {
      const selected = responses[q.id]?.selectedOptions ?? [];
      return count + (selected.length > 0 ? 1 : 0);
    }, 0);
  }, [questions, responses]);

  const progress = useMemo(() => {
    return questions.length ? (answeredCount / questions.length) * 100 : 0;
  }, [answeredCount, questions.length]);

  const setSelectedOptions = (question: DbDiagnosticQuestion, selectedOptions: string[]) => {
    setResponses((prev) => {
      const existing = prev[question.id] ?? { selectedOptions: [], observation: "" };
      return {
        ...prev,
        [question.id]: {
          ...existing,
          selectedOptions,
        },
      };
    });

    setMissingIds((prev) => {
      if (!prev.has(question.id)) return prev;
      const next = new Set(prev);
      next.delete(question.id);
      return next;
    });
  };

  const toggleOption = (question: DbDiagnosticQuestion, option: string) => {
    const current = responses[question.id]?.selectedOptions ?? [];

    if (question.multi_select) {
      const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
      setSelectedOptions(question, next);
    } else {
      setSelectedOptions(question, [option]);
    }
  };

  const setObservation = (questionId: string, value: string) => {
    setResponses((prev) => {
      const existing = prev[questionId] ?? { selectedOptions: [], observation: "" };
      return {
        ...prev,
        [questionId]: {
          ...existing,
          observation: value,
        },
      };
    });
  };

  const buildAnswers = (): DiagnosticAnswerDraft[] => {
    return questions.map((q) => {
      const resp = responses[q.id];
      return {
        questionId: q.id,
        questionText: q.question_text,
        selectedOptions: resp?.selectedOptions ?? [],
        observation: resp?.observation?.trim() ? resp.observation.trim() : undefined,
      };
    });
  };

  const validate = () => {
    const missing = questions
      .filter((q) => (responses[q.id]?.selectedOptions?.length ?? 0) === 0)
      .map((q) => q.id);

    setMissingIds(new Set(missing));

    if (missing.length > 0) {
      toast.error(`Responda ${missing.length} pergunta(s) para continuar.`);
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit(buildAnswers());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nenhuma pergunta configurada para este cargo.</p>
        <p className="text-sm mt-2">Entre em contato com o administrador.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[65vh]">
      {/* Progress */}
      <div className="space-y-2 pb-4 flex-shrink-0 px-4">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            {answeredCount} de {questions.length} respondidas
          </span>
          <span>{Math.round(progress)}% completo</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Questions */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 pb-4">
          {questions.map((q, idx) => {
            const selectedOptions = responses[q.id]?.selectedOptions ?? [];
            const observation = responses[q.id]?.observation ?? "";
            const isMissing = missingIds.has(q.id);

            return (
              <Card key={q.id} className={isMissing ? "border-2 border-destructive" : "border-2"}>
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <span className="font-bold text-lg">{idx + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-lg leading-relaxed">{q.question_text}</CardTitle>
                      {q.multi_select && (
                        <Badge variant="outline" className="mt-2">
                          Múltipla escolha
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {q.multi_select ? (
                      q.options.map((option) => (
                        <label
                          key={option.id}
                          className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedOptions.includes(option.option_text)
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <Checkbox 
                            checked={selectedOptions.includes(option.option_text)} 
                            onCheckedChange={() => toggleOption(q, option.option_text)} 
                          />
                          <span className="flex-1">{option.option_text}</span>
                        </label>
                      ))
                    ) : (
                      <RadioGroup 
                        value={selectedOptions[0] || ""} 
                        onValueChange={(value) => setSelectedOptions(q, [value])}
                      >
                        {q.options.map((option) => (
                          <label
                            key={option.id}
                            className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedOptions.includes(option.option_text)
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <RadioGroupItem value={option.option_text} />
                            <span className="flex-1">{option.option_text}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    )}
                  </div>

                  {/* Seller Observation */}
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      Observação do Vendedor (opcional)
                    </Label>
                    <Textarea
                      placeholder='Adicione sua percepção sobre esta resposta do cliente... Ex: "O cliente demonstrou frustração ao falar sobre isso."'
                      value={observation}
                      onChange={(e) => setObservation(q.id, e.target.value)}
                      className="min-h-[80px] resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Sua observação será considerada pela IA na análise final do diagnóstico.
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex flex-col gap-2 pt-4 flex-shrink-0 px-4 border-t">
        <Button onClick={handleSubmit} disabled={submitDisabled}>
          <Sparkles className="h-4 w-4 mr-2" />
          Gerar Diagnóstico
        </Button>
        {submitDisabledReason && <p className="text-xs text-muted-foreground">{submitDisabledReason}</p>}
      </div>
    </div>
  );
}

// Hook to fetch roles from database
export function useDiagnosticRoles() {
  const [roles, setRoles] = useState<DbDiagnosticRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase
          .from("diagnostic_roles")
          .select("*")
          .eq("is_active", true)
          .order("display_order");

        if (error) throw error;
        setRoles((data as any) || []);
      } catch (error) {
        console.error("Error fetching diagnostic roles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, []);

  return { roles, loading };
}
