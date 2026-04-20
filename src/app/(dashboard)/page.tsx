import { Eye, Heart, Bookmark, MessageSquare, DollarSign, Instagram, Youtube, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { ContentCalendar } from "@/components/dashboard/ContentCalendar";
import { MetasDonut } from "@/components/dashboard/MetasDonut";
import { ConversationsChart } from "@/components/dashboard/ConversationsChart";
import { CountUp } from "@/components/ui/CountUp";
import { DateFilter } from "@/components/ui/DateFilter";
import { parseDateParams, previousPeriod, nextDay, toISOStart } from "@/lib/date-utils";
import type { DateRange } from "@/types/date-filter";
import { Suspense } from "react";

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

async function getDashboardData(range: DateRange) {
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
    reelsMonth,
    goalsResult,
    salesCurrent,
    salesPrevious,
    conversationsCurrent,
    conversationsPrev,
    adsMessagingCurrent,
    adsMessagingPrev,
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

    // Query 4: Period daily insights (for daily charts)
    supabase
      .from("ig_account_insights")
      .select("metric_date, reach, impressions, likes, saves, comments")
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

    // Query 6: Reels last 90 days — for calendar + top sales panels (unchanged window)
    supabase
      .from("reels")
      .select(`
        id, caption, permalink, published_at, media_type, reel_type, has_ads, sales_amount,
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

    // Query 8: Reels published in CURRENT CALENDAR MONTH — for Metas del Mes "views" donut (C6).
    // Matches the basis used by the "Vistas Totales" Dashboard KPI (sum of reel views_org + views_paid)
    // so the donut reconciles with the header number when both are shown.
    supabase
      .from("reels")
      .select(`
        id, published_at,
        reel_metrics (views_org),
        reel_metrics_paid (views_paid)
      `)
      .eq("workspace_id", workspaceId)
      .gte("published_at", `${monthStart}T00:00:00.000Z`)
      .lt("published_at", `${monthTo}T00:00:00.000Z`)
      .limit(500),

    // Query 9: Workspace goals for current month
    supabase
      .from("workspace_goals")
      .select("metric, target_value")
      .eq("workspace_id", workspaceId)
      .eq("period_start", monthStart),

    // Query 10: Sales — current selected period (for "Ventas cobradas" KPI + source breakdown)
    supabase
      .from("sales")
      .select("amount_collected, source_type, payment_status")
      .eq("workspace_id", workspaceId)
      .neq("payment_status", "cancelled")
      .gte("sale_date", range.from)
      .lte("sale_date", range.to),

    // Query 11: Sales — previous period (for KPI delta)
    supabase
      .from("sales")
      .select("amount_collected")
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
  ]);

  // ─── Log query errors ───
  if (insightsCurrent.error) console.error('[dashboard] insightsCurrent error:', insightsCurrent.error);
  if (insightsPrevious.error) console.error('[dashboard] insightsPrevious error:', insightsPrevious.error);
  if (insightsPeriodFollows.error) console.error('[dashboard] insightsPeriodFollows error:', insightsPeriodFollows.error);
  if (insightsMonthly.error) console.error('[dashboard] insightsMonthly error:', insightsMonthly.error);
  if (insightsMonthGoals.error) console.error('[dashboard] insightsMonthGoals error:', insightsMonthGoals.error);
  if (reels90d.error) console.error('[dashboard] reels90d error:', reels90d.error);
  if (reelsPeriod.error) console.error('[dashboard] reelsPeriod error:', reelsPeriod.error);
  if (reelsMonth.error) console.error('[dashboard] reelsMonth error:', reelsMonth.error);
  if (salesCurrent.error) console.error('[dashboard] salesCurrent error:', salesCurrent.error);
  if (salesPrevious.error) console.error('[dashboard] salesPrevious error:', salesPrevious.error);
  if (conversationsCurrent.error) console.error('[dashboard] conversationsCurrent error:', conversationsCurrent.error);
  if (conversationsPrev.error) console.error('[dashboard] conversationsPrev error:', conversationsPrev.error);
  if (adsMessagingCurrent.error) console.error('[dashboard] adsMessagingCurrent error:', adsMessagingCurrent.error);
  if (adsMessagingPrev.error) console.error('[dashboard] adsMessagingPrev error:', adsMessagingPrev.error);

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
  const periodFollowerRows = insightsPeriodFollows.data ?? [];
  const withFt = periodFollowerRows.filter((r) => (r.followers_total || 0) > 0);
  const firstFt = withFt[0]?.followers_total ?? 0;
  const lastFt = withFt[withFt.length - 1]?.followers_total ?? 0;
  const newFollowsWindow = lastFt > firstFt
    ? lastFt - firstFt
    : periodFollowerRows.reduce((s, r) => s + (r.follower_count || 0), 0);

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
      reel_type: r.reel_type,
      has_ads: r.has_ads,
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

  // Views KPI scoped to selected period (Fix 3.1)
  const totalViewsPeriod = reelsInPeriod.reduce((s, r) => s + r.views_total, 0);

  // Sales total from 90d window (Top Ventas panel)
  const totalSales = reels.reduce((s, r) => s + (r.sales_amount ?? 0), 0);

  // C5: No previous-period reels query exists, so we can't compute a views delta honestly.
  // The KPI value is sum(reel.views_total) for the current period, but we have no equivalent
  // aggregate for the previous period. Previously this was computed from reach (an account-level
  // metric, not comparable to reel views), which produced a misleading "+X%" badge.
  // Setting to null hides the badge instead of showing a lie — the KPI renderer guards on this.
  const viewsChange = null as { text: string; up: boolean } | null;

  // Top 4 reels by views (from 90d window, panel labeled "Últimos 90 días")
  const topContent = [...reels]
    .sort((a, b) => b.views_total - a.views_total)
    .slice(0, 4)
    .map((r) => {
      const engRate = r.views_total > 0
        ? ((r.likes + r.comments + r.saves + r.shares) / r.views_total) * 100
        : 0;
      return {
        title: r.caption?.slice(0, 60) || "Sin título",
        platform: r.has_ads ? "IG Reel (Ads)" : "IG Reel",
        views: formatCompact(r.views_total),
        saves: formatCompact(r.saves),
        likes: formatCompact(r.likes),
        engRate: engRate > 0 ? `${engRate.toFixed(0)}%` : "—",
      };
    });

  // Best reel — now scoped to SELECTED period (Fix 3.2)
  const bestReelViews = reelsInPeriod.length > 0
    ? Math.max(...reelsInPeriod.map((r) => r.views_total))
    : 0;

  // Engagement rate over current period (uses interactionsOf() fallback) — Fix 3.9
  const engRatePeriod = sumCurrent.reach > 0
    ? (sumCurrent.interactions / sumCurrent.reach) * 100
    : 0;

  // ─── Daily chart data from ig_account_insights ───
  // Filter out days with zero metrics (incomplete sync data from current day)

  const dailyInsights = (insightsMonthly.data ?? []).filter(hasSignal);

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

  // C6: monthSumViews now aggregates from reels (views_org + views_paid) for reels
  // published during the current calendar month — matching the basis of the "Vistas Totales"
  // Dashboard KPI so the Metas del Mes donut reconciles with the header number.
  // Previously this summed ig_account_insights.impressions (account-level impressions, a
  // different universe than reel video plays) while labeled "Views" in the UI — misleading.
  // monthSumReach / monthSumInteractions stay on ig_account_insights (account-level, correct
  // basis for engagement-rate derivation).
  const monthSumViews = (reelsMonth.data ?? []).reduce((s, r) => {
    const metrics = Array.isArray(r.reel_metrics) ? r.reel_metrics[0] : r.reel_metrics;
    const paid = Array.isArray(r.reel_metrics_paid) ? r.reel_metrics_paid[0] : r.reel_metrics_paid;
    return s + (metrics?.views_org ?? 0) + (paid?.views_paid ?? 0);
  }, 0);
  const monthSumReach = monthRows.reduce((s, r) => s + (r.reach || 0), 0);
  const monthSumInteractions = monthRows.reduce((s, r) => s + interactionsOf(r), 0);

  // Followers gained this month: followers_total diff (preferred), fallback to follower_count sum
  const monthWithFt = monthRows.filter((r) => (r.followers_total || 0) > 0);
  const monthFirstFt = monthWithFt[0]?.followers_total ?? 0;
  const monthLastFt = monthWithFt[monthWithFt.length - 1]?.followers_total ?? 0;
  const followersGainedMonth = monthLastFt > monthFirstFt
    ? monthLastFt - monthFirstFt
    : monthRows.reduce((s, r) => s + (r.follower_count || 0), 0);

  const engRateMonth = monthSumReach > 0
    ? (monthSumInteractions / monthSumReach) * 100
    : 0;

  // ─── Sales (current selected period) — "Ventas cobradas" KPI + source donut ───
  // Currency treated as implicit USD (no currency column in schema).

  const salesCurrentRows = (salesCurrent.data ?? []) as Array<{
    amount_collected: number | null;
    source_type: string | null;
    payment_status: string | null;
  }>;
  const salesPreviousRows = (salesPrevious.data ?? []) as Array<{
    amount_collected: number | null;
  }>;

  const totalSalesCollected = salesCurrentRows.reduce((s, r) => s + (r.amount_collected ?? 0), 0);
  const totalSalesCollectedPrev = salesPreviousRows.reduce((s, r) => s + (r.amount_collected ?? 0), 0);
  const salesChange = pctChange(totalSalesCollected, totalSalesCollectedPrev);

  // ─── KPIs ───

  const kpis = [
    {
      label: "Vistas Totales",
      // Scoped to selected period (Fix 3.1)
      value: totalViewsPeriod > 0 ? formatCompact(totalViewsPeriod) : "—",
      // C5: viewsChange is null — no honest previous-period comparison available.
      // Using "—" + up:true so the renderer falls through to the "sin datos previos" branch.
      change: viewsChange?.text ?? "—",
      up: viewsChange?.up ?? true,
      icon: "eye" as const,
      color: "text-white/60",
    },
    {
      label: "Guardados",
      value: sumCurrent.saves > 0 ? formatCompact(sumCurrent.saves) : "—",
      ...pctChange(sumCurrent.saves, sumPrevious.saves),
      icon: "bookmark" as const,
      color: "text-white/60",
    },
    {
      label: "Me gusta",
      value: sumCurrent.likes > 0 ? formatCompact(sumCurrent.likes) : "—",
      ...pctChange(sumCurrent.likes, sumPrevious.likes),
      icon: "heart" as const,
      color: "text-white/60",
    },
    {
      label: "Comentarios",
      value: sumCurrent.comments > 0 ? formatCompact(sumCurrent.comments) : "—",
      ...pctChange(sumCurrent.comments, sumPrevious.comments),
      icon: "message" as const,
      color: "text-white/60",
    },
    {
      label: "Ventas cobradas",
      value: totalSalesCollected > 0 ? `$${formatCompact(totalSalesCollected)}` : "—",
      ...salesChange,
      icon: "dollar" as const,
      color: "text-white/60",
    },
  ];

  // ─── Quick Stats ───

  const periodSubLabel = `últimos ${range.days} días`;

  const quickStats = [
    { label: "Alcance Total", value: sumCurrent.reach > 0 ? formatCompact(sumCurrent.reach) : "—", sub: periodSubLabel },
    { label: "Tasa de Engagement", value: engRatePeriod > 0 ? `${engRatePeriod.toFixed(1)}%` : "—", sub: "interacciones / alcance" },
    { label: "Mejor Reel", value: bestReelViews > 0 ? formatCompact(bestReelViews) : "—", sub: "views" },
    // Sub-label now matches the selected period (Fix 3.2)
    { label: "Nuevos Follows", value: newFollowsWindow > 0 ? formatCompact(newFollowsWindow) : "—", sub: periodSubLabel },
    ...(totalSales > 0 ? [{ label: "Ventas Totales", value: `$${formatCompact(totalSales)}`, sub: "desde reels" }] : []),
  ];

  // Calendar reels (all, for this month) — include KPIs for display
  const calendarReels = reels.map((r) => ({
    id: r.id,
    published_at: r.published_at,
    caption: r.caption,
    has_ads: r.has_ads,
    reel_type: r.reel_type,
    views_total: r.views_total,
    likes: r.likes,
    saves: r.saves,
    comments: r.comments,
  }));

  // Top reels por ventas (para gráfico)
  const salesChartData = [...reels]
    .filter((r) => (r.sales_amount ?? 0) > 0)
    .sort((a, b) => (b.sales_amount ?? 0) - (a.sales_amount ?? 0))
    .slice(0, 8)
    .map((r) => ({
      caption: r.caption ? (r.caption.length > 22 ? r.caption.slice(0, 22) + "…" : r.caption) : "Sin caption",
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

  // Raw numeric values for donut calculation — CURRENT MONTH window (Fix 3.3)
  const metasActuals = {
    views: monthSumViews,
    followers: followersGainedMonth,
    engRate: engRateMonth,
  };

  // ─── Interacciones nuevas estimadas — respects dashboard date filter ───
  // Formula: (replies + FLOOR(comments/2) + ads_messaging) * 1.05 organic uplift.
  // Current + previous period for WoW-style delta.
  const ORGANIC_UPLIFT = 1.05;
  const estimateInteractions = (replies: number, comments: number, adsMsg: number) =>
    Math.round((replies + Math.floor(comments / 2) + adsMsg) * ORGANIC_UPLIFT);

  const interactionsCurrentRaw = (conversationsCurrent.data ?? []) as Array<{
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

  return {
    kpis,
    topContent,
    quickStats,
    growthData,
    engagementData,
    salesChartData,
    calendarReels,
    goals,
    metasActuals,
    conversationsData,
    conversationsPrevTotal,
  };
}

// ─── Icon mapping (can't pass components as serialized data) ───

const ICON_MAP = {
  eye: Eye,
  bookmark: Bookmark,
  heart: Heart,
  message: MessageSquare,
  dollar: DollarSign,
} as const;

// ─── Page ───

export default async function Home({ searchParams }: { searchParams: Promise<{ days?: string; from?: string; to?: string; preset?: string }> }) {
  const params = await searchParams;
  const dateRange = parseDateParams(params, "30d");
  const data = await getDashboardData(dateRange);

  const kpis = data?.kpis ?? [];
  const topContent = data?.topContent ?? [];
  const quickStats = data?.quickStats ?? [];
  const growthData = data?.growthData ?? [];
  const engagementData = data?.engagementData ?? [];
  const salesChartData = data?.salesChartData ?? [];
  const calendarReels = data?.calendarReels ?? [];
  const conversationsData = data?.conversationsData ?? [];
  const conversationsPrevTotal = data?.conversationsPrevTotal ?? 0;

  return (
    <div className="px-8 py-10">
      {/* Header */}
      <div className="animate-slide-up mb-10 flex items-start justify-between relative" style={{ zIndex: 100 }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-white/35 mt-3 text-[15px] font-light">Resumen global de tu marca personal.</p>
        </div>
        <div className="mt-1">
          <Suspense fallback={null}>
            <DateFilter mode="url" defaultPreset="30d" />
          </Suspense>
        </div>
      </div>

      {/* Main 70/30 Layout */}
      <div className="flex gap-6">
        {/* ── LEFT: Main Content (70%) ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Hero KPIs */}
          <div className="grid grid-cols-5 gap-5">
            {kpis.map((m, i) => {
              const IconComp = ICON_MAP[m.icon];
              return (
                <div key={m.label} className={`glass-card px-6 py-5 animate-slide-up stagger-${i + 1}`}>
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <p className="stat-label">{m.label}</p>
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center bg-white/[0.06] ${m.color}`}>
                      <IconComp className="h-[18px] w-[18px]" />
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
                        <span className="text-[11px] text-white/25 ml-1">vs anterior</span>
                      </>
                    ) : (
                      <span className="text-[11px] text-white/20">sin datos previos</span>
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

          {/* Top Performing Content */}
          <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[15px] font-light text-white tracking-wide">Mejor Contenido</h3>
              <span className="text-[11px] text-white/30 font-medium uppercase tracking-[0.1em]">Últimos 90 días</span>
            </div>
            {topContent.length > 0 ? (
              <div className="space-y-1">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium pb-3 border-b border-white/[0.06] px-2">
                  <div className="col-span-1">#</div>
                  <div className="col-span-4">Título</div>
                  <div className="col-span-2 text-right">Vistas</div>
                  <div className="col-span-1 text-right">Guard.</div>
                  <div className="col-span-1 text-right">Likes</div>
                  <div className="col-span-1 text-center">Eng%</div>
                  <div className="col-span-2 text-center">Plataforma</div>
                </div>
                {topContent.map((c, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center py-3.5 rounded-lg hover:bg-white/[0.03] transition-all duration-200 px-2 cursor-pointer group">
                    <div className="col-span-1">
                      <span className="text-[13px] font-light text-white/25">{i + 1}</span>
                    </div>
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                        {c.platform.includes("IG") ? <Instagram className="h-4 w-4 text-pink-400/70" /> : <Youtube className="h-4 w-4 text-red-400/70" />}
                      </div>
                      <span className="text-[13px] font-light text-white/70 group-hover:text-white truncate transition-colors">{c.title}</span>
                    </div>
                    <div className="col-span-2 text-right text-[13px] font-light text-white">{c.views}</div>
                    <div className="col-span-1 text-right text-[13px] font-light text-white/50">{c.saves}</div>
                    <div className="col-span-1 text-right text-[13px] font-light text-white/50">{c.likes}</div>
                    <div className="col-span-1 text-center">
                      <span className="text-[11px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">{c.engRate}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="pill-badge">{c.platform}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-[13px] text-white/20 font-light">No hay contenido aún</p>
              </div>
            )}
          </div>

        </div>

        {/* ── RIGHT: Summary Panel (30%) ── */}
        <div className="w-[320px] shrink-0 space-y-6">
          {/* Quick Stats */}
          <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-2">
            <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-[0.1em] mb-5">Resumen Rápido</h3>
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

          {/* IG DM Conversations (last 14d) — renders its own empty-state and
              deep-links to /settings/integrations when the webhook isn't active yet. */}
          <div className="animate-slide-up stagger-3">
            <ConversationsChart data={conversationsData} previousTotal={conversationsPrevTotal} />
          </div>

          {/* Metas del Mes — Donuts */}
          <MetasDonut
            views={data?.metasActuals?.views ?? 0}
            followers={data?.metasActuals?.followers ?? 0}
            engRate={data?.metasActuals?.engRate ?? 0}
            goalViews={data?.goals?.views ?? null}
            goalFollowers={data?.goals?.followers ?? null}
            goalEngRate={data?.goals?.engagement_rate ?? null}
          />

          {/* Top Ventas */}
          {salesChartData.length > 0 && (() => {
            const maxAmount = salesChartData[0].amount;
            const total = salesChartData.reduce((s, d) => s + d.amount, 0);
            return (
              <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-[0.1em]">Top Ventas</h3>
                  <span className="text-[15px] font-light text-emerald-300">${formatCompact(total)}</span>
                </div>
                <p className="text-[10px] text-white/20 mb-4">desde reels</p>
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

      {/* ── Calendario full-width ── */}
      <div className="mt-6 animate-slide-up stagger-6">
        <ContentCalendar reels={calendarReels} />
      </div>
    </div>
  );
}
