import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Edit,
  Trash2,
  GripVertical,
  FileSearch,
  Users,
  Briefcase,
  ChevronUp,
  ChevronDown,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface DiagnosticRole {
  id: string;
  role_key: string;
  label: string;
  description: string | null;
  icon: string;
  display_order: number;
  is_active: boolean;
}

interface DiagnosticQuestion {
  id: string;
  role_id: string;
  question_text: string;
  multi_select: boolean;
  display_order: number;
  is_active: boolean;
  options: DiagnosticOption[];
}

interface DiagnosticOption {
  id: string;
  question_id: string;
  option_text: string;
  display_order: number;
}

const iconMap: Record<string, React.ReactNode> = {
  FileSearch: <FileSearch className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  Briefcase: <Briefcase className="h-5 w-5" />,
};

export function DiagnosticQuestionsManager() {
  const [roles, setRoles] = useState<DiagnosticRole[]>([]);
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Role dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<DiagnosticRole | null>(null);
  const [roleForm, setRoleForm] = useState({
    role_key: "",
    label: "",
    description: "",
    icon: "FileSearch",
  });

  // Question dialog state
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<DiagnosticQuestion | null>(null);
  const [questionForm, setQuestionForm] = useState({
    question_text: "",
    multi_select: false,
    options: ["", "", ""],
  });

  // Delete confirmation state
  const [deleteRoleDialog, setDeleteRoleDialog] = useState(false);
  const [deleteQuestionDialog, setDeleteQuestionDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("diagnostic_roles")
        .select("*")
        .order("display_order");

      if (rolesError) throw rolesError;
      setRoles((rolesData as any) || []);

      // Fetch questions with options
      const { data: questionsData, error: questionsError } = await supabase
        .from("diagnostic_questions")
        .select(`
          *,
          diagnostic_question_options (*)
        `)
        .order("display_order");

      if (questionsError) throw questionsError;

      const formattedQuestions = (questionsData || []).map((q: any) => ({
        ...q,
        options: (q.diagnostic_question_options || []).sort(
          (a: any, b: any) => a.display_order - b.display_order
        ),
      }));
      setQuestions(formattedQuestions);

      if (rolesData && rolesData.length > 0 && !selectedRole) {
        setSelectedRole(rolesData[0].id);
      }
    } catch (error) {
      console.error("Error fetching diagnostic data:", error);
      toast.error("Erro ao carregar dados do diagnóstico");
    } finally {
      setLoading(false);
    }
  };

  // Role management
  const openRoleDialog = (role?: DiagnosticRole) => {
    if (role) {
      setEditingRole(role);
      setRoleForm({
        role_key: role.role_key,
        label: role.label,
        description: role.description || "",
        icon: role.icon,
      });
    } else {
      setEditingRole(null);
      setRoleForm({
        role_key: "",
        label: "",
        description: "",
        icon: "FileSearch",
      });
    }
    setRoleDialogOpen(true);
  };

  const saveRole = async () => {
    if (!roleForm.label || !roleForm.role_key) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      if (editingRole) {
        const { error } = await supabase
          .from("diagnostic_roles")
          .update({
            role_key: roleForm.role_key,
            label: roleForm.label,
            description: roleForm.description || null,
            icon: roleForm.icon,
          })
          .eq("id", editingRole.id);

        if (error) throw error;
        toast.success("Cargo atualizado com sucesso!");
      } else {
        const maxOrder = Math.max(...roles.map((r) => r.display_order), 0);
        const { error } = await supabase.from("diagnostic_roles").insert({
          role_key: roleForm.role_key,
          label: roleForm.label,
          description: roleForm.description || null,
          icon: roleForm.icon,
          display_order: maxOrder + 1,
        });

        if (error) throw error;
        toast.success("Cargo criado com sucesso!");
      }

      setRoleDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao salvar cargo: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleRoleActive = async (role: DiagnosticRole) => {
    try {
      const { error } = await supabase
        .from("diagnostic_roles")
        .update({ is_active: !role.is_active })
        .eq("id", role.id);

      if (error) throw error;
      toast.success(role.is_active ? "Cargo desativado" : "Cargo ativado");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao atualizar cargo: " + error.message);
    }
  };

  const deleteRole = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from("diagnostic_roles")
        .delete()
        .eq("id", itemToDelete);

      if (error) throw error;
      toast.success("Cargo excluído com sucesso!");
      setDeleteRoleDialog(false);
      setItemToDelete(null);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir cargo: " + error.message);
    }
  };

  // Question management
  const openQuestionDialog = (question?: DiagnosticQuestion) => {
    if (question) {
      setEditingQuestion(question);
      setQuestionForm({
        question_text: question.question_text,
        multi_select: question.multi_select,
        options: question.options.map((o) => o.option_text),
      });
    } else {
      setEditingQuestion(null);
      setQuestionForm({
        question_text: "",
        multi_select: false,
        options: ["", "", ""],
      });
    }
    setQuestionDialogOpen(true);
  };

  const saveQuestion = async () => {
    if (!questionForm.question_text || !selectedRole) {
      toast.error("Preencha a pergunta");
      return;
    }

    const validOptions = questionForm.options.filter((o) => o.trim());
    if (validOptions.length < 2) {
      toast.error("Adicione pelo menos 2 opções de resposta");
      return;
    }

    setSaving(true);
    try {
      if (editingQuestion) {
        // Update question
        const { error: qError } = await supabase
          .from("diagnostic_questions")
          .update({
            question_text: questionForm.question_text,
            multi_select: questionForm.multi_select,
          })
          .eq("id", editingQuestion.id);

        if (qError) throw qError;

        // Delete old options and insert new ones
        await supabase
          .from("diagnostic_question_options")
          .delete()
          .eq("question_id", editingQuestion.id);

        const optionsToInsert = validOptions.map((opt, idx) => ({
          question_id: editingQuestion.id,
          option_text: opt,
          display_order: idx + 1,
        }));

        const { error: oError } = await supabase
          .from("diagnostic_question_options")
          .insert(optionsToInsert);

        if (oError) throw oError;
        toast.success("Pergunta atualizada com sucesso!");
      } else {
        // Create question
        const roleQuestions = questions.filter((q) => q.role_id === selectedRole);
        const maxOrder = Math.max(...roleQuestions.map((q) => q.display_order), 0);

        const { data: newQuestion, error: qError } = await supabase
          .from("diagnostic_questions")
          .insert({
            role_id: selectedRole,
            question_text: questionForm.question_text,
            multi_select: questionForm.multi_select,
            display_order: maxOrder + 1,
          })
          .select()
          .single();

        if (qError) throw qError;

        const optionsToInsert = validOptions.map((opt, idx) => ({
          question_id: newQuestion.id,
          option_text: opt,
          display_order: idx + 1,
        }));

        const { error: oError } = await supabase
          .from("diagnostic_question_options")
          .insert(optionsToInsert);

        if (oError) throw oError;
        toast.success("Pergunta criada com sucesso!");
      }

      setQuestionDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao salvar pergunta: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleQuestionActive = async (question: DiagnosticQuestion) => {
    try {
      const { error } = await supabase
        .from("diagnostic_questions")
        .update({ is_active: !question.is_active })
        .eq("id", question.id);

      if (error) throw error;
      toast.success(question.is_active ? "Pergunta desativada" : "Pergunta ativada");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao atualizar pergunta: " + error.message);
    }
  };

  const deleteQuestion = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from("diagnostic_questions")
        .delete()
        .eq("id", itemToDelete);

      if (error) throw error;
      toast.success("Pergunta excluída com sucesso!");
      setDeleteQuestionDialog(false);
      setItemToDelete(null);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir pergunta: " + error.message);
    }
  };

  const moveQuestion = async (question: DiagnosticQuestion, direction: "up" | "down") => {
    const roleQuestions = questions
      .filter((q) => q.role_id === question.role_id)
      .sort((a, b) => a.display_order - b.display_order);

    const currentIndex = roleQuestions.findIndex((q) => q.id === question.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= roleQuestions.length) return;

    const targetQuestion = roleQuestions[targetIndex];

    try {
      await supabase
        .from("diagnostic_questions")
        .update({ display_order: targetQuestion.display_order })
        .eq("id", question.id);

      await supabase
        .from("diagnostic_questions")
        .update({ display_order: question.display_order })
        .eq("id", targetQuestion.id);

      fetchData();
    } catch (error: any) {
      toast.error("Erro ao reordenar pergunta: " + error.message);
    }
  };

  const addOptionField = () => {
    setQuestionForm((prev) => ({
      ...prev,
      options: [...prev.options, ""],
    }));
  };

  const removeOptionField = (index: number) => {
    setQuestionForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const updateOption = (index: number, value: string) => {
    setQuestionForm((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === index ? value : opt)),
    }));
  };

  const filteredQuestions = questions
    .filter((q) => q.role_id === selectedRole)
    .sort((a, b) => a.display_order - b.display_order);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Roles Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Cargos do Diagnóstico</CardTitle>
          <Button size="sm" onClick={() => openRoleDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cargo
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {roles.map((role) => (
              <Card
                key={role.id}
                className={`cursor-pointer transition-all ${
                  selectedRole === role.id
                    ? "ring-2 ring-primary"
                    : "hover:border-primary/50"
                } ${!role.is_active ? "opacity-50" : ""}`}
                onClick={() => setSelectedRole(role.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {iconMap[role.icon] || <FileSearch className="h-5 w-5" />}
                      </div>
                      <div>
                        <h4 className="font-medium">{role.label}</h4>
                        <p className="text-sm text-muted-foreground">
                          {role.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!role.is_active && (
                        <Badge variant="secondary" className="text-xs">
                          Inativo
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRoleDialog(role);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    {questions.filter((q) => q.role_id === role.id).length} perguntas
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Questions Section */}
      {selectedRole && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              Perguntas - {roles.find((r) => r.id === selectedRole)?.label}
            </CardTitle>
            <Button size="sm" onClick={() => openQuestionDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Pergunta
            </Button>
          </CardHeader>
          <CardContent>
            {filteredQuestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma pergunta cadastrada para este cargo.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQuestions.map((question, index) => (
                  <Card
                    key={question.id}
                    className={!question.is_active ? "opacity-50" : ""}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === 0}
                            onClick={() => moveQuestion(question, "up")}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === filteredQuestions.length - 1}
                            onClick={() => moveQuestion(question, "down")}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-primary">
                                  {index + 1}.
                                </span>
                                <h4 className="font-medium">
                                  {question.question_text}
                                </h4>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {question.multi_select && (
                                  <Badge variant="outline" className="text-xs">
                                    Múltipla escolha
                                  </Badge>
                                )}
                                {!question.is_active && (
                                  <Badge variant="secondary" className="text-xs">
                                    Inativa
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openQuestionDialog(question)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => toggleQuestionActive(question)}
                              >
                                {question.is_active ? (
                                  <X className="h-4 w-4" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setItemToDelete(question.id);
                                  setDeleteQuestionDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {question.options.map((opt) => (
                              <Badge
                                key={opt.id}
                                variant="secondary"
                                className="text-xs"
                              >
                                {opt.option_text}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRole ? "Editar Cargo" : "Novo Cargo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Chave do Cargo *</Label>
              <Input
                value={roleForm.role_key}
                onChange={(e) =>
                  setRoleForm({ ...roleForm, role_key: e.target.value })
                }
                placeholder="ex: analista, gerente, diretor"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome do Cargo *</Label>
              <Input
                value={roleForm.label}
                onChange={(e) =>
                  setRoleForm({ ...roleForm, label: e.target.value })
                }
                placeholder="ex: Analista de Licitação"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={roleForm.description}
                onChange={(e) =>
                  setRoleForm({ ...roleForm, description: e.target.value })
                }
                placeholder="Descrição do cargo..."
              />
            </div>
            <div className="space-y-2">
              <Label>Ícone</Label>
              <Select
                value={roleForm.icon}
                onValueChange={(value) =>
                  setRoleForm({ ...roleForm, icon: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FileSearch">
                    <div className="flex items-center gap-2">
                      <FileSearch className="h-4 w-4" /> FileSearch
                    </div>
                  </SelectItem>
                  <SelectItem value="Users">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" /> Users
                    </div>
                  </SelectItem>
                  <SelectItem value="Briefcase">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" /> Briefcase
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            {editingRole && (
              <Button
                variant="destructive"
                onClick={() => {
                  setItemToDelete(editingRole.id);
                  setRoleDialogOpen(false);
                  setDeleteRoleDialog(true);
                }}
              >
                Excluir
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveRole} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Dialog */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? "Editar Pergunta" : "Nova Pergunta"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pergunta *</Label>
              <Textarea
                value={questionForm.question_text}
                onChange={(e) =>
                  setQuestionForm({ ...questionForm, question_text: e.target.value })
                }
                placeholder="Digite a pergunta..."
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={questionForm.multi_select}
                onCheckedChange={(checked) =>
                  setQuestionForm({ ...questionForm, multi_select: checked })
                }
              />
              <Label>Permitir múltiplas respostas</Label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Opções de Resposta *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOptionField}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Opção
                </Button>
              </div>
              <div className="space-y-2">
                {questionForm.options.map((opt, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-6">
                      {index + 1}.
                    </span>
                    <Input
                      value={opt}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Opção ${index + 1}`}
                    />
                    {questionForm.options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => removeOptionField(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveQuestion} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Confirmation */}
      <AlertDialog open={deleteRoleDialog} onOpenChange={setDeleteRoleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cargo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este cargo? Todas as perguntas
              associadas também serão excluídas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Question Confirmation */}
      <AlertDialog open={deleteQuestionDialog} onOpenChange={setDeleteQuestionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pergunta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta pergunta? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteQuestion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
