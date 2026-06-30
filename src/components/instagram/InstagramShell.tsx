"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { ReelsSummary } from "./ReelsGrid";
import { hasFeature, TRAP, type Tier } from "@/lib/tier/config";
import { FeatureLock } from "@/components/common/FeatureLock";

// Skeleton for lazy-loaded tabs
const TabSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="grid grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-white/[0.04]" />)}
    </div>
    <div className="h-[300px] rounded-xl bg-white/[0.025]" />
  </div>
);

// Lazy-load ALL tab content (code-splitting): el chunk JS se baja recien al
// visitar la tab. SIN ssr:false — con ssr:false el cold load mostraba skeleton
// hasta hidratar aunque la data ya habia viajado en el payload del Server
// Component; ahora el HTML inicial trae las cards y el browser pide las
// imagenes de inmediato (los charts recharts igual aparecen al hidratar).
const ReelsGrid = dynamic(() => import("./ReelsGrid").then(m => ({ default: m.ReelsGrid })), { loading: TabSkeleton });
const StoriesGrid = dynamic(() => import("./StoriesGrid").then(m => ({ default: m.StoriesGrid })), { loading: TabSkeleton });
const PublicacionesGrid = dynamic(() => import("./PublicacionesGrid").then(m => ({ default: m.PublicacionesGrid })), { loading: TabSkeleton });
const IGMetricsClient = dynamic(() => import("./IGMetricsClient").then(m => ({ default: m.IGMetricsClient })), { loading: TabSkeleton });
// CompetitorTab y ReferencesTab ya NO se cargan aca: se renderizan server-side en
// CompetitorsLoader/ReferencesLoader (streameados via <Suspense> desde el page) y
// llegan como slots — asi su data pesada no bloquea el paint de la tab reels.

// Lazy-load heavy dashboard (charts) — only when user visits the tab
const IGDashboard = dynamic(
  () => import("./IGDashboard").then((m) => ({ default: m.IGDashboard })),
  {
    loading: () => (
      <div className="grid grid-cols-12 gap-5 animate-pulse">
        <div className="col-span-12 lg:col-span-8 h-[320px] rounded-xl bg-white/[0.025]" />
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">
          <div className="h-[148px] rounded-xl bg-white/[0.04]" />
          <div className="h-[148px] rounded-xl bg-white/[0.04]" />
        </div>
      </div>
    ),
  }
);

// ─── Types ───

export type TabKey = "dashboard" | "reels" | "historias" | "publicaciones" | "competencia" | "referencias" | "metrics";

interface ReelCard {
  id: string;
  ig_media_id: string;
  caption: string | null;
  auto_title: string | null;
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

interface DashboardReel {
  id: string;
  caption: string | null;
  auto_title: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  published_at: string | null;
  views_org: number;
  views_paid: number;
  views_total: number;
  likes: number;
  saves: number;
  comments: number;
  shares: number;
  sales_amount: number | null;
}

interface DailyInsight {
  metric_date: string;
  impressions: number;
  reach: number;
  profile_views: number;
  accounts_engaged: number;
  total_interactions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  follower_count: number;
  followers_total: number;
  follows_count: number;
  media_count: number;
}

interface StorySequence {
  id: string;
  ig_story_id: string;
  published_at: string;
  expires_at: string | null;
  total_impressions: number;
  total_reach: number;
  total_replies: number;
  total_exits: number;
  archived: boolean;
  slides: Array<{
    id: string;
    ig_media_id: string;
    slide_index: number;
    media_type: string | null;
    media_url: string | null;
    thumbnail_url: string | null;
    caption: string | null;
    impressions: number;
    reach: number;
    replies: number;
    exits: number;
    taps_forward: number;
    taps_back: number;
    swipe_aways: number;
    archived: boolean;
  }>;
}

interface PostCard {
  id: string;
  ig_media_id: string;
  caption: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  published_at: string | null;
  media_type: string | null;
  views_total: number;
  impressions: number;
  reach: number;
  likes: number;
  saves: number | null;
  comments: number;
  shares: number;
}

interface Demographics {
  audience_gender_age: Record<string, number>;
  audience_city: Record<string, number>;
  audience_country: Record<string, number>;
}

export interface InstagramShellProps {
  initialTab: TabKey;
  periodDays: number;
  totalAdVideoPlays: number;
  totalFollowers: number;
  reels: ReelCard[];
  dashboardReels: DashboardReel[];
  dailyInsights: DailyInsight[];
  demographics: Demographics | null;
  storySequences: StorySequence[];
  posts: PostCard[];
  reelsSummary: ReelsSummary | undefined;
  reelsMissingDuration: number;
  benchmarksByType: { normal: number; trial: number; all: number };
  workspaceId: string | null;
  // Slots streameados via <Suspense> desde el page: la data pesada de competencia
  // y referencias se carga FUERA del critical path (no bloquea el paint de reels).
  competenciaSlot: ReactNode;
  referenciasSlot: ReactNode;
  tier?: Tier;
}

// ─── Component ───

export function InstagramShell({
  initialTab,
  periodDays,
  totalAdVideoPlays,
  totalFollowers,
  reels,
  dashboardReels,
  dailyInsights,
  demographics,
  storySequences,
  posts,
  reelsSummary,
  benchmarksByType,
  workspaceId,
  competenciaSlot,
  referenciasSlot,
  tier = "pro",
}: InstagramShellProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const searchParams = useSearchParams();

  // Re-sync when initialTab changes (sidebar navigation via router.push)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Posts summary
  const postsSummary = posts.length > 0 ? (() => {
    const totalPosts = posts.filter(p => p.media_type !== "CAROUSEL_ALBUM").length;
    const totalCarruseles = posts.filter(p => p.media_type === "CAROUSEL_ALBUM").length;
    const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
    const totalSaves = posts.reduce((s, p) => s + (p.saves ?? 0), 0);
    const totalComments = posts.reduce((s, p) => s + p.comments, 0);
    const totalShares = posts.reduce((s, p) => s + p.shares, 0);
    const avgLikes = posts.length > 0 ? Math.round(totalLikes / posts.length) : 0;
    const avgComments = posts.length > 0 ? Math.round(totalComments / posts.length) : 0;
    const avgSaves = posts.length > 0 ? Math.round(totalSaves / posts.length) : 0;
    return { totalPosts, totalCarruseles, totalLikes, totalSaves, totalComments, totalShares, avgLikes, avgComments, avgSaves };
  })() : undefined;

  return (
    <>
      {/* ── Tab content ── */}

      {activeTab === "dashboard" && (
        <IGDashboard
          dailyInsights={dailyInsights}
          reels={dashboardReels}
          totalFollowers={totalFollowers}
          periodDays={periodDays}
          totalAdVideoPlays={totalAdVideoPlays}
        />
      )}

      {activeTab === "reels" && (
        <ReelsGrid reels={reels} summary={reelsSummary} benchmarksByType={benchmarksByType} />
      )}

      {activeTab === "historias" && (
        <StoriesGrid
          sequences={storySequences}
          totalFollowers={totalFollowers}
          initialSelectedId={searchParams.get("story")}
        />
      )}

      {activeTab === "publicaciones" && (
        <PublicacionesGrid posts={posts} summary={postsSummary} />
      )}

      {/* Competencia/Referencias: slots streameados via <Suspense> desde el page.
          La data pesada (myStats/myReels se derivan en el page) NO bloquea el paint
          de la tab reels (default). */}
      {activeTab === "competencia" && competenciaSlot}

      {activeTab === "referencias" && referenciasSlot}

      {activeTab === "metrics" && (
        hasFeature(tier, "audience") ? (
          <IGMetricsClient dailyInsights={dailyInsights} demographics={demographics} />
        ) : (
          <FeatureLock variant="page" preview="audience" title={TRAP.title} description={TRAP.description} ctaText={TRAP.ctaText} ctaHref={TRAP.ctaHref} />
        )
      )}
    </>
  );
}
