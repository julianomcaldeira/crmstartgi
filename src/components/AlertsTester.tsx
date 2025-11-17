import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const AlertsTester = () => {
  const [checking, setChecking] = useState(false);

  const checkAlerts = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-opportunity-alerts');
      
      if (error) throw error;
      
      toast.success(`Verificação concluída`, {
        description: `${data.alerts_created} novos alertas criados`
      });
    } catch (error) {
      console.error('Error checking alerts:', error);
      toast.error('Erro ao verificar alertas', {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Sistema de Alertas</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Verificar oportunidades e gerar alertas inteligentes para vendedores
        </p>
        <Button 
          onClick={checkAlerts} 
          disabled={checking}
          size="sm"
          className="w-full"
        >
          {checking ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Verificar Alertas Agora
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};