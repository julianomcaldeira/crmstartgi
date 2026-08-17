import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { canAccessContract, canAccessContractStoragePath, forbidden } from "../_shared/contract-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extrai texto de PDF/DOCX usando Lovable AI (Gemini multimodal para PDF/imagem; mammoth para DOCX)
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { storage_path, file_name, mime_type, contract_id } = await req.json();
    if (!storage_path) return new Response(JSON.stringify({ error: "storage_path obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Autorização: o chamador precisa ser dono do contrato/arquivo ou ter papel privilegiado
    const authorized = contract_id
      ? await canAccessContract(admin, user.id, contract_id)
      : await canAccessContractStoragePath(admin, user.id, storage_path);
    if (!authorized) return forbidden(corsHeaders);

    const { data: file, error: dlErr } = await admin.storage.from("contracts").download(storage_path);
    if (dlErr || !file) throw new Error("Não foi possível ler o anexo");

    const buf = new Uint8Array(await file.arrayBuffer());
    const lowerName = (file_name || "").toLowerCase();
    const isDocx = mime_type?.includes("wordprocessingml") || lowerName.endsWith(".docx");
    const isPdf = mime_type === "application/pdf" || lowerName.endsWith(".pdf");
    const isImage = mime_type?.startsWith("image/");
    const isText = mime_type?.startsWith("text/") || lowerName.endsWith(".txt") || lowerName.endsWith(".md");

    let extracted = "";

    if (isText) {
      extracted = new TextDecoder("utf-8").decode(buf);
    } else if (isDocx) {
      // Usa mammoth via esm.sh
      try {
        const mammoth = await import("https://esm.sh/mammoth@1.8.0?bundle");
        const r = await mammoth.extractRawText({ arrayBuffer: buf.buffer });
        extracted = r.value || "";
      } catch (e) {
        console.error("mammoth falhou", e);
        throw new Error("Não foi possível extrair texto do DOCX");
      }
    } else if ((isPdf || isImage) && LOVABLE_API_KEY) {
      const b64 = btoa(String.fromCharCode(...buf));
      const dataUrl = `data:${mime_type || (isPdf ? "application/pdf" : "image/png")};base64,${b64}`;
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Extraia TODO o texto deste documento em português, preservando estrutura de cláusulas e parágrafos. Retorne SOMENTE o texto, sem comentários." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          }],
        }),
      });
      if (!aiResp.ok) {
        const t = await aiResp.text();
        console.error("AI extract error", aiResp.status, t);
        if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Limite IA atingido" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos IA esgotados" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("Falha na extração via IA");
      }
      const aj = await aiResp.json();
      extracted = aj.choices?.[0]?.message?.content || "";
    } else {
      return new Response(JSON.stringify({ error: "Tipo de arquivo não suportado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, text: extracted, length: extracted.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("extract-contract-attachment error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
