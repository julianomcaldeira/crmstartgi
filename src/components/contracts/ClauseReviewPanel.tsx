import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, MessageSquare, Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  revision: any;
  contract: any;
  canReview: boolean;
  onClose: () => void;
}

export function ClauseReviewPanel({ revision, contract, canReview, onClose }: Props) {
  const [decisions, setDecisions] = useState<any[]>([]);
  const [summary, setSummary] = useState(revision.admin_summary || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [revision.id]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contract_clause_decisions")
      .select("*")
      .eq("revision_id", revision.id)
      .order("position", { ascending: true });
    setDecisions(data || []);
    setLoading(false);
  };

  const updateDecision = (idx: number, patch: any) => {
    setDecisions(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  };

  const saveDecision = async (d: any) => {
    if (!canReview) return;
    const { error } = await supabase
      .from("contract_clause_decisions")
      .update({
        decision: d.decision,
        admin_comment: d.admin_comment,
        counter_text: d.counter_text,
        decided_at: new Date().toISOString(),
      })
      .eq("id", d.id);
    if (error) toast.error(error.message);
  };

  const concludeReview = async () => {
    const pending = decisions.filter(d => !d.decision);
    if (pending.length > 0) {
      toast.error(`Faltam ${pending.length} cláusula(s) sem decisão`);
      return;
    }
    setSaving(true);
    try {
      // Salva todas as decisões
      for (const d of decisions) await saveDecision(d);

      // Atualiza summary + status reviewed antes de gerar o docx (function lê do banco)
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("contract_clause_revisions").update({
        status: "reviewed",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user!.id,
        admin_summary: summary || null,
      }).eq("id", revision.id);

      // Gera DOCX real via edge function
      const { error: docxErr } = await supabase.functions.invoke("generate-negotiation-docx", {
        body: { revision_id: revision.id },
      });
      if (docxErr) {
        toast.warning("Revisão concluída, mas houve erro ao gerar o Word. Tente reabrir.");
      }

      // Notifica vendedor por e-mail com resumo cláusula a cláusula
      supabase.functions.invoke("notify-contract-revision", {
        body: { revision_id: revision.id, event: "reviewed" },
      }).catch(() => {});

      toast.success("Revisão concluída, devolutiva gerada e vendedor notificado");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao concluir revisão");
    } finally {
      setSaving(false);
    }
  };

  const decisionColor = (v?: string) =>
    v === "accepted" ? "bg-emerald-500"
    : v === "rejected" ? "bg-red-500"
    : v === "counter_proposal" ? "bg-amber-500" : "bg-gray-300";

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revisão de cláusulas</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto" /></div>
        ) : decisions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            A IA não extraiu cláusulas. Verifique o texto enviado pelo prospect.
          </div>
        ) : (
          <div className="space-y-4">
            {decisions.map((d, idx) => (
              <Card key={d.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-medium">{idx + 1}. {d.clause_reference}</div>
                    <Badge className={`${decisionColor(d.decision)} text-white`}>
                      {d.decision === "accepted" ? "Aceita"
                        : d.decision === "rejected" ? "Rejeitada"
                        : d.decision === "counter_proposal" ? "Contraproposta"
                        : "Pendente"}
                    </Badge>
                  </div>

                  {d.original_text && (
                    <div className="text-xs">
                      <div className="font-semibold text-muted-foreground">Original:</div>
                      <div className="bg-muted/40 rounded p-2 mt-1 whitespace-pre-wrap">{d.original_text}</div>
                    </div>
                  )}
                  <div className="text-sm">
                    <div className="font-semibold">Mudança solicitada pelo prospect:</div>
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded p-2 mt-1 whitespace-pre-wrap">
                      {d.proposed_change}
                    </div>
                  </div>

                  {canReview && (
                    <>
                      <div className="flex gap-2">
                        <Button size="sm" variant={d.decision === "accepted" ? "default" : "outline"}
                          className={d.decision === "accepted" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                          onClick={() => updateDecision(idx, { decision: "accepted" })}>
                          <CheckCircle2 size={14} className="mr-1" /> Aceitar
                        </Button>
                        <Button size="sm" variant={d.decision === "rejected" ? "default" : "outline"}
                          className={d.decision === "rejected" ? "bg-red-600 hover:bg-red-700" : ""}
                          onClick={() => updateDecision(idx, { decision: "rejected" })}>
                          <XCircle size={14} className="mr-1" /> Rejeitar
                        </Button>
                        <Button size="sm" variant={d.decision === "counter_proposal" ? "default" : "outline"}
                          className={d.decision === "counter_proposal" ? "bg-amber-600 hover:bg-amber-700" : ""}
                          onClick={() => updateDecision(idx, { decision: "counter_proposal" })}>
                          <MessageSquare size={14} className="mr-1" /> Contraproposta
                        </Button>
                      </div>
                      <div>
                        <Label className="text-xs">Parecer / motivo {d.decision === "rejected" ? "(obrigatório)" : "(opcional)"}</Label>
                        <Textarea rows={2} value={d.admin_comment || ""}
                          onChange={(e) => updateDecision(idx, { admin_comment: e.target.value })} />
                      </div>
                      {d.decision === "counter_proposal" && (
                        <div>
                          <Label className="text-xs">Texto da contraproposta</Label>
                          <Textarea rows={2} value={d.counter_text || ""}
                            onChange={(e) => updateDecision(idx, { counter_text: e.target.value })} />
                        </div>
                      )}
                    </>
                  )}
                  {!canReview && d.admin_comment && (
                    <div className="text-xs">
                      <div className="font-semibold text-muted-foreground">Parecer:</div>
                      <div className="bg-muted/40 rounded p-2 mt-1 whitespace-pre-wrap">{d.admin_comment}</div>
                      {d.counter_text && (
                        <>
                          <div className="font-semibold text-muted-foreground mt-2">Contraproposta:</div>
                          <div className="bg-muted/40 rounded p-2 mt-1 whitespace-pre-wrap">{d.counter_text}</div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {canReview && (
              <div>
                <Label>Resumo geral (opcional)</Label>
                <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)}
                  placeholder="Mensagem final ao vendedor sobre a negociação…" />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t">
          <div>
            {revision.negotiation_docx_url && (
              <a href={revision.negotiation_docx_url} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="gap-1"><FileDown size={14} /> Baixar devolutiva</Button>
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Fechar</Button>
            {canReview && revision.status !== "reviewed" && revision.status !== "final_consolidated" && (
              <Button onClick={concludeReview} disabled={saving} className="gap-2">
                {saving && <Loader2 className="animate-spin" size={14} />}
                Concluir revisão e gerar devolutiva
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
