import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ProposalRenderer } from "@/components/proposal/ProposalRenderer";
import { buildVariableContext } from "@/lib/proposalTypes";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, AlertCircle } from "lucide-react";
import logo from "@/assets/logo-evolua-crm.png";

export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_proposal_by_token", { _token: token });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) throw new Error("Proposta não encontrada");
        setData(row);
        await supabase.rpc("register_proposal_view", { _token: token });
      } catch (e: any) {
        setError(e.message || "Erro ao carregar proposta");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
      <AlertCircle className="h-12 w-12 text-destructive mb-3" />
      <h1 className="text-xl font-semibold">Proposta indisponível</h1>
      <p className="text-muted-foreground">{error}</p>
    </div>
  );
  if (!data) return null;

  const variables = buildVariableContext({
    client: { company_name: data.client_company },
    validity_days: data.validity_days,
  });
  // The stored variables are authoritative — merge so they override
  const finalVars = { ...variables, ...(data.variables || {}) };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b sticky top-0 z-10 print:hidden">
        <div className="max-w-4xl mx-auto p-3 flex items-center justify-between">
          <img src={logo} alt="Evolua CRM" className="h-10" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}><FileText className="h-4 w-4 mr-1" /> Imprimir / PDF</Button>
          </div>
        </div>
      </header>
      <main className="py-6">
        <div className="mx-auto bg-white shadow-lg" style={{ width: 794 }}>
          <ProposalRenderer blocks={data.blocks || []} variables={finalVars} />
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4 print:hidden">
          Validade: {data.validity_days || 30} dias · Visualização registrada
        </p>
      </main>
    </div>
  );
}
