/**
 * POST /api/v1/sync/youtube
 * Thin proxy that authenticates the user and delegates sync work
 * to a Supabase Edge Function.
 *
 * Query: ?steps=quick|all
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api500 } from '@/lib/api/response';
import { env } from '@/lib/env';

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const url = new URL(request.url);
    const steps = url.searchParams.get('steps') || 'all';

    const supabase = await createClient();
    const syncHeaders = { 'x-sync-secret': env.SYNC_SECRET ?? '' };

    const { data, error } = await supabase.functions.invoke('sync-youtube', {
      body: { workspace_id: auth.workspaceId, steps },
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
