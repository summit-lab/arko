/**
 * Instagram Webhook Endpoint
 *
 * GET  — Meta verification challenge (hub.mode=subscribe).
 * POST — Event delivery (DMs, message events).
 *
 * Security:
 *  - GET verifies hub.verify_token against IG_WEBHOOK_VERIFY_TOKEN.
 *  - POST verifies X-Hub-Signature-256 with HMAC-SHA256(IG_APP_SECRET, rawBody).
 *
 * Storage:
 *  - Uses service-role client (RLS bypass) — this endpoint is unauthenticated.
 *  - Each entry in body.entry is mapped to a meta_connections row via
 *    ig_business_account_id == entry.id. Unknown ids are skipped with a warn log.
 *
 * Latency:
 *  - Meta requires 200 OK in <5s. Per-event work is lightweight (INSERT only).
 *  - Daily aggregation happens later in the aggregate-conversations Edge function.
 */

import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';

interface IGMessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
  };
  postback?: {
    mid?: string;
    title?: string;
    payload?: string;
  };
}

interface IGEntry {
  id: string;
  time?: number;
  messaging?: IGMessagingEvent[];
  changes?: Array<{ field: string; value: Record<string, unknown> }>;
}

interface IGWebhookPayload {
  object?: string;
  entry?: IGEntry[];
}

interface ExtractedEvent {
  meta_event_id: string | null;
  thread_id: string;
  sender_igsid: string | null;
  event_type: 'message_received' | 'conversation_opened';
  event_at: string;
  raw: unknown;
}

// ─── GET: verification challenge ────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const verifyToken = env.IG_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error('[ig-webhook] IG_WEBHOOK_VERIFY_TOKEN not configured');
    return new Response('Server not configured', { status: 500 });
  }

  if (mode === 'subscribe' && token && challenge && safeEqualStr(token, verifyToken)) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response('Forbidden', { status: 403 });
}

// ─── POST: event delivery ───────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');

  // IG_APP_SECRET is the canonical name per Sprint B spec; fall back to
  // META_APP_SECRET since Meta uses a single app secret across OAuth + webhooks.
  const appSecret = env.IG_APP_SECRET ?? env.META_APP_SECRET;
  if (!appSecret) {
    console.error('[ig-webhook] IG_APP_SECRET / META_APP_SECRET not configured');
    return new Response('Server not configured', { status: 500 });
  }

  if (!signature || !verifySignature(rawBody, signature, appSecret)) {
    console.error('[ig-webhook] Invalid signature');
    return new Response('Invalid signature', { status: 401 });
  }

  let payload: IGWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as IGWebhookPayload;
  } catch (err) {
    console.error('[ig-webhook] JSON parse failed', { err });
    return new Response('Bad request', { status: 400 });
  }

  const entries = payload.entry ?? [];
  const supabase = createAdminClient();

  for (const entry of entries) {
    try {
      await processEntry(supabase, entry);
    } catch (err) {
      console.error('[ig-webhook] Entry processing failed', {
        ig_business_account_id: entry.id,
        error: err instanceof Error ? err.message : String(err),
      });
      // Swallow per-entry errors — never let one bad entry crash the batch.
    }
  }

  return new Response(null, { status: 200 });
}

// ─── Entry processor ────────────────────────────────────────────

async function processEntry(
  supabase: ReturnType<typeof createAdminClient>,
  entry: IGEntry
): Promise<void> {
  const igAccountId = entry.id;
  if (!igAccountId) return;

  const { data: connection, error: connError } = await supabase
    .from('meta_connections')
    .select('id, workspace_id')
    .eq('ig_business_account_id', igAccountId)
    .maybeSingle();

  if (connError) {
    console.error('[ig-webhook] Connection lookup error', {
      ig_business_account_id: igAccountId,
      error: connError.message,
    });
    return;
  }

  if (!connection) {
    console.warn('[ig-webhook] No meta_connection for IG account', {
      ig_business_account_id: igAccountId,
    });
    return;
  }

  const events = extractEvents(entry);

  for (const evt of events) {
    try {
      await insertEvent(supabase, {
        workspace_id: connection.workspace_id,
        meta_connection_id: connection.id,
        ig_business_account_id: igAccountId,
        event: evt,
      });
    } catch (err) {
      console.error('[ig-webhook] Event insert failed', {
        workspace_id: connection.workspace_id,
        meta_connection_id: connection.id,
        meta_event_id: evt.meta_event_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ─── Event extraction ───────────────────────────────────────────

function extractEvents(entry: IGEntry): ExtractedEvent[] {
  const out: ExtractedEvent[] = [];
  const messaging = entry.messaging ?? [];

  for (const m of messaging) {
    // Skip echoes (outbound messages from the business account itself).
    if (m.message?.is_echo) continue;

    // Postbacks (button taps in IG Messenger) are NOT conversations for
    // Moka's analytics purposes — they are UI interactions on persistent
    // menus / quick replies. Skip them entirely so they never inflate
    // messages_received or new_conversations.
    if (m.postback && !m.message) continue;

    // Anything without a message payload is not an inbound DM (e.g.
    // delivery / read receipts, reactions, referrals). Skip with a log so
    // we can spot unexpected event shapes without polluting the store.
    if (!m.message) {
      console.warn('[ig-webhook] Skipping non-message event', {
        ig_business_account_id: entry.id,
        keys: Object.keys(m),
      });
      continue;
    }

    const senderId = m.sender?.id ?? null;
    const recipientId = m.recipient?.id ?? entry.id;
    if (!senderId) continue;

    // Thread is defined by the pair (business_account, sender). Canonical form:
    // sorted pair joined by ":".
    const thread_id = [recipientId, senderId].sort().join(':');
    const ts = typeof m.timestamp === 'number' ? m.timestamp : Date.now();

    out.push({
      meta_event_id: m.message.mid ?? null,
      thread_id,
      sender_igsid: senderId,
      event_type: 'message_received',
      event_at: new Date(ts).toISOString(),
      raw: m,
    });
  }

  return out;
}

// ─── Insert with dedupe + first-inbound detection ───────────────

async function insertEvent(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    workspace_id: string;
    meta_connection_id: string;
    ig_business_account_id: string;
    event: ExtractedEvent;
  }
): Promise<void> {
  const { workspace_id, meta_connection_id, ig_business_account_id, event } = params;

  // Dedupe by meta_event_id when present.
  if (event.meta_event_id) {
    const { data: existing } = await supabase
      .from('ig_conversation_events')
      .select('id')
      .eq('meta_event_id', event.meta_event_id)
      .maybeSingle();
    if (existing) return;
  }

  // Detect first-inbound event for this thread.
  const { data: prior } = await supabase
    .from('ig_conversation_events')
    .select('id')
    .eq('meta_connection_id', meta_connection_id)
    .eq('thread_id', event.thread_id)
    .eq('is_first_inbound', true)
    .limit(1)
    .maybeSingle();

  const is_first_inbound = !prior;

  const baseRow = {
    workspace_id,
    meta_connection_id,
    ig_business_account_id,
    event_type: event.event_type,
    meta_event_id: event.meta_event_id,
    thread_id: event.thread_id,
    sender_igsid: event.sender_igsid,
    event_at: event.event_at,
    raw_payload: event.raw as Record<string, unknown>,
  };

  const { error } = await supabase
    .from('ig_conversation_events')
    .insert({ ...baseRow, is_first_inbound });

  if (!error) return;

  // Unique-violation on meta_event_id is fine (concurrent delivery of same mid).
  // We distinguish the two possible 23505 sources by the constraint name
  // surfaced in `error.message` / `error.details`:
  //   - idx_ig_conv_events_meta_id             → same event delivered twice, drop
  //   - ig_conv_events_one_first_inbound       → another concurrent insert already
  //     claimed the first-inbound slot, retry as is_first_inbound=false
  if (error.code === '23505') {
    const hay = `${error.message ?? ''} ${error.details ?? ''}`;
    if (hay.includes('ig_conv_events_one_first_inbound')) {
      const { error: retryErr } = await supabase
        .from('ig_conversation_events')
        .insert({ ...baseRow, is_first_inbound: false });
      if (!retryErr) return;
      // If the retry itself hits the meta_event_id unique index, drop silently.
      if (retryErr.code === '23505') return;
      throw retryErr;
    }
    // Any other 23505 is the meta_event_id dedupe case — drop silently.
    return;
  }

  throw error;
}

// ─── Signature helpers ──────────────────────────────────────────

function verifySignature(rawBody: string, header: string, secret: string): boolean {
  // Header shape: "sha256=<hex>"
  const idx = header.indexOf('=');
  if (idx < 0) return false;
  const provided = header.slice(idx + 1);
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const a = Buffer.from(provided, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function safeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
