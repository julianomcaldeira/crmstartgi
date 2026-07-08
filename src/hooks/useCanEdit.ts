import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Regra de ouro: qualquer vendedor pode VER tudo, mas só pode EDITAR o que é dele.
 * Admin e gestor podem editar tudo.
 */
export function useCanEdit() {
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      setUserId(user?.id ?? null);
      if (user) {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        if (mounted) setRole(roleRow?.role || "vendedor");
      }
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const isAdmin = role === "admin";
  const isGestor = role === "gestor";
  const isPreVendas = role === "pre_vendas";
  const isPrivileged = isAdmin || isGestor;

  /** Retorna true se o usuário pode editar o registro. */
  const canEdit = (record?: { created_by?: string | null; assigned_to?: string | null } | null) => {
    if (loading) return false;
    if (isPrivileged) return true;
    if (!record || !userId) return false;
    return record.created_by === userId || record.assigned_to === userId;
  };

  return { userId, role, isAdmin, isGestor, isPreVendas, isPrivileged, canEdit, loading };
}
