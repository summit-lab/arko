import Link from "next/link";
import { Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { SyncControls } from "@/components/instagram/SyncControls";
import { PeriodFilter } from "@/components/instagram/PeriodFilter";
import { InstagramTabs } from "@/components/instagram/InstagramTabs";
import { ReelsGrid } from "@/components/instagram/ReelsGrid";

import { IGMetricsClient } from "@/components/instagram/IGMetricsClient";
import { IGDashboardClient } from "@/components/instagram/IGDashboardClient";
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

type TabKey = "dashboard" | "reels" | "metrics";

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
    shares: number; saves: number; follower_count: number; follows_count: number; media_count: number;
  }> = [];
  let demographics: { audience_gender_age: Record<string, number>; audience_city: Record<string, number>; audience_country: Record<string, number> } | null = null;
  let connectionStatus: string | null = null;
  let totalFollowers = 0;

  if (workspaceId) {
    const needsMedia = activeTab === "reels" || activeTab === "dashboard";
    const needsInsights = activeTab === "dashboard" || activeTab === "metrics";

    // ── Build queries ──
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

    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const todayDate = todayUtc.toISOString().split("T")[0];
    const periodStartDate = new Date(todayUtc.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const insightsQuery = needsInsights
      ? supabase
          .from("ig_account_insights")
          .select("metric_date, impressions, reach, profile_views, accounts_engaged, total_interactions, likes, comments, shares, saves, follower_count, follows_count, media_count")
          .eq("workspace_id", workspaceId)
          .gte("metric_date", periodStartDate)
          .lt("metric_date", todayDate)
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

    // ── Fetch all in parallel ──
    const [connectionResult, mediaResult, benchmarkResult, insightsResult, demoResult] = await Promise.all([
      supabase.from("meta_connections").select("status, ig_username").eq("workspace_id", workspaceId).single(),
      mediaQuery ?? Promise.resolve({ data: null as null }),
      supabase.from("reel_benchmarks").select("avg_views_90d").eq("workspace_id", workspaceId).order("calculated_at", { ascending: false }).limit(1).maybeSingle(),
      insightsQuery ?? Promise.resolve({ data: null as null }),
      demoQuery ?? Promise.resolve({ data: null as null }),
    ]);

    connectionStatus = connectionResult.data?.status || null;

    // Process insights
    if (insightsResult?.data) {
      dailyInsights = insightsResult.data;
      const latestDay = [...dailyInsights].sort((a, b) => b.metric_date.localeCompare(a.metric_date))[0];
      if (latestDay?.follower_count) totalFollowers = latestDay.follower_count;
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
        />
      )}

      {/* ── TAB: Reels ────────────────────────────────────────────── */}
      {activeTab === "reels" && (
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

              {/* ── Performance Overview Strip ── */}
              <div className="glass-panel rounded-xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-[0.1em]">Resumen de Rendimiento</h3>
                  <span className="text-[11px] text-white/25 font-light">Últimos {reels.length} reels</span>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  {/* Engagement Rate */}
                  <div>
                    <p className="text-[11px] text-white/30 font-medium uppercase tracking-[0.08em] mb-2">Engagement Rate</p>
                    <p className="text-[28px] font-light text-white tracking-[-0.02em] leading-none">
                      {totalViews > 0 ? ((totalLikes + totalSaves + totalComments) / totalViews * 100).toFixed(1) : "0"}%
                    </p>
                    <p className="text-[11px] text-white/20 font-light mt-1">likes + saves + comments / views</p>
                  </div>

                  {/* Organic vs Paid Split */}
                  <div>
                    <p className="text-[11px] text-white/30 font-medium uppercase tracking-[0.08em] mb-3">Distribución de Tráfico</p>
                    <div className="h-[6px] w-full rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div
                        className="h-full rounded-l-full"
                        style={{ width: `${100 - paidPct}%`, background: "linear-gradient(90deg, #818cf8, #a78bfa)" }}
                      />
                      <div
                        className="h-full rounded-r-full"
                        style={{ width: `${paidPct}%`, background: "linear-gradient(90deg, #f472b6, #fb7185)" }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#818cf8]" />
                        <span className="text-[11px] text-white/40 font-light">Orgánico {100 - paidPct}%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#f472b6]" />
                        <span className="text-[11px] text-white/40 font-light">Pagado {paidPct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Top 5 by views — mini bars */}
                  <div>
                    <p className="text-[11px] text-white/30 font-medium uppercase tracking-[0.08em] mb-3">Top 5 Reels por Views</p>
                    <div className="space-y-2">
                      {reels
                        .sort((a, b) => b.views_total - a.views_total)
                        .slice(0, 5)
                        .map((r, i) => {
                          const maxV = reels[0]?.views_total || 1;
                          const pct = Math.round((r.views_total / maxV) * 100);
                          return (
                            <div key={r.id} className="flex items-center gap-2">
                              <span className="text-[10px] text-white/20 w-3 text-right font-light">{i + 1}</span>
                              <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                                <div className="h-full rounded-full bg-white/20" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-white/40 font-light w-10 text-right">{formatNumber(r.views_total)}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <ReelsGrid reels={reels} />
        </>
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
