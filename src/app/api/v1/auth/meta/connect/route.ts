/**
 * POST /api/v1/auth/meta/connect
 * Initiates Meta OAuth flow — returns the redirect URL for the user
 * PRD 4.3 Step 1: Iniciar login
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { api401, api500 } from '@/lib/api/response';
import crypto from 'crypto';
import { env, getMetaRedirectUri } from '@/lib/env';

const REQUIRED_SCOPES = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
  'ads_read',
  'business_management',
].join(',');

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return api401();
    }

    // Get workspace_id from body
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
    // Meta OAuth to it — full account takeover of that workspace's IG data.
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

    // Generate CSRF state token (contains workspace_id for callback)
    const csrfState = crypto.randomBytes(32).toString('hex');
    const statePayload = Buffer.from(
      JSON.stringify({ csrf: csrfState, workspace_id: workspaceId, user_id: user.id })
    ).toString('base64url');

    // Store state in meta_connections for validation in callback
    await supabase.from('meta_connections').upsert({
      workspace_id: workspaceId,
      status: 'pending',
      last_error: null,
    }, { onConflict: 'workspace_id' });

    // Build Meta OAuth URL (PRD 4.3 Step 1)
    const oauthUrl = new URL('https://www.facebook.com/v25.0/dialog/oauth');
    oauthUrl.searchParams.set('client_id', env.META_APP_ID!);
    oauthUrl.searchParams.set('redirect_uri', getMetaRedirectUri());
    oauthUrl.searchParams.set('state', statePayload);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('scope', REQUIRED_SCOPES);

    return NextResponse.json({
      data: { oauth_url: oauthUrl.toString() },
    });
  } catch {
    return api500();
  }
}
