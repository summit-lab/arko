/**
 * GET /api/v1/reels
 * List reels for a workspace with computed metrics and top performer badges
 * PRD 8.1: Dashboard grid
 *
 * Query params:
 *   workspace_id (required)
 *   page (default 1)
 *   limit (default 30, max 100)
 *   type (optional: normal | trial_likely | unknown)
 *   sort (optional: published_at | views_total, default published_at)
 *   order (optional: asc | desc, default desc)
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiPaginated, api500 } from '@/lib/api/response';
import type { ReelCard } from '@/types/database';

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '30')));
    const reelType = url.searchParams.get('type');
    const sort = url.searchParams.get('sort') || 'published_at';
    const order = url.searchParams.get('order') === 'asc' ? true : false;

    const offset = (page - 1) * limit;

    const supabase = await createClient();

    // Build query
    let query = supabase
      .from('reels')
      .select(`
        id,
        ig_media_id,
        thumbnail_url,
        permalink,
        published_at,
        reel_type,
        has_ads,
        reel_metrics (views_org),
        reel_metrics_paid (views_paid)
      `, { count: 'exact' })
      .eq('workspace_id', auth.workspaceId)
      .range(offset, offset + limit - 1);

    // Filter by reel type if specified
    if (reelType && ['normal', 'trial_likely', 'unknown'].includes(reelType)) {
      query = query.eq('reel_type', reelType);
    }

    // Sort
    if (sort === 'published_at') {
      query = query.order('published_at', { ascending: order });
    } else {
      query = query.order('published_at', { ascending: order });
    }

    const { data: reels, count, error } = await query;

    if (error) {
      console.error('[reels] List error:', error);
      return api500();
    }

    // Get latest benchmark for top performer calculation
    const { data: benchmark } = await supabase
      .from('reel_benchmarks')
      .select('avg_views_90d')
      .eq('workspace_id', auth.workspaceId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const avgViews90d = benchmark?.avg_views_90d || 0;

    // Transform to ReelCard format
    const cards: ReelCard[] = (reels || []).map((reel) => {
      const metricsArr = reel.reel_metrics as unknown as { views_org: number }[] | null;
      const paidArr = reel.reel_metrics_paid as unknown as { views_paid: number }[] | null;
      const viewsOrg = metricsArr?.[0]?.views_org || 0;
      const viewsPaid = paidArr?.[0]?.views_paid || 0;
      const viewsTotal = viewsOrg + viewsPaid;
      const performerMultiple = avgViews90d > 0 ? viewsTotal / avgViews90d : null;

      return {
        id: reel.id,
        ig_media_id: reel.ig_media_id,
        thumbnail_url: reel.thumbnail_url,
        permalink: reel.permalink,
        published_at: reel.published_at,
        reel_type: reel.reel_type,
        has_ads: reel.has_ads,
        views_total: viewsTotal,
        views_org: viewsOrg,
        views_paid: viewsPaid,
        performer_multiple: performerMultiple,
        is_top_performer: (performerMultiple ?? 0) >= 3,
      };
    });

    const total = count || 0;

    return apiPaginated(cards, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    return api500();
  }
}
