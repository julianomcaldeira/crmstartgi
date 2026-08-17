// Shared authorization helpers for contract-related edge functions.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PRIVILEGED_ROLES = ["admin", "gestor", "pre_vendas"];

export async function hasPrivilegedRole(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId);
  return (data || []).some((r: { role: string }) => PRIVILEGED_ROLES.includes(r.role));
}

/** Caller must own the contract (created_by) or hold a privileged role. */
export async function canAccessContract(
  admin: SupabaseClient,
  userId: string,
  contractId: string,
): Promise<boolean> {
  if (!contractId) return false;
  const { data: contract } = await admin
    .from("contracts")
    .select("id, created_by")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return false;
  if (contract.created_by === userId) return true;
  return await hasPrivilegedRole(admin, userId);
}

/** Caller must be the revision requester, the contract owner, or privileged. */
export async function canAccessRevision(
  admin: SupabaseClient,
  userId: string,
  revisionId: string,
): Promise<boolean> {
  if (!revisionId) return false;
  const { data: rev } = await admin
    .from("contract_clause_revisions")
    .select("id, contract_id, requested_by")
    .eq("id", revisionId)
    .maybeSingle();
  if (!rev) return false;
  if (rev.requested_by === userId) return true;
  return await canAccessContract(admin, userId, rev.contract_id);
}

/**
 * Caller may read a file in the private `contracts` bucket only if the path is
 * registered on a contract they can access (or is under their own user folder).
 */
export async function canAccessContractStoragePath(
  admin: SupabaseClient,
  userId: string,
  storagePath: string,
): Promise<boolean> {
  if (!storagePath) return false;
  if (storagePath.startsWith(`${userId}/`)) return true;

  const { data: files } = await admin
    .from("contract_files")
    .select("contract_id, file_url, created_by")
    .or(`file_url.eq.${storagePath},file_url.like.%${storagePath}%`)
    .limit(5);

  for (const f of files || []) {
    if (f.created_by === userId) return true;
    if (f.contract_id && (await canAccessContract(admin, userId, f.contract_id))) return true;
  }
  return await hasPrivilegedRole(admin, userId);
}

export function forbidden(corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ error: "Acesso negado a este contrato" }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
