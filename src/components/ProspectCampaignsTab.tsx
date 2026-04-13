import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Megaphone, Calendar, CheckCircle2, Clock, ListChecks, Trash2, Target } from "lucide-react";
import { toast } from "sonner";
import { formatDateLocaleBR } from "@/lib/dateUtils";

interface ProspectCampaignsTabProps {
  clientId: string;
  clientName: string;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  ligacao: "Ligação",
  email: "E-mail",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  visita_presencial: "Visita Presencial",
  reuniao_online: "Reunião Online",
  visita_feira: "Visita a Feira",
  visita_evento: "Visita a Evento",
  pesquisa_inicial: "Pesquisa Inicial",
};

export const ProspectCampaignsTab = ({ clientId, clientName }: ProspectCampaignsTabProps) => {
  const [availableCampaigns, setAvailableCampaigns] = useState<any[]>([]);
  const [linkedCampaigns, setLinkedCampaigns] = useState<any[]>([]);
  const [campaignTasks, setCampaignTasks] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);
  const [unlinkDialog, setUnlinkDialog] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all active campaigns
      const { data: allCampaigns } = await supabase
        .from("campaigns")
        .select("*")
        .in("status", ["active", "paused"])
        .order("name");

      // Fetch linked campaigns for this client
      const { data: links } = await supabase
        .from("client_campaigns")
        .select("*, campaign:campaigns(*)")
        .eq("client_id", clientId);

      const linkedIds = new Set((links || []).map((l: any) => l.campaign_id));
      setLinkedCampaigns(links || []);
      setAvailableCampaigns((allCampaigns || []).filter(c => !linkedIds.has(c.id)));

      // Fetch task completion for linked campaigns
      if (links && links.length > 0) {
        const taskMap: Record<string, any[]> = {};
        for (const link of links) {
          // Fetch tasks created for this campaign-client combo
          const { data: tasks } = await supabase
            .from("tasks")
            .select("id, title, status, task_type, due_date, completed_at")
            .eq("client_id", clientId)
            .like("description", `%[Campanha: ${link.campaign?.name}]%`);
          taskMap[link.campaign_id] = tasks || [];
        }
        setCampaignTasks(taskMap);
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkCampaign = async (campaign: any) => {
    setLinking(campaign.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Insert link
      const { error: linkError } = await supabase
        .from("client_campaigns")
        .insert({
          client_id: clientId,
          campaign_id: campaign.id,
          linked_by: user.id,
        });
      if (linkError) throw linkError;

      // Fetch task templates for this campaign
      const { data: templates } = await supabase
        .from("campaign_task_templates")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("display_order");

      // Create tasks based on templates
      if (templates && templates.length > 0) {
        const campaignStart = new Date(campaign.start_date);
        const tasksToCreate = templates.map(tpl => {
          const dueDate = new Date(campaignStart);
          dueDate.setDate(dueDate.getDate() + tpl.end_day_offset);
          dueDate.setHours(18, 0, 0, 0);

          // Build description with campaign tag and instructions
          let desc = tpl.description || "";
          if (tpl.instructions) {
            desc += `\n\n━━━ Orientações da Campanha (não editável) ━━━\n${tpl.instructions}`;
          }
          desc += `\n\n[Campanha: ${campaign.name}]`;

          return {
            title: `${TASK_TYPE_LABELS[tpl.task_type] || tpl.task_type} - ${tpl.title}`,
            description: desc.trim(),
            client_id: clientId,
            task_type: tpl.task_type as any,
            priority: tpl.priority as "low" | "medium" | "high",
            due_date: dueDate.toISOString(),
            status: "pending" as const,
            assigned_to: user.id,
            created_by: user.id,
          };
        });

        const { error: tasksError } = await supabase.from("tasks").insert(tasksToCreate);
        if (tasksError) throw tasksError;

        toast.success(`Campanha vinculada! ${tasksToCreate.length} tarefa(s) criada(s) automaticamente.`);
      } else {
        toast.success("Campanha vinculada!");
      }

      fetchData();
    } catch (error: any) {
      toast.error("Erro ao vincular: " + error.message);
    } finally {
      setLinking(null);
    }
  };

  const handleUnlink = async () => {
    if (!unlinkDialog) return;
    try {
      const campaignName = unlinkDialog.campaign?.name;

      // Delete all tasks related to this campaign for this client
      if (campaignName) {
        const { error: tasksError } = await supabase
          .from("tasks")
          .delete()
          .eq("client_id", clientId)
          .like("description", `%[Campanha: ${campaignName}]%`);
        if (tasksError) throw tasksError;
      }

      const { error } = await supabase
        .from("client_campaigns")
        .delete()
        .eq("id", unlinkDialog.id);
      if (error) throw error;

      toast.success("Campanha desvinculada e tarefas removidas!");
      setUnlinkDialog(null);
      fetchData();
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Linked campaigns */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Campanhas Vinculadas
        </h3>

        {linkedCampaigns.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <Megaphone className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-1">Nenhuma campanha vinculada</p>
            <p className="text-xs text-muted-foreground">Vincule uma campanha abaixo para gerar tarefas automaticamente</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {linkedCampaigns.map(link => {
              const campaign = link.campaign;
              if (!campaign) return null;
              const tasks = campaignTasks[campaign.id] || [];
              const completed = tasks.filter(t => t.status === "completed").length;
              const total = tasks.length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

              return (
                <Card key={link.id} className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        <Megaphone className="h-4 w-4 text-primary" />
                        {campaign.name}
                      </h4>
                      {campaign.description && (
                        <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setUnlinkDialog(link)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDateLocaleBR(campaign.start_date)} — {formatDateLocaleBR(campaign.end_date)}
                    </span>
                    <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
                      {campaign.status === "active" ? "Ativa" : campaign.status === "paused" ? "Pausada" : campaign.status}
                    </Badge>
                  </div>

                  {/* Progress */}
                  {total > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <ListChecks className="h-4 w-4" />
                          Progresso das Tarefas
                        </span>
                        <span className="font-medium text-foreground">
                          {completed}/{total} ({pct}%)
                        </span>
                      </div>
                      <Progress value={pct} className="h-2" />
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" /> {completed} concluída(s)
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-yellow-500" /> {total - completed} pendente(s)
                        </span>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Available campaigns */}
      {availableCampaigns.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Campanhas Disponíveis
          </h3>
          <div className="grid gap-3">
            {availableCampaigns.map(campaign => (
              <Card key={campaign.id} className="p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-foreground truncate">{campaign.name}</h4>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDateLocaleBR(campaign.start_date)} — {formatDateLocaleBR(campaign.end_date)}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleLinkCampaign(campaign)}
                  disabled={linking === campaign.id}
                  className="gap-1 ml-3"
                >
                  {linking === campaign.id ? (
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Vincular
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Unlink dialog */}
      <AlertDialog open={!!unlinkDialog} onOpenChange={(open) => !open && setUnlinkDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha será desvinculada deste prospect e todas as tarefas geradas por ela serão excluídas automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlink} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
