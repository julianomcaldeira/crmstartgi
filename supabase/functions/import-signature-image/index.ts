import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_HOSTS = new Set([
  "postimg.cc",
  "i.postimg.cc",
  "postimages.org",
  "imgbb.com",
  "ibb.co",
  "i.ibb.co",
]);

function assertAllowedUrl(input: string) {
  const url = new URL(input);
  if (!/^https?:$/.test(url.protocol) || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("URL de imagem não suportada para importação automática");
  }
  return url;
}

function pickImageFromHtml(html: string, baseUrl: string) {
  const candidates = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["']/i,
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern)?.[1];
    if (match) return new URL(match.replace(/&amp;/g, "&"), baseUrl).toString();
  }

  throw new Error("Não encontramos a imagem real na página externa");
}

function extensionFromMime(mime: string) {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "png";
}

class ExternalImageDownloadError extends Error {
  status: number;
  contentType: string;

  constructor(message: string, status: number, contentType: string) {
    super(message);
    this.status = status;
    this.contentType = contentType;
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchExternalImage(url: URL, refererUrl?: string) {
  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 EvoluaCRM/1.0",
      "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "Referer": refererUrl || `${url.protocol}//${url.hostname}/`,
    },
    redirect: "follow",
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    await response.arrayBuffer().catch(() => null);
    throw new ExternalImageDownloadError("Não foi possível baixar a imagem externa", response.status, contentType);
  }

  return response;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user?.id) throw new Error("Unauthorized");

    const { url } = await req.json();
    const sourceUrl = assertAllowedUrl(String(url || ""));

    let response = await fetchExternalImage(sourceUrl);

    let contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const directUrl = assertAllowedUrl(pickImageFromHtml(await response.text(), sourceUrl.toString()));
      response = await fetchExternalImage(directUrl, sourceUrl.toString());
      contentType = response.headers.get("content-type") || "";
    }

    if (!contentType.startsWith("image/")) throw new Error("O link informado não retornou uma imagem válida");

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 2 * 1024 * 1024) throw new Error("Imagem externa maior que 2MB");

    const admin = createClient(supabaseUrl, serviceKey);
    const path = `${user.id}/imported-${crypto.randomUUID()}.${extensionFromMime(contentType)}`;
    const { error: uploadError } = await admin.storage
      .from("email-signatures")
      .upload(path, bytes, { contentType, upsert: true });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = admin.storage.from("email-signatures").getPublicUrl(path);
    return jsonResponse({ publicUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro ao importar imagem";
    if (error instanceof ExternalImageDownloadError) {
      console.warn("External signature image import blocked", {
        status: error.status,
        contentType: error.contentType,
      });
      return jsonResponse({
        error: message,
        fallback: true,
        reason: "external_download_blocked",
      });
    }
    const status = message === "Unauthorized" ? 401 : 400;
    return jsonResponse({ error: message }, status);
  }
});