/**
 * Google OAuth token refresh utility.
 * Google access tokens expire in 1 hour. This utility auto-refreshes them.
 */

import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

interface RefreshResult {
  accessToken: string;
  channelId: string;
}

export async function getValidGoogleToken(workspaceId: string): Promise<RefreshResult | null> {
  const supabase = await createClient();

  // Get connection
  const { data: conn } = await supabase
    .from('google_connections')
    .select('yt_channel_id, token_expires_at, status')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .maybeSingle();

  if (!conn?.yt_channel_id) return null;

  const encryptionKey = env.GOOGLE_TOKENS_ENCRYPTION_KEY;
  if (!encryptionKey) return null;

  // Check if token needs refresh (expired or within 5 minutes)
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : new Date(0);
  const needsRefresh = expiresAt.getTime() - Date.now() < 5 * 60 * 1000;

  if (needsRefresh) {
    // Get refresh token
    const { data: refreshToken } = await supabase.rpc('get_google_refresh_token', {
      p_workspace_id: workspaceId,
      p_encryption_key: encryptionKey,
    });

    if (!refreshToken) {
      await supabase.from('google_connections').update({ status: 'expired', last_error: 'missing_refresh_token' }).eq('workspace_id', workspaceId);
      return null;
    }

    // Refresh the token
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const data = await res.json();

    if (data.error) {
      console.error('[google-token] Refresh failed:', data.error);
      await supabase.from('google_connections').update({ status: 'expired', last_error: `refresh_failed: ${data.error}` }).eq('workspace_id', workspaceId);
      return null;
    }

    // Save new access token (encrypted)
    const newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

    // Update encrypted token via RPC (reuse save, but we only need to update access token)
    // Since save_google_connection does ON CONFLICT UPDATE, we can call it with the existing refresh token
    await supabase.rpc('save_google_connection', {
      p_workspace_id: workspaceId,
      p_access_token: data.access_token,
      p_refresh_token: refreshToken, // Keep the same refresh token
      p_encryption_key: encryptionKey,
      p_token_expires_at: newExpiresAt,
      p_google_user_id: '', // Won't change due to ON CONFLICT
      p_google_email: '',
      p_yt_channel_id: conn.yt_channel_id,
      p_yt_channel_title: '',
      p_scopes_granted: [],
    });

    return { accessToken: data.access_token, channelId: conn.yt_channel_id };
  }

  // Token is still valid — decrypt and return
  const { data: accessToken } = await supabase.rpc('get_google_access_token', {
    p_workspace_id: workspaceId,
    p_encryption_key: encryptionKey,
  });

  if (!accessToken) return null;

  return { accessToken, channelId: conn.yt_channel_id };
}
