/**
 * GET /api/v1/auth/meta/callback
 * Meta OAuth callback — exchanges code for tokens, discovers assets
 * PRD 4.3 Steps 2-6
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

import { env, getAppUrl, getMetaRedirectUri } from '@/lib/env';

function getWorkspaceIdFromState(stateParam: string | null) {
  if (!stateParam) {
    return null;
  }

  try {
    const statePayload = JSON.parse(
      Buffer.from(stateParam, 'base64url').toString()
    ) as { workspace_id?: string };

    return statePayload.workspace_id ?? null;
  } catch {
    return null;
  }
}

async function markConnectionAsError(workspaceId: string | null, message: string) {
  if (!workspaceId) {
    return;
  }

  const supabase = await createClient();

  await supabase
    .from('meta_connections')
    .update({
      status: 'error',
      last_error: message,
    })
    .eq('workspace_id', workspaceId);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  const workspaceIdFromState = getWorkspaceIdFromState(stateParam);

  if (errorParam) {
    await markConnectionAsError(workspaceIdFromState, errorParam);
    return NextResponse.redirect(`${getAppUrl()}/onboarding?error=${errorParam}`);
  }

  if (!code || !stateParam) {
    await markConnectionAsError(workspaceIdFromState, 'missing_code_or_state');
    return NextResponse.redirect(`${getAppUrl()}/onboarding?error=missing_code_or_state`);
  }

  try {
    // Decode state
    const statePayload = JSON.parse(
      Buffer.from(stateParam, 'base64url').toString()
    );
    const { workspace_id } = statePayload;

    const supabase = await createClient();

    // Step 2: Exchange code for short-lived access token (PRD 4.3)
    const tokenUrl = new URL('https://graph.facebook.com/v25.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', env.META_APP_ID!);
    tokenUrl.searchParams.set('redirect_uri', getMetaRedirectUri());
    tokenUrl.searchParams.set('client_secret', env.META_APP_SECRET!);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('[meta-callback] Token exchange error:', tokenData.error);
      await markConnectionAsError(workspace_id, 'token_exchange_failed');
      return NextResponse.redirect(`${getAppUrl()}/onboarding?error=token_exchange_failed`);
    }

    const shortLivedToken = tokenData.access_token;

    // Exchange for long-lived token (60 days)
    const longLivedUrl = new URL('https://graph.facebook.com/v25.0/oauth/access_token');
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', env.META_APP_ID!);
    longLivedUrl.searchParams.set('client_secret', env.META_APP_SECRET!);
    longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();
    const accessToken = longLivedData.access_token || shortLivedToken;
    const expiresIn = longLivedData.expires_in || 5184000; // 60 days default

    // Step 3-4: Validate token + check permissions (PRD 4.3)
    const permissionsRes = await fetch(
      `https://graph.facebook.com/v25.0/me/permissions?access_token=${accessToken}`
    );
    const permissionsData = await permissionsRes.json();
    const grantedPermissions = (permissionsData.data || [])
      .filter((p: { status: string }) => p.status === 'granted')
      .map((p: { permission: string }) => p.permission);

    // Step 5: Discover assets (PRD 4.3)
    // Get FB user ID
    const meRes = await fetch(
      `https://graph.facebook.com/v25.0/me?fields=id,name&access_token=${accessToken}`
    );
    const meData = await meRes.json();

    // List pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v25.0/${meData.id}/accounts?fields=id,name,access_token&access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();
    const page = pagesData.data?.[0]; // First page

    let igBusinessAccountId: string | null = null;
    let igUsername: string | null = null;

    if (page) {
      // Resolve IG business account from page
      const igRes = await fetch(
        `https://graph.facebook.com/v25.0/${page.id}?fields=instagram_business_account{id,username}&access_token=${accessToken}`
      );
      const igData = await igRes.json();
      igBusinessAccountId = igData.instagram_business_account?.id || null;
      igUsername = igData.instagram_business_account?.username || null;
    }

    if (!page || !igBusinessAccountId || !igUsername) {
      await markConnectionAsError(workspace_id, 'instagram_business_account_not_found');

      return NextResponse.redirect(
        `${getAppUrl()}/onboarding?error=instagram_business_account_not_found`
      );
    }

    // List ad accounts
    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v25.0/${meData.id}/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
    );
    const adAccountsData = await adAccountsRes.json();
    const adAccountIds = (adAccountsData.data || [])
      .filter((a: { account_status: number }) => a.account_status === 1) // Only active
      .map((a: { id: string }) => a.id);

    // Step 6: Persist (PRD 4.3) — encrypt tokens with pgcrypto
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Use raw SQL to encrypt tokens with pgcrypto
    const { error: rpcError } = await supabase.rpc('save_meta_connection', {
      p_workspace_id: workspace_id,
      p_access_token: accessToken,
      p_encryption_key: env.META_TOKENS_ENCRYPTION_KEY!,
      p_token_expires_at: tokenExpiresAt,
      p_fb_user_id: meData.id,
      p_page_id: page?.id || null,
      p_page_name: page?.name || null,
      p_page_access_token: page?.access_token || null,
      p_ig_business_account_id: igBusinessAccountId,
      p_ig_username: igUsername,
      p_ad_account_ids: adAccountIds,
      p_permissions_granted: grantedPermissions,
    });

    if (rpcError) {
      console.error('[meta-callback] save_meta_connection RPC error:', rpcError);
      await markConnectionAsError(workspace_id, 'save_connection_failed');
      return NextResponse.redirect(`${getAppUrl()}/onboarding?error=save_connection_failed`);
    }

    // Redirect to success page
    return NextResponse.redirect(
      `${getAppUrl()}/instagram/bootstrap`
    );
  } catch (err) {
    console.error('[meta-callback] Error:', err);
    await markConnectionAsError(workspaceIdFromState, 'internal_error');
    return NextResponse.redirect(`${getAppUrl()}/onboarding?error=internal_error`);
  }
}
