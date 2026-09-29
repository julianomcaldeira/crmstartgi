import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Stethoscope } from "lucide-react";

/**
 * Diagnóstico temporário de contas (CNPJ).
 * Consulta public.clients e mostra dono, status e classificação da conta.
 * Deve ser removido após a investigação da conta desaparecida.
 */
export const ClientDiagnosticButton = () => {
  const [busy, setBusy] = useState(false);
  const [cnpj, setCnpj] = useState("18.917.657/0001-83");

  const run = async () => {
    const input =
      window.prompt("CNPJ para diagnosticar (apenas dígitos ou formatado):", cnpj) ??
      cnpj;
    setCnpj(input);
    const digits = input.replace(/\D/g, "");
    if (!digits) {
      toast.error("Informe um CNPJ");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select(
          `
          id, cnpj, company_name, trade_name, created_by, created_at, updated_at,
          created_by_profile:profiles!clients_created_by_fkey(id, full_name, email, is_deleted),
          opportunities(id, status, assigned_to),
          contacts(id),
          client_notes(id)
        `,
        )
        .like("cnpj", `%${digits}%`);

      if (error) throw error;

      const rows = data || [];
      if (rows.length === 0) {
        toast.info("Nenhuma conta encontrada com esse CNPJ", {
          description: "Pode ter sido removida ou o CNPJ está salvo com outro formato.",
          duration: 12000,
        });
        return;
      }

      rows.forEach((c: any) => {
        const owner = c.created_by_profile;
        const openOps = (c.opportunities || []).filter(
          (o: any) => o.status !== "won" && o.status !== "lost",
        );
        const lines = [
          `Conta: ${c.company_name}${c.trade_name ? ` (${c.trade_name})` : ""}`,
          `CNPJ: ${c.cnpj}`,
          `ID: ${c.id}`,
          `Dono (created_by): ${owner ? `${owner.full_name} <${owner.email}>` : "NULL (carteira/pool)"}`,
          `Dono deletado: ${owner ? (owner.is_deleted ? "SIM" : "não") : "—"}`,
          `Oportunidades abertas: ${openOps.length}`,
          `Contatos: ${(c.contacts || []).length} | Notas: ${(c.client_notes || []).length}`,
          `Atualizado em: ${c.updated_at}`,
        ];
        if (!owner) {
          lines.push("⚠️ CLASSIFICAÇÃO: pool_sem_dono — conta está sem responsável.");
        } else if (owner.is_deleted) {
          lines.push("⚠️ CLASSIFICAÇÃO: dono_desativado — dono foi soft-deletado.");
        } else if (["carteira@pool.evolua", "juliano@startgi.com.br"].includes(owner.email)) {
          lines.push("⚠️ CLASSIFICAÇÃO: colide_com_pool — dono é o usuário usado como fallback do pool (bug).");
        }
        // eslint-disable-next-line no-console
        console.log(lines.join("\n"));
        toast.info(lines.join(" — "), { duration: 30000 });
      });
    } catch (e: any) {
      toast.error("Erro no diagnóstico", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      disabled={busy}
      title="Diagnóstico de conta por CNPJ (temporário)"
      onClick={run}
    >
      <Stethoscope className="h-4 w-4" />
    </Button>
  );
};
