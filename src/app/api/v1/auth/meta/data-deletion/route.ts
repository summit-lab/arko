/**
 * POST /api/v1/auth/meta/data-deletion
 * Meta data deletion callback — called by Meta when a user requests
 * deletion of their data via Facebook settings.
 *
 * ⚠️ ÚNICO endpoint oficial de data-deletion. Es la URL registrada en el
 * dashboard de Meta (https://app.usemoka.io/api/v1/auth/meta/data-deletion).
 * El endpoint legacy /api/data-deletion-callback fue eliminado (2026-06-02):
 * solo loggeaba, nunca se registró en Meta. NO recrear un segundo endpoint.
 *
 * Meta requires this endpoint to return a confirmation_code and a URL
 * where the user can check the status of their deletion request.
 *
 * Ref: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { env, getAppUrl } from '@/lib/env';
import crypto from 'crypto';

function parseSignedRequest(signedRequest: string, secret: string): Record<string, unknown> | null {
  const [encodedSig, payload] = signedRequest.split('.');
  if (!encodedSig || !payload) return null;

  const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest();

  if (!crypto.timingSafeEqual(sig, expectedSig)) return null;

  const data = JSON.parse(
    Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
  ) as Record<string, unknown>;

  return data;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const signedRequest = formData.get('signed_request') as string | null;

    if (!signedRequest || !env.META_APP_SECRET) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const data = parseSignedRequest(signedRequest, env.META_APP_SECRET);
    if (!data) {
      console.error('[meta/data-deletion] Invalid signed_request signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const fbUserId = data.user_id as string | undefined;
    if (!fbUserId) {
      console.error('[meta/data-deletion] No user_id in signed_request');
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    // Generate a unique confirmation code for this deletion request
    const confirmationCode = crypto.randomUUID();

    console.log(`[meta/data-deletion] Deletion request for user ${fbUserId}, code: ${confirmationCode}`);

    const supabase = await createClient();

    // Delete all data for this Facebook user's connections
    const { data: connections } = await supabase
      .from('meta_connections')
      .select('workspace_id')
      .eq('fb_user_id', fbUserId);

    if (connections && connections.length > 0) {
      for (const conn of connections) {
        // Clear the meta connection data
        await supabase
          .from('meta_connections')
          .update({
            access_token_encrypted: null,
            token_expires_at: null,
            fb_user_id: null,
            page_id: null,
            page_name: null,
            page_access_token_enc: null,
            ig_business_account_id: null,
            ig_username: null,
            ad_account_ids: [],
            permissions_granted: [],
            status: 'deleted',
            last_error: `Data deletion requested via Facebook. Code: ${confirmationCode}`,
          })
          .eq('workspace_id', conn.workspace_id);
      }
    }

    // Meta requires this exact response format
    const statusUrl = `${getAppUrl()}/data-deletion`;

    return NextResponse.json({
      url: statusUrl,
      confirmation_code: confirmationCode,
    });
  } catch (error) {
    console.error('[meta/data-deletion] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
