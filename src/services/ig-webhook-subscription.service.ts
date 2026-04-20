/**
 * IG Webhook Subscription Service
 *
 * Subscribes a Meta connection (IG business account) to the app's webhook for
 * DM events. Called once from the OAuth callback after the connection is
 * persisted. Failure does NOT block OAuth — it is retried manually from
 * settings.
 *
 * Endpoint:
 *   POST https://graph.facebook.com/v25.0/{ig_business_account_id}/subscribed_apps
 *     ?subscribed_fields=messages,messaging_postbacks
 *     &access_token={access_token}
 *
 * Required scopes on the token:
 *   instagram_manage_messages (+ the usual instagram_basic, pages_manage_metadata)
 */

import { createAdminClient } from '@/lib/supabase/admin';

const GRAPH_API_VERSION = 'v25.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface SubscribeInput {
  /** meta_connections.id — primary key of the connection row to flag. */
  id: string;
  /** IG Business Account id (entry.id in webhook payloads). */
  ig_user_id: string;
  /** Page access token or user access token with messaging permissions. */
  access_token: string;
}

interface SubscribeResult {
  ok: boolean;
  error?: string;
}

/**
 * Subscribe one IG account to the app's webhook with bounded retries on
 * transient failures (429, 5xx). Worst-case elapsed time with the default
 * settings: ~0.5s + ~1s + ~1.5s jitter ≈ 3s, so the OAuth callback is not
 * held hostage by Meta flapping.
 */
async function subscribeWithRetry(url: string, maxAttempts = 3): Promise<Response> {
  let lastRes: Response | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, { method: 'POST' });
    if (res.ok) return res;
    lastRes = res;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === maxAttempts) return res;
    const delay = 1000 * Math.pow(2, attempt - 1) + Math.random() * 500;
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }
  // Unreachable given the loop always returns on the last attempt, but TS
  // wants a definite return. If we got here, `lastRes` is set.
  if (lastRes) return lastRes;
  throw new Error('subscribeWithRetry: unreachable');
}

export async function subscribeIgAccountToWebhook(
  igAccount: SubscribeInput
): Promise<SubscribeResult> {
  // Guard: access_token is required by the Graph API. A missing/invalid
  // token here means the OAuth flow didn't persist one — fail fast with a
  // clear message instead of letting `undefined` hit fetch() and crash.
  if (
    !igAccount.access_token ||
    typeof igAccount.access_token !== 'string' ||
    igAccount.access_token.length < 10
  ) {
    console.error('[ig-webhook-subscription] missing or invalid access_token', {
      id: igAccount.id,
    });
    return { ok: false, error: 'missing or invalid access_token' };
  }

  if (!igAccount.ig_user_id || typeof igAccount.ig_user_id !== 'string') {
    console.error('[ig-webhook-subscription] missing or invalid ig_user_id', {
      id: igAccount.id,
    });
    return { ok: false, error: 'missing or invalid ig_user_id' };
  }

  const url = new URL(`${GRAPH_BASE}/${igAccount.ig_user_id}/subscribed_apps`);
  url.searchParams.set('subscribed_fields', 'messages,messaging_postbacks');
  url.searchParams.set('access_token', igAccount.access_token);

  let response: Response;
  try {
    response = await subscribeWithRetry(url.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ig-webhook-subscription] fetch failed', { id: igAccount.id, error: message });
    return { ok: false, error: message };
  }

  const body = await response.text();

  if (!response.ok) {
    console.error('[ig-webhook-subscription] subscribe failed', {
      id: igAccount.id,
      status: response.status,
      body,
    });
    return { ok: false, error: body || `HTTP ${response.status}` };
  }

  // Persist success flag.
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('meta_connections')
      .update({
        webhook_subscribed: true,
        webhook_subscribed_at: new Date().toISOString(),
      })
      .eq('id', igAccount.id);

    if (error) {
      console.error('[ig-webhook-subscription] flag update failed', {
        id: igAccount.id,
        error: error.message,
      });
      return { ok: false, error: error.message };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ig-webhook-subscription] admin client error', { id: igAccount.id, error: message });
    return { ok: false, error: message };
  }

  return { ok: true };
}
