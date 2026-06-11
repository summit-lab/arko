import { Eye, Heart, Bookmark, MessageSquare, MessagesSquare, Reply, DollarSign, ArrowUpRight, ArrowDownRight, Film, BookImage, Grid2X2, Link as LinkIcon, Shapes, AtSign, Users, TrendingUp } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { ContentCalendar } from "@/components/dashboard/ContentCalendar";
import { MetasDonut } from "@/components/dashboard/MetasDonut";
import { ConversationsChart } from "@/components/dashboard/ConversationsChart";
import { RecentReelsStrip } from "@/components/dashboard/RecentReelsStrip";
import { FollowerGrowthChart } from "@/components/dashboard/FollowerGrowthChart";
import { CountUp } from "@/components/ui/CountUp";
import { DateFilter } from "@/components/ui/DateFilter";
import { parseDateParams, previousPeriod, nextDay, toISOStart } from "@/lib/date-utils";
import { dailyNewFromTotals, sumCleanFollowerDeltas, cleanFollowersTotalSeries } from "@/lib/follower-metrics";
import { signStorageThumbs, pickThumb } from "@/lib/storage-thumbs";
import type { DateRange } from "@/types/date-filter";
import { Suspense } from "react";

type DashboardTranslator = Awaited<ReturnType<typeof getTranslations<"dashboard">>>;

// ─── Helpers ───

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toString();
}

function pctChange(current: number, previous: number): { text: string; up: boolean } {
  if (previous === 0) return current > 0 ? { text: "+100%", up: true } : { text: "—", up: true };
  const change = ((current - previous) / previous) * 100;
  return {
    text: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
    up: change >= 0,
  };
}

/**
 * Filter helper — Meta returns sparse/zero rows for some accounts+days.
 * We treat a day as having "signal" when at least reach or impressions is > 0.
 * Applied to BOTH current and previous period to keep deltas unbiased (Fix 3.4).
 */
const hasSignal = (d: { reach?: number | null; impressions?: number | null }) =>
  (d.reach ?? 0) > 0 || (d.impressions ?? 0) > 0;

/**
 * Interaction fallback — Meta sometimes returns null for total_interactions.
 * In that case we reconstruct it from component metrics so engagement-rate
 * derivation is robust on partial-sync workspaces (Fix 3.9).
 * Only affects engagement-rate computation, not the component KPIs.
 */
function interactionsOf(r: {
  total_interactions?: number | null;
  likes?: number | null;
  comments?: number | null;
  saves?: number | null;
  shares?: number | null;
}): number {
  return (
    r.total_interactions ??
    ((r.likes ?? 0) + (r.comments ?? 0) + (r.saves ?? 0) + (r.shares ?? 0))
  );
}

/** Current calendar month window {from: YYYY-MM-01, to: todayISO} — for "Metas del Mes" actuals (Fix 3.3) */
function getCurrentMonthWindow(): { from: string; to: string } {
  const d = new Date();
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from, to };
}

// ─── Data Fetching ───

async function getDashboardData(range: DateRange, t: DashboardTranslator) {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();
  const today = nextDay(range.to); // exclusive upper bound for .lt()
  const thirtyDaysAgo = range.from;
  const prev = previousPeriod(range);
  const sixtyDaysAgo = prev.from;
  // Keep 90d window for reels (need content calendar + top sales regardless of filter)
  const ninetyDaysAgo = toISOStart(new Date(new Date().getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const periodAgo = range.from;

  // Period reels range (ISO bounds for reels.published_at timestamptz) — Fix 3.1/3.2
  const periodReelsFromISO = toISOStart(range.from);
  const periodReelsToISO = toISOStart(nextDay(range.to));

  // Current calendar month window (for Metas del Mes donuts) — Fix 3.3
  const monthWin = getCurrentMonthWindow();
  const monthTo = nextDay(monthWin.to);
  const monthStart = monthWin.from;

  const [
    insightsCurrent,
    insightsPrevious,
    insightsPeriodFollows,
    insightsMonthly,
    insightsMonthGoals,
    reels90d,
    reelsPeriod,
    goalsResult,
    salesCurrent,
    salesPrevious,
    conversationsCurrent,
    conversationsPrev,
    adsMessagingCurrent,
    adsMessagingPrev,
    storiesForCalendar,
    viewsCurrentInsights,
    viewsPrevInsights,
  ] = await Promise.all([
    // Query 1: Current period insights (for KPIs + deltas). Removed hardcoded .limit(30)
    // — the date range predicate already bounds the result (Fix 3.6).
    supabase
      .from("ig_account_insights")
      .select("reach, impressions, total_interactions, likes, comments, shares, saves, follower_count, follows_count")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", thirtyDaysAgo)
      .lt("metric_date", today)
      .order("metric_date", { ascending: false }),

    // Query 2: Previous period insights (for % change). Added ORDER BY, dropped .limit (Fix 3.5).
    supabase
      .from("ig_account_insights")
      .select("reach, impressions, total_interactions, likes, comments, shares, saves")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", sixtyDaysAgo)
      .lt("metric_date", thirtyDaysAgo)
      .order("metric_date", { ascending: true }),

    // Query 3: Follower growth over SELECTED period (was hardcoded 7d) — Fix 3.2
    supabase
      .from("ig_account_insights")
      .select("metric_date, follower_count, followers_total")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", range.from)
      .lt("metric_date", today)
      .order("metric_date", { ascending: true }),

    // Query 4: Period daily insights (for daily charts + profile growth section)
    supabase
      .from("ig_account_insights")
      .select("metric_date, reach, impressions, likes, saves, comments, profile_views, follower_count, followers_total")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", periodAgo)
      .lt("metric_date", today)
      .order("metric_date", { ascending: true }),

    // Query 5: Current-month insights (for Metas del Mes donuts) — Fix 3.3
    supabase
      .from("ig_account_insights")
      .select("metric_date, reach, impressions, total_interactions, likes, comments, saves, shares, follower_count, followers_total")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", monthStart)
      .lt("metric_date", monthTo)
      .order("metric_date", { ascending: true }),

    // Query 6: Reels last 90 days — for calendar + top sales + recent reels strip
    supabase
      .from("reels")
      .select(`
        id, caption, permalink, published_at, media_type, reel_type, has_ads, sales_amount, thumbnail_url, media_storage_path,
        reel_metrics (views_org, likes_total, comments_total, shares_total, saves_total),
        reel_metrics_paid (views_paid)
      `)
      .eq("workspace_id", workspaceId)
      .gte("published_at", ninetyDaysAgo)
      .order("published_at", { ascending: false })
      .limit(200),

    // Query 7: Reels in SELECTED period — for "Vistas Totales" KPI + "Mejor Reel" (Fix 3.1/3.2)
    supabase
      .from("reels")
      .select(`
        id, caption, permalink, published_at, has_ads, reel_type,
        reel_metrics (views_org, likes_total, comments_total, shares_total, saves_total),
        reel_metrics_paid (views_paid)
      `)
      .eq("workspace_id", workspaceId)
      .gte("published_at", periodReelsFromISO)
      .lt("published_at", periodReelsToISO)
      .order("published_at", { ascending: false })
      .limit(500),

    // Query 9: Workspace goals for current month
    supabase
      .from("workspace_goals")
      .select("metric, target_value")
      .eq("workspace_id", workspaceId)
      .eq("period_start", monthStart),

    // Query 10: Sales — current selected period (para Facturacion + Efectivo + material breakdown)
    // Embebemos reels, story_sequences + sus slides, con campos para el render:
    //   - reels: auto_title, caption (fallback), thumbnail_url (portada)
    //   - stories: published_at + primer slide para su thumbnail
    supabase
      .from("sales")
      .select(`
        amount_total, amount_collected, source_type, source_label, payment_status,
        reel_id, story_sequence_id,
        reels(id, caption, auto_title, thumbnail_url, media_storage_path, media_type),
        ig_story_sequences(id, published_at, ig_story_slides(slide_index, thumbnail_url, media_url, media_storage_path))
      `)
      .eq("workspace_id", workspaceId)
      .neq("payment_status", "cancelled")
      .gte("sale_date", range.from)
      .lte("sale_date", range.to),

    // Query 11: Sales — previous period (para KPI deltas)
    supabase
      .from("sales")
      .select("amount_total, amount_collected")
      .eq("workspace_id", workspaceId)
      .neq("payment_status", "cancelled")
      .gte("sale_date", prev.from)
      .lte("sale_date", prev.to),

    // Query 12: current period insights for interactions chart.
    supabase
      .from("ig_account_insights")
      .select("metric_date, replies, comments")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", range.from)
      .lte("metric_date", range.to)
      .order("metric_date", { ascending: true }),

    // Query 13: previous period insights (for delta).
    supabase
      .from("ig_account_insights")
      .select("replies, comments")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", prev.from)
      .lte("metric_date", prev.to),

    // Query 14: current period ads messaging. The sync-instagram edge function
    // already filters ad_metrics_daily rows by ownership (isOwnAd), so every
    // row in this table belongs to the workspace's own IG/page.
    supabase
      .from("ad_metrics_daily")
      .select("metric_date, messaging_conversations")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", range.from)
      .lte("metric_date", range.to),

    // Query 15: previous period ads messaging (for delta).
    supabase
      .from("ad_metrics_daily")
      .select("messaging_conversations")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", prev.from)
      .lte("metric_date", prev.to),

    // Query 16: story sequences last 90 days — for calendar
    supabase
      .from("ig_story_sequences")
      .select("id, published_at, total_impressions, total_reach, total_replies")
      .eq("workspace_id", workspaceId)
      .gte("published_at", ninetyDaysAgo)
      .order("published_at", { ascending: false })
      .limit(200),

    // Query 17 + 18: "Vistas Totales" del periodo. Usamos account-level
    // impressions de ig_account_insights — es la misma metrica que IG nativo
    // muestra como "Impresiones de la cuenta". Suma TODO: reels nuevos, viejos
    // creciendo, stories, posts. Daily, sumable por cualquier ventana.
    supabase
      .from("ig_account_insights")
      .select("impressions")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", range.from)
      .lte("metric_date", range.to),
    supabase
      .from("ig_account_insights")
      .select("impressions")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", prev.from)
      .lte("metric_date", prev.to),
  ]);

  // ─── Log query errors ───
  if (insightsCurrent.error) console.error('[dashboard] insightsCurrent error:', insightsCurrent.error);
  if (insightsPrevious.error) console.error('[dashboard] insightsPrevious error:', insightsPrevious.error);
  if (insightsPeriodFollows.error) console.error('[dashboard] insightsPeriodFollows error:', insightsPeriodFollows.error);
  if (insightsMonthly.error) console.error('[dashboard] insightsMonthly error:', insightsMonthly.error);
  if (insightsMonthGoals.error) console.error('[dashboard] insightsMonthGoals error:', insightsMonthGoals.error);
  if (reels90d.error) console.error('[dashboard] reels90d error:', reels90d.error);
  if (reelsPeriod.error) console.error('[dashboard] reelsPeriod error:', reelsPeriod.error);
  if (viewsCurrentInsights.error) console.error('[dashboard] viewsCurrentInsights error:', viewsCurrentInsights.error);
  if (viewsPrevInsights.error) console.error('[dashboard] viewsPrevInsights error:', viewsPrevInsights.error);
  if (salesCurrent.error) console.error('[dashboard] salesCurrent error:', salesCurrent.error);
  if (salesPrevious.error) console.error('[dashboard] salesPrevious error:', salesPrevious.error);
  if (conversationsCurrent.error) console.error('[dashboard] conversationsCurrent error:', conversationsCurrent.error);
  if (conversationsPrev.error) console.error('[dashboard] conversationsPrev error:', conversationsPrev.error);
  if (adsMessagingCurrent.error) console.error('[dashboard] adsMessagingCurrent error:', adsMessagingCurrent.error);
  if (adsMessagingPrev.error) console.error('[dashboard] adsMessagingPrev error:', adsMessagingPrev.error);
  if (storiesForCalendar.error) console.error('[dashboard] storiesForCalendar error:', storiesForCalendar.error);

  // ─── Follower growth chart data (from Query 3) ───
  // "Nuevos por día" = resta de totales REALES (followers_total[hoy] − [ayer]),
  // estilo Metricool. Robusto por diseño: no depende del delta follower_count de
  // Meta (que se dispara tras suspensión/reactivación). El valle de suspensión se
  // excluye dentro de dailyNewFromTotals.
  const rawFollowerGrowth = dailyNewFromTotals(insightsPeriodFollows.data ?? []).map((r) => {
    const d = new Date(r.metric_date + "T00:00:00Z");
    return {
      date: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
      newFollowers: r.newFollowers,
    };
  });
  // Trim trailing zeros — Meta has 24-48h delay so last 1-2 days may read as 0
  let trimEnd = rawFollowerGrowth.length;
  while (trimEnd > 0 && rawFollowerGrowth[trimEnd - 1].newFollowers === 0) trimEnd--;
  const followerGrowthData = trimEnd > 0 ? rawFollowerGrowth.slice(0, trimEnd) : rawFollowerGrowth;

  // ─── Process insights data ───
  // Apply `hasSignal` filter to BOTH current AND previous windows to avoid biased deltas (Fix 3.4).
  const current30d = (insightsCurrent.data ?? []).filter(hasSignal);
  const previous30d = (insightsPrevious.data ?? []).filter(hasSignal);

  const sumCurrent = {
    reach: current30d.reduce((s, r) => s + (r.reach || 0), 0),
    likes: current30d.reduce((s, r) => s + (r.likes || 0), 0),
    comments: current30d.reduce((s, r) => s + (r.comments || 0), 0),
    saves: current30d.reduce((s, r) => s + (r.saves || 0), 0),
    shares: current30d.reduce((s, r) => s + (r.shares || 0), 0),
    // Use interactionsOf() fallback so rows with null total_interactions still contribute (Fix 3.9)
    interactions: current30d.reduce((s, r) => s + interactionsOf(r), 0),
  };

  const sumPrevious = {
    reach: previous30d.reduce((s, r) => s + (r.reach || 0), 0),
    likes: previous30d.reduce((s, r) => s + (r.likes || 0), 0),
    comments: previous30d.reduce((s, r) => s + (r.comments || 0), 0),
    saves: previous30d.reduce((s, r) => s + (r.saves || 0), 0),
    shares: previous30d.reduce((s, r) => s + (r.shares || 0), 0),
    interactions: previous30d.reduce((s, r) => s + interactionsOf(r), 0),
  };

  // Follower growth over SELECTED period: prefer followers_total diff, fallback to follower_count sum (Fix 3.2)
  // Excluye el valle de suspensión de los diffs y los deltas anómalos de la suma.
  const periodFollowerRows = insightsPeriodFollows.data ?? [];
  const withFt = cleanFollowersTotalSeries(periodFollowerRows).filter((r) => (r.followers_total || 0) > 0);
  const firstFt = withFt[0]?.followers_total ?? 0;
  const lastFt = withFt[withFt.length - 1]?.followers_total ?? 0;
  const newFollowsWindow = lastFt > firstFt
    ? lastFt - firstFt
    : sumCleanFollowerDeltas(periodFollowerRows);

  // ─── Storage-first para portadas (reel-media + story-media) ───
  // El thumbnail crudo de scontent expira; preferimos el re-host estable.
  // Firmado batch + fallback via helper compartido (src/lib/storage-thumbs).
  // Los DOS buckets se firman EN PARALELO (antes story-media se firmaba mas
  // abajo como segundo await serial).
  const reelStoragePaths = new Set<string>();
  for (const r of (reels90d.data ?? []) as Array<{ media_storage_path?: string | null }>) {
    if (r.media_storage_path) reelStoragePaths.add(r.media_storage_path);
  }
  for (const s of (salesCurrent.data ?? []) as Array<{ reels?: { media_storage_path?: string | null } | null }>) {
    if (s.reels?.media_storage_path) reelStoragePaths.add(s.reels.media_storage_path);
  }
  const storyStoragePaths = new Set<string>();
  for (const s of (salesCurrent.data ?? []) as Array<{ ig_story_sequences?: { ig_story_slides?: Array<{ media_storage_path?: string | null }> } | null }>) {
    for (const slide of s.ig_story_sequences?.ig_story_slides ?? []) {
      if (slide.media_storage_path) storyStoragePaths.add(slide.media_storage_path);
    }
  }
  const [reelSignedUrls, storySignedUrls] = await Promise.all([
    signStorageThumbs(supabase, "reel-media", reelStoragePaths),
    signStorageThumbs(supabase, "story-media", storyStoragePaths),
  ]);
  const reelThumb = (storagePath: string | null | undefined, raw: string | null | undefined): string | null =>
    pickThumb(reelSignedUrls, storagePath, raw);

  // ─── Process 90d reels (calendar + top sales) ───

  const reels = (reels90d.data ?? []).map((r) => {
    const metrics = Array.isArray(r.reel_metrics) ? r.reel_metrics[0] : r.reel_metrics;
    const paid = Array.isArray(r.reel_metrics_paid) ? r.reel_metrics_paid[0] : r.reel_metrics_paid;
    const viewsOrg = metrics?.views_org || 0;
    const viewsPaid = paid?.views_paid || 0;
    return {
      id: r.id,
      caption: r.caption,
      permalink: r.permalink,
      published_at: r.published_at,
      media_type: (r as { media_type?: string }).media_type,
      reel_type: r.reel_type,
      has_ads: r.has_ads,
      thumbnail_url: reelThumb((r as { media_storage_path?: string | null }).media_storage_path, (r as { thumbnail_url?: string | null }).thumbnail_url),
      views_org: viewsOrg,
      views_paid: viewsPaid,
      views_total: viewsOrg + viewsPaid,
      likes: metrics?.likes_total || 0,
      saves: metrics?.saves_total || 0,
      comments: metrics?.comments_total || 0,
      shares: metrics?.shares_total || 0,
      sales_amount: r.sales_amount ?? null,
    };
  });

  // ─── Process period-scoped reels (KPI + mejor reel) — Fix 3.1/3.2 ───

  const reelsInPeriod = (reelsPeriod.data ?? []).map((r) => {
    const metrics = Array.isArray(r.reel_metrics) ? r.reel_metrics[0] : r.reel_metrics;
    const paid = Array.isArray(r.reel_metrics_paid) ? r.reel_metrics_paid[0] : r.reel_metrics_paid;
    const viewsOrg = metrics?.views_org || 0;
    const viewsPaid = paid?.views_paid || 0;
    return {
      id: r.id,
      caption: r.caption,
      published_at: r.published_at,
      has_ads: r.has_ads,
      reel_type: r.reel_type,
      views_total: viewsOrg + viewsPaid,
      likes: metrics?.likes_total || 0,
      saves: metrics?.saves_total || 0,
      comments: metrics?.comments_total || 0,
      shares: metrics?.shares_total || 0,
    };
  });

  // Vistas Totales = SUM(impressions) account-level. Misma metrica que IG nativo.
  const sumImpressions = (rows: Array<{ impressions: number | null }> | null) =>
    (rows ?? []).reduce((s, r) => s + (r.impressions ?? 0), 0);
  const totalViewsPeriod = sumImpressions(viewsCurrentInsights.data);
  const totalViewsPrevPeriod = sumImpressions(viewsPrevInsights.data);

  // Sales total from 90d window (Top Ventas panel)
  const totalSales = reels.reduce((s, r) => s + (r.sales_amount ?? 0), 0);

  const viewsChange: { text: string; up: boolean } | null = (totalViewsPeriod > 0 || totalViewsPrevPeriod > 0)
    ? pctChange(totalViewsPeriod, totalViewsPrevPeriod)
    : null;

  // Best reel — now scoped to SELECTED period (Fix 3.2)
  const bestReelViews = reelsInPeriod.length > 0
    ? Math.max(...reelsInPeriod.map((r) => r.views_total))
    : 0;

  // Engagement rate over current period (uses interactionsOf() fallback) — Fix 3.9
  const engRatePeriod = sumCurrent.reach > 0
    ? (sumCurrent.interactions / sumCurrent.reach) * 100
    : 0;

  // ─── Total followers snapshot (last known followers_total in period) ───
  const totalFollowers = withFt[withFt.length - 1]?.followers_total ?? 0;

  // ─── Daily chart data from ig_account_insights ───
  // Filter out days with zero metrics (incomplete sync data from current day)

  const dailyInsights = (insightsMonthly.data ?? []).filter(hasSignal);

  // Profile views + conversion rate (unique from IGDashboard)
  const totalProfileViews = dailyInsights.reduce(
    (s, r) => s + ((r as { profile_views?: number | null }).profile_views ?? 0), 0
  );
  const conversionRate = totalProfileViews > 0 && newFollowsWindow > 0
    ? ((newFollowsWindow / totalProfileViews) * 100).toFixed(1)
    : null;

  // Recent reels strip — top 7 by views, with thumbnails
  const recentReels = [...reels]
    .sort((a, b) => b.views_total - a.views_total)
    .slice(0, 7);

  const growthData = dailyInsights.map((row) => {
    const d = new Date(row.metric_date);
    return {
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      reach: row.reach || 0,
      impressions: row.impressions || 0,
    };
  });

  const engagementData = dailyInsights.map((row) => {
    const d = new Date(row.metric_date);
    return {
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      likes: row.likes || 0,
      saves: row.saves || 0,
      comments: row.comments || 0,
    };
  });

  // ─── Metas del Mes actuals — scoped to CURRENT CALENDAR MONTH (Fix 3.3) ───

  const monthRows = (insightsMonthGoals.data ?? []).filter(hasSignal);

  // Mismo basis que el KPI "Vistas Totales": account-level impressions de IG.
  const monthSumViews = monthRows.reduce((s, r) => s + (r.impressions || 0), 0);
  const monthSumReach = monthRows.reduce((s, r) => s + (r.reach || 0), 0);
  const monthSumInteractions = monthRows.reduce((s, r) => s + interactionsOf(r), 0);
  const monthSumLikes = monthRows.reduce((s, r) => s + (r.likes || 0), 0);
  const monthSumSaves = monthRows.reduce((s, r) => s + (r.saves || 0), 0);

  // Followers gained this month: followers_total diff (preferred), fallback to follower_count sum
  // Saneado: excluye valle de suspensión de los diffs y deltas anómalos de la suma.
  const monthWithFt = cleanFollowersTotalSeries(monthRows).filter((r) => (r.followers_total || 0) > 0);
  const monthFirstFt = monthWithFt[0]?.followers_total ?? 0;
  const monthLastFt = monthWithFt[monthWithFt.length - 1]?.followers_total ?? 0;
  const followersGainedMonth = monthLastFt > monthFirstFt
    ? monthLastFt - monthFirstFt
    : sumCleanFollowerDeltas(monthRows);

  const engRateMonth = monthSumReach > 0
    ? (monthSumInteractions / monthSumReach) * 100
    : 0;

  // ─── Sales (current selected period) — "Ventas cobradas" KPI + source donut ───
  // Currency treated as implicit USD (no currency column in schema).

  const salesCurrentRows = (salesCurrent.data ?? []) as unknown as Array<{
    amount_total: number | null;
    amount_collected: number | null;
    source_type: string | null;
    source_label: string | null;
    payment_status: string | null;
    reel_id: string | null;
    story_sequence_id: string | null;
    reels?: { id: string; caption: string | null; auto_title: string | null; thumbnail_url: string | null; media_type: string | null } | null;
    ig_story_sequences?: {
      id: string;
      published_at: string | null;
      ig_story_slides?: Array<{ slide_index: number; thumbnail_url: string | null; media_url: string | null; media_storage_path: string | null }>;
    } | null;
  }>;
  const salesPreviousRows = (salesPrevious.data ?? []) as Array<{
    amount_total: number | null;
    amount_collected: number | null;
  }>;

  // Facturacion = amount_total (deal/precio acordado, lo facturado)
  // Efectivo = amount_collected (cash que ya entro)
  const totalBilled = salesCurrentRows.reduce((s, r) => s + Number(r.amount_total ?? 0), 0);
  const totalBilledPrev = salesPreviousRows.reduce((s, r) => s + Number(r.amount_total ?? 0), 0);
  const billingChange = pctChange(totalBilled, totalBilledPrev);

  const totalSalesCollected = salesCurrentRows.reduce((s, r) => s + Number(r.amount_collected ?? 0), 0);
  const totalSalesCollectedPrev = salesPreviousRows.reduce((s, r) => s + Number(r.amount_collected ?? 0), 0);
  const salesChange = pctChange(totalSalesCollected, totalSalesCollectedPrev);

  // ─── Top 5 materiales de facturación ───
  // Agrupa por MATERIAL UNICO (reel_id, story_sequence_id o source_label),
  // no por tipo de fuente. De ese modo cada reel/post/historia aparece como
  // un item propio aunque haya generado varias ventas.
  //
  // Cada row tiene:
  //   key:       identificador unico estable (para map + key de React)
  //   type:      "reel" | "post" | "historia" | "otro" (para icono/color)
  //   label:     caption del reel o "Historia del DD/MM" o source_label
  //   billed:    SUM(amount_total)
  //   count:     cuantas ventas se atribuyen al material
  // Solo consideramos ventas con MATERIAL ASOCIADO (reel/post/carrusel o
  // historia). Las ventas con source_type='link_bio' o 'otro' no apuntan a
  // contenido real, así que ensucian el ranking con agrupaciones genéricas
  // ("Instagram", "CTA Bio", etc). Si el usuario quiere verlas aparte, se
  // podría agregar un panel "Fuentes sin contenido" en el sidebar.

  // Storage-first para portadas de historia: storySignedUrls ya se firmó
  // arriba (en paralelo con reel-media) via signStorageThumbs.

  type MaterialKey = { key: string; type: string; label: string; thumbnailUrl: string | null };
  const materialOf = (s: typeof salesCurrentRows[number]): MaterialKey | null => {
    // Reel embebido (incluye posts y carruseles — media_type decide el tipo).
    // Label preferido: auto_title (titulo AI generado) > caption truncado > fallback.
    if (s.reels?.id) {
      const mt = s.reels.media_type;
      const isPost = mt === "IMAGE" || mt === "CAROUSEL_ALBUM";
      const autoTitle = (s.reels.auto_title ?? "").trim();
      const captionShort = (s.reels.caption ?? "").trim().slice(0, 80);
      return {
        key: `reel:${s.reels.id}`,
        type: isPost ? "post" : "reel",
        label: autoTitle || captionShort || (isPost ? t("calendar.postUntitled") : t("calendar.reelUntitled")),
        thumbnailUrl: reelThumb((s.reels as { media_storage_path?: string | null }).media_storage_path, s.reels.thumbnail_url),
      };
    }
    // Historia embebida — para la portada, usamos el primer slide (slide_index=0).
    if (s.ig_story_sequences?.id) {
      const d = s.ig_story_sequences.published_at;
      const formatted = d
        ? new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
        : "";
      const slides = s.ig_story_sequences.ig_story_slides ?? [];
      const firstSlide = [...slides].sort((a, b) => a.slide_index - b.slide_index)[0];
      const archivedUrl = firstSlide?.media_storage_path
        ? storySignedUrls.get(firstSlide.media_storage_path) ?? null
        : null;
      const storyThumb = archivedUrl ?? firstSlide?.thumbnail_url ?? firstSlide?.media_url ?? null;
      return {
        key: `story:${s.ig_story_sequences.id}`,
        type: "historia",
        label: formatted ? t("calendar.storyOf", { date: formatted }) : t("calendar.story"),
        thumbnailUrl: storyThumb,
      };
    }
    // Sin contenido asociado (link_bio, otro) — se excluye del ranking.
    return null;
  };

  const materialTotals = new Map<string, { type: string; label: string; thumbnailUrl: string | null; billed: number; count: number }>();
  for (const s of salesCurrentRows) {
    const m = materialOf(s);
    if (!m) continue;
    const entry = materialTotals.get(m.key) ?? { type: m.type, label: m.label, thumbnailUrl: m.thumbnailUrl, billed: 0, count: 0 };
    entry.billed += Number(s.amount_total ?? 0);
    entry.count += 1;
    materialTotals.set(m.key, entry);
  }
  const topSources = [...materialTotals.entries()]
    .map(([key, v]) => ({ key, source_type: v.type, label: v.label, thumbnailUrl: v.thumbnailUrl, billed: v.billed, count: v.count }))
    .filter((s) => s.billed > 0)
    .sort((a, b) => b.billed - a.billed)
    .slice(0, 6);

  // KPIs array is built further down — after the conversations/stories
  // aggregations, because two of its cards depend on those series.

  // ─── Quick Stats ───

  const periodSubLabel = t("periodSubLabel", { days: range.days });

  const quickStats = [
    { label: t("quickStats.totalReach"), value: sumCurrent.reach > 0 ? formatCompact(sumCurrent.reach) : "—", sub: periodSubLabel },
    { label: t("quickStats.engagementRate"), value: engRatePeriod > 0 ? `${engRatePeriod.toFixed(1)}%` : "—", sub: t("quickStats.engagementSub") },
    { label: t("quickStats.bestReel"), value: bestReelViews > 0 ? formatCompact(bestReelViews) : "—", sub: t("quickStats.bestReelSub") },
    // Sub-label now matches the selected period (Fix 3.2)
    { label: t("quickStats.newFollows"), value: newFollowsWindow > 0 ? formatCompact(newFollowsWindow) : "—", sub: periodSubLabel },
    ...(totalSales > 0 ? [{ label: t("quickStats.totalSales"), value: `$${formatCompact(totalSales)}`, sub: t("quickStats.salesSub") }] : []),
  ];

  // Calendar content (reels/posts/carousels + stories) — for the monthly calendar.
  // `reels` table actually holds all IG media types (VIDEO/IMAGE/CAROUSEL_ALBUM),
  // and we type them here so the calendar can filter by "reels"/"posts".
  type CalendarItemType = "reel" | "post" | "historia";
  type CalendarItem = {
    id: string;
    type: CalendarItemType;
    published_at: string;
    caption: string | null;
    has_ads: boolean;
    reel_type?: string;
    views_total: number;
    likes: number;
    saves: number;
    comments: number;
  };

  const reelsAndPostsForCalendar: CalendarItem[] = reels.map((r) => {
    const mt = (r as { media_type?: string }).media_type;
    const type: CalendarItemType =
      mt === "IMAGE" || mt === "CAROUSEL_ALBUM" ? "post" : "reel";
    return {
      id: r.id,
      type,
      published_at: r.published_at,
      caption: r.caption,
      has_ads: r.has_ads,
      reel_type: r.reel_type,
      views_total: r.views_total,
      likes: r.likes,
      saves: r.saves,
      comments: r.comments,
    };
  });

  const storiesForCalendarItems: CalendarItem[] = (
    (storiesForCalendar.data ?? []) as Array<{
      id: string;
      published_at: string;
      total_impressions: number | null;
      total_reach: number | null;
      total_replies: number | null;
    }>
  ).map((s) => ({
    id: s.id,
    type: "historia",
    published_at: s.published_at,
    caption: null,
    has_ads: false,
    views_total: s.total_impressions ?? 0,
    likes: 0,
    saves: 0,
    comments: s.total_replies ?? 0,
  }));

  const calendarContent: CalendarItem[] = [
    ...reelsAndPostsForCalendar,
    ...storiesForCalendarItems,
  ];

  // Top reels por ventas (para gráfico)
  const salesChartData = [...reels]
    .filter((r) => (r.sales_amount ?? 0) > 0)
    .sort((a, b) => (b.sales_amount ?? 0) - (a.sales_amount ?? 0))
    .slice(0, 8)
    .map((r) => ({
      caption: r.caption ? (r.caption.length > 22 ? r.caption.slice(0, 22) + "…" : r.caption) : t("calendar.noCaption"),
      amount: r.sales_amount ?? 0,
      views: r.views_total,
    }));

  // ─── Goals (from DB) ───
  const goalsMap = new Map<string, number>();
  for (const g of (goalsResult.data ?? []) as { metric: string; target_value: number }[]) {
    goalsMap.set(g.metric, Number(g.target_value));
  }
  const goals = {
    views: goalsMap.get("views") ?? null,
    followers: goalsMap.get("followers") ?? null,
    engagement_rate: goalsMap.get("engagement_rate") ?? null,
    likes: goalsMap.get("likes") ?? null,
    saves: goalsMap.get("saves") ?? null,
    reach: goalsMap.get("reach") ?? null,
  };

  // Raw numeric values for donut calculation — CURRENT MONTH window (Fix 3.3).
  // Keys must match METRIC_CONFIG in MetasDonut (views/followers/engagement_rate/reach/likes/saves).
  const metasActuals = {
    views: monthSumViews,
    followers: followersGainedMonth,
    engagement_rate: engRateMonth,
    reach: monthSumReach,
    likes: monthSumLikes,
    saves: monthSumSaves,
  };

  // ─── Interacciones nuevas estimadas — respects dashboard date filter ───
  // Formula: (replies + FLOOR(comments/2) + ads_messaging) * 1.05 organic uplift.
  // Current + previous period for WoW-style delta.
  const ORGANIC_UPLIFT = 1.05;
  const estimateInteractions = (replies: number, comments: number, adsMsg: number) =>
    Math.round((replies + Math.floor(comments / 2) + adsMsg) * ORGANIC_UPLIFT);

  // Exclude today — IG insights have ~24h delay and today always reads as 0,
  // which dragged the chart line down to the baseline on the last point.
  const todayIso = new Date().toISOString().split("T")[0];

  const interactionsCurrentRaw = (conversationsCurrent.data ?? [])
    .filter((r): r is { metric_date: string; replies: number | null; comments: number | null } =>
      (r as { metric_date: string }).metric_date !== todayIso
    ) as Array<{
    metric_date: string;
    replies: number | null;
    comments: number | null;
  }>;
  const adsMsgCurrentRows = (adsMessagingCurrent.data ?? []) as Array<{
    metric_date: string;
    messaging_conversations: number | null;
  }>;
  const adsMsgCurrentByDate = new Map<string, number>();
  for (const r of adsMsgCurrentRows) {
    if (r.metric_date === todayIso) continue;
    adsMsgCurrentByDate.set(
      r.metric_date,
      (adsMsgCurrentByDate.get(r.metric_date) ?? 0) + (r.messaging_conversations ?? 0)
    );
  }
  const conversationsData = interactionsCurrentRaw.map((r) => ({
    date: r.metric_date,
    interactions: estimateInteractions(
      r.replies ?? 0,
      r.comments ?? 0,
      adsMsgCurrentByDate.get(r.metric_date) ?? 0
    ),
  }));

  // Previous period total for delta
  const interactionsPrevRaw = (conversationsPrev.data ?? []) as Array<{
    replies: number | null;
    comments: number | null;
  }>;
  const adsMsgPrevTotal = (adsMessagingPrev.data ?? []).reduce(
    (s, r) => s + ((r as { messaging_conversations: number | null }).messaging_conversations ?? 0),
    0
  );
  const prevBase = interactionsPrevRaw.reduce(
    (s, r) => s + (r.replies ?? 0) + Math.floor((r.comments ?? 0) / 2),
    0
  );
  const conversationsPrevTotal = Math.round((prevBase + adsMsgPrevTotal) * ORGANIC_UPLIFT);

  // ─── KPIs ───
  // Set final: Vistas Totales · Conversaciones generadas · Comentarios ·
  // Respuestas a historias · Ventas cobradas.

  // "Conversaciones generadas" = sum of the estimated interactions series
  // (replies + floor(comments/2) + ads_messaging, 5% organic uplift). Excludes
  // today — same criterion as the chart.
  const conversationsCurrentTotal = conversationsData.reduce(
    (sum, d) => sum + d.interactions, 0
  );
  const conversationsChange = pctChange(conversationsCurrentTotal, conversationsPrevTotal);

  // "Respuestas a historias" = sum of total_replies from ig_story_sequences in
  // the selected period. Filtered client-side from the 90d fetch to avoid an
  // extra query.
  const storiesRows = (storiesForCalendar.data ?? []) as Array<{ published_at: string; total_replies: number | null }>;
  const storyRepliesCurrent = storiesRows
    .filter((s) => s.published_at >= range.from && s.published_at <= range.to)
    .reduce((sum, s) => sum + (s.total_replies ?? 0), 0);
  const storyRepliesPrev = storiesRows
    .filter((s) => s.published_at >= prev.from && s.published_at <= prev.to)
    .reduce((sum, s) => sum + (s.total_replies ?? 0), 0);
  const storyRepliesChange = pctChange(storyRepliesCurrent, storyRepliesPrev);

  const kpis = [
    {
      label: t("kpis.totalViews"),
      // Siempre mostrar numero real (0 en vez de guion).
      value: formatCompact(totalViewsPeriod),
      change: viewsChange?.text ?? "—",
      up: viewsChange?.up ?? true,
      icon: "eye" as const,
      color: "text-white/60",
    },
    {
      label: t("kpis.conversations"),
      value: formatCompact(conversationsCurrentTotal),
      ...conversationsChange,
      icon: "conversations" as const,
      color: "text-white/60",
    },
    {
      label: t("kpis.comments"),
      value: formatCompact(sumCurrent.comments),
      ...pctChange(sumCurrent.comments, sumPrevious.comments),
      icon: "message" as const,
      color: "text-white/60",
    },
    {
      label: t("kpis.storyReplies"),
      value: formatCompact(storyRepliesCurrent),
      ...storyRepliesChange,
      icon: "reply" as const,
      color: "text-white/60",
    },
  ];

  // Ventas: vive en el sidebar como card con 2 metricas stackeadas.
  // Ambas siempre muestran $0 (nunca guion) y van en verde.
  const salesMetrics = {
    billing: {
      value: `$${formatCompact(totalBilled)}`,
      change: billingChange,
    },
    collected: {
      value: `$${formatCompact(totalSalesCollected)}`,
      change: salesChange,
    },
  };

  return {
    kpis,
    quickStats,
    growthData,
    engagementData,
    salesChartData,
    calendarContent,
    goals,
    metasActuals,
    conversationsData,
    conversationsPrevTotal,
    salesMetrics,
    topSources,
    totalFollowers,
    totalProfileViews,
    conversionRate,
    recentReels,
    followerGrowthData,
    newFollowsWindow,
  };
}

// ─── Icon mapping (can't pass components as serialized data) ───

const ICON_MAP = {
  eye: Eye,
  bookmark: Bookmark,
  heart: Heart,
  message: MessageSquare,
  conversations: MessagesSquare,
  reply: Reply,
  dollar: DollarSign,
} as const;

// ─── Source type metadata — must mirror Ventas client for visual consistency ───

const SOURCE_HEX: Record<string, string> = {
  reel: "#7A86E0",
  historia: "#AF6EC7",
  post: "#4BCEAF",
  link_bio: "#EB6991",
  cta_bio: "#F59E0B",
  otro: "#9B9BA8",
};

const SOURCE_BG: Record<string, string> = {
  reel: "rgba(122,134,224,0.12)",
  historia: "rgba(175,110,199,0.12)",
  post: "rgba(75,206,175,0.12)",
  link_bio: "rgba(235,105,145,0.12)",
  cta_bio: "rgba(245,158,11,0.12)",
  otro: "rgba(155,155,168,0.12)",
};

const SOURCE_ICON = {
  reel: Film,
  historia: BookImage,
  post: Grid2X2,
  link_bio: LinkIcon,
  cta_bio: AtSign,
  otro: Shapes,
} as const;

function fmtMoneyInt(n: number): string {
  return `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

interface TopSourceRow {
  key: string;
  source_type: string;
  label: string;
  thumbnailUrl: string | null;
  billed: number;
  count: number;
}

function TopSourcesList({ topSources, t }: { topSources: TopSourceRow[]; t: DashboardTranslator }) {
  const maxBilled = topSources.reduce((m, s) => Math.max(m, s.billed), 0);
  const totalBilled = topSources.reduce((s, r) => s + r.billed, 0);
  return (
    <div className="space-y-2.5">
      {topSources.map((s, i) => {
        const hex = SOURCE_HEX[s.source_type] ?? SOURCE_HEX.otro;
        const bg = SOURCE_BG[s.source_type] ?? SOURCE_BG.otro;
        // Label = titulo/caption del material (cada reel/historia/post es unico).
        const label = s.label;
        const Icon = SOURCE_ICON[s.source_type as keyof typeof SOURCE_ICON] ?? Shapes;
        const barPct = maxBilled > 0 ? (s.billed / maxBilled) * 100 : 0;
        const sharePct = totalBilled > 0 ? Math.round((s.billed / totalBilled) * 100) : 0;
        return (
          <div
            key={s.key}
            className="flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-white/[0.03]"
          >
            <span className="text-[11px] font-medium text-white/25 w-4 shrink-0 text-center">{i + 1}</span>
            {/* Thumbnail del material. Si falta (historia sin slide, reel
                archivado sin thumbnail_url, etc.) generamos una "portada
                sintética" con gradiente del color del tipo + inicial del
                label. Siempre hay algo visual — nunca un placeholder genérico
                de "imagen rota". */}
            {s.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.thumbnailUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-md object-cover"
                style={{ border: `1px solid ${bg}` }}
              />
            ) : (
              <div
                className="h-9 w-9 shrink-0 rounded-md flex items-center justify-center relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${hex}55, ${hex}15)`,
                  border: `1px solid ${bg}`,
                }}
                aria-hidden
              >
                <Icon className="h-[13px] w-[13px] absolute top-0.5 right-0.5 opacity-60" style={{ color: hex }} />
                <span className="text-[13px] font-semibold leading-none" style={{ color: hex }}>
                  {(label.trim().charAt(0) || "?").toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-[13px] font-medium text-white/85 truncate">{label}</span>
                <span className="text-[13px] font-medium text-emerald-400 tabular-nums">{fmtMoneyInt(s.billed)}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${barPct}%`, background: hex }}
                  />
                </div>
                <span className="text-[10px] text-white/35 tabular-nums whitespace-nowrap">
                  {t("sales.saleCount", { count: s.count })} · {sharePct}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ───

export default async function Home({ searchParams }: { searchParams: Promise<{ days?: string; from?: string; to?: string; preset?: string }> }) {
  const params = await searchParams;
  const dateRange = parseDateParams(params, "30d");
  const t = await getTranslations("dashboard");
  const data = await getDashboardData(dateRange, t);

  const kpis = data?.kpis ?? [];
  const quickStats = data?.quickStats ?? [];
  const growthData = data?.growthData ?? [];
  const engagementData = data?.engagementData ?? [];
  const salesChartData = data?.salesChartData ?? [];
  const calendarContent = data?.calendarContent ?? [];
  const conversationsData = data?.conversationsData ?? [];
  const conversationsPrevTotal = data?.conversationsPrevTotal ?? 0;
  const salesMetrics = data?.salesMetrics ?? null;
  const topSources = data?.topSources ?? [];
  const totalFollowers = data?.totalFollowers ?? 0;
  const totalProfileViews = data?.totalProfileViews ?? 0;
  const conversionRate = data?.conversionRate ?? null;
  const recentReels = data?.recentReels ?? [];
  const followerGrowthData = data?.followerGrowthData ?? [];
  const newFollowsWindow = data?.newFollowsWindow ?? 0;

  return (
    <div className="px-8 py-10">
      {/* Header del Dashboard — z-20 para crear stacking context propio que
          permite al dropdown del DateFilter flotar sobre los KPIs. Menor que
          el topbar global (z-50) para que el sticky header quede siempre
          arriba cuando scroleas. */}
      <div className="animate-slide-up mb-10 flex items-start justify-between relative z-20">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="text-white/35 mt-3 text-[15px] font-light">{t("subtitle")}</p>
        </div>
        <div className="mt-1">
          <Suspense fallback={null}>
            <DateFilter mode="url" defaultPreset="30d" />
          </Suspense>
        </div>
      </div>

      {/* Layout 70/30: columna izq (KPIs + charts + mejor contenido) | sidebar der
          (Ventas arriba + Resumen Rapido + etc). Los KPIs viven DENTRO del col izq
          asi que tienen el mismo ancho que los graficos de abajo. Ventas va
          arriba del todo en la sidebar, alineada al ras superior con los KPIs. */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── LEFT: KPIs + charts + Mejor Contenido ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Hero KPIs — 2 cols en mobile, 4 cols en lg+. Restringido al ancho
              del col izq asi no invade el sidebar. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {kpis.map((m, i) => {
              const IconComp = ICON_MAP[m.icon];
              return (
                <div key={m.label} className={`@container glass-card px-6 py-5 animate-slide-up stagger-${i + 1}`}>
                  {/* Container query: card angosto → icono ARRIBA + label DEBAJO
                      (stackeado). Card ancho (>=180px) → label IZQ + icono DER
                      (horizontal). Los `order` hacen el swap del arreglo DOM. */}
                  <div className="flex flex-col gap-2 mb-4 relative z-10 @[180px]:flex-row @[180px]:items-center @[180px]:justify-between">
                    <p className="stat-label leading-tight order-last @[180px]:order-first">{m.label}</p>
                    <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center bg-white/[0.06] ${m.color} order-first @[180px]:order-last`}>
                      <IconComp className="h-[18px] w-[18px] shrink-0" />
                    </div>
                  </div>
                  <CountUp value={m.value} className="stat-number-xl relative z-10" />
                  <div className="flex items-center gap-1.5 mt-3 relative z-10">
                    {m.change !== "—" ? (
                      <>
                        {m.up ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                        )}
                        <span className={`text-[12px] font-medium ${m.up ? "text-emerald-400" : "text-red-400"}`}>{m.change}</span>
                        <span className="text-[11px] text-white/25 ml-1">{t("vsPrevious")}</span>
                      </>
                    ) : (
                      <span className="text-[11px] text-white/20">{t("noPrevious")}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main charts — Recharts */}
          <div className="animate-slide-up stagger-4">
            <DashboardCharts growthData={growthData} engagementData={engagementData} salesData={salesChartData} />
          </div>

          {/* Top fuentes de facturación (periodo seleccionado).
              Reemplaza el bloque histórico "Mejor Contenido". Si no hay ventas
              con facturación > 0 en el periodo, mostramos un empty state en
              lugar de omitir la card — así el layout no salta. */}
          <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[15px] font-light text-white tracking-wide">{t("sales.topSources")}</h3>
              <span className="text-[11px] text-white/30 font-medium uppercase tracking-[0.1em]">{t("sales.topSourcesPeriod")}</span>
            </div>
            {topSources.length > 0 ? (
              <TopSourcesList topSources={topSources} t={t} />
            ) : (
              <div className="py-10 text-center">
                <p className="text-[13px] text-white/20 font-light">{t("sales.noSales")}</p>
              </div>
            )}
          </div>

          {/* Nuevos seguidores / día — gráfico de crecimiento (from IGDashboard) */}
          {followerGrowthData.length > 0 && (
            <FollowerGrowthChart
              data={followerGrowthData}
              totalGained={newFollowsWindow}
              title={t("newFollowersChart.title")}
              gainedLabel={t("newFollowersChart.gained")}
              newLabel={t("newFollowersChart.new")}
            />
          )}

          {/* Calendario de Contenido — al ancho del col izq asi llena el espacio
              bajo "Mejor Contenido" en vez de ocupar full-width al fondo. */}
          <div className="animate-slide-up stagger-6">
            <ContentCalendar items={calendarContent} />
          </div>

          {/* Reels recientes — top 7 por vistas (from IGDashboard) */}
          <RecentReelsStrip reels={recentReels} label={t("recentReels")} />

        </div>

        {/* ── RIGHT: Summary sidebar (320px en desktop, full-width stackeada en <1024px) ── */}
        <div className="w-full lg:w-[320px] lg:shrink-0 space-y-6">
          {/* Ventas — 2 glass-cards independientes stackeados (matchean el
              estilo de los KPIs de la fila 1: label arriba con icono a la der,
              numero grande debajo, delta abajo). */}
          {salesMetrics && (
            <>
              {/* Facturacion */}
              <div className="@container glass-card px-6 py-5 animate-slide-up stagger-1">
                <div className="flex flex-col gap-2 mb-4 relative z-10 @[180px]:flex-row @[180px]:items-center @[180px]:justify-between">
                  <p className="stat-label leading-tight order-last @[180px]:order-first">{t("sales.billing")}</p>
                  <div className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center bg-white/[0.06] text-emerald-400 order-first @[180px]:order-last">
                    <DollarSign className="h-[18px] w-[18px] shrink-0" />
                  </div>
                </div>
                <CountUp value={salesMetrics.billing.value} className="stat-number-xl relative z-10 text-emerald-300" />
                <div className="flex items-center gap-1.5 mt-3 relative z-10">
                  {salesMetrics.billing.change.text !== "—" && salesMetrics.billing.value !== "$0" ? (
                    <>
                      {salesMetrics.billing.change.up ? (
                        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                      )}
                      <span className={`text-[12px] font-medium ${salesMetrics.billing.change.up ? "text-emerald-400" : "text-red-400"}`}>
                        {salesMetrics.billing.change.text}
                      </span>
                      <span className="text-[11px] text-white/25 ml-1">{t("vsPrevious")}</span>
                    </>
                  ) : (
                    <span className="text-[11px] text-white/20">{t("noPrevious")}</span>
                  )}
                </div>
              </div>

              {/* Efectivo recolectado */}
              <div className="@container glass-card px-6 py-5 animate-slide-up stagger-2">
                <div className="flex flex-col gap-2 mb-4 relative z-10 @[180px]:flex-row @[180px]:items-center @[180px]:justify-between">
                  <p className="stat-label leading-tight order-last @[180px]:order-first">{t("sales.collected")}</p>
                  <div className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center bg-white/[0.06] text-emerald-400 order-first @[180px]:order-last">
                    <DollarSign className="h-[18px] w-[18px] shrink-0" />
                  </div>
                </div>
                <CountUp value={salesMetrics.collected.value} className="stat-number-xl relative z-10 text-emerald-300" />
                <div className="flex items-center gap-1.5 mt-3 relative z-10">
                  {salesMetrics.collected.change.text !== "—" && salesMetrics.collected.value !== "$0" ? (
                    <>
                      {salesMetrics.collected.change.up ? (
                        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                      )}
                      <span className={`text-[12px] font-medium ${salesMetrics.collected.change.up ? "text-emerald-400" : "text-red-400"}`}>
                        {salesMetrics.collected.change.text}
                      </span>
                      <span className="text-[11px] text-white/25 ml-1">{t("vsPrevious")}</span>
                    </>
                  ) : (
                    <span className="text-[11px] text-white/20">{t("noPrevious")}</span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Crecimiento de perfil — total followers + conversion rate (from IGDashboard) */}
          {totalFollowers > 0 && (
            <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-2">
              <div className="flex items-center justify-between mb-4">
                <p className="stat-label">{t("profileGrowth.title")}</p>
                <div className="h-8 w-8 rounded-full flex items-center justify-center bg-white/[0.06] text-white/40">
                  <Users className="h-[15px] w-[15px]" />
                </div>
              </div>
              <CountUp value={formatCompact(totalFollowers)} className="stat-number-xl" />
              <p className="text-[12px] text-white/25 font-light mt-1">{t("profileGrowth.totalFollowers")}</p>
              {conversionRate && totalProfileViews > 0 && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-violet-400/60" />
                    <p className="text-[11px] text-white/30 uppercase tracking-[0.06em]">{t("profileGrowth.conversionRate")}</p>
                  </div>
                  <p className="text-[28px] font-light text-violet-400">{conversionRate}%</p>
                  <p className="text-[11px] text-white/20 mt-0.5">{formatCompact(totalProfileViews)} {t("profileGrowth.visitsSub")}</p>
                </div>
              )}
            </div>
          )}

          {/* Quick Stats — columna vertical siempre. */}
          <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-2">
            <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-[0.1em] mb-5">{t("quickStats.title")}</h3>
            <div className="space-y-5">
              {quickStats.map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] text-white/35 font-light">{s.label}</p>
                    <p className="text-[11px] text-white/20 font-light mt-0.5">{s.sub}</p>
                  </div>
                  <CountUp value={s.value} className={`text-[22px] font-light tracking-[-0.02em] ${s.value.startsWith("$") ? "text-emerald-300" : "text-white"}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Interacciones nuevas — estimated from replies + comments/2 + ads_msg + 5% uplift */}
          <div className="animate-slide-up stagger-3">
            <ConversationsChart data={conversationsData} previousTotal={conversationsPrevTotal} />
          </div>

          {/* Metas del Mes — Donuts (soporta las 6 metricas configurables) */}
          <MetasDonut
            goals={data?.goals ?? {}}
            actuals={data?.metasActuals ?? {}}
          />

          {/* Top Ventas */}
          {salesChartData.length > 0 && (() => {
            const maxAmount = salesChartData[0].amount;
            const total = salesChartData.reduce((s, d) => s + d.amount, 0);
            return (
              <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-[0.1em]">{t("sales.topSales")}</h3>
                  <span className="text-[15px] font-light text-emerald-300">${formatCompact(total)}</span>
                </div>
                <p className="text-[10px] text-white/20 mb-4">{t("sales.fromReels")}</p>
                <div className="space-y-3">
                  {salesChartData.map((d, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-white/25 w-3 shrink-0">{i + 1}</span>
                        <span className="text-[10px] text-white/50 flex-1 truncate font-light">{d.caption}</span>
                        <span className="text-[11px] text-emerald-300 font-light shrink-0">${formatCompact(d.amount)}</span>
                      </div>
                      <div className="h-[3px] w-full rounded-full overflow-hidden ml-5 bg-white/[0.05]">
                        <div className="h-full rounded-full bg-emerald-400/60" style={{ width: `${Math.round((d.amount / maxAmount) * 88)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
