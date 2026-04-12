/**
 * GET /api/v1/auth/google/callback
 * Google OAuth callback — exchanges code for tokens, discovers YouTube channel
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { env, getAppUrl, getGoogleRedirectUri } from '@/lib/env';

function getWorkspaceIdFromState(stateParam: string | null): string | null {
  if (!stateParam) return null;
  try {
    const payload = JSON.parse(Buffer.from(stateParam, 'base64url').toString()) as { workspace_id?: string };
    return payload.workspace_id ?? null;
  } catch {
    return null;
  }
}

async function markConnectionAsError(workspaceId: string | null, message: string) {
  if (!workspaceId) return;
  const supabase = await createClient();
  await supabase.from('google_connections').update({ status: 'error', last_error: message }).eq('workspace_id', workspaceId);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  const workspaceIdFromState = getWorkspaceIdFromState(stateParam);

  if (errorParam) {
    await markConnectionAsError(workspaceIdFromState, errorParam);
    return NextResponse.redirect(`${getAppUrl()}/youtube?error=${errorParam}`);
  }

  if (!code || !stateParam) {
    await markConnectionAsError(workspaceIdFromState, 'missing_code_or_state');
    return NextResponse.redirect(`${getAppUrl()}/youtube?error=missing_code_or_state`);
  }

  try {
    const statePayload = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
    const { workspace_id } = statePayload;
    const supabase = await createClient();

    // Step 1: Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: getGoogleRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('[google-callback] Token exchange error:', tokenData.error);
      await markConnectionAsError(workspace_id, 'token_exchange_failed');
      return NextResponse.redirect(`${getAppUrl()}/youtube?error=token_exchange_failed`);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;

    if (!refreshToken) {
      console.error('[google-callback] No refresh token received');
      await markConnectionAsError(workspace_id, 'no_refresh_token');
      return NextResponse.redirect(`${getAppUrl()}/youtube?error=no_refresh_token`);
    }

    // Step 2: Get Google user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userRes.json();

    // Step 3: Discover YouTube channel
    // Try mine=true first, then fallback to listing all channels for this account
    let channel: Record<string, unknown> | null = null;

    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&mine=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const channelData = await channelRes.json();
    console.log('[google-callback] channels?mine=true response:', JSON.stringify(channelData).slice(0, 500));
    channel = channelData.items?.[0] ?? null;

    // Fallback: try by managedByMe (for brand accounts)
    if (!channel) {
      const managedRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&managedByMe=true&maxResults=10`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const managedData = await managedRes.json();
      console.log('[google-callback] channels?managedByMe response:', JSON.stringify(managedData).slice(0, 500));
      channel = managedData.items?.[0] ?? null;
    }

    if (!channel) {
      console.error('[google-callback] No channel found for user:', userData.email);
      await markConnectionAsError(workspace_id, 'youtube_channel_not_found');
      return NextResponse.redirect(`${getAppUrl()}/youtube?error=youtube_channel_not_found`);
    }

    // Step 4: Save connection with encrypted tokens
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const scopesGranted = (tokenData.scope || '').split(' ').filter(Boolean);

    const { error: rpcError } = await supabase.rpc('save_google_connection', {
      p_workspace_id: workspace_id,
      p_access_token: accessToken,
      p_refresh_token: refreshToken,
      p_encryption_key: env.GOOGLE_TOKENS_ENCRYPTION_KEY!,
      p_token_expires_at: tokenExpiresAt,
      p_google_user_id: userData.id,
      p_google_email: userData.email,
      p_yt_channel_id: channel.id,
      p_yt_channel_title: channel.snippet?.title || null,
      p_scopes_granted: scopesGranted,
    });

    if (rpcError) {
      console.error('[google-callback] save_google_connection RPC error:', rpcError);
      await markConnectionAsError(workspace_id, 'save_connection_failed');
      return NextResponse.redirect(`${getAppUrl()}/youtube?error=save_connection_failed`);
    }

    // Step 5: Upsert channel metadata
    await supabase.from('yt_channels').upsert({
      workspace_id,
      yt_channel_id: channel.id,
      title: channel.snippet?.title,
      description: channel.snippet?.description,
      custom_url: channel.snippet?.customUrl,
      thumbnail_url: channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.default?.url,
      country: channel.snippet?.country,
      published_at: channel.snippet?.publishedAt,
      subscriber_count: parseInt(channel.statistics?.subscriberCount || '0'),
      video_count: parseInt(channel.statistics?.videoCount || '0'),
      view_count: parseInt(channel.statistics?.viewCount || '0'),
      uploads_playlist_id: channel.contentDetails?.relatedPlaylists?.uploads,
      fetched_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,yt_channel_id' });

    return NextResponse.redirect(`${getAppUrl()}/youtube?connected=true`);
  } catch (err) {
    console.error('[google-callback] Error:', err);
    await markConnectionAsError(workspaceIdFromState, 'internal_error');
    return NextResponse.redirect(`${getAppUrl()}/youtube?error=internal_error`);
  }
}
