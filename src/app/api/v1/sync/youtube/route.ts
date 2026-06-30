/**
 * POST /api/v1/sync/youtube
 * Thin proxy that authenticates the user and delegates sync work
 * to a Supabase Edge Function.
 *
 * Query: ?steps=quick|all
 * Body (optional): { channel_input: string } — for first-time connect
 */

import { createClient } from '@/lib/supabase/server';
import { isAuthError } from '@/lib/api/auth';
import { requireFeature } from '@/lib/api/guard';
import { apiSuccess, api500 } from '@/lib/api/response';
import { env } from '@/lib/env';

export async function POST(request: Request) {
  try {
    const auth = await requireFeature(request, 'youtube');
    if (isAuthError(auth)) return auth;

    const url = new URL(request.url);
    const steps = url.searchParams.get('steps') || 'all';

    // Optional: channel_input for first-time connect
    let channelInput: string | undefined;
    try {
      const body = await request.json();
      channelInput = body.channel_input;
    } catch {
      // No body — that's fine for re-sync
    }

    const supabase = await createClient();
    const syncHeaders = { 'x-sync-secret': env.SYNC_SECRET ?? '' };

    const { data, error } = await supabase.functions.invoke('sync-youtube', {
      body: { workspace_id: auth.workspaceId, steps, ...(channelInput ? { channel_input: channelInput } : {}) },
      headers: syncHeaders,
    });

    if (error) {
      console.error('[sync/youtube] Edge Function error:', error);
      return api500();
    }

    return apiSuccess(data);
  } catch (err) {
    console.error('[sync/youtube] Unhandled error:', err);
    return api500();
  }
}
