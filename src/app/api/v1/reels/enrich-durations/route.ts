/**
 * POST /api/v1/reels/enrich-durations
 * Enriches duration_seconds for reels that are missing it, using Apify.
 * Runs up to CONCURRENCY fetches in parallel.
 * Safe to call as fire-and-forget from the frontend.
 */

export const maxDuration = 60;

import { createClient } from '@/lib/supabase/server';
import { isAuthError } from '@/lib/api/auth';
import { requireFeature } from '@/lib/api/guard';
import { apiSuccess, api500 } from '@/lib/api/response';
import { fetchApifyReelPublicData } from '@/services/apify-reel.service';
import { logIntegrationUsage } from '@/services/integration-usage.service';

const CONCURRENCY = 4;
const MAX_REELS = 20;

export async function POST(request: Request) {
  try {
    const auth = await requireFeature(request, 'reelAiAnalysis');
    if (isAuthError(auth)) return auth;

    const supabase = await createClient();

    // Find reels missing duration_seconds
    const { data: reels, error } = await supabase
      .from('reels')
      .select('id, permalink')
      .eq('workspace_id', auth.workspaceId)
      .eq('media_product_type', 'REELS')
      .is('duration_seconds', null)
      .not('permalink', 'is', null)
      .limit(MAX_REELS);

    if (error || !reels || reels.length === 0) {
      return apiSuccess({ enriched: 0, total: 0 });
    }

    let enriched = 0;

    // Process in batches of CONCURRENCY
    for (let i = 0; i < reels.length; i += CONCURRENCY) {
      const batch = reels.slice(i, i + CONCURRENCY);

      await Promise.all(
        batch.map(async (reel) => {
          try {
            const t0 = Date.now();
            const apifyData = await fetchApifyReelPublicData(reel.permalink);
            const latencyMs = Date.now() - t0;
            const duration = apifyData?.video_duration_seconds ?? null;

            logIntegrationUsage(supabase, {
              workspaceId: auth.workspaceId,
              userId: auth.userId,
              feature: 'ig-reel-enrichment',
              provider: 'scraper',
              operation: 'reel-scrape',
              latencyMs,
              status: apifyData ? 'success' : 'error',
            }).catch(() => {});

            if (duration) {
              await supabase
                .from('reels')
                .update({ duration_seconds: duration })
                .eq('id', reel.id);
              enriched++;
            }
          } catch {
            // Non-blocking — continue with other reels
          }
        }),
      );
    }

    return apiSuccess({ enriched, total: reels.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[enrich-durations]', message);
    return api500(message);
  }
}
