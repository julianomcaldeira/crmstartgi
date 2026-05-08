import { supabase } from "@/integrations/supabase/client";

export async function uploadProposalImage(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const ext = file.name.split(".").pop() || "png";
  const path = `${user.id}/assets/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("proposals")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("proposals").getPublicUrl(path);
  return data.publicUrl;
}
