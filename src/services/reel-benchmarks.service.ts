import { createClient as createServerClient } from '@/lib/supabase/server';

const BENCHMARK_WINDOW_DAYS = 90;
const EXCLUDE_TRIALS = true;
const MIN_VIEWS_THRESHOLD = 0;

interface ReelMetricsRow {
  views_org: number | null;
  likes_total: number | null;
  comments_total: number | null;
  shares_total: number | null;
  saves_total: number | null;
  follows_generated: number | null;
  reach_org: number | null;
  avg_watch_time_sec: number | null;
}

interface ReelMetricsPaidRow {
  views_paid: number | null;
  reach_paid: number | null;
}

interface ReelBenchmarkRow {
  id: string;
  workspace_id: string;
  calculated_at: string;
  window_start: string;
  window_end: string;
  reels_in_window: number;
}

interface ReelRow {
  id: string;
  reel_type: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  reel_metrics: ReelMetricsRow | ReelMetricsRow[] | null;
  reel_metrics_paid: ReelMetricsPaidRow | ReelMetricsPaidRow[] | null;
}

export interface RefreshReelBenchmarksResult {
  snapshotId: string;
  reelsInWindow: number;
  windowStart: string;
  windowEnd: string;
}

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getUtcDateString(value: Date): string {
  return value.toISOString().split('T')[0];
}

function getWindowBounds(): { windowStart: string; windowEnd: string } {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (BENCHMARK_WINDOW_DAYS - 1));

  return {
    windowStart: getUtcDateString(start),
    windowEnd: getUtcDateString(end),
  };
}

export async function refreshReelBenchmarks(
  workspaceId: string,
): Promise<RefreshReelBenchmarksResult> {
  const supabase = await createServerClient();
  const { windowStart, windowEnd } = getWindowBounds();

  const { data, error } = await supabase
    .from('reels')
    .select(`
      id,
      reel_type,
      published_at,
      duration_seconds,
      reel_metrics (
        views_org,
        likes_total,
        comments_total,
        shares_total,
        saves_total,
        follows_generated,
        reach_org,
        avg_watch_time_sec
      ),
      reel_metrics_paid (
        views_paid,
        reach_paid
      )
    `)
    .eq('workspace_id', workspaceId)
    .eq('media_product_type', 'REELS')
    .not('published_at', 'is', null)
    .gte('published_at', `${windowStart}T00:00:00.000Z`)
    .lte('published_at', `${windowEnd}T23:59:59.999Z`);

  if (error) {
    throw new Error(`No se pudo calcular reel_benchmarks: ${error.message}`);
  }

  const reels = (data ?? []) as ReelRow[];

  const eligible = reels
    .map((reel) => {
      const organic = normalizeRelation(reel.reel_metrics);
      const paid = normalizeRelation(reel.reel_metrics_paid);
      const viewsTotal = (organic?.views_org ?? 0) + (paid?.views_paid ?? 0);
      const reachTotal = (organic?.reach_org ?? 0) + (paid?.reach_paid ?? 0);
      const likes = organic?.likes_total ?? 0;
      const comments = organic?.comments_total ?? 0;
      const shares = organic?.shares_total ?? 0;
      const saves = organic?.saves_total ?? 0;
      const follows = organic?.follows_generated ?? 0;
      const avgWatchTime = organic?.avg_watch_time_sec ?? null;
      const totalInteractions = likes + comments + shares + saves;
      const durationSeconds = reel.duration_seconds ?? null;

      return {
        reelType: reel.reel_type,
        hasMetrics: organic != null || paid != null,
        viewsTotal,
        reachTotal,
        likes,
        comments,
        shares,
        saves,
        follows,
        avgWatchTime,
        totalInteractions,
        durationSeconds,
      };
    })
    .filter((reel) => {
      if (!reel.hasMetrics) return false;
      if (EXCLUDE_TRIALS && reel.reelType === 'trial_likely') return false;
      return reel.viewsTotal >= MIN_VIEWS_THRESHOLD;
    });

  const withViews = eligible.filter((reel) => reel.viewsTotal > 0);
  const withWatchTime = eligible.filter((reel) => reel.avgWatchTime != null);
  const withDuration = eligible.filter((reel) => reel.durationSeconds != null && reel.durationSeconds > 0);
  const withRetention = eligible.filter(
    (reel) => reel.avgWatchTime != null && reel.durationSeconds != null && reel.durationSeconds > 0,
  );
  const withReach = eligible.filter((reel) => reel.reachTotal > 0);

  const payload = {
    workspace_id: workspaceId,
    calculated_at: new Date().toISOString(),
    window_start: windowStart,
    window_end: windowEnd,
    reels_in_window: eligible.length,
    // Absolute averages
    avg_views_90d: average(eligible.map((reel) => reel.viewsTotal)),
    avg_comments_90d: average(eligible.map((reel) => reel.comments)),
    avg_saves_90d: average(eligible.map((reel) => reel.saves)),
    avg_follows_90d: average(eligible.map((reel) => reel.follows)),
    avg_likes_90d: average(eligible.map((reel) => reel.likes)),
    avg_shares_90d: average(eligible.map((reel) => reel.shares)),
    avg_reach_90d: average(eligible.map((reel) => reel.reachTotal)),
    avg_watch_time_90d: average(withWatchTime.map((reel) => reel.avgWatchTime ?? 0)),
    // Per-view ratios
    avg_likes_per_view: average(withViews.map((reel) => reel.likes / reel.viewsTotal)),
    avg_comments_per_view: average(withViews.map((reel) => reel.comments / reel.viewsTotal)),
    avg_shares_per_view: average(withViews.map((reel) => reel.shares / reel.viewsTotal)),
    avg_saves_per_view: average(withViews.map((reel) => reel.saves / reel.viewsTotal)),
    avg_follows_per_view: average(withViews.map((reel) => reel.follows / reel.viewsTotal)),
    // New composite metrics
    avg_engagement_rate: average(
      withViews.map((reel) => (reel.totalInteractions / reel.viewsTotal) * 100),
    ),
    avg_retention_rate: average(
      withRetention.map((reel) =>
        Math.min(100, ((reel.avgWatchTime ?? 0) / (reel.durationSeconds ?? 1)) * 100),
      ),
    ),
    avg_duration_seconds: average(
      withDuration.map((reel) => reel.durationSeconds ?? 0),
    ),
    avg_reach_per_view: average(
      withViews.map((reel) => reel.reachTotal / reel.viewsTotal),
    ),
    avg_saves_per_reach: average(
      withReach.map((reel) => reel.saves / reel.reachTotal),
    ),
    exclude_trials: EXCLUDE_TRIALS,
    min_views_threshold: MIN_VIEWS_THRESHOLD,
  };

  const { data: upserted, error: upsertError } = await supabase
    .from('reel_benchmarks')
    .upsert(payload, { onConflict: 'workspace_id' })
    .select('id, reels_in_window, window_start, window_end')
    .single();

  if (upsertError || !upserted) {
    throw new Error(`No se pudo guardar reel_benchmarks: ${upsertError?.message ?? 'sin respuesta'}`);
  }

  const snapshot = upserted as Pick<ReelBenchmarkRow, 'id' | 'reels_in_window' | 'window_start' | 'window_end'>;

  return {
    snapshotId: snapshot.id,
    reelsInWindow: snapshot.reels_in_window,
    windowStart: snapshot.window_start,
    windowEnd: snapshot.window_end,
  };
}
