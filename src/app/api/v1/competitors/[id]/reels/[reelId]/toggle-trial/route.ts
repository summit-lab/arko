/**
 * POST /api/v1/competitors/[id]/reels/[reelId]/toggle-trial
 * Manually flag/unflag a competitor reel as a trial.
 *
 * Auto trial-detection (gridShortcodes vs reelShortcodes) is best-effort and
 * sometimes fails — the post-scraper actor briefly catches reels that ARE
 * trials, or misses regular reels. This endpoint lets the user override.
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api404 } from '@/lib/api/response';

interface ToggleTrialBody {
  is_trial?: boolean;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; reelId: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { id: competitorId, reelId } = await params;
  const body = (await request.json().catch(() => ({}))) as ToggleTrialBody;

  if (typeof body.is_trial !== 'boolean') {
    return api400('Se requiere is_trial (boolean) en el body.');
  }

  const supabase = await createClient();

  // Verify the reel belongs to a competitor in this workspace via the parent
  // competitor's workspace_id (RLS on competitor_reels references it indirectly).
  const { data: competitor } = await supabase
    .from('workspace_competitors')
    .select('id')
    .eq('id', competitorId)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle();

  if (!competitor) return api404('Competidor no encontrado');

  const { data: reel } = await supabase
    .from('competitor_reels')
    .select('id')
    .eq('id', reelId)
    .eq('competitor_id', competitorId)
    .maybeSingle();

  if (!reel) return api404('Reel no encontrado');

  const { error } = await supabase
    .from('competitor_reels')
    .update({ maybe_trial: body.is_trial })
    .eq('id', reelId);

  if (error) {
    console.error('[toggle-trial] update error:', error);
    return api400('No se pudo actualizar el reel.');
  }

  return apiSuccess({ id: reelId, maybe_trial: body.is_trial });
}
