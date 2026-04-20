/**
 * POST /api/v1/auth/google/connect
 * Initiates Google OAuth flow — returns the redirect URL for the user
 * Scopes: YouTube readonly + YouTube Analytics readonly
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { api401, api500 } from '@/lib/api/response';
import crypto from 'crypto';
import { env, getGoogleRedirectUri } from '@/lib/env';

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return api401();
    }

    const body = await request.json();
    const workspaceId = body.workspace_id;

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'workspace_id is required' },
        { status: 400 }
      );
    }

    // Verify the user owns (or belongs to) this workspace. Without this check a
    // logged-in user could pass another user's workspace_id and bind their own
    // Google OAuth to it — full account takeover of that workspace's YT data.
    const { data: ownsWorkspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('owner_id', user.id)
      .maybeSingle();

    let allowed = !!ownsWorkspace;
    if (!allowed) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .maybeSingle();
      allowed = !!membership;
    }

    if (!allowed) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'No tenés acceso a este workspace' },
        { status: 403 }
      );
    }

    // Generate CSRF state token
    const csrfState = crypto.randomBytes(32).toString('hex');
    const statePayload = Buffer.from(
      JSON.stringify({ csrf: csrfState, workspace_id: workspaceId, user_id: user.id })
    ).toString('base64url');

    // Store state in google_connections for validation in callback
    await supabase.from('google_connections').upsert({
      workspace_id: workspaceId,
      status: 'pending',
      last_error: null,
    }, { onConflict: 'workspace_id' });

    // Build Google OAuth URL
    const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    oauthUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID!);
    oauthUrl.searchParams.set('redirect_uri', getGoogleRedirectUri());
    oauthUrl.searchParams.set('state', statePayload);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('scope', REQUIRED_SCOPES);
    oauthUrl.searchParams.set('access_type', 'offline');   // Get refresh token
    oauthUrl.searchParams.set('prompt', 'consent');         // Force consent to always get refresh token

    return NextResponse.json({
      data: { oauth_url: oauthUrl.toString() },
    });
  } catch {
    return api500();
  }
}
