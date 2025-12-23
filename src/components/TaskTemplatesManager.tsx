import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, FileText, Phone, Mail, MessageCircle, Users, MapPin, Video, Briefcase, Globe, User, Edit, FolderOpen, Tag } from "lucide-react";

interface TaskTemplate {
  id: string;
  name: string;
  task_type: string;
  priority: string;
  description: string | null;
  is_global: boolean;
  created_by: string;
  category: string | null;
}

const defaultCategories = [
  "geral",
  "prospecção",
  "qualificação",
  "apresentação",
  "proposta",
  "negociação",
  "pós-venda",
  "suporte",
];

const taskTypes = [
  { value: "ligacao", label: "Ligação", icon: Phone },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "linkedin", label: "LinkedIn", icon: Users },
  { value: "visita_presencial", label: "Visita Presencial", icon: MapPin },
  { value: "reuniao_online", label: "Reunião Online", icon: Video },
  { value: "visita_feira", label: "Visita a Feira", icon: Briefcase },
  { value: "visita_evento", label: "Visita a Evento", icon: Users },
  { value: "apresentacao", label: "Apresentação", icon: Briefcase },
  { value: "proposta", label: "Proposta", icon: Briefcase },
];

const priorities = [
  { value: "low", label: "Baixa", color: "bg-success/20 text-success" },
  { value: "medium", label: "Média", color: "bg-warning/20 text-warning" },
  { value: "high", label: "Alta", color: "bg-destructive/20 text-destructive" },
];

const TaskTemplatesManager = () => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [activeTab, setActiveTab] = useState("global");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [taskType, setTaskType] = useState("ligacao");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [isGlobal, setIsGlobal] = useState(false);
  const [category, setCategory] = useState("geral");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [availableCategories, setAvailableCategories] = useState<string[]>(defaultCategories);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchTemplates();
    }
  }, [currentUserId, activeTab]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);

    if (user) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      setUserRole(roleData?.role || null);
    }
  };

  const fetchTemplates = async () => {
    try {
      let query = supabase
        .from("task_templates")
        .select("*")
        .order("category")
        .order("name");

      if (activeTab === "personal") {
        query = query.eq("is_global", false).eq("created_by", currentUserId);
      } else {
        query = query.eq("is_global", true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTemplates(data || []);
      
      // Extract unique categories
      const categories = new Set(defaultCategories);
      data?.forEach(t => {
        if (t.category) categories.add(t.category);
      });
      setAvailableCategories(Array.from(categories).sort());
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Digite um nome para o template");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const templateData = {
        name: name.trim(),
        task_type: taskType,
        priority,
        description: description.trim() || null,
        is_global: activeTab === "global" && (userRole === "admin" || userRole === "gestor"),
        created_by: user.id,
        category: category.trim() || "geral",
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from("task_templates")
          .update(templateData)
          .eq("id", editingTemplate.id);

        if (error) throw error;
        toast.success("Template atualizado!");
      } else {
        const { error } = await supabase.from("task_templates").insert(templateData);

        if (error) throw error;
        toast.success("Template criado!");
      }

      resetForm();
      setDialogOpen(false);
      fetchTemplates();
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast.error(error.message || "Erro ao salvar template");
    }
  };

  const handleEdit = (template: TaskTemplate) => {
    setEditingTemplate(template);
    setName(template.name);
    setTaskType(template.task_type);
    setPriority(template.priority);
    setDescription(template.description || "");
    setIsGlobal(template.is_global);
    setCategory(template.category || "geral");
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("task_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Template removido!");
      fetchTemplates();
    } catch (error: any) {
      console.error("Error deleting template:", error);
      toast.error("Erro ao remover template");
    }
  };

  const resetForm = () => {
    setEditingTemplate(null);
    setName("");
    setTaskType("ligacao");
    setPriority("medium");
    setDescription("");
    setIsGlobal(false);
    setCategory("geral");
  };

  const getTaskTypeLabel = (type: string) => {
    return taskTypes.find((t) => t.value === type)?.label || type;
  };

  const getTaskTypeIcon = (type: string) => {
    const taskType = taskTypes.find((t) => t.value === type);
    if (taskType) {
      const Icon = taskType.icon;
      return <Icon size={16} />;
    }
    return <FileText size={16} />;
  };

  const getPriorityBadge = (priority: string) => {
    const p = priorities.find((pr) => pr.value === priority);
    return (
      <Badge className={p?.color || "bg-muted"}>
        {p?.label || priority}
      </Badge>
    );
  };

  const canCreateGlobal = userRole === "admin" || userRole === "gestor";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Templates de Tarefas
        </CardTitle>
        <CardDescription>
          Crie templates completos para agilizar a criação de tarefas com tipo, prioridade e descrição pré-configurados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="global" className="gap-2">
              <Globe size={14} />
              Globais
            </TabsTrigger>
            <TabsTrigger value="personal" className="gap-2">
              <User size={14} />
              Pessoais
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <FolderOpen size={16} className="text-muted-foreground" />
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        <span className="capitalize">{cat}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Novo Template
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingTemplate ? "Editar Template" : "Novo Template de Tarefa"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome do Template *</Label>
                      <Input
                        placeholder="Ex: Follow-up pós-reunião"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Tarefa</Label>
                        <Select value={taskType} onValueChange={setTaskType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {taskTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center gap-2">
                                  <type.icon size={14} />
                                  {type.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Prioridade</Label>
                        <Select value={priority} onValueChange={setPriority}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {priorities.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Descrição Padrão</Label>
                      <Textarea
                        placeholder="Descrição que será preenchida automaticamente..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              <div className="flex items-center gap-2 capitalize">
                                <FolderOpen size={14} />
                                {cat}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {activeTab === "global" && !canCreateGlobal && (
                      <p className="text-sm text-muted-foreground">
                        Apenas administradores e gestores podem criar templates globais. Este template será salvo como pessoal.
                      </p>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSubmit}>
                        {editingTemplate ? "Salvar" : "Criar"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Templates list */}
            {loading ? (
              <p className="text-center text-muted-foreground py-4">Carregando...</p>
            ) : templates.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                {activeTab === "personal" 
                  ? "Nenhum template pessoal cadastrado" 
                  : "Nenhum template global cadastrado"}
              </p>
            ) : (
              <>
                {/* Group templates by category */}
                {Object.entries(
                  templates
                    .filter(t => filterCategory === "all" || t.category === filterCategory)
                    .reduce((acc, template) => {
                      const cat = template.category || "geral";
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(template);
                      return acc;
                    }, {} as Record<string, TaskTemplate[]>)
                ).sort(([a], [b]) => a.localeCompare(b)).map(([categoryName, categoryTemplates]) => (
                  <div key={categoryName} className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <FolderOpen size={14} />
                      <span className="capitalize">{categoryName}</span>
                      <Badge variant="secondary" className="text-xs">{categoryTemplates.length}</Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {categoryTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="p-4 border rounded-lg bg-card hover:border-primary/50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getTaskTypeIcon(template.task_type)}
                              <h4 className="font-medium">{template.name}</h4>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEdit(template)}
                              >
                                <Edit size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(template.id)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {getTaskTypeLabel(template.task_type)}
                            </Badge>
                            {getPriorityBadge(template.priority)}
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {template.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {templates.filter(t => filterCategory === "all" || t.category === filterCategory).length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum template encontrado para esta categoria
                  </p>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TaskTemplatesManager;
