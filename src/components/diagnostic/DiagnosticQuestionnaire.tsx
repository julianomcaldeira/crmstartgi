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
import type { DiagnosticRole, DiagnosticQuestion } from "@/lib/diagnosticQuestions";

export interface DiagnosticAnswerDraft {
  questionId: string;
  questionText: string;
  selectedOptions: string[];
  observation?: string;
}

type ResponseState = Record<string, { selectedOptions: string[]; observation: string }>;

interface DiagnosticQuestionnaireProps {
  role: DiagnosticRole;
  onSubmit: (answers: DiagnosticAnswerDraft[]) => void | Promise<void>;
  submitDisabled?: boolean;
  submitDisabledReason?: string;
}

function getAnsweredCount(role: DiagnosticRole, responses: ResponseState) {
  return role.questions.reduce((count, q) => {
    const selected = responses[q.id]?.selectedOptions ?? [];
    return count + (selected.length > 0 ? 1 : 0);
  }, 0);
}

export function DiagnosticQuestionnaire({
  role,
  onSubmit,
  submitDisabled,
  submitDisabledReason,
}: DiagnosticQuestionnaireProps) {
  const [responses, setResponses] = useState<ResponseState>({});
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setResponses({});
    setMissingIds(new Set());
  }, [role.id]);

  const answeredCount = useMemo(() => getAnsweredCount(role, responses), [role, responses]);
  const progress = useMemo(() => (role.questions.length ? (answeredCount / role.questions.length) * 100 : 0), [answeredCount, role.questions.length]);

  const setSelectedOptions = (question: DiagnosticQuestion, selectedOptions: string[]) => {
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

  const toggleOption = (question: DiagnosticQuestion, option: string) => {
    const current = responses[question.id]?.selectedOptions ?? [];

    if (question.multiSelect) {
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
    return role.questions.map((q) => {
      const resp = responses[q.id];
      return {
        questionId: q.id,
        questionText: q.question,
        selectedOptions: resp?.selectedOptions ?? [],
        observation: resp?.observation?.trim() ? resp.observation.trim() : undefined,
      };
    });
  };

  const validate = () => {
    const missing = role.questions
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

  return (
    <div className="flex flex-col h-[65vh]">
      {/* Progress */}
      <div className="space-y-2 pb-4 flex-shrink-0 px-4">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            {answeredCount} de {role.questions.length} respondidas
          </span>
          <span>{Math.round(progress)}% completo</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Questions */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 pb-4">
          {role.questions.map((q, idx) => {
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
                      <CardTitle className="text-lg leading-relaxed">{q.question}</CardTitle>
                      {q.multiSelect && (
                        <Badge variant="outline" className="mt-2">
                          Múltipla escolha
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {q.multiSelect ? (
                      q.options.map((option) => (
                        <label
                          key={option}
                          className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedOptions.includes(option)
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <Checkbox checked={selectedOptions.includes(option)} onCheckedChange={() => toggleOption(q, option)} />
                          <span className="flex-1">{option}</span>
                        </label>
                      ))
                    ) : (
                      <RadioGroup value={selectedOptions[0] || ""} onValueChange={(value) => setSelectedOptions(q, [value])}>
                        {q.options.map((option) => (
                          <label
                            key={option}
                            className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedOptions.includes(option)
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
                    <p className="text-xs text-muted-foreground">Sua observação será considerada pela IA na análise final do diagnóstico.</p>
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
