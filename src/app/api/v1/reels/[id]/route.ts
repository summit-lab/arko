/**
 * GET /api/v1/reels/[id]
 * Full reel detail — "Ficha de Reel" (PRD 8.2)
 * Returns: reel + metrics + paid + transcript + narrative + visual + audio + diagnostics + benchmark
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api404, api500 } from '@/lib/api/response';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const supabase = await createClient();

    // Fetch reel with all related data
    const { data: reel, error } = await supabase
      .from('reels')
      .select(`
        *,
        reel_metrics (*),
        reel_metrics_paid (*),
        reel_transcripts (*),
        reel_narrative_analysis (*),
        reel_visual_analysis (*),
        reel_audio_analysis (*),
        reel_diagnostics (*),
        ad_mappings (*)
      `)
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId)
      .single();

    if (error || !reel) {
      return api404('Reel no encontrado');
    }

    // Get latest benchmark for performer calculation
    const { data: benchmark } = await supabase
      .from('reel_benchmarks')
      .select('*')
      .eq('workspace_id', auth.workspaceId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    // Compute totals and performer status
    const metrics = reel.reel_metrics as Record<string, number> | null;
    const metricsPaid = reel.reel_metrics_paid as Record<string, number> | null;
    const viewsOrg = metrics?.views_org || 0;
    const viewsPaid = metricsPaid?.views_paid || 0;
    const viewsTotal = viewsOrg + viewsPaid;
    const impressionsOrg = metrics?.impressions_org ?? null;
    const impressionsPaid = metricsPaid?.impressions_paid || 0;
    const reachOrg = metrics?.reach_org || 0;
    const reachPaid = metricsPaid?.reach_paid || 0;
    const totalInteractions = metrics?.total_interactions || 0;
    const avgViews90d = benchmark?.avg_views_90d || 0;
    const performerMultiple = avgViews90d > 0 ? viewsTotal / avgViews90d : null;

    // duration_seconds ya se guarda en la DB durante el sync/enrichment inicial.
    // No llamamos al scraper externo aquí — los datos de métricas vienen de Meta API (gratis)
    // y el transcript viene del análisis de Gemini.
    const effectiveDuration = reel.duration_seconds ?? null;
    const avgWatchTimeSec = metrics?.avg_watch_time_sec ?? null;

    const retentionRate = avgWatchTimeSec != null && effectiveDuration && effectiveDuration > 0
      ? Math.min(100, (avgWatchTimeSec / effectiveDuration) * 100)
      : null;

    return apiSuccess({
      ...reel,
      duration_seconds: effectiveDuration,
      computed: {
        views_org: viewsOrg,
        views_paid: viewsPaid,
        views_total: viewsTotal,
        impressions_org: impressionsOrg,
        impressions_paid: impressionsPaid,
        impressions_total: (impressionsOrg ?? 0) + impressionsPaid,
        reach_org: reachOrg,
        reach_paid: reachPaid,
        reach_total: reachOrg + reachPaid,
        total_interactions: totalInteractions,
        avg_watch_time_sec: avgWatchTimeSec,
        watch_time_total_sec: avgWatchTimeSec != null
          ? avgWatchTimeSec * viewsOrg
          : null,
        profile_visits: metrics?.profile_visits ?? null,
        follows_generated: metrics?.follows_generated ?? null,
        paid_clicks: metricsPaid?.clicks || 0,
        spend_cents: metricsPaid?.spend_cents || 0,
        paid_video_plays: metricsPaid?.video_plays || 0,
        engagement_rate: viewsTotal > 0 ? (totalInteractions / viewsTotal) * 100 : 0,
        retention_rate: retentionRate,
        paid_ctr: impressionsPaid > 0 ? ((metricsPaid?.clicks || 0) / impressionsPaid) * 100 : null,
        paid_cpv: (metricsPaid?.video_plays || 0) > 0 ? (metricsPaid?.spend_cents || 0) / 100 / (metricsPaid?.video_plays || 1) : null,
        paid_cpm: impressionsPaid > 0 ? (metricsPaid?.spend_cents || 0) / 100 / (impressionsPaid / 1000) : null,
      },
      benchmark,
      performer_multiple_views: performerMultiple,
      is_top_performer: (performerMultiple ?? 0) >= 3,
    });
  } catch {
    return api500();
  }
}
