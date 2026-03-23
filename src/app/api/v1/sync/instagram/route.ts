/**
 * POST /api/v1/sync/instagram
 * Thin proxy that authenticates the user and delegates heavy sync work
 * to a Supabase Edge Function (free, no Vercel function costs).
 *
 * Body: { workspace_id: string }
 * Query: ?steps=all|media|account
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

    // Invoke the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('sync-instagram', {
      body: {
        workspace_id: auth.workspaceId,
        steps,
      },
      headers: {
        'x-sync-secret': env.SYNC_SECRET ?? '',
      },
    });

    if (error) {
      console.error('[sync/instagram] Edge Function error:', error);
      return api500();
    }

    // Pass through the Edge Function response
    return apiSuccess(data);
  } catch (err) {
    console.error('[sync/instagram] Unhandled error:', err);
    return api500();
  }
}
