"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { ReelsSummary } from "./ReelsGrid";
import { LayoutDashboard, Clapperboard, BarChart3, BookImage, Swords, Grid2X2, BookMarked } from "lucide-react";

// Skeleton for lazy-loaded tabs
const TabSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="grid grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-white/[0.04]" />)}
    </div>
    <div className="h-[300px] rounded-xl bg-white/[0.025]" />
  </div>
);

// Lazy-load ALL tab content — only hydrate JS when user visits the tab
const ReelsGrid = dynamic(() => import("./ReelsGrid").then(m => ({ default: m.ReelsGrid })), { ssr: false, loading: TabSkeleton });
const StoriesGrid = dynamic(() => import("./StoriesGrid").then(m => ({ default: m.StoriesGrid })), { ssr: false, loading: TabSkeleton });
const PublicacionesGrid = dynamic(() => import("./PublicacionesGrid").then(m => ({ default: m.PublicacionesGrid })), { ssr: false, loading: TabSkeleton });
const IGMetricsClient = dynamic(() => import("./IGMetricsClient").then(m => ({ default: m.IGMetricsClient })), { ssr: false, loading: TabSkeleton });
const CompetitorTab = dynamic(() => import("./CompetitorTab").then(m => ({ default: m.CompetitorTab })), { ssr: false, loading: TabSkeleton });
const ReferencesTab = dynamic(() => import("./ReferencesTab").then(m => ({ default: m.ReferencesTab })), { ssr: false, loading: TabSkeleton });

// Lazy-load heavy dashboard (charts) — only when user visits the tab
const IGDashboard = dynamic(
  () => import("./IGDashboard").then((m) => ({ default: m.IGDashboard })),
  {
    ssr: false,
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
  workspaceId: string | null;
  // Pre-fetched data for instant tab switching (no client-side fetch on mount)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialCompetitors: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialReferences: any[];
}

// ─── Tab definitions ───

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { key: "reels",         label: "Reels",         icon: Clapperboard },
  { key: "historias",     label: "Historias",     icon: BookImage },
  { key: "publicaciones", label: "Publicaciones", icon: Grid2X2 },
  { key: "competencia",   label: "Competencia",   icon: Swords },
  { key: "referencias",   label: "Referencias",   icon: BookMarked },
  { key: "metrics",       label: "Demografía",    icon: BarChart3 },
];

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
  workspaceId,
  initialCompetitors,
  initialReferences,
}: InstagramShellProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const searchParams = useSearchParams();

  // Update URL without server roundtrip (shallow)
  const handleTabChange = useCallback((key: TabKey) => {
    if (key === activeTab) return;
    setActiveTab(key);
    // Update URL for shareability + back button, using replaceState (no navigation)
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    window.history.replaceState(null, "", `/instagram?${params.toString()}`);
  }, [activeTab, searchParams]);

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
      {/* ── Tabs (instant, client-side) ── */}
      <div
        className="inline-flex items-center gap-1 p-1 rounded-full"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-250 cursor-pointer ${
                active
                  ? "text-white"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
              style={active ? {
                background: "rgba(255,255,255,0.1)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.22)",
                boxShadow: "0 1px 16px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.2)",
              } : undefined}
            >
              <tab.icon size={14} strokeWidth={active ? 2.2 : 1.6} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content (instant switch, no server roundtrip) ── */}

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
        <ReelsGrid reels={reels} summary={reelsSummary} />
      )}

      {activeTab === "historias" && (
        <StoriesGrid sequences={storySequences} totalFollowers={totalFollowers} />
      )}

      {activeTab === "publicaciones" && (
        <PublicacionesGrid posts={posts} summary={postsSummary} />
      )}

      {activeTab === "competencia" && (
        <CompetitorTab
          workspaceId={workspaceId ?? null}
          initialCompetitors={initialCompetitors}
          myStats={{
            avgViews:    reels.length > 0 ? Math.round(reels.reduce((s, r) => s + r.views_total, 0) / reels.length) : 0,
            followers:   totalFollowers,
            avgLikes:    reels.length > 0 ? Math.round(reels.reduce((s, r) => s + r.likes,       0) / reels.length) : 0,
            avgComments: reels.length > 0 ? Math.round(reels.reduce((s, r) => s + r.comments,    0) / reels.length) : 0,
          }}
          myReels={reels.map((r) => ({ published_at: r.published_at, views_total: r.views_total }))}
          myFollowerHistory={dailyInsights
            .filter((d) => d.followers_total > 0)
            .map((d) => ({ date: d.metric_date, followers: d.followers_total }))}
        />
      )}

      {activeTab === "referencias" && (
        <ReferencesTab workspaceId={workspaceId ?? null} initialReferences={initialReferences} />
      )}

      {activeTab === "metrics" && (
        <IGMetricsClient dailyInsights={dailyInsights} demographics={demographics} />
      )}
    </>
  );
}
