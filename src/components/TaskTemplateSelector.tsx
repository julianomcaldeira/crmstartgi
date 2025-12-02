import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Phone, Mail, MessageCircle, Users, MapPin, Video, Briefcase, FolderOpen } from "lucide-react";

interface TaskTemplate {
  id: string;
  name: string;
  task_type: string;
  priority: string;
  description: string | null;
  is_global: boolean;
  category: string | null;
}

interface TaskTemplateSelectorProps {
  onSelect: (template: { task_type: string; priority: string; description: string }) => void;
}

const taskTypeIcons: Record<string, any> = {
  ligacao: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  linkedin: Users,
  visita_presencial: MapPin,
  reuniao_online: Video,
  visita_feira: Briefcase,
  visita_evento: Users,
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "bg-success/20 text-success" },
  medium: { label: "Média", color: "bg-warning/20 text-warning" },
  high: { label: "Alta", color: "bg-destructive/20 text-destructive" },
};

const TaskTemplateSelector = ({ onSelect }: TaskTemplateSelectorProps) => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("task_templates")
        .select("*")
        .or(`is_global.eq.true,created_by.eq.${user?.id}`)
        .order("category")
        .order("name");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const handleSelect = (template: TaskTemplate) => {
    onSelect({
      task_type: template.task_type,
      priority: template.priority,
      description: template.description || "",
    });
    setOpen(false);
  };

  if (templates.length === 0) return null;

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    const cat = template.category || "geral";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(template);
    return acc;
  }, {} as Record<string, TaskTemplate[]>);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText size={14} />
          Usar Template
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground px-2 py-1">
              Selecione um template para preencher automaticamente
            </p>
            {Object.entries(groupedTemplates).sort(([a], [b]) => a.localeCompare(b)).map(([categoryName, categoryTemplates]) => (
              <div key={categoryName} className="space-y-1">
                <div className="flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
                  <FolderOpen size={12} />
                  <span className="capitalize">{categoryName}</span>
                </div>
                {categoryTemplates.map((template) => {
                  const Icon = taskTypeIcons[template.task_type] || FileText;
                  const priority = priorityLabels[template.priority];
                  return (
                    <button
                      key={template.id}
                      className="w-full flex items-start gap-3 p-2 rounded-md hover:bg-muted text-left transition-colors"
                      onClick={() => handleSelect(template)}
                    >
                      <Icon size={16} className="mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{template.name}</span>
                          {template.is_global && (
                            <Badge variant="secondary" className="text-[10px] px-1">Global</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`text-[10px] px-1.5 ${priority?.color}`}>
                            {priority?.label}
                          </Badge>
                        </div>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default TaskTemplateSelector;
