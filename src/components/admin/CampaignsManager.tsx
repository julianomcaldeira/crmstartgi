import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, GripVertical, Calendar, Target, Users, CheckCircle2, Pause, Play, Archive, Megaphone, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { formatDateLocaleBR } from "@/lib/dateUtils";

const TASK_TYPES = [
  { value: "ligacao", label: "Ligação" },
  { value: "email", label: "E-mail" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "visita_presencial", label: "Visita Presencial" },
  { value: "reuniao_online", label: "Reunião Online" },
  { value: "visita_feira", label: "Visita a Feira" },
  { value: "visita_evento", label: "Visita a Evento" },
  { value: "pesquisa_inicial", label: "Pesquisa Inicial" },
];

const PRIORITIES = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground", icon: Edit },
  active: { label: "Ativa", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: Play },
  paused: { label: "Pausada", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Pause },
  finished: { label: "Finalizada", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: Archive },
};

const getInstructionLabel = (taskType: string): string | null => {
  switch (taskType) {
    case "email": return "📧 Conteúdo do E-mail";
    case "ligacao": return "📞 Roteiro da Ligação";
    case "whatsapp": return "💬 Mensagem do WhatsApp";
    case "linkedin": return "🔗 Mensagem do LinkedIn";
    case "visita_presencial": return "🏢 Roteiro da Visita";
    case "reuniao_online": return "💻 Pauta da Reunião";
    case "visita_feira": return "🎪 Orientações da Feira";
    case "visita_evento": return "🎤 Orientações do Evento";
    case "pesquisa_inicial": return "🔍 Instruções da Pesquisa";
    default: return null;
  }
};

const getInstructionPlaceholder = (taskType: string): string => {
  switch (taskType) {
    case "email": return "Escreva aqui o conteúdo/modelo do e-mail que o vendedor deve enviar...";
    case "ligacao": return "Descreva o que o vendedor deve falar nesta ligação, pontos-chave, argumentos...";
    case "whatsapp": return "Escreva a mensagem modelo que o vendedor deve enviar pelo WhatsApp...";
    case "linkedin": return "Escreva a mensagem modelo para enviar no LinkedIn...";
    case "visita_presencial": return "Descreva os pontos a abordar na visita presencial...";
    case "reuniao_online": return "Defina a pauta e pontos a discutir na reunião online...";
    default: return "Instruções detalhadas para o vendedor executar esta tarefa...";
  }
};

interface TaskTemplate {
  id?: string;
  title: string;
  description: string;
  task_type: string;
  priority: string;
  start_date: string;
  end_date: string;
  instructions: string;
  display_order: number;
}

export const CampaignsManager = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [linkedCounts, setLinkedCounts] = useState<Record<string, number>>({});
  const [linkedBySeller, setLinkedBySeller] = useState<Record<string, { name: string; count: number }[]>>({});

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    status: "draft",
  });
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar campanhas");
      setLoading(false);
      return;
    }

    setCampaigns(data || []);

    // Fetch linked counts + breakdown by seller
    if (data && data.length > 0) {
      const { data: links } = await supabase
        .from("client_campaigns")
        .select("campaign_id, linked_by, profiles:profiles!client_campaigns_linked_by_fkey(full_name)");

      const counts: Record<string, number> = {};
      const bySeller: Record<string, Record<string, { name: string; count: number }>> = {};
      (links || []).forEach((l: any) => {
        counts[l.campaign_id] = (counts[l.campaign_id] || 0) + 1;
        const sellerId = l.linked_by;
        const sellerName = l.profiles?.full_name || "Desconhecido";
        if (!bySeller[l.campaign_id]) bySeller[l.campaign_id] = {};
        if (!bySeller[l.campaign_id][sellerId]) {
          bySeller[l.campaign_id][sellerId] = { name: sellerName, count: 0 };
        }
        bySeller[l.campaign_id][sellerId].count += 1;
      });
      setLinkedCounts(counts);
      const grouped: Record<string, { name: string; count: number }[]> = {};
      Object.entries(bySeller).forEach(([cid, sellers]) => {
        grouped[cid] = Object.values(sellers).sort((a, b) => b.count - a.count);
      });
      setLinkedBySeller(grouped);
    }

    setLoading(false);
  };

  const openDialog = async (campaign?: any) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setFormData({
        name: campaign.name,
        description: campaign.description || "",
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        status: campaign.status,
      });
      // Fetch task templates
      const { data: templates } = await supabase
        .from("campaign_task_templates")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("display_order");
      setTaskTemplates(templates || []);
    } else {
      setEditingCampaign(null);
      setFormData({ name: "", description: "", start_date: "", end_date: "", status: "draft" });
      setTaskTemplates([]);
    }
    setDialogOpen(true);
  };

  const addTaskTemplate = () => {
    setTaskTemplates(prev => [
      ...prev,
      {
        title: "",
        description: "",
        task_type: "ligacao",
        priority: "medium",
        start_date: formData.start_date || "",
        end_date: formData.end_date || "",
        instructions: "",
        display_order: prev.length,
      },
    ]);
  };

  const updateTaskTemplate = (index: number, field: string, value: any) => {
    setTaskTemplates(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const removeTaskTemplate = (index: number) => {
    setTaskTemplates(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Preencha o nome da campanha");
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      toast.error("Preencha as datas de início e fim");
      return;
    }
    // Validate task templates
    for (const t of taskTemplates) {
      if (!t.title.trim()) {
        toast.error("Todas as tarefas precisam ter um título");
        return;
      }
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      let campaignId: string;

      if (editingCampaign) {
        const { error } = await supabase
          .from("campaigns")
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            start_date: formData.start_date,
            end_date: formData.end_date,
            status: formData.status,
          })
          .eq("id", editingCampaign.id);
        if (error) throw error;
        campaignId = editingCampaign.id;

        // Delete old templates and recreate
        await supabase
          .from("campaign_task_templates")
          .delete()
          .eq("campaign_id", campaignId);
      } else {
        const { data, error } = await supabase
          .from("campaigns")
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            start_date: formData.start_date,
            end_date: formData.end_date,
            status: formData.status,
            created_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;
        campaignId = data.id;
      }

      // Insert task templates
      if (taskTemplates.length > 0) {
        const templatesData = taskTemplates.map((t, i) => ({
          campaign_id: campaignId,
          title: t.title.trim(),
          description: t.description?.trim() || null,
          task_type: t.task_type,
          priority: t.priority,
          start_date: t.start_date || null,
          end_date: t.end_date || null,
          instructions: t.instructions?.trim() || null,
          display_order: i,
        }));
        const { error: tplErr } = await supabase
          .from("campaign_task_templates")
          .insert(templatesData);
        if (tplErr) throw tplErr;
      }

      toast.success(editingCampaign ? "Campanha atualizada!" : "Campanha criada!");
      setDialogOpen(false);
      fetchCampaigns();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!campaignToDelete) return;
    try {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", campaignToDelete.id);
      if (error) throw error;
      toast.success("Campanha excluída!");
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
      fetchCampaigns();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const handleStatusChange = async (campaignId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: newStatus })
        .eq("id", campaignId);
      if (error) throw error;
      toast.success("Status atualizado!");
      fetchCampaigns();
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Campanhas de Vendas</h2>
            <p className="text-sm text-muted-foreground">Configure campanhas e automatize tarefas para sua equipe</p>
          </div>
        </div>
        <Button onClick={() => openDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: campaigns.length, icon: Megaphone, color: "text-primary" },
          { label: "Ativas", value: campaigns.filter(c => c.status === "active").length, icon: Play, color: "text-green-500" },
          { label: "Rascunhos", value: campaigns.filter(c => c.status === "draft").length, icon: Edit, color: "text-muted-foreground" },
          { label: "Prospects Vinculados", value: Object.values(linkedCounts).reduce((a, b) => a + b, 0), icon: Users, color: "text-blue-500" },
        ].map((s, i) => (
          <Card key={i} className="p-4 flex items-center gap-3">
            <s.icon className={`h-8 w-8 ${s.color}`} />
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Campaign list */}
      {campaigns.length === 0 ? (
        <Card className="p-12 text-center">
          <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma campanha criada</h3>
          <p className="text-muted-foreground mb-4">Crie sua primeira campanha de vendas para automatizar tarefas da equipe</p>
          <Button onClick={() => openDialog()} className="gap-2">
            <Plus className="h-4 w-4" /> Criar Campanha
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map(campaign => {
            const statusInfo = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
            const StatusIcon = statusInfo.icon;
            const count = linkedCounts[campaign.id] || 0;
            return (
              <Card key={campaign.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-foreground truncate">{campaign.name}</h3>
                      <Badge className={`${statusInfo.color} gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusInfo.label}
                      </Badge>
                    </div>
                    {campaign.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{campaign.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateLocaleBR(campaign.start_date)} — {formatDateLocaleBR(campaign.end_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {count} prospect{count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {campaign.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(campaign.id, "active")} className="gap-1">
                        <Play className="h-3.5 w-3.5" /> Ativar
                      </Button>
                    )}
                    {campaign.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(campaign.id, "paused")} className="gap-1">
                        <Pause className="h-3.5 w-3.5" /> Pausar
                      </Button>
                    )}
                    {campaign.status === "paused" && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(campaign.id, "active")} className="gap-1">
                        <Play className="h-3.5 w-3.5" /> Retomar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openDialog(campaign)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setCampaignToDelete(campaign); setDeleteDialogOpen(true); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Campaign Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              {editingCampaign ? "Editar Campanha" : "Nova Campanha"}
            </DialogTitle>
            <DialogDescription>
              Configure a campanha e defina as tarefas que serão criadas automaticamente para cada prospect vinculado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label>Nome da Campanha *</Label>
                <Input
                  placeholder="Ex: Campanha Q2 - Prospecção Ativa"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descreva o objetivo e estratégia da campanha..."
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data Início *</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Data Fim *</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
              {editingCampaign && (
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={v => setFormData(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Rascunho</SelectItem>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="paused">Pausada</SelectItem>
                      <SelectItem value="finished">Finalizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Task Templates */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-primary" />
                  <Label className="text-base font-semibold">Tarefas da Campanha</Label>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addTaskTemplate} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Adicionar Tarefa
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Defina as tarefas que serão criadas automaticamente quando um vendedor vincular esta campanha a um prospect.
              </p>

              {taskTemplates.length === 0 ? (
                <Card className="p-6 text-center border-dashed">
                  <ListChecks className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma tarefa definida. Adicione tarefas para automatizar o fluxo da campanha.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {taskTemplates.map((template, index) => {
                    const instructionLabel = getInstructionLabel(template.task_type);
                    const instructionPlaceholder = getInstructionPlaceholder(template.task_type);
                    return (
                    <Card key={index} className="p-4 border-l-4 border-l-primary/50">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-1 mt-2 text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                          <span className="text-xs font-mono font-bold">#{index + 1}</span>
                        </div>
                        <div className="flex-1 space-y-3">
                          {/* Row 1: Title */}
                          <div>
                            <Label className="text-xs">Título *</Label>
                            <Input
                              placeholder="Ex: Primeira ligação de apresentação"
                              value={template.title}
                              onChange={e => updateTaskTemplate(index, "title", e.target.value)}
                            />
                          </div>
                          {/* Row 2: Tipo, Prioridade, Data Início, Data Fim */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <Label className="text-xs">Tipo</Label>
                              <Select value={template.task_type} onValueChange={v => { updateTaskTemplate(index, "task_type", v); }}>
                                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Prioridade</Label>
                              <Select value={template.priority} onValueChange={v => updateTaskTemplate(index, "priority", v)}>
                                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Data Início</Label>
                              <Input
                                type="date"
                                value={template.start_date}
                                onChange={e => updateTaskTemplate(index, "start_date", e.target.value)}
                                className="text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Data Fim</Label>
                              <Input
                                type="date"
                                value={template.end_date}
                                onChange={e => updateTaskTemplate(index, "end_date", e.target.value)}
                                className="text-xs"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Descrição</Label>
                            <Input
                              placeholder="Instruções gerais para o vendedor..."
                              value={template.description}
                              onChange={e => updateTaskTemplate(index, "description", e.target.value)}
                            />
                          </div>
                          {instructionLabel && (
                            <div>
                              <Label className="text-xs text-primary">{instructionLabel}</Label>
                              <Textarea
                                placeholder={instructionPlaceholder}
                                value={template.instructions}
                                onChange={e => updateTaskTemplate(index, "instructions", e.target.value)}
                                rows={3}
                                className="text-sm"
                              />
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Este conteúdo aparecerá como observação não editável para o vendedor na tarefa.
                              </p>
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive mt-2"
                          onClick={() => removeTaskTemplate(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editingCampaign ? "Salvar Alterações" : "Criar Campanha"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha "{campaignToDelete?.name}" será excluída permanentemente, incluindo todas as tarefas modelo. 
              As tarefas já criadas nos prospects não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
