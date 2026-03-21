/**
 * GET /api/v1/dashboard/stats
 * Aggregated dashboard statistics for a workspace
 * PRD 8.1: Dashboard principal — zona superior
 *
 * Query params: workspace_id (required)
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api500 } from '@/lib/api/response';

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const supabase = await createClient();

    // Count total reels
    const { count: totalReels } = await supabase
      .from('reels')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', auth.workspaceId);

    // Aggregate views from reel_computed view
    const { data: viewsAgg } = await supabase
      .from('reel_computed')
      .select('views_org, views_paid, views_total')
      .eq('workspace_id', auth.workspaceId);

    const totalViews = viewsAgg?.reduce((sum, r) => sum + (r.views_total || 0), 0) || 0;
    const totalViewsOrg = viewsAgg?.reduce((sum, r) => sum + (r.views_org || 0), 0) || 0;
    const totalViewsPaid = viewsAgg?.reduce((sum, r) => sum + (r.views_paid || 0), 0) || 0;
    const avgViews = (totalReels ?? 0) > 0 ? totalViews / (totalReels ?? 1) : 0;

    // Get latest benchmark
    const { data: benchmark } = await supabase
      .from('reel_benchmarks')
      .select('*')
      .eq('workspace_id', auth.workspaceId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    // Count top performers
    const avgViews90d = benchmark?.avg_views_90d || 0;
    const topPerformersCount = avgViews90d > 0
      ? (viewsAgg?.filter(r => (r.views_total || 0) >= avgViews90d * 3).length || 0)
      : 0;

    return apiSuccess({
      total_reels: totalReels || 0,
      total_views: totalViews,
      avg_views: Math.round(avgViews),
      total_views_org: totalViewsOrg,
      total_views_paid: totalViewsPaid,
      top_performers_count: topPerformersCount,
      benchmark: benchmark || null,
    });
  } catch {
    return api500();
  }
}
