"use client";

import { useState, useCallback } from "react";
import { Eye, ThumbsUp, MessageSquare, Clock, ChevronRight, Play, RefreshCw, TrendingUp, Users } from "lucide-react";
import Image from "next/image";
import { CountUp } from "@/components/ui/CountUp";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface YTChannel {
  title: string | null;
  custom_url: string | null;
  thumbnail_url: string | null;
  subscriber_count: number;
  video_count: number;
  view_count: number;
}

export interface YTVideo {
  id: string;
  yt_video_id: string;
  title: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  likes_per_view: number | null;
  comments_per_view: number | null;
}

interface YouTubeDashboardProps {
  channel: YTChannel;
  videos: YTVideo[];
  workspaceId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toString();
}

function fmtDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  if (days < 365) return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
  return `Hace ${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? "s" : ""}`;
}

type SortKey = "recent" | "views" | "likes" | "engagement";

// ─── Component ───────────────────────────────────────────────────────────────

export function YouTubeDashboard({ channel, videos, workspaceId }: YouTubeDashboardProps) {
  const [syncing, setSyncing] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("recent");

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await fetch(`/api/v1/sync/youtube?steps=quick&workspace_id=${encodeURIComponent(workspaceId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      window.location.reload();
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  }, [workspaceId]);

  // Sort videos
  const sorted = [...videos].sort((a, b) => {
    switch (sortBy) {
      case "views": return b.view_count - a.view_count;
      case "likes": return b.like_count - a.like_count;
      case "engagement": return (b.likes_per_view ?? 0) - (a.likes_per_view ?? 0);
      default: return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
    }
  });

  // Aggregates
  const totalViews = videos.reduce((s, v) => s + v.view_count, 0);
  const totalLikes = videos.reduce((s, v) => s + v.like_count, 0);
  const totalComments = videos.reduce((s, v) => s + v.comment_count, 0);
  const avgEngagement = totalViews > 0 ? ((totalLikes + totalComments) / totalViews * 100) : 0;
  const kpis = [
    { label: "Views Totales", value: fmt(totalViews), icon: Eye },
    { label: "Suscriptores", value: fmt(channel.subscriber_count), icon: Users },
    { label: "Likes", value: fmt(totalLikes), icon: ThumbsUp },
    { label: "Comentarios", value: fmt(totalComments), icon: MessageSquare },
    { label: "Engagement", value: `${avgEngagement.toFixed(1)}%`, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      {/* Channel Header */}
      <div className="glass-section p-6 flex items-center gap-5">
        {channel.thumbnail_url && (
          <Image
            src={channel.thumbnail_url}
            alt={channel.title ?? "Canal"}
            width={64}
            height={64}
            className="rounded-full"
          />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-[18px] font-light text-white truncate">{channel.title}</h2>
          <p className="text-[13px] text-white/35">{channel.custom_url} · {fmt(channel.subscriber_count)} suscriptores · {channel.video_count} videos</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Sincronizando…" : "Sincronizar"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-5">
        {kpis.map((kpi, i) => (
          <div key={kpi.label} className={`glass-card px-5 py-4 animate-slide-up stagger-${i + 1}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="stat-label">{kpi.label}</p>
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-white/40" style={{ background: "rgba(255,255,255,0.06)" }}>
                <kpi.icon className="h-4 w-4" />
              </div>
            </div>
            <CountUp value={kpi.value} className="stat-number" />
          </div>
        ))}
      </div>

      {/* Videos List */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-light text-white tracking-wide">
            Videos <span className="text-white/30 ml-2 text-[12px]">{videos.length}</span>
          </h3>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[12px] text-white/50 outline-none cursor-pointer"
            style={{ colorScheme: "dark" }}
          >
            <option value="recent">Más recientes</option>
            <option value="views">Más views</option>
            <option value="likes">Más likes</option>
            <option value="engagement">Mejor engagement</option>
          </select>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-12 gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium pb-3 border-b border-white/[0.06] px-2">
          <div className="col-span-5">Video</div>
          <div className="col-span-1 text-right">Views</div>
          <div className="col-span-1 text-right">Likes</div>
          <div className="col-span-1 text-right">Comments</div>
          <div className="col-span-1 text-center">Eng%</div>
          <div className="col-span-1 text-center">Duración</div>
          <div className="col-span-1 text-center">Fecha</div>
          <div className="col-span-1"></div>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-12 text-white/25 text-[13px]">
            No hay videos sincronizados. Click en Sincronizar para traer tus videos.
          </div>
        ) : (
          <div className="space-y-0.5">
            {sorted.map((video) => {
              const eng = video.view_count > 0
                ? ((video.like_count + video.comment_count) / video.view_count * 100)
                : 0;

              return (
                <div
                  key={video.id}
                  className="grid grid-cols-12 gap-2 items-center py-3 rounded-lg hover:bg-white/[0.03] transition-all duration-200 px-2 cursor-pointer group"
                >
                  <div className="col-span-5 flex items-center gap-3 min-w-0">
                    <div className="h-12 w-[85px] rounded-lg overflow-hidden shrink-0 relative bg-white/[0.04]">
                      {video.thumbnail_url ? (
                        <Image src={video.thumbnail_url} alt="" fill className="object-cover" sizes="85px" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Play className="h-4 w-4 text-white/20" />
                        </div>
                      )}
                      {video.duration_seconds && (
                        <div className="absolute bottom-0.5 right-0.5 bg-black/80 text-[9px] text-white/70 px-1 rounded">
                          {fmtDuration(video.duration_seconds)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] text-white/80 truncate group-hover:text-white transition-colors">
                        {video.title || "Sin título"}
                      </p>
                    </div>
                  </div>

                  <div className="col-span-1 text-right text-[13px] font-light text-white/70">{fmt(video.view_count)}</div>
                  <div className="col-span-1 text-right text-[13px] font-light text-white/40">{fmt(video.like_count)}</div>
                  <div className="col-span-1 text-right text-[13px] font-light text-white/40">{fmt(video.comment_count)}</div>
                  <div className="col-span-1 text-center">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      eng >= 8 ? "text-emerald-400 bg-emerald-400/10"
                        : eng >= 4 ? "text-blue-400 bg-blue-400/10"
                        : "text-white/40 bg-white/[0.04]"
                    }`}>
                      {eng.toFixed(1)}%
                    </span>
                  </div>
                  <div className="col-span-1 text-center text-[12px] text-white/35 flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    {fmtDuration(video.duration_seconds)}
                  </div>
                  <div className="col-span-1 text-center text-[11px] text-white/25">{timeAgo(video.published_at)}</div>
                  <div className="col-span-1 text-right">
                    <ChevronRight className="h-4 w-4 text-white/15 group-hover:text-white/40 transition-colors ml-auto" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
