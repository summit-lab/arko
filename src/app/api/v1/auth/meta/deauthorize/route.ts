/**
 * POST /api/v1/auth/meta/deauthorize
 * Meta deauthorize callback — called by Meta when a user removes the app
 * from their Facebook Business Integrations.
 *
 * Meta sends a signed_request in the POST body.
 * We verify the signature, find the user's connection, and revoke it.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
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
      console.error('[meta/deauthorize] Invalid signed_request signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const fbUserId = data.user_id as string | undefined;
    if (!fbUserId) {
      console.error('[meta/deauthorize] No user_id in signed_request');
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    console.log(`[meta/deauthorize] User ${fbUserId} deauthorized the app`);

    const supabase = await createClient();

    // Revoke all connections for this Facebook user
    const { error } = await supabase
      .from('meta_connections')
      .update({
        access_token_encrypted: null,
        token_expires_at: null,
        page_access_token_enc: null,
        permissions_granted: [],
        status: 'revoked',
        last_error: 'User deauthorized app via Facebook settings',
      })
      .eq('fb_user_id', fbUserId);

    if (error) {
      console.error('[meta/deauthorize] DB error:', error);
      return NextResponse.json({ error: 'Failed to revoke connection' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[meta/deauthorize] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
