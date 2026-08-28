import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

export interface SalesStep {
  id: number;
  title: string;
  description: string;
  activities: string[];
  tips: string[];
  duration: string;
}

interface SalesProcessEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steps: SalesStep[];
  onSave: (steps: SalesStep[]) => void;
}

export const SalesProcessEditor = ({ open, onOpenChange, steps: initialSteps, onSave }: SalesProcessEditorProps) => {
  const [steps, setSteps] = useState<SalesStep[]>(initialSteps);
  const [editingStep, setEditingStep] = useState<number | null>(null);
  
  const handleSave = () => {
    onSave(steps);
    toast.success("Processo de vendas atualizado!");
    onOpenChange(false);
  };

  const updateStep = (stepId: number, field: keyof SalesStep, value: any) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, [field]: value } : step
    ));
  };

  const addActivity = (stepId: number) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, activities: [...step.activities, ""] } : step
    ));
  };

  const removeActivity = (stepId: number, index: number) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, activities: step.activities.filter((_, i) => i !== index) }
        : step
    ));
  };

  const updateActivity = (stepId: number, index: number, value: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { 
            ...step, 
            activities: step.activities.map((act, i) => i === index ? value : act) 
          }
        : step
    ));
  };

  const addTip = (stepId: number) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, tips: [...step.tips, ""] } : step
    ));
  };

  const removeTip = (stepId: number, index: number) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, tips: step.tips.filter((_, i) => i !== index) }
        : step
    ));
  };

  const updateTip = (stepId: number, index: number, value: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { 
            ...step, 
            tips: step.tips.map((tip, i) => i === index ? value : tip) 
          }
        : step
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Processo de Vendas</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {steps.map((step) => (
            <div key={step.id} className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <Badge>{step.id}. {step.title}</Badge>
                <Button
                  size="sm"
                  variant={editingStep === step.id ? "default" : "outline"}
                  onClick={() => setEditingStep(editingStep === step.id ? null : step.id)}
                >
                  {editingStep === step.id ? "Fechar" : "Editar"}
                </Button>
              </div>

              {editingStep === step.id && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={step.title}
                      onChange={(e) => updateStep(step.id, "title", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={step.description}
                      onChange={(e) => updateStep(step.id, "description", e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Duração</Label>
                    <Input
                      value={step.duration}
                      onChange={(e) => updateStep(step.id, "duration", e.target.value)}
                      placeholder="Ex: 1-2 dias"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Atividades</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addActivity(step.id)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {step.activities.map((activity, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={activity}
                          onChange={(e) => updateActivity(step.id, index, e.target.value)}
                          placeholder="Descrição da atividade"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeActivity(step.id, index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Dicas</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addTip(step.id)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {step.tips.map((tip, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={tip}
                          onChange={(e) => updateTip(step.id, index, e.target.value)}
                          placeholder="Dica de sucesso"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeTip(step.id, index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
