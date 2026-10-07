import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyResendWebhook } from '../_shared/email.ts'

// Suppression events pushed by Resend (sent via signed Svix webhooks):
//   email.bounced   -> bounce
//   email.complained-> complaint
//
// Config:
//   RESEND_WEBHOOK_SECRET  obrigatória — signing secret do webhook da Resend.

interface ResendWebhookEvent {
  type?: string
  data?: {
    email?: {
      email_address?: string
      created_at?: string
      email_id?: string
    }
    bounce?: {
      category?: string
      created_at?: string
      message?: string
      recipient?: string
    }
    complaint?: {
      created_at?: string
      message?: string
      recipient?: string
    }
  }
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  let event: ResendWebhookEvent
  try {
    event = (await verifyResendWebhook(webhookSecret, req)) as ResendWebhookEvent
  } catch (error) {
    console.error('Webhook verification failed', { error })
    return jsonResponse({ error: 'Invalid signature' }, 401)
  }

  // Ignore delivery/opening events — we only care about bounce/complaint.
  if (event.type !== 'email.bounced' && event.type !== 'email.complained') {
    return jsonResponse({ success: true })
  }

  const reason: 'bounce' | 'complaint' =
    event.type === 'email.bounced' ? 'bounce' : 'complaint'
  const recipient =
    event.data?.email?.email_address ??
    event.data?.bounce?.recipient ??
    event.data?.complaint?.recipient
  const messageId = event.data?.email?.email_id ?? null
  const message =
    event.data?.bounce?.message ?? event.data?.complaint?.message ?? null
  const createdAt =
    event.data?.email?.created_at ??
    event.data?.bounce?.created_at ??
    event.data?.complaint?.created_at ??
    null

  if (!recipient) {
    console.error('Resend webhook missing recipient')
    return jsonResponse({ error: 'Invalid payload' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const normalizedEmail = recipient.toLowerCase()
  const metadata = {
    provider: 'resend',
    category: event.data?.bounce?.category ?? null,
    message: message ? String(message).slice(0, 500) : null,
    created_at: createdAt,
  }

  // 1. Upsert to suppressed_emails (idempotent — safe for retries)
  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      {
        email: normalizedEmail,
        reason,
        metadata: JSON.stringify(metadata),
      },
      { onConflict: 'email' },
    )

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      error: suppressError,
      email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    })
    return jsonResponse({ error: 'Failed to write suppression' }, 500)
  }

  // 2. Append a new log entry for the suppression event (never update existing rows)
  const sendLogStatus = reason === 'bounce' ? 'bounced' : 'complained'
  const sendLogMessage =
    reason === 'bounce'
      ? 'Permanent bounce — email address is invalid or rejected'
      : 'Spam complaint — recipient marked email as spam'

  const { error: insertError } = await supabase
    .from('email_send_log')
    .insert({
      message_id: messageId,
      template_name: 'system',
      recipient_email: normalizedEmail,
      status: sendLogStatus,
      error_message: sendLogMessage,
      metadata: JSON.stringify(metadata),
    })

  if (insertError) {
    // Non-fatal — log and continue. The suppression was already recorded.
    console.warn('Failed to insert email_send_log', {
      error: insertError,
    })
  }

  console.log('Suppression processed', {
    email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    reason,
    provider: 'resend',
    has_message_id: !!messageId,
  })

  return jsonResponse({ success: true })
})