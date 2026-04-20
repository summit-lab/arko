/**
 * POST /api/data-deletion-callback
 *
 * Meta App Review requirement: called when a user requests deletion of their
 * data from the Facebook/Instagram settings. Verifies the signed_request with
 * the app secret, records the request, performs inline deletion of the user's
 * IG conversation data, and responds with `{ url, confirmation_code }`.
 *
 * Deletion scope (tight by design):
 *   - `ig_conversation_events` rows where `sender_igsid = user_id`.
 *   - Nothing else — `meta_connections` belongs to the workspace, not the DM
 *     participant, and media/sales/ads data are scoped to connections rather
 *     than to individual end-users.
 *
 * Inline deletion is used because the Moka DM corpus is small (< a few
 * thousand rows per user even for high-volume workspaces) and Meta expects
 * a synchronous confirmation code. If volume grows, migrate to an Edge
 * function and mark the request as 'pending' until the job drains.
 *
 * Ref: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { env, getAppUrl } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

function parseSignedRequest(signedRequest: string, secret: string): Record<string, unknown> | null {
  const [encodedSig, payload] = signedRequest.split('.');
  if (!encodedSig || !payload) return null;

  const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest();

  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(sig, expectedSig)) return null;

  try {
    const json = Buffer.from(
      payload.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf-8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const secret = env.IG_APP_SECRET ?? env.META_APP_SECRET;
    if (!secret) {
      console.error('[data-deletion-callback] Missing app secret');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const signedRequest = formData.get('signed_request');

    if (typeof signedRequest !== 'string' || signedRequest.length === 0) {
      return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 });
    }

    const data = parseSignedRequest(signedRequest, secret);
    if (!data) {
      console.error('[data-deletion-callback] Invalid signed_request signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const userId = typeof data.user_id === 'string' ? data.user_id : null;
    if (!userId) {
      console.error('[data-deletion-callback] Missing user_id', { data });
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1) Record the request up-front so the public /data-deletion page has
    //    something to show even if the inline delete below fails.
    const { data: inserted, error: insertError } = await supabase
      .from('data_deletion_requests')
      .insert({
        signed_request_user_id: userId,
        status: 'pending',
      })
      .select('code')
      .single();

    if (insertError || !inserted) {
      console.error('[data-deletion-callback] Failed to record request', {
        user_id: userId,
        error: insertError?.message,
      });
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }

    const confirmationCode = inserted.code as string;

    // 2) Inline deletion. Scope is strictly DM conversation rows keyed by
    //    sender_igsid — the only place Moka persists data tied to an
    //    individual Meta end-user.
    const { data: deletedRows, error: deleteError } = await supabase
      .from('ig_conversation_events')
      .delete()
      .eq('sender_igsid', userId)
      .select('id');

    if (deleteError) {
      console.error('[data-deletion-callback] Deletion failed', {
        user_id: userId,
        code: confirmationCode,
        error: deleteError.message,
      });
      // Leave the row as 'pending' so operators can retry manually.
      return NextResponse.json({
        url: `${getAppUrl()}/data-deletion?code=${confirmationCode}`,
        confirmation_code: confirmationCode,
      });
    }

    const rowsDeleted = deletedRows?.length ?? 0;

    const { error: updateError } = await supabase
      .from('data_deletion_requests')
      .update({
        status: 'completed',
        rows_deleted: rowsDeleted,
        completed_at: new Date().toISOString(),
      })
      .eq('code', confirmationCode);

    if (updateError) {
      console.error('[data-deletion-callback] Failed to mark completed', {
        code: confirmationCode,
        error: updateError.message,
      });
    }

    console.warn('[data-deletion-callback] Deletion completed', {
      user_id: userId,
      confirmation_code: confirmationCode,
      rows_deleted: rowsDeleted,
    });

    return NextResponse.json({
      url: `${getAppUrl()}/data-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (err) {
    console.error('[data-deletion-callback] Unhandled error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
