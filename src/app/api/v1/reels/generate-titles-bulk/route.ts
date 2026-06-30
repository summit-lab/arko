/**
 * POST /api/v1/reels/generate-titles-bulk
 * Genera auto_title para todos los reels del workspace sin título.
 * Usa el service compartido.
 */

import { isAuthError } from '@/lib/api/auth';
import { requireFeature } from '@/lib/api/guard';
import { apiSuccess, api500 } from '@/lib/api/response';
import { generateMissingTitles } from '@/services/reel-titles.service';

export async function POST(request: Request) {
  try {
    const auth = await requireFeature(request, 'reelAiAnalysis');
    if (isAuthError(auth)) return auth;

    const result = await generateMissingTitles(auth.workspaceId);
    return apiSuccess(result);
  } catch {
    return api500();
  }
}
