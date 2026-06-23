import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const _authHeader = req.headers.get("Authorization");
    if (!_authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: _authHeader } } });
    const { data: { user }, error: _authError } = await _authClient.auth.getUser();
    if (_authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { audio, mimeType } = await req.json();
    if (!audio) throw new Error("No audio data provided");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Decode base64 to bytes
    const binary = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));

    // Determine format/extension from mimeType
    const mt = (mimeType || "audio/webm").split(";")[0];
    const extMap: Record<string, string> = {
      "audio/webm": "webm",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/ogg": "ogg",
      "audio/m4a": "m4a",
      "audio/aac": "aac",
      "audio/flac": "flac",
    };
    const ext = extMap[mt] || "webm";

    const form = new FormData();
    form.append("file", new Blob([binary], { type: mt }), `recording.${ext}`);
    form.append("model", "openai/gpt-4o-mini-transcribe");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente mais tarde." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("Erro ao transcrever áudio");
    }

    const data = await response.json();
    const transcription = data.text || data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ text: transcription }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
