import Link from "next/link";
import { Zap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { SyncControls } from "@/components/instagram/SyncControls";
import { DateFilter } from "@/components/ui/DateFilter";
import { parseDateParams, toISOStart, nextDay } from "@/lib/date-utils";
import { latestCleanFollowersTotal } from "@/lib/follower-metrics";
import { signStorageThumbs, pickThumb } from "@/lib/storage-thumbs";
import { DurationEnricher } from "@/components/instagram/DurationEnricher";
import { InstagramShell, type TabKey } from "@/components/instagram/InstagramShell";
import type { ReelsSummary } from "@/components/instagram/ReelsGrid";
import { ReelTitlesBulkGenerator } from "@/components/instagram/ReelTitlesBulkGenerator";
import { CompetitorsLoader } from "@/components/instagram/CompetitorsLoader";
import { ReferencesLoader } from "@/components/instagram/ReferencesLoader";
import { Suspense } from "react";

// Fallback de los slots streameados (competencia / referencias) mientras su data
// pesada llega por <Suspense>. La tab reels (default) ya pinto para entonces.
function TabContentSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/[0.04]" />
        ))}
      </div>
      <div className="h-[300px] rounded-xl bg-white/[0.025]" />
    </div>
  );
}

// ─── Page Component ───
// La tab default (reels) y las metricas se fetchean upfront; competencia y
// referencias streamean via <Suspense> (CompetitorsLoader / ReferencesLoader) para
// no bloquear el primer paint. InstagramShell hace el switch de tabs client-side.

export default async function InstagramPage({ searchParams }: { searchParams: Promise<{ days?: string; from?: string; to?: string; preset?: string; tab?: string }> }) {
  const params = await searchParams;
  const activeTab = (params.tab as TabKey) || "reels";
  const dateRange = parseDateParams(params, "90d");
  const t = await getTranslations("instagram");
  const tNav = await getTranslations("nav");
  const TAB_TITLES: Partial<Record<TabKey, string>> = {
    reels:       "Reels",
    historias:   tNav("historias"),
    competencia: tNav("competencia"),
  };
  const pageTitle = TAB_TITLES[activeTab] ?? t("pageTitle");
  const periodDays = dateRange.days;
  const periodStartIso = toISOStart(dateRange.from);
  // Upper bound exclusivo: para filtrar `published_at` entre dateRange.from y
  // dateRange.to debemos cerrar con `.lt(nextDay(to))`. Sin esto, preset
  // "mes_anterior" o cualquier rango que termine antes de hoy traía también
  // todos los reels posteriores al límite superior.
  const periodEndIsoExclusive = toISOStart(nextDay(dateRange.to));

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId();

  let connectionStatus: string | null = null;

  // Default empty data for all tabs
  type ReelCard = {
    id: string; ig_media_id: string; caption: string | null; auto_title: string | null; permalink: string | null;
    thumbnail_url: string | null; published_at: string | null; duration_seconds: number | null;
    reel_type: string; has_ads: boolean; views_org: number; views_paid: number; views_total: number;
    likes: number; saves: number; comments: number; shares: number; follows: number;
    performer_multiple: number | null; is_top_performer: boolean; sales_amount: number | null;
  };
  let reels: ReelCard[] = [];
  let benchmarksForShell: { normal: number; trial: number; all: number } = { normal: 0, trial: 0, all: 0 };
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
    views_total: number; impressions: number; reach: number;
    likes: number; saves: number; comments: number; shares: number;
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
    // Date calculations — derived from dateRange
    const periodStartDate = dateRange.from;
    const yesterdayDate = dateRange.to;

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
          id, ig_media_id, caption, auto_title, permalink, thumbnail_url, media_url, media_storage_path, published_at,
          duration_seconds, reel_type, has_ads, media_type, media_product_type, sales_amount,
          reel_metrics (views_org, impressions_org, reach_org, likes_total, comments_total, shares_total, saves_total, follows_generated),
          reel_metrics_paid (views_paid)
        `)
        .eq("workspace_id", workspaceId)
        .gte("published_at", periodStartIso)
        .lt("published_at", periodEndIsoExclusive)
        .order("published_at", { ascending: false })
        .limit(200),
      supabase.from("reel_benchmarks").select("avg_views_90d, avg_views_by_type").eq("workspace_id", workspaceId).order("calculated_at", { ascending: false }).limit(1).maybeSingle(),
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
            impressions, reach, replies, exits, taps_forward, taps_back, swipe_aways, archived,
            media_storage_path
          )
        `)
        .eq("workspace_id", workspaceId)
        .gte("published_at", periodStartIso)
        .lt("published_at", periodEndIsoExclusive)
        .order("published_at", { ascending: false })
        .limit(100),
      supabase
        .from("reels")
        .select(`
          id, ig_media_id, caption, permalink, thumbnail_url, media_storage_path, published_at,
          media_type, media_product_type,
          reel_metrics (likes_total, comments_total, shares_total, saves_total, impressions_org, reach_org),
          reel_metrics_paid (views_paid)
        `)
        .eq("workspace_id", workspaceId)
        .not("media_product_type", "eq", "REELS")
        .gte("published_at", periodStartIso)
        .lt("published_at", periodEndIsoExclusive)
        .order("published_at", { ascending: false })
        .limit(200),
      supabase.from("sync_jobs").select("metadata").eq("workspace_id", workspaceId).eq("job_type", "ads_insights").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("sales").select("reel_id, amount_total").eq("workspace_id", workspaceId).not("reel_id", "is", null),
      // Competencia + referencias YA NO van aca: las cargan CompetitorsLoader /
      // ReferencesLoader server-side, streameados via <Suspense>, asi su data pesada
      // (embed de 3 niveles + reference_reel_analysis) no bloquea el paint de reels.
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

    // ── Storage-first para reels/posts/historias ──
    // Los thumbnails re-hosteados (reel-media / story-media) dan una URL estable
    // (no expira, sin 502). Firmado batch + fallback via helper compartido
    // (src/lib/storage-thumbs). Los DOS buckets se firman EN PARALELO — antes
    // eran 2 awaits seriales en el critical path de toda la pagina.
    const reelStoragePaths: string[] = [];
    for (const r of (mediaResult?.data ?? []) as Array<{ media_storage_path: string | null }>) {
      if (r.media_storage_path) reelStoragePaths.push(r.media_storage_path);
    }
    for (const r of (postsResult?.data ?? []) as Array<{ media_storage_path: string | null }>) {
      if (r.media_storage_path) reelStoragePaths.push(r.media_storage_path);
    }
    const storyStoragePaths: string[] = [];
    for (const seq of (storiesResult?.data ?? []) as Array<{ ig_story_slides: Array<{ media_storage_path: string | null }> }>) {
      for (const slide of seq.ig_story_slides || []) {
        if (slide.media_storage_path) storyStoragePaths.push(slide.media_storage_path);
      }
    }
    const [reelSignedMap, storySignedMap] = await Promise.all([
      signStorageThumbs(supabase, "reel-media", reelStoragePaths),
      signStorageThumbs(supabase, "story-media", storyStoragePaths),
    ]);
    const reelThumb = (storagePath: string | null, raw: string | null): string | null =>
      pickThumb(reelSignedMap, storagePath, raw);

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
          media_storage_path: string | null;
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
          ? [...seq.ig_story_slides].sort((a, b) => a.slide_index - b.slide_index).map((slide) => {
              // Storage-first: IG CDN signed URLs expire in hours/days, but the DB string stays truthy
              // forever, so always prefer the archived storage URL when available.
              const archivedUrl = slide.media_storage_path ? storySignedMap.get(slide.media_storage_path) ?? null : null;
              return {
                ...slide,
                thumbnail_url: archivedUrl || slide.thumbnail_url,
                media_url: archivedUrl || slide.media_url,
              };
            })
          : [],
      }));
    }

    // ── Process posts ──
    if (postsResult?.data) {
      type MShape = { likes_total: number; comments_total: number; shares_total: number; saves_total: number; impressions_org: number; reach_org: number };
      type PShape = { views_paid: number };
      const getM = (raw: unknown): MShape | null => Array.isArray(raw) ? (raw as MShape[])[0] : (raw as MShape | null);
      const getP = (raw: unknown): PShape | null => Array.isArray(raw) ? (raw as PShape[])[0] : (raw as PShape | null);
      posts = (postsResult.data as Array<{
        id: string; ig_media_id: string; caption: string | null; thumbnail_url: string | null;
        media_storage_path: string | null;
        permalink: string | null; published_at: string | null; media_type: string | null;
        media_product_type: string | null; reel_metrics: unknown; reel_metrics_paid: unknown;
      }>).map((r) => {
        const m = getM(r.reel_metrics);
        const p = getP(r.reel_metrics_paid);
        return {
          id: r.id, ig_media_id: r.ig_media_id, caption: r.caption,
          thumbnail_url: reelThumb(r.media_storage_path, r.thumbnail_url), permalink: r.permalink,
          published_at: r.published_at, media_type: r.media_type,
          views_total: p?.views_paid || 0,
          impressions: m?.impressions_org || 0,
          reach: m?.reach_org || 0,
          likes: m?.likes_total || 0,
          saves: m?.saves_total || 0, comments: m?.comments_total || 0, shares: m?.shares_total || 0,
        };
      });
    }

    // ── Process insights ──
    if (insightsResult?.data) {
      dailyInsights = insightsResult.data.filter((d) => d.impressions > 0 || d.reach > 0);
      // Snapshot saneado: ignora el valle de followers_total por suspensión.
      const cleanTotal = latestCleanFollowersTotal(insightsResult.data);
      if (cleanTotal > 0) totalFollowers = cleanTotal;
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
        // Multiplicador = views_org / avg_views_org_del_tipo. Solo-orgánico en
        // ambos lados: un reel con ads no infla su propio multiplicador ni
        // el promedio del resto. El tipo depende del filtro activo en la UI,
        // así que el client recalcula; acá sólo persistimos un valor base
        // ("normal" benchmark) para `is_top_performer` y para sort default.
        const rawByType = benchmarkResult.data?.avg_views_by_type as
          | { normal?: number; trial?: number; all?: number }
          | null
          | undefined;
        const fallbackNormal = benchmarkResult.data?.avg_views_90d || 0;
        const benchmarksByType = {
          normal: rawByType?.normal ?? fallbackNormal,
          trial:  rawByType?.trial  ?? 0,
          all:    rawByType?.all    ?? fallbackNormal,
        };
        reels = reelsData.map((r) => {
          const m = getMetrics(r.reel_metrics);
          const p = getPaid(r.reel_metrics_paid);
          const viewsOrg = m?.views_org || 0;
          const viewsPaid = p?.views_paid || 0;
          const viewsTotal = viewsOrg + viewsPaid;
          // Top performer: comparado contra el benchmark del tipo del reel.
          // Así, un trial que destaca entre trials también cuenta como top.
          const ownBenchmark = r.reel_type === "trial_likely"
            ? benchmarksByType.trial
            : benchmarksByType.normal;
          const baseMultiple = ownBenchmark > 0 ? viewsOrg / ownBenchmark : null;
          return {
            id: r.id, ig_media_id: r.ig_media_id, caption: r.caption, auto_title: r.auto_title ?? null,
            permalink: r.permalink, thumbnail_url: reelThumb(r.media_storage_path, r.thumbnail_url),
            published_at: r.published_at, duration_seconds: r.duration_seconds,
            reel_type: r.reel_type, has_ads: r.has_ads,
            views_org: viewsOrg, views_paid: viewsPaid, views_total: viewsTotal,
            likes: m?.likes_total || 0, saves: m?.saves_total || 0,
            comments: m?.comments_total || 0, shares: m?.shares_total || 0,
            follows: m?.follows_generated || 0,
            // performer_multiple queda legacy: el UI lo recalcula según filtro.
            performer_multiple: baseMultiple,
            is_top_performer: (baseMultiple || 0) >= 3,
            sales_amount: salesByReel.get(r.id) ?? null,
          };
        });
        benchmarksForShell = benchmarksByType;
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
  const reelsMissingTitles = reels.some((r) => !r.auto_title);

  const dashboardReels = reels.map((r) => ({
    id: r.id, caption: r.caption, auto_title: r.auto_title ?? null, thumbnail_url: r.thumbnail_url, permalink: r.permalink,
    published_at: r.published_at, views_org: r.views_org, views_paid: r.views_paid,
    views_total: r.views_total, likes: r.likes, saves: r.saves,
    comments: r.comments, shares: r.shares, sales_amount: r.sales_amount,
  }));

  const reelsSummary: ReelsSummary | undefined = reels.length > 0
    ? { totalViews, avgViews, totalViewsOrg, totalViewsPaid, totalLikes, totalSaves, totalComments, topPerformers, paidPct }
    : undefined;

  // Stats propios para la tab competencia — se derivan de la data RAPIDA (reels +
  // insights) y se pasan ya calculados a CompetitorsLoader. Filtra reels con 0 views
  // para un denominador simetrico con el lado "Ellos" (que tambien filtra views>0).
  const reelsWithViews = reels.filter((r) => (r.views_total ?? 0) > 0);
  const nWithViews = reelsWithViews.length;
  const myStats = {
    avgViews:    nWithViews > 0 ? Math.round(reelsWithViews.reduce((s, r) => s + r.views_total, 0) / nWithViews) : 0,
    followers:   totalFollowers,
    avgLikes:    nWithViews > 0 ? Math.round(reelsWithViews.reduce((s, r) => s + r.likes,       0) / nWithViews) : 0,
    avgComments: nWithViews > 0 ? Math.round(reelsWithViews.reduce((s, r) => s + r.comments,    0) / nWithViews) : 0,
  };
  const myReels = reels.map((r) => ({ published_at: r.published_at, views_total: r.views_total }));
  const myFollowerHistory = dailyInsights
    .filter((d) => d.followers_total > 0)
    .map((d) => ({ date: d.metric_date, followers: d.followers_total }));

  return (
    <div className="px-8 py-10 space-y-8">
      <ReelTitlesBulkGenerator hasMissingTitles={reelsMissingTitles} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title tracking-[-0.04em]">{pageTitle}</h1>
          <p className="text-white/40 mt-3 text-[15px] font-normal">
            {t("pageSubtitle")}
            {!hasRealData && connectionStatus !== "active" && (
              <span className="ml-2 text-amber-400/50 text-[12px]">{t("connectMetaHint")}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Suspense fallback={null}>
            <DateFilter mode="url" defaultPreset="90d" />
          </Suspense>
          {!connectionStatus && (
            <Link
              href="/onboarding"
              className="flex items-center gap-2 text-[13px] font-medium text-violet-300 px-5 py-2.5 rounded-full transition-all hover:bg-white/[0.04]"
              style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}
            >
              <Zap className="h-4 w-4" />
              {t("connectButton")}
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
        benchmarksByType={benchmarksForShell}
        workspaceId={workspaceId}
        competenciaSlot={
          <Suspense fallback={<TabContentSkeleton />}>
            <CompetitorsLoader
              workspaceId={workspaceId}
              myStats={myStats}
              myReels={myReels}
              myFollowerHistory={myFollowerHistory}
            />
          </Suspense>
        }
        referenciasSlot={
          <Suspense fallback={<TabContentSkeleton />}>
            <ReferencesLoader workspaceId={workspaceId} />
          </Suspense>
        }
      />

      {/* Auto-enrich durations */}
      {workspaceId && reelsMissingDuration > 0 && (
        <DurationEnricher workspaceId={workspaceId} missingCount={reelsMissingDuration} />
      )}
    </div>
  );
}
