import Link from "next/link";
import { Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { SyncControls } from "@/components/instagram/SyncControls";
import { PeriodFilter } from "@/components/instagram/PeriodFilter";
import { InstagramTabs } from "@/components/instagram/InstagramTabs";
import { ReelsGrid, type ReelsSummary } from "@/components/instagram/ReelsGrid";
import { IGMetricsClient } from "@/components/instagram/IGMetricsClient";
import { IGDashboardClient } from "@/components/instagram/IGDashboardClient";
import { DurationEnricher } from "@/components/instagram/DurationEnricher";
import { ReelsHeatmap } from "@/components/instagram/ReelsHeatmap";
import { ReelsScatterPlot } from "@/components/instagram/ReelsScatterPlot";
import { StoriesGrid } from "@/components/instagram/StoriesGrid";
import { PublicacionesGrid } from "@/components/instagram/PublicacionesGrid";
import { Suspense } from "react";

// ─── Types for this page ───

interface ReelCard {
  id: string;
  ig_media_id: string;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  reel_type: string;
  has_ads: boolean;
  views_org: number;
  views_paid: number;
  views_total: number;
  likes: number;
  saves: number;
  comments: number;
  shares: number;
  follows: number;
  performer_multiple: number | null;
  is_top_performer: boolean;
  sales_amount: number | null;
}

type TabKey = "dashboard" | "reels" | "historias" | "publicaciones" | "competencia" | "referencias" | "metrics";

// ─── Page Component ───

export default async function InstagramPage({ searchParams }: { searchParams: Promise<{ days?: string; tab?: string }> }) {
  const params = await searchParams;
  const activeTab = (params.tab as TabKey) || "dashboard";
  const periodDays = parseInt(params.days || "90", 10);
  const periodStartIso = new Date(new Date().getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId();

  let reels: ReelCard[] = [];
  let dailyInsights: Array<{
    metric_date: string; impressions: number; reach: number; profile_views: number;
    accounts_engaged: number; total_interactions: number; likes: number; comments: number;
    shares: number; saves: number; follower_count: number; followers_total: number; follows_count: number; media_count: number;
  }> = [];
  let demographics: { audience_gender_age: Record<string, number>; audience_city: Record<string, number>; audience_country: Record<string, number> } | null = null;
  let connectionStatus: string | null = null;
  let totalFollowers = 0;
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
    const needsMedia = activeTab === "reels" || activeTab === "dashboard";
    const needsInsights = activeTab === "dashboard" || activeTab === "metrics";

    // ── Build queries ──
    const mediaQuery = needsMedia
      ? supabase
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
          .limit(200)
      : null;

    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const yesterdayUtc = new Date(todayUtc.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayDate = yesterdayUtc.toISOString().split("T")[0];
    const periodStartDate = new Date(todayUtc.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const insightsQuery = needsInsights
      ? supabase
          .from("ig_account_insights")
          .select("metric_date, impressions, reach, profile_views, accounts_engaged, total_interactions, likes, comments, shares, saves, follower_count, followers_total, follows_count, media_count")
          .eq("workspace_id", workspaceId)
          .gte("metric_date", periodStartDate)
          .lte("metric_date", yesterdayDate)
          .order("metric_date", { ascending: true })
          .limit(90)
      : null;

    const demoQuery = activeTab === "metrics"
      ? supabase
          .from("ig_account_demographics")
          .select("audience_gender_age, audience_city, audience_country")
          .eq("workspace_id", workspaceId)
          .order("snapshot_date", { ascending: false })
          .limit(1)
          .single()
      : null;

    const postsQuery = activeTab === "publicaciones"
      ? supabase
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
          .limit(200)
      : null;

    const storiesQuery = activeTab === "historias"
      ? supabase
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
          .limit(100)
      : null;

    // ── Fetch all in parallel ──
    const [connectionResult, mediaResult, benchmarkResult, insightsResult, demoResult, storiesResult, postsResult] = await Promise.all([
      supabase.from("meta_connections").select("status, ig_username").eq("workspace_id", workspaceId).maybeSingle(),
      mediaQuery ?? Promise.resolve({ data: null as null }),
      supabase.from("reel_benchmarks").select("avg_views_90d").eq("workspace_id", workspaceId).order("calculated_at", { ascending: false }).limit(1).maybeSingle(),
      insightsQuery ?? Promise.resolve({ data: null as null }),
      demoQuery ?? Promise.resolve({ data: null as null }),
      storiesQuery ?? Promise.resolve({ data: null as null }),
      postsQuery ?? Promise.resolve({ data: null as null }),
    ]);

    connectionStatus = connectionResult.data?.status || null;

    // Process stories
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

    // Process posts (non-REELS media)
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
          id: r.id,
          ig_media_id: r.ig_media_id,
          caption: r.caption,
          thumbnail_url: r.thumbnail_url,
          permalink: r.permalink,
          published_at: r.published_at,
          media_type: r.media_type,
          views_total: p?.views_paid || 0,
          likes: m?.likes_total || 0,
          saves: m?.saves_total || 0,
          comments: m?.comments_total || 0,
          shares: m?.shares_total || 0,
        };
      });
    }

    // Process insights — filter out days with zero metrics (incomplete sync data)
    if (insightsResult?.data) {
      dailyInsights = insightsResult.data.filter(
        (d) => d.impressions > 0 || d.reach > 0
      );
      // For followers_total, check all rows (including zero-metric ones) to get latest value
      const latestDay = [...insightsResult.data].sort((a, b) => b.metric_date.localeCompare(a.metric_date))[0];
      if (latestDay?.followers_total) totalFollowers = latestDay.followers_total;
    }

    // Process demographics
    if (demoResult?.data) {
      demographics = {
        audience_gender_age: (demoResult.data.audience_gender_age as Record<string, number>) ?? {},
        audience_city: (demoResult.data.audience_city as Record<string, number>) ?? {},
        audience_country: (demoResult.data.audience_country as Record<string, number>) ?? {},
      };
    }

    // Process media
    if (needsMedia) {
      const mediaData = mediaResult.data;

      if (mediaData && mediaData.length > 0) {
        type MetricsShape = { views_org: number; impressions_org: number; reach_org: number; likes_total: number; comments_total: number; shares_total: number; saves_total: number; follows_generated: number };
        type PaidShape = { views_paid: number };

        const getMetrics = (raw: unknown): MetricsShape | null => Array.isArray(raw) ? (raw as MetricsShape[])[0] : (raw as MetricsShape | null);
        const getPaid = (raw: unknown): PaidShape | null => Array.isArray(raw) ? (raw as PaidShape[])[0] : (raw as PaidShape | null);

        const reelsData = mediaData.filter((r) => r.media_product_type === "REELS");

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
              id: r.id,
              ig_media_id: r.ig_media_id,
              caption: r.caption,
              permalink: r.permalink,
              thumbnail_url: r.thumbnail_url,
              published_at: r.published_at,
              duration_seconds: r.duration_seconds,
              reel_type: r.reel_type,
              has_ads: r.has_ads,
              views_org: viewsOrg,
              views_paid: viewsPaid,
              views_total: viewsTotal,
              likes: m?.likes_total || 0,
              saves: m?.saves_total || 0,
              comments: m?.comments_total || 0,
              shares: m?.shares_total || 0,
              follows: m?.follows_generated || 0,
              performer_multiple: multiple,
              is_top_performer: (multiple || 0) >= 3,
              sales_amount: r.sales_amount ?? null,
            };
          });
        }

      }
    }
  }

  // Aggregate stats for Reels KPI bar
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

  // Dashboard reels summary
  const dashboardReels = reels.map((r) => ({
    id: r.id,
    caption: r.caption,
    thumbnail_url: r.thumbnail_url,
    permalink: r.permalink,
    published_at: r.published_at,
    views_org: r.views_org,
    views_paid: r.views_paid,
    views_total: r.views_total,
    likes: r.likes,
    saves: r.saves,
    comments: r.comments,
    shares: r.shares,
    sales_amount: r.sales_amount,
  }));

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

      {/* Tabs */}
      <Suspense fallback={null}>
        <InstagramTabs />
      </Suspense>

      {/* ── TAB: Dashboard (default) ─────────────────────────────── */}
      {activeTab === "dashboard" && (
        <IGDashboardClient
          dailyInsights={dailyInsights}
          reels={dashboardReels}
          totalFollowers={totalFollowers}
          periodDays={periodDays}
        />
      )}

      {/* ── TAB: Reels ────────────────────────────────────────────── */}
      {activeTab === "reels" && (
        <ReelsGrid
          reels={reels}
          summary={reels.length > 0 ? ({
            totalViews,
            avgViews,
            totalViewsOrg,
            totalViewsPaid,
            totalLikes,
            totalSaves,
            totalComments,
            topPerformers,
            paidPct,
          } satisfies ReelsSummary) : undefined}
        />
      )}

      {/* ── TAB: Historias ───────────────────────────────────────── */}
      {activeTab === "historias" && (
        <StoriesGrid sequences={storySequences} />
      )}

      {/* ── TAB: Publicaciones ───────────────────────────────────── */}
      {activeTab === "publicaciones" && (() => {
        const totalPosts = posts.filter(p => p.media_type !== "CAROUSEL_ALBUM").length;
        const totalCarruseles = posts.filter(p => p.media_type === "CAROUSEL_ALBUM").length;
        const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
        const totalSaves = posts.reduce((s, p) => s + p.saves, 0);
        const totalComments = posts.reduce((s, p) => s + p.comments, 0);
        const avgLikes = posts.length > 0 ? Math.round(totalLikes / posts.length) : 0;
        return (
          <PublicacionesGrid
            posts={posts}
            summary={posts.length > 0 ? { totalPosts, totalCarruseles, totalLikes, totalSaves, totalComments, avgLikes } : undefined}
          />
        );
      })()}

      {/* ── TAB: Competencia ─────────────────────────────────────── */}
      {activeTab === "competencia" && (
        <div className="py-16 text-center">
          <div className="inline-flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-white/[0.05] flex items-center justify-center">
              <span className="text-2xl">⚔️</span>
            </div>
            <div>
              <p className="text-white/50 font-light text-[15px]">Análisis de Competencia — próximamente</p>
              <p className="text-white/25 text-sm mt-1 font-light">Comparativa de métricas contra tus competidores definidos en el ADN</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Referencias ─────────────────────────────────────── */}
      {activeTab === "referencias" && (
        <div className="py-16 text-center">
          <div className="inline-flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-white/[0.05] flex items-center justify-center">
              <span className="text-2xl">📌</span>
            </div>
            <div>
              <p className="text-white/50 font-light text-[15px]">Módulo de Referencias — próximamente</p>
              <p className="text-white/25 text-sm mt-1 font-light">Inspiración y benchmarks de contenido de referencia</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Demografía ──────────────────────────────────────── */}
      {activeTab === "metrics" && (
        <IGMetricsClient dailyInsights={dailyInsights} demographics={demographics} />
      )}

      {/* Auto-enrich durations */}
      {workspaceId && reelsMissingDuration > 0 && (
        <DurationEnricher workspaceId={workspaceId} missingCount={reelsMissingDuration} />
      )}
    </div>
  );
}
