import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, X, AlertCircle, Clock, TrendingDown, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Alert = {
  id: string;
  opportunity_id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: any;
  created_at: string;
  opportunity?: {
    client?: {
      company_name: string;
      trade_name: string;
    };
  };
};

export const AlertsPanel = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    initializeAlerts();
  }, []);

  const initializeAlerts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      await fetchAlerts(user.id);
      subscribeToAlerts(user.id);
    }
  };

  const fetchAlerts = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("opportunity_alerts")
        .select(`
          *,
          opportunity:opportunities(
            client:clients(company_name, trade_name)
          )
        `)
        .eq("assigned_to", userId)
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setAlerts(data || []);
      setUnreadCount(data?.filter(a => !a.is_read).length || 0);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToAlerts = (userId: string) => {
    const channel = supabase
      .channel('opportunity-alerts-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'opportunity_alerts',
          filter: `assigned_to=eq.${userId}`
        },
        (payload) => {
          console.log('New alert for current user:', payload);
          if (currentUserId) {
            fetchAlerts(currentUserId);
          }
          toast.info("Nova notificação recebida", {
            description: (payload.new as any).title
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from("opportunity_alerts")
        .update({ is_read: true })
        .eq("id", alertId);

      if (error) throw error;

      setAlerts(prev => 
        prev.map(a => a.id === alertId ? { ...a, is_read: true } : a)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking alert as read:", error);
    }
  };

  const dismissAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from("opportunity_alerts")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", alertId);

      if (error) throw error;

      setAlerts(prev => prev.filter(a => a.id !== alertId));
      toast.success("Notificação dispensada");
    } catch (error) {
      console.error("Error dismissing alert:", error);
      toast.error("Erro ao dispensar notificação");
    }
  };

  const dismissAllAlerts = async () => {
    if (!currentUserId || alerts.length === 0) return;
    
    try {
      const { error } = await supabase
        .from("opportunity_alerts")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("assigned_to", currentUserId)
        .is("dismissed_at", null);

      if (error) throw error;

      setAlerts([]);
      setUnreadCount(0);
      toast.success("Todas as notificações foram limpas");
    } catch (error) {
      console.error("Error dismissing all alerts:", error);
      toast.error("Erro ao limpar notificações");
    }
  };

  const handleAlertClick = (alert: Alert) => {
    markAsRead(alert.id);
    navigate(`/oportunidades`);
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'close_date_approaching':
        return <Clock className="h-4 w-4" />;
      case 'no_recent_activity':
        return <AlertCircle className="h-4 w-4" />;
      case 'probability_drop':
        return <TrendingDown className="h-4 w-4" />;
      case 'stagnant_stage':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-500';
      case 'high':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-orange-500';
      case 'medium':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-amber-500';
      case 'low':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-500';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-500';
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alertas Inteligentes
              {unreadCount > 0 && (
                <Badge variant="secondary">{unreadCount} não lidas</Badge>
              )}
            </SheetTitle>
            {alerts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={dismissAllAlerts}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Limpar todas
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] mt-4">
          <div className="space-y-3">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : alerts.length === 0 ? (
              <Card className="mt-8">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    Nenhum alerta no momento
                  </p>
                  <p className="text-sm text-muted-foreground text-center mt-2">
                    Você será notificado sobre oportunidades que precisam de atenção
                  </p>
                </CardContent>
              </Card>
            ) : (
              alerts.map((alert) => (
                <Card
                  key={alert.id}
                  className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${getSeverityColor(alert.severity)} ${
                    !alert.is_read ? 'bg-accent/50' : ''
                  }`}
                  onClick={() => handleAlertClick(alert)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${getSeverityColor(alert.severity)}`}>
                        {getAlertIcon(alert.alert_type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-sm line-clamp-1">
                            {alert.title}
                          </h4>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissAlert(alert.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {alert.message}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {alert.severity === 'critical' && 'Crítico'}
                            {alert.severity === 'high' && 'Alto'}
                            {alert.severity === 'medium' && 'Médio'}
                            {alert.severity === 'low' && 'Baixo'}
                          </Badge>
                          
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(alert.created_at), {
                              addSuffix: true,
                              locale: ptBR
                            })}
                          </span>
                        </div>

                        {!alert.is_read && (
                          <Badge variant="secondary" className="mt-2 text-xs">
                            Nova
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};