/**
 * POST /api/v1/youtube/channel
 * Connect a YouTube channel by URL/handle — no OAuth needed.
 * Triggers initial sync via Edge Function.
 *
 * GET /api/v1/youtube/channel
 * Returns the connected channel metadata.
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api500 } from '@/lib/api/response';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const channelInput = body.channel_input;

    if (!channelInput || typeof channelInput !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'channel_input is required (URL, @handle, or channel ID)' },
        { status: 400 }
      );
    }

    // Trigger sync with channel_input — the Edge Function will resolve and sync
    const supabase = await createClient();
    const { data, error } = await supabase.functions.invoke('sync-youtube', {
      body: { workspace_id: auth.workspaceId, steps: 'all', channel_input: channelInput },
      headers: { 'x-sync-secret': env.SYNC_SECRET ?? '' },
    });

    if (error) {
      console.error('[youtube/channel] Sync error:', error);
      return api500();
    }

    return apiSuccess(data);
  } catch (err) {
    console.error('[youtube/channel] Error:', err);
    return api500();
  }
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const supabase = await createClient();

    const { data: channel } = await supabase
      .from('yt_channels')
      .select('*')
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    return apiSuccess({ channel });
  } catch (err) {
    console.error('[youtube/channel] Error:', err);
    return api500();
  }
}
