// Envio de e-mail transacional via Resend (transporte direto, sem Lovable).
//
// Configuração via secrets do Supabase:
//   RESEND_API_KEY          obrigatória — chave da API Resend (re_...)
//   PUBLIC_BASE_URL         base pública do app para o link de unsubscribe
//
// O pipeline (fila, retries, TTL, DLQ, supressão) permanece intacto — só o
// transporte muda. Erros de 429/403 preservam as propriedades esperadas pela
// fila (status, retryAfterSeconds).

const RESEND_API_URL = "https://api.resend.com/emails";

export interface EmailPayload {
  from: string;
  to: string;
  reply_to?: string;
  subject: string;
  html: string;
  text: string;
  unsubscribe_url?: string;
}

export class EmailSendError extends Error {
  override name = "EmailSendError";
  status?: number;
  retryAfterSeconds?: number | null;

  constructor(
    message: string,
    opts: { status?: number; retryAfterSeconds?: number | null } = {},
  ) {
    super(message);
    this.status = opts.status;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}

export async function sendEmail(
  payload: EmailPayload,
): Promise<{ id: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new EmailSendError("RESEND_API_KEY não configurada", { status: 500 });
  }

  const body: Record<string, unknown> = {
    from: payload.from,
    to: [payload.to],
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  };
  if (payload.reply_to) body.reply_to = payload.reply_to;

  if (payload.unsubscribe_url) {
    body.headers = {
      "List-Unsubscribe": `<${payload.unsubscribe_url}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errBody: Record<string, unknown> = {};
    try {
      errBody = await res.json();
    } catch {
      // corpo sem JSON
    }
    const msg = String(errBody?.message ?? res.statusText);
    const retryAfter = res.headers.get("Retry-After");
    throw new EmailSendError(msg, {
      status: res.status,
      retryAfterSeconds: retryAfter
        ? Number(retryAfter)
        : res.status === 429
          ? 60
          : null,
    });
  }

  const data = await res.json().catch(() => ({}));
  return { id: typeof data?.id === "string" ? data.id : "" };
}

// ----- Webhooks (Resend usa assinatura Svix/standard EASU) -----

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/_/g, "/").replace(/-/g, "+"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyResendWebhook(
  secret: string,
  req: Request,
): Promise<Record<string, unknown>> {
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error("Missing svix webhook headers");
  }

  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    throw new Error("Stale webhook timestamp");
  }

  const body = await req.text();
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;

  const v1 = svixSignature
    .split(",")
    .map((s) => s.trim())
    .find((s) => s.startsWith("v1,"));
  const expected = v1?.split(",")[1];
  if (!expected) throw new Error("Invalid signature format");

  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const computed = bytesToBase64(new Uint8Array(mac));

  if (!constantTimeEqual(computed, expected)) {
    throw new Error("Invalid webhook signature");
  }

  return JSON.parse(body);
}