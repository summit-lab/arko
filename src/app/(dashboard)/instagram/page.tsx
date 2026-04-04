import Link from "next/link";
import { Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { SyncControls } from "@/components/instagram/SyncControls";
import { PeriodFilter } from "@/components/instagram/PeriodFilter";
import { DurationEnricher } from "@/components/instagram/DurationEnricher";
import { InstagramShell, type TabKey } from "@/components/instagram/InstagramShell";
import type { ReelsSummary } from "@/components/instagram/ReelsGrid";
import { Suspense } from "react";

// ─── Page Component ───
// Fetches ALL tab data in parallel upfront, then delegates to InstagramShell
// for instant client-side tab switching (zero server roundtrips on tab change).

export default async function InstagramPage({ searchParams }: { searchParams: Promise<{ days?: string; tab?: string }> }) {
  const params = await searchParams;
  const activeTab = (params.tab as TabKey) || "dashboard";
  const periodDays = parseInt(params.days || "90", 10);
  const periodStartIso = new Date(new Date().getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId();

  let connectionStatus: string | null = null;

  // Default empty data for all tabs
  type ReelCard = {
    id: string; ig_media_id: string; caption: string | null; permalink: string | null;
    thumbnail_url: string | null; published_at: string | null; duration_seconds: number | null;
    reel_type: string; has_ads: boolean; views_org: number; views_paid: number; views_total: number;
    likes: number; saves: number; comments: number; shares: number; follows: number;
    performer_multiple: number | null; is_top_performer: boolean; sales_amount: number | null;
  };
  let reels: ReelCard[] = [];
  let dailyInsights: Array<{
    metric_date: string; impressions: number; reach: number; profile_views: number;
    accounts_engaged: number; total_interactions: number; likes: number; comments: number;
    shares: number; saves: number; follower_count: number; followers_total: number; follows_count: number; media_count: number;
  }> = [];
  let demographics: { audience_gender_age: Record<string, number>; audience_city: Record<string, number>; audience_country: Record<string, number> } | null = null;
  let totalFollowers = 0;
  let totalAdVideoPlays = 0;
  let posts: Array<{
    id: string; ig_media_id: string; caption: string | null;
    thumbnail_url: string | null; permalink: string | null;
    published_at: string | null; media_type: string | null;
    views_total: number; likes: number; saves: number; comments: number; shares: number;
  }> = [];
  let storySequences: Array<{
    id: string; ig_story_id: string; published_at: string; expires_at: string | null;
    total_impressions: number; total_reach: number; total_replies: number; total_exits: number;
    archived: boolean;
    slides: Array<{
      id: string; ig_media_id: string; slide_index: number; media_type: string | null;
      media_url: string | null; thumbnail_url: string | null; caption: string | null;
      impressions: number; reach: number; replies: number; exits: number;
      taps_forward: number; taps_back: number; swipe_aways: number; archived: boolean;
    }>;
  }> = [];

  if (workspaceId) {
    // Date calculations
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const yesterdayUtc = new Date(todayUtc.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayDate = yesterdayUtc.toISOString().split("T")[0];
    const periodStartDate = new Date(todayUtc.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // ── Fetch ALL queries in parallel (no conditional — instant tab switching) ──
    const [
      connectionResult,
      mediaResult,
      benchmarkResult,
      insightsResult,
      demoResult,
      storiesResult,
      postsResult,
      adsSyncResult,
      salesResult,
    ] = await Promise.all([
      supabase.from("meta_connections").select("status, ig_username").eq("workspace_id", workspaceId).maybeSingle(),
      supabase
        .from("reels")
        .select(`
          id, ig_media_id, caption, permalink, thumbnail_url, media_url, published_at,
          duration_seconds, reel_type, has_ads, media_type, media_product_type, sales_amount,
          reel_metrics (views_org, impressions_org, reach_org, likes_total, comments_total, shares_total, saves_total, follows_generated),
          reel_metrics_paid (views_paid)
        `)
        .eq("workspace_id", workspaceId)
        .gte("published_at", periodStartIso)
        .order("published_at", { ascending: false })
        .limit(200),
      supabase.from("reel_benchmarks").select("avg_views_90d").eq("workspace_id", workspaceId).order("calculated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase
        .from("ig_account_insights")
        .select("metric_date, impressions, reach, profile_views, accounts_engaged, total_interactions, likes, comments, shares, saves, follower_count, followers_total, follows_count, media_count")
        .eq("workspace_id", workspaceId)
        .gte("metric_date", periodStartDate)
        .lte("metric_date", yesterdayDate)
        .order("metric_date", { ascending: true })
        .limit(90),
      supabase
        .from("ig_account_demographics")
        .select("audience_gender_age, audience_city, audience_country")
        .eq("workspace_id", workspaceId)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("ig_story_sequences")
        .select(`
          id, ig_story_id, published_at, expires_at,
          total_impressions, total_reach, total_replies, total_exits, archived,
          ig_story_slides (
            id, ig_media_id, slide_index, media_type, media_url, thumbnail_url, caption,
            impressions, reach, replies, exits, taps_forward, taps_back, swipe_aways, archived
          )
        `)
        .eq("workspace_id", workspaceId)
        .gte("published_at", periodStartIso)
        .order("published_at", { ascending: false })
        .limit(100),
      supabase
        .from("reels")
        .select(`
          id, ig_media_id, caption, permalink, thumbnail_url, published_at,
          media_type, media_product_type,
          reel_metrics (likes_total, comments_total, shares_total, saves_total),
          reel_metrics_paid (views_paid)
        `)
        .eq("workspace_id", workspaceId)
        .not("media_product_type", "eq", "REELS")
        .gte("published_at", periodStartIso)
        .order("published_at", { ascending: false })
        .limit(200),
      supabase.from("sync_jobs").select("metadata").eq("workspace_id", workspaceId).eq("job_type", "ads_insights").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("sales").select("reel_id, amount_total").eq("workspace_id", workspaceId).not("reel_id", "is", null),
    ]);

    connectionStatus = connectionResult.data?.status || null;
    const adsMeta = adsSyncResult.data?.metadata as { totalVideoPlays?: number; totalVideoPlays30d?: number } | null;
    totalAdVideoPlays = periodDays <= 30
      ? (adsMeta?.totalVideoPlays30d ?? adsMeta?.totalVideoPlays ?? 0)
      : (adsMeta?.totalVideoPlays ?? 0);

    // Build reel_id → sales amount map
    const salesByReel = new Map<string, number>();
    for (const s of (salesResult.data ?? []) as { reel_id: string; amount_total: number }[]) {
      salesByReel.set(s.reel_id, (salesByReel.get(s.reel_id) ?? 0) + Number(s.amount_total));
    }

    // ── Process stories ──
    if (storiesResult?.data) {
      storySequences = (storiesResult.data as Array<{
        id: string; ig_story_id: string; published_at: string; expires_at: string | null;
        total_impressions: number; total_reach: number; total_replies: number; total_exits: number;
        archived: boolean;
        ig_story_slides: Array<{
          id: string; ig_media_id: string; slide_index: number; media_type: string | null;
          media_url: string | null; thumbnail_url: string | null; caption: string | null;
          impressions: number; reach: number; replies: number; exits: number;
          taps_forward: number; taps_back: number; swipe_aways: number; archived: boolean;
        }>;
      }>).map((seq) => ({
        id: seq.id,
        ig_story_id: seq.ig_story_id,
        published_at: seq.published_at,
        expires_at: seq.expires_at,
        total_impressions: seq.total_impressions,
        total_reach: seq.total_reach,
        total_replies: seq.total_replies,
        total_exits: seq.total_exits,
        archived: seq.archived,
        slides: Array.isArray(seq.ig_story_slides)
          ? [...seq.ig_story_slides].sort((a, b) => a.slide_index - b.slide_index)
          : [],
      }));
    }

    // ── Process posts ──
    if (postsResult?.data) {
      type MShape = { likes_total: number; comments_total: number; shares_total: number; saves_total: number };
      type PShape = { views_paid: number };
      const getM = (raw: unknown): MShape | null => Array.isArray(raw) ? (raw as MShape[])[0] : (raw as MShape | null);
      const getP = (raw: unknown): PShape | null => Array.isArray(raw) ? (raw as PShape[])[0] : (raw as PShape | null);
      posts = (postsResult.data as Array<{
        id: string; ig_media_id: string; caption: string | null; thumbnail_url: string | null;
        permalink: string | null; published_at: string | null; media_type: string | null;
        media_product_type: string | null; reel_metrics: unknown; reel_metrics_paid: unknown;
      }>).map((r) => {
        const m = getM(r.reel_metrics);
        const p = getP(r.reel_metrics_paid);
        return {
          id: r.id, ig_media_id: r.ig_media_id, caption: r.caption,
          thumbnail_url: r.thumbnail_url, permalink: r.permalink,
          published_at: r.published_at, media_type: r.media_type,
          views_total: p?.views_paid || 0, likes: m?.likes_total || 0,
          saves: m?.saves_total || 0, comments: m?.comments_total || 0, shares: m?.shares_total || 0,
        };
      });
    }

    // ── Process insights ──
    if (insightsResult?.data) {
      dailyInsights = insightsResult.data.filter((d) => d.impressions > 0 || d.reach > 0);
      const latestDay = [...insightsResult.data].sort((a, b) => b.metric_date.localeCompare(a.metric_date))[0];
      if (latestDay?.followers_total) totalFollowers = latestDay.followers_total;
    }

    // ── Process demographics ──
    if (demoResult?.data) {
      demographics = {
        audience_gender_age: (demoResult.data.audience_gender_age as Record<string, number>) ?? {},
        audience_city: (demoResult.data.audience_city as Record<string, number>) ?? {},
        audience_country: (demoResult.data.audience_country as Record<string, number>) ?? {},
      };
    }

    // ── Process media (reels) ──
    if (mediaResult?.data && mediaResult.data.length > 0) {
      type MetricsShape = { views_org: number; impressions_org: number; reach_org: number; likes_total: number; comments_total: number; shares_total: number; saves_total: number; follows_generated: number };
      type PaidShape = { views_paid: number };
      const getMetrics = (raw: unknown): MetricsShape | null => Array.isArray(raw) ? (raw as MetricsShape[])[0] : (raw as MetricsShape | null);
      const getPaid = (raw: unknown): PaidShape | null => Array.isArray(raw) ? (raw as PaidShape[])[0] : (raw as PaidShape | null);
      const reelsData = mediaResult.data.filter((r) => r.media_product_type === "REELS");

      if (reelsData.length > 0) {
        const avgViewsBenchmark = benchmarkResult.data?.avg_views_90d || 1;
        reels = reelsData.map((r) => {
          const m = getMetrics(r.reel_metrics);
          const p = getPaid(r.reel_metrics_paid);
          const viewsOrg = m?.views_org || 0;
          const viewsPaid = p?.views_paid || 0;
          const viewsTotal = viewsOrg + viewsPaid;
          const multiple = avgViewsBenchmark > 0 ? viewsTotal / avgViewsBenchmark : null;
          return {
            id: r.id, ig_media_id: r.ig_media_id, caption: r.caption,
            permalink: r.permalink, thumbnail_url: r.thumbnail_url,
            published_at: r.published_at, duration_seconds: r.duration_seconds,
            reel_type: r.reel_type, has_ads: r.has_ads,
            views_org: viewsOrg, views_paid: viewsPaid, views_total: viewsTotal,
            likes: m?.likes_total || 0, saves: m?.saves_total || 0,
            comments: m?.comments_total || 0, shares: m?.shares_total || 0,
            follows: m?.follows_generated || 0, performer_multiple: multiple,
            is_top_performer: (multiple || 0) >= 3,
            sales_amount: salesByReel.get(r.id) ?? null,
          };
        });
      }
    }
  }

  // ── Aggregates for ReelsGrid ──
  const totalViews = reels.reduce((s, r) => s + r.views_total, 0);
  const totalViewsOrg = reels.reduce((s, r) => s + r.views_org, 0);
  const totalViewsPaid = reels.reduce((s, r) => s + r.views_paid, 0);
  const totalLikes = reels.reduce((s, r) => s + r.likes, 0);
  const totalSaves = reels.reduce((s, r) => s + r.saves, 0);
  const totalComments = reels.reduce((s, r) => s + r.comments, 0);
  const topPerformers = reels.filter(r => r.is_top_performer).length;
  const avgViews = reels.length > 0 ? Math.round(totalViews / reels.length) : 0;
  const paidPct = totalViews > 0 ? Math.round((totalViewsPaid / totalViews) * 100) : 0;

  const hasRealData = reels.length > 0 || dailyInsights.length > 0;
  const reelsMissingDuration = reels.filter((r) => r.duration_seconds === null).length;

  const dashboardReels = reels.map((r) => ({
    id: r.id, caption: r.caption, thumbnail_url: r.thumbnail_url, permalink: r.permalink,
    published_at: r.published_at, views_org: r.views_org, views_paid: r.views_paid,
    views_total: r.views_total, likes: r.likes, saves: r.saves,
    comments: r.comments, shares: r.shares, sales_amount: r.sales_amount,
  }));

  const reelsSummary: ReelsSummary | undefined = reels.length > 0
    ? { totalViews, avgViews, totalViewsOrg, totalViewsPaid, totalLikes, totalSaves, totalComments, topPerformers, paidPct }
    : undefined;

  return (
    <div className="px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title tracking-[-0.04em]">IG Intelligence</h1>
          <p className="text-white/40 mt-3 text-[15px] font-normal">
            Análisis profundo de tu cuenta de Instagram.
            {!hasRealData && connectionStatus !== "active" && (
              <span className="ml-2 text-amber-400/50 text-[12px]">(Conectá tu cuenta Meta para ver data real)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Suspense fallback={null}>
            <PeriodFilter />
          </Suspense>
          {!connectionStatus && (
            <Link
              href="/onboarding"
              className="flex items-center gap-2 text-[13px] font-medium text-violet-300 px-5 py-2.5 rounded-full transition-all hover:bg-white/[0.04]"
              style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}
            >
              <Zap className="h-4 w-4" />
              Conectar Instagram
            </Link>
          )}
          {workspaceId && connectionStatus === "active" && (
            <SyncControls workspaceId={workspaceId} currentTab={activeTab} />
          )}
        </div>
      </div>

      {/* Shell: tabs + content (instant client-side switching) */}
      <InstagramShell
        initialTab={activeTab}
        periodDays={periodDays}
        totalAdVideoPlays={totalAdVideoPlays}
        totalFollowers={totalFollowers}
        reels={reels}
        dashboardReels={dashboardReels}
        dailyInsights={dailyInsights}
        demographics={demographics}
        storySequences={storySequences}
        posts={posts}
        reelsSummary={reelsSummary}
        reelsMissingDuration={reelsMissingDuration}
        workspaceId={workspaceId}
      />

      {/* Auto-enrich durations */}
      {workspaceId && reelsMissingDuration > 0 && (
        <DurationEnricher workspaceId={workspaceId} missingCount={reelsMissingDuration} />
      )}
    </div>
  );
}
