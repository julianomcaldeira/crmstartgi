import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, MessageSquare, Phone, Mail, MessageCircle, Users, MapPin, Video, Briefcase, Globe, User } from "lucide-react";

interface Template {
  id: string;
  task_type: string;
  message: string;
  created_by: string;
  usage_count: number;
  is_personal: boolean;
}

const taskTypes = [
  { value: "ligacao", label: "Ligação", icon: Phone },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "linkedin", label: "LinkedIn", icon: Users },
  { value: "visita_presencial", label: "Visita Presencial", icon: MapPin },
  { value: "reuniao_online", label: "Reunião Online", icon: Video },
  { value: "visita_feira", label: "Visita a Feira", icon: Briefcase },
  { value: "visita_evento", label: "Visita a Evento", icon: Users },
  { value: "proposta", label: "Proposta", icon: Briefcase },
];

const TaskMessageTemplates = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [newTaskType, setNewTaskType] = useState("ligacao");
  const [isPersonal, setIsPersonal] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [activeTab, setActiveTab] = useState("global");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
  };

  const fetchTemplates = async () => {
    try {
      let query = supabase
        .from("task_message_templates")
        .select("*")
        .order("usage_count", { ascending: false })
        .order("message");

      if (activeTab === "personal") {
        query = query.eq("is_personal", true).eq("created_by", currentUserId);
      } else {
        query = query.eq("is_personal", false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Erro ao carregar mensagens");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newMessage.trim()) {
      toast.error("Digite uma mensagem");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("task_message_templates").insert({
        task_type: newTaskType,
        message: newMessage.trim(),
        created_by: user.id,
        is_personal: activeTab === "personal",
      });

      if (error) throw error;

      toast.success("Mensagem adicionada!");
      setNewMessage("");
      fetchTemplates();
    } catch (error: any) {
      console.error("Error creating template:", error);
      toast.error(error.message || "Erro ao criar mensagem");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("task_message_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Mensagem removida!");
      fetchTemplates();
    } catch (error: any) {
      console.error("Error deleting template:", error);
      toast.error("Erro ao remover mensagem");
    }
  };

  const getTaskTypeLabel = (type: string) => {
    return taskTypes.find((t) => t.value === type)?.label || type;
  };

  const getTaskTypeIcon = (type: string) => {
    const taskType = taskTypes.find((t) => t.value === type);
    if (taskType) {
      const Icon = taskType.icon;
      return <Icon size={14} />;
    }
    return <MessageSquare size={14} />;
  };

  const filteredTemplates = filterType === "all" 
    ? templates 
    : templates.filter((t) => t.task_type === filterType);

  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    if (!acc[template.task_type]) {
      acc[template.task_type] = [];
    }
    acc[template.task_type].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Mensagens Padrão para Tarefas
        </CardTitle>
        <CardDescription>
          Configure atalhos de mensagens rápidas por tipo de tarefa. Mensagens globais são visíveis para todos, pessoais são só suas.
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
            {/* Add new template */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="sm:w-48">
                <Select value={newTaskType} onValueChange={setNewTaskType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
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
              <div className="flex-1">
                <Input
                  placeholder="Digite a mensagem padrão..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Filtrar:</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
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

            {/* Templates list */}
            {loading ? (
              <p className="text-center text-muted-foreground py-4">Carregando...</p>
            ) : Object.keys(groupedTemplates).length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                {activeTab === "personal" 
                  ? "Nenhuma mensagem pessoal cadastrada" 
                  : "Nenhuma mensagem global cadastrada"}
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedTemplates).map(([type, msgs]) => (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      {getTaskTypeIcon(type)}
                      {getTaskTypeLabel(type)}
                      <Badge variant="secondary" className="text-xs">
                        {msgs.length}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {msgs.map((template) => (
                        <Badge
                          key={template.id}
                          variant="outline"
                          className="px-3 py-1.5 text-sm cursor-default group hover:bg-destructive/10"
                        >
                          {template.message}
                          {template.usage_count > 0 && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({template.usage_count})
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          >
                            <Trash2 size={12} />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TaskMessageTemplates;
