// Helper central de chamadas a provedores de IA OpenAI-compatible
// (OpenRouter por padrão; OpenAI, OpenCode Zen etc. via AI_BASE_URL).
//
// Configuração via secrets do Supabase:
//   AI_API_KEY             chave do provedor (obrigatória) — ex.: sk-or-v1-... (OpenRouter)
//   AI_BASE_URL            base opcional; padrão https://openrouter.ai/api/v1
//   AI_TRANSCRIBE_BASE_URL base opcional p/ transcrição de áudio; padrão https://api.openai.com/v1
//
// Os modelos mantêm os slugs OpenAI-compatible já usados
// (ex.: google/gemini-2.5-flash, openai/gpt-4o-mini-transcribe).

const DEFAULT_CHAT_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_TRANSCRIBE_BASE = "https://api.openai.com/v1";

export function aiKeyConfigured(): boolean {
  return Boolean(
    Deno.env.get("AI_API_KEY") ??
      Deno.env.get("OPENROUTER_API_KEY") ??
      Deno.env.get("OPENAI_API_KEY"),
  );
}

export function aiKey(): string {
  const key = aiKeyConfigured();
  if (!key) {
    throw new Error(
      "AI_API_KEY não configurada (OpenRouter/OpenAI). Defina AI_API_KEY nas secrets.",
    );
  }
  return key as string;
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function chatBaseUrl(): string {
  return stripSlash(Deno.env.get("AI_BASE_URL") ?? DEFAULT_CHAT_BASE);
}

export function transcribeBaseUrl(): string {
  return stripSlash(Deno.env.get("AI_TRANSCRIBE_BASE_URL") ?? DEFAULT_TRANSCRIBE_BASE);
}

export async function aiChat(params: {
  model: string;
  messages: unknown[];
  tools?: unknown;
  tool_choice?: unknown;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}): Promise<Response> {
  const base = chatBaseUrl();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${aiKey()}`,
  };
  if (base.includes("openrouter")) {
    headers["HTTP-Referer"] = Deno.env.get("SITE_URL") ?? "https://evoluacrm.com.br";
    headers["X-Title"] = "Evolua CRM";
  }
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
  };
  if (params.tools !== undefined) body.tools = params.tools;
  if (params.tool_choice !== undefined) body.tool_choice = params.tool_choice;
  if (params.stream !== undefined) body.stream = params.stream;
  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.max_tokens !== undefined) body.max_tokens = params.max_tokens;

  return await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export async function aiTranscribe(
  file: Blob,
  filename: string,
  model = "gpt-4o-mini-transcribe",
): Promise<Response> {
  const form = new FormData();
  form.append("file", file, filename);
  form.append("model", model);
  return await fetch(`${transcribeBaseUrl()}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${aiKey()}` },
    body: form,
  });
}