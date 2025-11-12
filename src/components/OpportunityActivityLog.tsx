import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Edit, 
  TrendingUp, 
  Paperclip, 
  X, 
  Clock,
  User
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Activity {
  id: string;
  activity_type: string;
  description: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
  created_by_profile?: {
    full_name: string;
  };
}

interface OpportunityActivityLogProps {
  opportunityId: string;
}

export function OpportunityActivityLog({ opportunityId }: OpportunityActivityLogProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();

    // Set up realtime subscription
    const channel = supabase
      .channel(`opportunity_activities:${opportunityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'opportunity_activities',
          filter: `opportunity_id=eq.${opportunityId}`,
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [opportunityId]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("opportunity_activities")
        .select("*")
        .eq("opportunity_id", opportunityId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(a => a.created_by))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        const activitiesWithProfiles = data.map(activity => ({
          ...activity,
          created_by_profile: profileMap.get(activity.created_by),
        }));

        setActivities(activitiesWithProfiles);
      } else {
        setActivities([]);
      }
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "status_change":
        return <TrendingUp className="h-4 w-4 text-primary" />;
      case "edit":
        return <Edit className="h-4 w-4 text-info" />;
      case "attachment_added":
        return <Paperclip className="h-4 w-4 text-success" />;
      case "attachment_removed":
        return <X className="h-4 w-4 text-destructive" />;
      case "created":
        return <FileText className="h-4 w-4 text-primary" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "status_change":
        return "border-l-primary";
      case "edit":
        return "border-l-info";
      case "attachment_added":
        return "border-l-success";
      case "attachment_removed":
        return "border-l-destructive";
      case "created":
        return "border-l-primary";
      default:
        return "border-l-muted";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Atividades</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Histórico de Atividades
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma atividade registrada
            </p>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className={`border-l-4 pl-4 py-3 rounded-r-lg bg-muted/30 ${getActivityColor(
                    activity.activity_type
                  )}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">{getActivityIcon(activity.activity_type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.description}</p>
                      
                      {activity.old_value && activity.new_value && (
                        <div className="mt-2 text-xs space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-destructive/10">
                              Anterior: {activity.old_value}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-success/10">
                              Novo: {activity.new_value}
                            </Badge>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {activity.created_by_profile?.full_name || "Sistema"}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(activity.created_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}