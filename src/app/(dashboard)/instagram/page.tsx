import Link from "next/link";
import { Eye, TrendingUp, Zap, Bookmark, MessageSquare, Heart, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { SyncButton } from "@/components/instagram/SyncButton";
import { PeriodFilter } from "@/components/instagram/PeriodFilter";
import { InstagramTabs } from "@/components/instagram/InstagramTabs";
import { ReelsGrid } from "@/components/instagram/ReelsGrid";
import { PostsGrid } from "@/components/instagram/PostsGrid";
import { IGMetricsClient } from "@/components/instagram/IGMetricsClient";
import { DurationEnricher } from "@/components/instagram/DurationEnricher";
import { Suspense } from "react";

// ─── Helper functions ───

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

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
}

interface PostCard {
  id: string;
  caption: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  permalink: string | null;
  published_at: string | null;
  media_type: string | null;
  media_product_type: string | null;
  impressions: number;
  reach: number;
  likes: number;
  saves: number;
  comments: number;
  shares: number;
}

type TabKey = "reels" | "posts" | "all" | "metrics";

// ─── Page Component ───

export default async function InstagramPage({ searchParams }: { searchParams: Promise<{ days?: string; tab?: string }> }) {
  const params = await searchParams;
  const activeTab = (params.tab as TabKey) || "reels";
  const periodDays = parseInt(params.days || "90", 10);
  const periodLabel = `${periodDays}d`;
  const periodStartIso = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId();

  let reels: ReelCard[] = [];
  let posts: PostCard[] = [];
  let dailyInsights: Array<{
    metric_date: string; impressions: number; reach: number; profile_views: number;
    accounts_engaged: number; total_interactions: number; likes: number; comments: number;
    shares: number; saves: number; follower_count: number; follows_count: number; media_count: number;
  }> = [];
  let demographics: { audience_gender_age: Record<string, number>; audience_city: Record<string, number>; audience_country: Record<string, number> } | null = null;
  let connectionStatus: string | null = null;

  if (workspaceId) {
      const needsMedia = activeTab === "reels" || activeTab === "posts" || activeTab === "all";

      // ── Fetch connection + media in parallel ──────────────────────
      const mediaQuery = needsMedia
        ? supabase
            .from("reels")
            .select(`
              id, ig_media_id, caption, permalink, thumbnail_url, media_url, published_at,
              duration_seconds, reel_type, has_ads, media_type, media_product_type,
              reel_metrics (views_org, impressions_org, reach_org, likes_total, comments_total, shares_total, saves_total, follows_generated),
              reel_metrics_paid (views_paid)
            `)
            .eq("workspace_id", workspaceId)
            .gte("published_at", periodStartIso)
            .order("published_at", { ascending: false })
            .limit(200)
        : null;

      const [connectionResult, mediaResult, benchmarkResult] = await Promise.all([
        supabase.from("meta_connections").select("status, ig_username").eq("workspace_id", workspaceId).single(),
        mediaQuery ?? Promise.resolve({ data: null as null }),
        supabase.from("reel_benchmarks").select("avg_views_90d").eq("workspace_id", workspaceId).order("calculated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      connectionStatus = connectionResult.data?.status || null;

      if (needsMedia) {
        const mediaData = mediaResult.data;

        if (mediaData && mediaData.length > 0) {
          type MetricsShape = { views_org: number; impressions_org: number; reach_org: number; likes_total: number; comments_total: number; shares_total: number; saves_total: number; follows_generated: number };
          type PaidShape = { views_paid: number };

          const getMetrics = (raw: unknown): MetricsShape | null => Array.isArray(raw) ? (raw as MetricsShape[])[0] : (raw as MetricsShape | null);
          const getPaid = (raw: unknown): PaidShape | null => Array.isArray(raw) ? (raw as PaidShape[])[0] : (raw as PaidShape | null);

          // Split into reels and posts
          const reelsData = mediaData.filter((r) => r.media_product_type === "REELS");
          const postsData = mediaData.filter((r) => r.media_product_type !== "REELS");

          // Build reels with benchmark from DB (single source of truth)
          if (reelsData.length > 0) {
            const avgViews = benchmarkResult.data?.avg_views_90d || 1;

            reels = reelsData.map((r) => {
              const m = getMetrics(r.reel_metrics);
              const p = getPaid(r.reel_metrics_paid);
              const viewsOrg = m?.views_org || 0;
              const viewsPaid = p?.views_paid || 0;
              const viewsTotal = viewsOrg + viewsPaid;
              const multiple = avgViews > 0 ? viewsTotal / avgViews : null;

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
              };
            });
          }

          // Build posts
          if (postsData.length > 0) {
            posts = postsData.map((r) => {
              const m = getMetrics(r.reel_metrics);
              return {
                id: r.id,
                caption: r.caption,
                thumbnail_url: r.thumbnail_url,
                media_url: r.media_url ?? null,
                permalink: r.permalink,
                published_at: r.published_at,
                media_type: r.media_type ?? null,
                media_product_type: r.media_product_type ?? null,
                impressions: m?.impressions_org || 0,
                reach: m?.reach_org || 0,
                likes: m?.likes_total || 0,
                saves: m?.saves_total || 0,
                comments: m?.comments_total || 0,
                shares: m?.shares_total || 0,
              };
            });
          }
        }
      }

      // ── Fetch account insights (for metrics tab) — parallel ───────
      if (activeTab === "metrics") {
        const todayUtc = new Date();
        todayUtc.setUTCHours(0, 0, 0, 0);
        const todayDate = todayUtc.toISOString().split("T")[0];
        const periodStartDate = new Date(todayUtc.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        const [insightsResult, demoResult] = await Promise.all([
          supabase
            .from("ig_account_insights")
            .select("metric_date, impressions, reach, profile_views, accounts_engaged, total_interactions, likes, comments, shares, saves, follower_count, follows_count, media_count")
            .eq("workspace_id", workspaceId)
            .gte("metric_date", periodStartDate)
            .lt("metric_date", todayDate)
            .order("metric_date", { ascending: true })
            .limit(90),
          supabase
            .from("ig_account_demographics")
            .select("audience_gender_age, audience_city, audience_country")
            .eq("workspace_id", workspaceId)
            .order("snapshot_date", { ascending: false })
            .limit(1)
            .single(),
        ]);

        if (insightsResult.data) dailyInsights = insightsResult.data;

        if (demoResult.data) {
          demographics = {
            audience_gender_age: (demoResult.data.audience_gender_age as Record<string, number>) ?? {},
            audience_city: (demoResult.data.audience_city as Record<string, number>) ?? {},
            audience_country: (demoResult.data.audience_country as Record<string, number>) ?? {},
          };
        }
      }
  }

  // Aggregate stats for Reels KPI bar (only shown on reels/all tabs)
  const showReelsKpis = activeTab === "reels" || activeTab === "all";
  const totalViews = reels.reduce((s, r) => s + r.views_total, 0);
  const totalViewsOrg = reels.reduce((s, r) => s + r.views_org, 0);
  const totalViewsPaid = reels.reduce((s, r) => s + r.views_paid, 0);
  const totalLikes = reels.reduce((s, r) => s + r.likes, 0);
  const totalSaves = reels.reduce((s, r) => s + r.saves, 0);
  const totalComments = reels.reduce((s, r) => s + r.comments, 0);
  const topPerformers = reels.filter(r => r.is_top_performer).length;
  const avgViews = reels.length > 0 ? Math.round(totalViews / reels.length) : 0;
  const paidPct = totalViews > 0 ? Math.round((totalViewsPaid / totalViews) * 100) : 0;

  const hasRealData = reels.length > 0 || posts.length > 0 || dailyInsights.length > 0;
  const reelsMissingDuration = reels.filter((r) => r.duration_seconds === null).length;

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
            <SyncButton workspaceId={workspaceId} currentTab={activeTab} />
          )}
        </div>
      </div>

      {/* Tabs */}
      <Suspense fallback={null}>
        <InstagramTabs />
      </Suspense>

      {/* ── TAB: Reels ────────────────────────────────────────────── */}
      {activeTab === "reels" && (
        <>
          {reels.length > 0 && (
            <div className="space-y-5">
              {/* Hero KPIs — 4 large */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: "Views Totales", value: formatNumber(totalViews) },
                  { label: "Views Promedio", value: formatNumber(avgViews) },
                  { label: "Orgánico", value: formatNumber(totalViewsOrg), sub: `${100 - paidPct}%` },
                  { label: "Pagado", value: formatNumber(totalViewsPaid), sub: `${paidPct}%` },
                ].map((s) => (
                  <div key={s.label} className="glass-card px-6 py-5 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-2 relative z-10">
                      <p className="stat-label">{s.label}</p>
                      {(s as { sub?: string }).sub && (
                        <span className="pill-badge">{(s as { sub?: string }).sub}</span>
                      )}
                    </div>
                    <p className="stat-number relative z-10">{s.value}</p>
                  </div>
                ))}
              </div>
              {/* Secondary KPIs — compact */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: "Likes", value: formatNumber(totalLikes) },
                  { label: "Guardados", value: formatNumber(totalSaves) },
                  { label: "Comentarios", value: formatNumber(totalComments) },
                  { label: "Top Performers", value: `${topPerformers}`, sub: `de ${reels.length}` },
                ].map((s) => (
                  <div key={s.label} className="glass-card px-6 py-5 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-2 relative z-10">
                      <p className="stat-label">{s.label}</p>
                      {(s as { sub?: string }).sub && (
                        <span className="text-[11px] font-bold text-white/30 uppercase tracking-[0.08em]">{(s as { sub?: string }).sub}</span>
                      )}
                    </div>
                    <p className="stat-number relative z-10">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ReelsGrid reels={reels} />
        </>
      )}

      {/* ── TAB: Posts ────────────────────────────────────────────── */}
      {activeTab === "posts" && (
        <PostsGrid posts={posts} />
      )}

      {/* ── TAB: Todos ───────────────────────────────────────────── */}
      {activeTab === "all" && (
        <>
          {reels.length > 0 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: "Views Totales", value: formatNumber(totalViews) },
                  { label: "Views Promedio", value: formatNumber(avgViews) },
                  { label: "Orgánico", value: formatNumber(totalViewsOrg), sub: `${100 - paidPct}%` },
                  { label: "Pagado", value: formatNumber(totalViewsPaid), sub: `${paidPct}%` },
                ].map((s) => (
                  <div key={s.label} className="glass-card px-6 py-5 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-2 relative z-10">
                      <p className="stat-label">{s.label}</p>
                      {(s as { sub?: string }).sub && (
                        <span className="pill-badge">{(s as { sub?: string }).sub}</span>
                      )}
                    </div>
                    <p className="stat-number relative z-10">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: "Likes", value: formatNumber(totalLikes) },
                  { label: "Guardados", value: formatNumber(totalSaves) },
                  { label: "Comentarios", value: formatNumber(totalComments) },
                  { label: "Top Performers", value: `${topPerformers}`, sub: `de ${reels.length}` },
                ].map((s) => (
                  <div key={s.label} className="glass-card px-6 py-5 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-2 relative z-10">
                      <p className="stat-label">{s.label}</p>
                      {(s as { sub?: string }).sub && (
                        <span className="text-[11px] font-bold text-white/30 uppercase tracking-[0.08em]">{(s as { sub?: string }).sub}</span>
                      )}
                    </div>
                    <p className="stat-number relative z-10">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ReelsGrid reels={reels} />
          {posts.length > 0 && (
            <div className="mt-6">
              <PostsGrid posts={posts} />
            </div>
          )}
        </>
      )}

      {/* ── TAB: IG Metrics ──────────────────────────────────────── */}
      {activeTab === "metrics" && (
        <IGMetricsClient dailyInsights={dailyInsights} demographics={demographics} />
      )}

      {/* Auto-enrich durations in background when reels are missing them */}
      {workspaceId && reelsMissingDuration > 0 && (
        <DurationEnricher workspaceId={workspaceId} missingCount={reelsMissingDuration} />
      )}
    </div>
  );
}
