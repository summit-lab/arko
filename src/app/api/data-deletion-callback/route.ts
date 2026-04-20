/**
 * POST /api/data-deletion-callback
 *
 * Meta App Review requirement: verifies the signed_request, records the
 * request, returns `{ url, confirmation_code }`. Moka does not store any
 * per-end-user data (we only track aggregate metrics scoped to workspaces),
 * so there is nothing to actually delete — the callback records the request
 * for auditing and responds with the confirmation shape Meta expects.
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

    // Mark as completed immediately — no per-user data to delete.
    const { error: updateError } = await supabase
      .from('data_deletion_requests')
      .update({
        status: 'completed',
        rows_deleted: 0,
        completed_at: new Date().toISOString(),
      })
      .eq('code', confirmationCode);

    if (updateError) {
      console.error('[data-deletion-callback] Failed to mark completed', {
        code: confirmationCode,
        error: updateError.message,
      });
    }

    console.warn('[data-deletion-callback] Request recorded', {
      user_id: userId,
      confirmation_code: confirmationCode,
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
