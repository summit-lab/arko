"use client";

import { useState, useCallback, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  LineChart, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import {
  Eye, ThumbsUp, MessageSquare, Clock, ChevronRight, Play,
  RefreshCw, TrendingUp, Users, LayoutDashboard, Video,
  ArrowUpRight, ArrowDownRight, ExternalLink,
} from "lucide-react";
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

type TabKey = "canal" | "videos";
type SortKey = "recent" | "views" | "likes" | "engagement";
type ChartMetric = "views" | "watchtime" | "likes" | "comentarios";

interface DailyMetric {
  metric_date: string;
  view_count: number;
  like_count: number;
  comment_count: number;
}

// ─── Chart metric config ──────────────────────────────────────────────────────

const CHART_METRICS: {
  key: ChartMetric;
  label: string;
  color: string;
  gradId: string;
  unit: string;
}[] = [
  { key: "views",       label: "Views",       color: "#818cf8", gradId: "ytGradViews",    unit: "" },
  { key: "watchtime",   label: "Watch time",  color: "#22d3ee", gradId: "ytGradWatch",    unit: " hrs" },
  { key: "likes",       label: "Likes",       color: "#34d399", gradId: "ytGradLikes",    unit: "" },
  { key: "comentarios", label: "Comentarios", color: "#fb7185", gradId: "ytGradComments", unit: "" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
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

function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

// ─── Chart Tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({
  active, payload, label, unit,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 text-xs space-y-1.5"
      style={{
        background: "rgba(0,0,0,0.9)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
        backdropFilter: "blur(24px)",
      }}
    >
      <p className="text-white/40 text-[11px] mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-white/50 capitalize">{p.name}:</span>
          <span className="text-white font-medium">{fmt(p.value)}{unit ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Video Bar Tooltip ────────────────────────────────────────────────────────

const DARK_TT_STYLE = {
  background: "rgba(0,0,0,0.92)",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 12px 48px rgba(0,0,0,0.7)",
  backdropFilter: "blur(24px)",
  maxWidth: 220,
} as const;

function VideoBarTooltip({
  active, payload, color = "#818cf8", suffix = "",
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { fullTitle: string; date: string } }>;
  color?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl px-4 py-3 text-xs" style={DARK_TT_STYLE}>
      <p className="text-white/35 text-[10px] mb-1">{item.payload.date}</p>
      <p className="text-white/80 text-[11px] mb-2 leading-snug">{item.payload.fullTitle}</p>
      <p style={{ color }} className="font-medium">{fmt(item.value)}{suffix}</p>
    </div>
  );
}

function TimelineTooltip({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { date: string; fullTitle: string; isThis: boolean } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl px-4 py-3 text-xs" style={DARK_TT_STYLE}>
      <p className="text-white/35 text-[10px] mb-1">{item.payload.date}</p>
      {item.payload.isThis && (
        <p className="text-[10px] font-medium mb-1.5" style={{ color: "#818cf8" }}>← Este video</p>
      )}
      <p className="text-white/75 text-[11px] mb-2 leading-snug">{item.payload.fullTitle}</p>
      <p style={{ color: "#818cf8" }} className="font-medium">{fmt(item.value)} views</p>
    </div>
  );
}

function ScatterTooltip({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { title: string; duration: number; views: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl px-4 py-3 text-xs" style={DARK_TT_STYLE}>
      <p className="text-white/75 text-[11px] mb-3 leading-snug">{d.title}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-white/35 text-[10px]">Duración:</span>
          <span className="text-cyan-400 font-medium">{d.duration} min</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/35 text-[10px]">Views:</span>
          <span className="text-violet-400 font-medium">{fmt(d.views)}</span>
        </div>
      </div>
    </div>
  );
}

function DailyMetricTooltip({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { date: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl px-4 py-3 text-xs" style={DARK_TT_STYLE}>
      <p className="text-white/35 text-[10px] mb-1">{item.payload.date}</p>
      <p style={{ color: "#818cf8" }} className="font-medium">{fmt(item.value)} views</p>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  color = "text-white/40",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  trend?: { value: string; positive: boolean };
  color?: string;
}) {
  return (
    <div className="glass-card px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="stat-label">{label}</p>
        <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      <CountUp value={value} className="stat-number" />
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-[11px] ${trend.positive ? "text-emerald-400" : "text-rose-400"}`}>
          {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {trend.value}
        </div>
      )}
      {sub && !trend && <p className="text-[11px] text-white/30 mt-1.5">{sub}</p>}
    </div>
  );
}

// ─── Canal Tab ────────────────────────────────────────────────────────────────

function CanalTab({ channel, videos, onSync, syncing }: {
  channel: YTChannel;
  videos: YTVideo[];
  onSync: () => void;
  syncing: boolean;
}) {
  const [chartMetric, setChartMetric] = useState<ChartMetric>("views");

  // ── Aggregates ──
  const totalViews    = videos.reduce((s, v) => s + v.view_count, 0);
  const totalLikes    = videos.reduce((s, v) => s + v.like_count, 0);
  const totalComments = videos.reduce((s, v) => s + v.comment_count, 0);
  const totalWatchHrs = Math.round(
    videos.reduce((s, v) => s + (v.duration_seconds ?? 0) * v.view_count / 3600, 0)
  );
  const avgEngagement = totalViews > 0 ? ((totalLikes + totalComments) / totalViews * 100) : 0;
  const avgViews      = videos.length > 0 ? Math.round(totalViews / videos.length) : 0;

  const metricTotals: Record<ChartMetric, number> = {
    views:       totalViews,
    watchtime:   totalWatchHrs,
    likes:       totalLikes,
    comentarios: totalComments,
  };

  // ── Chart data (per-video, chronological) ──
  const chartData = [...videos]
    .filter((v) => v.published_at)
    .sort((a, b) => new Date(a.published_at!).getTime() - new Date(b.published_at!).getTime())
    .map((v) => ({
      date:        fmtDateShort(v.published_at!),
      views:       v.view_count,
      watchtime:   v.duration_seconds ? Math.round(v.duration_seconds * v.view_count / 3600) : 0,
      likes:       v.like_count,
      comentarios: v.comment_count,
    }));

  // ── Top 3 by views for summary card ──
  const top3 = [...videos]
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 3);

  // ── Views per video vertical bar (chronological) ──
  const videoBarData = [...videos]
    .filter((v) => v.published_at)
    .sort((a, b) => new Date(a.published_at!).getTime() - new Date(b.published_at!).getTime())
    .map((v) => ({
      date:      fmtDateShort(v.published_at!),
      fullTitle: v.title ?? "Sin título",
      views:     v.view_count,
    }));

  // ── Engagement % por video (chronological, for bottom bar chart) ──
  const engByVideo = [...videos]
    .filter((v) => v.published_at && v.view_count > 0)
    .sort((a, b) => new Date(a.published_at!).getTime() - new Date(b.published_at!).getTime())
    .map((v) => ({
      date:        fmtDateShort(v.published_at!),
      fullTitle:   v.title ?? "Sin título",
      engagement:  parseFloat(((v.like_count + v.comment_count) / v.view_count * 100).toFixed(2)),
    }));

  // ── Duration vs Views scatter ──
  const durationVsViews = videos
    .filter((v) => v.duration_seconds && v.view_count > 0)
    .map((v) => ({
      duration: Math.round((v.duration_seconds ?? 0) / 60),
      views:    v.view_count,
      title:    v.title ?? "Sin título",
    }));

  // ── Engagement donut ──
  const engData = [
    { name: "Likes",       value: totalLikes,    color: "#818cf8" },
    { name: "Comentarios", value: totalComments, color: "#22d3ee" },
  ].filter((d) => d.value > 0);

  const activeMeta = CHART_METRICS.find((m) => m.key === chartMetric)!;

  return (
    <div className="space-y-6">

      {/* ── Channel header ── */}
      <div className="glass-section p-6 flex items-center gap-5">
        {channel.thumbnail_url ? (
          <div className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-white/10 shrink-0">
            <Image src={channel.thumbnail_url} alt={channel.title ?? "Canal"} fill className="object-cover" sizes="64px" unoptimized />
          </div>
        ) : (
          <div className="h-16 w-16 rounded-full bg-red-500/15 border-2 border-red-500/25 flex items-center justify-center shrink-0">
            <Video className="h-7 w-7 text-red-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-[20px] font-extralight text-white truncate tracking-[-0.02em]">{channel.title}</h2>
          <p className="text-[13px] text-white/35 mt-0.5">
            {channel.custom_url && `${channel.custom_url} · `}
            {fmt(channel.subscriber_count)} suscriptores · {channel.video_count} videos
          </p>
        </div>
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Sincronizando…" : "Sincronizar"}
        </button>
      </div>

      {/* ── KPI cards — period ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <KpiCard icon={Eye}           label="Views período"  value={fmt(totalViews)}    sub={`Prom: ${fmt(avgViews)}/video`} />
        <KpiCard icon={Users}         label="Suscriptores"  value={fmt(channel.subscriber_count)} />
        <KpiCard icon={ThumbsUp}      label="Likes"         value={fmt(totalLikes)}    sub={totalViews > 0 ? `${((totalLikes    / totalViews) * 100).toFixed(2)}% de views` : undefined} />
        <KpiCard icon={MessageSquare} label="Comentarios"   value={fmt(totalComments)} sub={totalViews > 0 ? `${((totalComments / totalViews) * 100).toFixed(2)}% de views` : undefined} />
        <KpiCard icon={TrendingUp}    label="Engagement"    value={`${avgEngagement.toFixed(1)}%`} sub="(L+C) / Views" />
      </div>

      {/* ── Channel analytics (chart + summary card) ── */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-12 gap-5">

          {/* Left: big metric chart */}
          <div className="col-span-12 lg:col-span-8 glass-card p-6 flex flex-col">
            {/* Metric tab switcher */}
            <div className="flex items-center gap-1 mb-5">
              {CHART_METRICS.map((m) => {
                const isActive = chartMetric === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setChartMetric(m.key)}
                    className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 cursor-pointer ${
                      isActive ? "text-white" : "text-white/35 hover:text-white/55 hover:bg-white/[0.04]"
                    }`}
                    style={isActive ? {
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderBottom: `2px solid ${m.color}`,
                    } : { border: "1px solid transparent" }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* Active metric total */}
            <div className="mb-4">
              <p className="text-[32px] font-extralight text-white tracking-[-0.03em]" style={{ color: activeMeta.color }}>
                {fmt(metricTotals[chartMetric])}{activeMeta.unit}
              </p>
              <p className="text-[12px] text-white/35 mt-0.5">
                {chartMetric === "views"       && "Views totales en el período"}
                {chartMetric === "watchtime"   && "Horas estimadas de reproducción"}
                {chartMetric === "likes"       && "Likes totales en el período"}
                {chartMetric === "comentarios" && "Comentarios totales en el período"}
              </p>
            </div>

            {/* Area chart */}
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    {CHART_METRICS.map((m) => (
                      <linearGradient key={m.gradId} id={m.gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={m.color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={m.color} stopOpacity={0}   />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    axisLine={false} tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                    interval={Math.max(0, Math.floor(chartData.length / 6) - 1)}
                  />
                  <YAxis
                    axisLine={false} tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                    tickFormatter={(v: number) => fmt(v)}
                  />
                  <Tooltip
                    content={<ChartTooltip unit={activeMeta.unit} />}
                    cursor={{ stroke: "rgba(255,255,255,0.07)", strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey={chartMetric}
                    name={activeMeta.label}
                    stroke={activeMeta.color}
                    strokeWidth={2}
                    fill={`url(#${activeMeta.gradId})`}
                    dot={chartData.length <= 15 ? { fill: activeMeta.color, r: 3, strokeWidth: 0 } : false}
                    activeDot={{ r: 5, fill: activeMeta.color, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[10px] text-white/20 mt-3">
              Datos por video · ordenados por fecha de publicación
            </p>
          </div>

          {/* Right: channel summary card */}
          <div className="col-span-12 lg:col-span-4 glass-card p-6 flex flex-col">
            <p className="text-[11px] text-white/35 font-medium uppercase tracking-[0.08em] mb-4">
              Canal analytics
            </p>

            {/* Subscribers */}
            <div className="mb-5">
              <p className="text-[11px] text-white/30 mb-1.5">Suscriptores actuales</p>
              <p className="text-[36px] font-extralight text-white tracking-[-0.03em] leading-none">
                {fmt(channel.subscriber_count)}
              </p>
            </div>

            {/* Period summary */}
            <div className="border-t border-white/[0.06] pt-4 mb-5">
              <p className="text-[10px] text-white/25 uppercase tracking-[0.07em] mb-3">
                Período actual · {videos.length} videos
              </p>
              <div className="space-y-2.5">
                {[
                  { label: "Views",       value: fmt(totalViews),            unit: "" },
                  { label: "Watch time",  value: fmt(totalWatchHrs),         unit: " hrs est." },
                  { label: "Likes",       value: fmt(totalLikes),            unit: "" },
                  { label: "Comentarios", value: fmt(totalComments),         unit: "" },
                  { label: "Engagement",  value: `${avgEngagement.toFixed(1)}%`, unit: "" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-[12px] text-white/40">{row.label}</span>
                    <span className="text-[12px] font-light text-white">
                      {row.value}{row.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top content */}
            {top3.length > 0 && (
              <div className="border-t border-white/[0.06] pt-4 flex-1">
                <p className="text-[10px] text-white/25 uppercase tracking-[0.07em] mb-3">
                  Top contenido · período
                </p>
                <div className="space-y-3">
                  {top3.map((v, i) => (
                    <a
                      key={v.id}
                      href={`https://www.youtube.com/watch?v=${v.yt_video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 group hover:bg-white/[0.03] rounded-lg p-1 -m-1 transition-colors"
                    >
                      {/* Rank */}
                      <span className="text-[10px] text-white/20 w-3 shrink-0 text-center">{i + 1}</span>
                      {/* Thumbnail */}
                      <div className="relative h-9 w-16 rounded overflow-hidden shrink-0 bg-white/[0.04]">
                        {v.thumbnail_url ? (
                          <Image src={v.thumbnail_url} alt="" fill className="object-cover" sizes="64px" unoptimized />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Play className="h-3 w-3 text-white/20" />
                          </div>
                        )}
                      </div>
                      {/* Title + views */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white/60 group-hover:text-white/80 transition-colors line-clamp-2 leading-tight">
                          {v.title ?? "Sin título"}
                        </p>
                        <p className="text-[10px] text-white/30 mt-0.5">{fmt(v.view_count)} views</p>
                      </div>
                      <ExternalLink className="h-3 w-3 text-white/15 group-hover:text-white/40 transition-colors shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Views por video — vertical bar chart (full width) ── */}
      {videoBarData.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[13px] font-light text-white/50">Views por video</p>
            <p className="text-[11px] text-white/25">{videoBarData.length} videos · cronológico</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={videoBarData}
              margin={{ top: 4, right: 4, bottom: videoBarData.length > 12 ? 40 : 20, left: 0 }}
            >
              <defs>
                <linearGradient id="ytBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#818cf8" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                angle={videoBarData.length > 12 ? -35 : 0}
                textAnchor={videoBarData.length > 12 ? "end" : "middle"}
                interval={videoBarData.length > 20 ? Math.floor(videoBarData.length / 12) : 0}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                tickFormatter={(v: number) => fmt(v)}
                width={48}
              />
              <Tooltip
                content={<VideoBarTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="views" fill="url(#ytBarGrad)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Bottom row: donut + engagement bar + scatter ── */}
      {videos.length > 0 && (
        <div className="grid grid-cols-12 gap-5">

          {/* 1. Engagement donut */}
          {engData.length > 0 && (
            <div className="col-span-12 lg:col-span-4 glass-card p-6 flex flex-col">
              <p className="text-[13px] font-light text-white/50 mb-4">Engagement desglosado</p>
              <div className="flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={engData} cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={3} dataKey="value">
                      {engData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} opacity={0.85} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "rgba(0,0,0,0.92)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px", color: "white" }}
                      itemStyle={{ color: "white" }}
                      labelStyle={{ color: "rgba(255,255,255,0.4)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-1">
                {engData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-white/40">{d.name}</span>
                    </div>
                    <span className="text-white font-light">{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Engagement % por video */}
          {engByVideo.length > 1 && (
            <div className="col-span-12 lg:col-span-4 glass-card p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[13px] font-light text-white/50">Engagement por video</p>
                <p className="text-[10px] text-white/25">(L+C) / Views</p>
              </div>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={engByVideo}
                    margin={{ top: 4, right: 4, bottom: engByVideo.length > 10 ? 36 : 16, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="ytEngGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#34d399" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0.35} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      axisLine={false} tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                      angle={engByVideo.length > 10 ? -35 : 0}
                      textAnchor={engByVideo.length > 10 ? "end" : "middle"}
                      interval={engByVideo.length > 15 ? Math.floor(engByVideo.length / 8) : 0}
                    />
                    <YAxis
                      axisLine={false} tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                      tickFormatter={(v: number) => `${v}%`}
                      width={36}
                    />
                    <Tooltip
                      content={<VideoBarTooltip color="#34d399" suffix="%" />}
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    />
                    <Bar dataKey="engagement" fill="url(#ytEngGrad)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 3. Duración vs Views scatter */}
          {durationVsViews.length > 1 && (
            <div className="col-span-12 lg:col-span-4 glass-card p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[13px] font-light text-white/50">Duración vs. Views</p>
                <p className="text-[10px] text-white/25">minutos · vistas</p>
              </div>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height={200}>
                  <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      type="number" dataKey="duration" name="Duración"
                      axisLine={false} tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                      tickFormatter={(v: number) => `${v}m`}
                      label={{ value: "min", position: "insideBottomRight", offset: -4, style: { fill: "rgba(255,255,255,0.2)", fontSize: 10 } }}
                    />
                    <YAxis
                      type="number" dataKey="views" name="Views"
                      axisLine={false} tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                      tickFormatter={(v: number) => fmt(v)}
                      width={44}
                    />
                    <ZAxis range={[40, 40]} />
                    <Tooltip
                      content={<ScatterTooltip />}
                      cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.15)" }}
                    />
                    <Scatter data={durationVsViews} fill="#22d3ee" opacity={0.7} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-white/20 mt-2 text-center">
                Cada punto es un video
              </p>
            </div>
          )}

        </div>
      )}

      {/* ── Empty state ── */}
      {videos.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Video className="h-10 w-10 text-white/15 mx-auto mb-3" />
          <p className="text-white/35 text-sm">No hay videos en este período.</p>
          <p className="text-white/20 text-xs mt-1">Cambiá el filtro de fechas o sincronizá tu canal.</p>
        </div>
      )}
    </div>
  );
}

// ─── Video Analytics View ─────────────────────────────────────────────────────

type VidDetailTab = "overview" | "alcance" | "engagement";

const VID_DETAIL_TABS: { key: VidDetailTab; label: string }[] = [
  { key: "overview",   label: "Overview"   },
  { key: "alcance",    label: "Alcance"    },
  { key: "engagement", label: "Engagement" },
];

function VideoAnalyticsView({
  video,
  allVideos,
  workspaceId,
  onBack,
}: {
  video: YTVideo;
  allVideos: YTVideo[];
  workspaceId: string;
  onBack: () => void;
}) {
  const [tab, setTab]               = useState<VidDetailTab>("overview");
  const [chartMetric, setChartMetric] = useState<"views" | "watchtime" | "likes" | "comentarios">("views");
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);

  useEffect(() => {
    fetch(`/api/v1/youtube/video-metrics?video_id=${video.id}&workspace_id=${encodeURIComponent(workspaceId)}`)
      .then((r) => r.json())
      .then((d) => { if (d?.data?.metrics) setDailyMetrics(d.data.metrics); })
      .catch(() => {});
  }, [video.id, workspaceId]);

  // ── Core metrics ──
  const eng         = video.view_count > 0 ? (video.like_count + video.comment_count) / video.view_count * 100 : 0;
  const likeRate    = video.view_count > 0 ? video.like_count    / video.view_count * 100 : 0;
  const commentRate = video.view_count > 0 ? video.comment_count / video.view_count * 100 : 0;
  const watchHrs    = (video.duration_seconds ?? 0) * video.view_count / 3600;

  // ── Channel averages ──
  const peers          = allVideos.filter((v) => v.view_count > 0);
  const avgViews       = peers.length > 0 ? peers.reduce((s, v) => s + v.view_count, 0) / peers.length : 0;
  const avgLikeRate    = peers.length > 0 ? peers.reduce((s, v) => s + v.like_count    / v.view_count * 100, 0) / peers.length : 0;
  const avgCommentRate = peers.length > 0 ? peers.reduce((s, v) => s + v.comment_count / v.view_count * 100, 0) / peers.length : 0;
  const avgEng         = peers.length > 0 ? peers.reduce((s, v) => s + (v.like_count + v.comment_count) / v.view_count * 100, 0) / peers.length : 0;

  // ── Rankings ──
  const viewsRank = [...allVideos].sort((a, b) => b.view_count - a.view_count).findIndex((v) => v.id === video.id) + 1;
  const engRank   = [...peers].sort((a, b) => ((b.like_count + b.comment_count) / b.view_count) - ((a.like_count + a.comment_count) / a.view_count)).findIndex((v) => v.id === video.id) + 1;

  // ── Comparison chart: top 12 by views, this video highlighted ──
  const compMetaMap = {
    views:       { color: "#818cf8", label: "Views",       unit: "" },
    watchtime:   { color: "#22d3ee", label: "Watch time",  unit: " hrs" },
    likes:       { color: "#34d399", label: "Likes",       unit: "" },
    comentarios: { color: "#fb7185", label: "Comentarios", unit: "" },
  } as const;
  const compData = [...allVideos]
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 12)
    .map((v) => ({
      title:       (v.title ?? "Sin título").slice(0, 22) + ((v.title?.length ?? 0) > 22 ? "…" : ""),
      views:       v.view_count,
      watchtime:   Math.round((v.duration_seconds ?? 0) * v.view_count / 3600),
      likes:       v.like_count,
      comentarios: v.comment_count,
      isThis:      v.id === video.id,
    }));
  const compMeta = compMetaMap[chartMetric];

  // ── Daily views chart data ──
  const dailyChartData = dailyMetrics.map((d) => ({
    date: new Date(d.metric_date).toLocaleDateString("es", { day: "numeric", month: "short" }),
    views: d.view_count,
  }));

  // ── Funnel width (logarithmic) ──
  function funnelWidth(val: number): number {
    if (video.view_count <= 0 || val <= 0) return 18;
    return Math.max(20, Math.min(100, (Math.log(val + 1) / Math.log(video.view_count + 1)) * 100));
  }

  // ── Engagement donut ──
  const engDonut = [
    { name: "Likes",       value: video.like_count,    color: "#818cf8" },
    { name: "Comentarios", value: video.comment_count, color: "#22d3ee" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-5">

      {/* ── Back button ── */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[13px] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
        Volver a videos
      </button>

      {/* ── Video header ── */}
      <div className="glass-section p-6 flex items-start gap-5">
        <div className="relative h-24 w-[170px] rounded-xl overflow-hidden shrink-0 bg-white/[0.04] border border-white/[0.06]">
          {video.thumbnail_url ? (
            <Image src={video.thumbnail_url} alt="" fill className="object-cover" sizes="170px" unoptimized />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Play className="h-6 w-6 text-white/20" />
            </div>
          )}
          {video.duration_seconds && (
            <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white/80 px-1.5 py-0.5 rounded">
              {fmtDuration(video.duration_seconds)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[18px] font-extralight text-white tracking-[-0.02em] leading-snug mb-2">
            {video.title ?? "Sin título"}
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/35">
            {video.published_at && (
              <span>Publicado {new Date(video.published_at).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}</span>
            )}
            {video.duration_seconds && <span>{fmtDuration(video.duration_seconds)}</span>}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-[24px] font-extralight text-white">{fmt(video.view_count)}</span>
            <span className="text-[12px] text-white/35">views</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20">
              #{viewsRank} en el período
            </span>
          </div>
        </div>
        <a
          href={`https://www.youtube.com/watch?v=${video.yt_video_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[12px] text-red-400/50 hover:text-red-400 transition-colors shrink-0 mt-1"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ver en YouTube
        </a>
      </div>

      {/* ── Tab bar (underline style, like YT Studio) ── */}
      <div className="flex items-end border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {VID_DETAIL_TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-[13px] font-medium transition-all cursor-pointer border-b-2 -mb-px ${
                isActive
                  ? "text-white border-white/60"
                  : "text-white/35 border-transparent hover:text-white/55 hover:border-white/20"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ════════════════ OVERVIEW ════════════════ */}
      {tab === "overview" && (
        <div className="space-y-5">

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: "Views",
                value: fmt(video.view_count),
                sub: video.view_count >= avgViews
                  ? `+${fmt(Math.round(video.view_count - avgViews))} vs promedio`
                  : `-${fmt(Math.round(avgViews - video.view_count))} vs promedio`,
                ok: video.view_count >= avgViews,
              },
              {
                label: "Watch time est.",
                value: `${watchHrs < 10 ? watchHrs.toFixed(1) : fmt(Math.round(watchHrs))} hrs`,
                sub: "duración × views / 3600",
                ok: null as boolean | null,
              },
              {
                label: "Likes",
                value: fmt(video.like_count),
                sub: `${likeRate.toFixed(2)}% de views`,
                ok: null as boolean | null,
              },
              {
                label: "Comentarios",
                value: fmt(video.comment_count),
                sub: `${commentRate.toFixed(2)}% de views`,
                ok: null as boolean | null,
              },
            ].map((card) => (
              <div key={card.label} className="glass-card px-5 py-4">
                <p className="stat-label mb-3">{card.label}</p>
                <p className="stat-number">{card.value}</p>
                <p className={`text-[11px] mt-1.5 ${
                  card.ok === null ? "text-white/30" : card.ok ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {card.sub}
                </p>
              </div>
            ))}
          </div>

          {/* Metric switcher + comparison horizontal bar chart */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="text-[13px] font-light text-white/50">Este video vs. top del período</p>
              <div className="flex items-center gap-1">
                {(["views", "watchtime", "likes", "comentarios"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setChartMetric(m)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                      chartMetric === m ? "text-white" : "text-white/30 hover:text-white/50 hover:bg-white/[0.04]"
                    }`}
                    style={chartMetric === m ? {
                      background: "rgba(255,255,255,0.07)",
                      border: `1px solid rgba(255,255,255,0.12)`,
                      borderBottom: `2px solid ${compMeta.color}`,
                    } : { border: "1px solid transparent" }}
                  >
                    {compMetaMap[m].label}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={compData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickFormatter={(v: number) => fmt(v)} />
                <YAxis type="category" dataKey="title" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} width={150} />
                <Tooltip
                  contentStyle={{ background: "rgba(0,0,0,0.92)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px", color: "white" }}
                  itemStyle={{ color: "white" }}
                  labelStyle={{ color: "rgba(255,255,255,0.4)" }}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar dataKey={chartMetric} name={compMeta.label} radius={[0, 4, 4, 0]}>
                  {compData.map((entry, i) => (
                    <Cell key={i} fill={entry.isThis ? compMeta.color : "rgba(255,255,255,0.08)"} opacity={entry.isThis ? 0.9 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-white/20 mt-2 text-center">Barra resaltada = este video</p>
          </div>

          {/* Performance vs channel avg */}
          <div className="glass-card p-6">
            <p className="text-[13px] font-light text-white/50 mb-5">Rendimiento vs. promedio del canal</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { label: "Views",        thisVal: video.view_count, avg: avgViews,       fmtFn: (v: number) => fmt(Math.round(v)) },
                { label: "Like rate",    thisVal: likeRate,         avg: avgLikeRate,    fmtFn: (v: number) => `${v.toFixed(2)}%` },
                { label: "Comment rate", thisVal: commentRate,      avg: avgCommentRate, fmtFn: (v: number) => `${v.toFixed(2)}%` },
                { label: "Engagement",   thisVal: eng,              avg: avgEng,         fmtFn: (v: number) => `${v.toFixed(2)}%` },
              ].map((row) => {
                const delta    = row.avg > 0 ? ((row.thisVal - row.avg) / row.avg * 100) : 0;
                const positive = row.thisVal >= row.avg;
                return (
                  <div key={row.label} className="text-center">
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">{row.label}</p>
                    <p className="text-[22px] font-extralight text-white">{row.fmtFn(row.thisVal)}</p>
                    <div className={`flex items-center justify-center gap-1 mt-1 text-[11px] ${positive ? "text-emerald-400" : "text-rose-400"}`}>
                      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(delta).toFixed(0)}% vs avg
                    </div>
                    <p className="text-[10px] text-white/20 mt-0.5">avg: {row.fmtFn(row.avg)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily views line chart */}
          {dailyChartData.length > 1 && (
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[13px] font-light text-white/50">Evolución de views</p>
                  <p className="text-[11px] text-white/25 mt-0.5">
                    {dailyChartData.length} días de datos · desde publicación
                  </p>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-300/60 border border-violet-500/15">
                  {fmt(video.view_count)} views totales
                </span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="dailyViewsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                    interval={Math.max(0, Math.floor(dailyChartData.length / 6) - 1)}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                    tickFormatter={(v: number) => fmt(v)}
                    width={48}
                  />
                  <Tooltip
                    content={<DailyMetricTooltip />}
                    cursor={{ stroke: "rgba(255,255,255,0.07)", strokeWidth: 1 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="#818cf8"
                    strokeWidth={2}
                    dot={dailyChartData.length <= 30 ? { fill: "#818cf8", r: 2.5, strokeWidth: 0 } : false}
                    activeDot={{ r: 5, fill: "#818cf8", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>
      )}

      {/* ════════════════ ALCANCE ════════════════ */}
      {tab === "alcance" && (
        <div className="space-y-5">

          {/* Clean stacked funnel */}
          <div className="glass-card p-6">
            <p className="text-[13px] font-light text-white/50 mb-6">Conversión de audiencia</p>
            <div>
              {[
                {
                  label:     "Views totales",
                  display:   fmt(video.view_count),
                  barPct:    100,
                  color:     "#818cf8",
                  connector: null,
                },
                {
                  label:     "Likes",
                  display:   fmt(video.like_count),
                  barPct:    Math.max(3, likeRate * 4),
                  color:     "#34d399",
                  connector: `${likeRate.toFixed(2)}% like rate`,
                },
                {
                  label:     "Comentarios",
                  display:   fmt(video.comment_count),
                  barPct:    Math.max(2, commentRate * 8),
                  color:     "#22d3ee",
                  connector: `${commentRate.toFixed(2)}% comment rate`,
                },
                {
                  label:     "Engagement total",
                  display:   `${eng.toFixed(2)}%`,
                  barPct:    Math.max(3, Math.min(100, eng * 4)),
                  color:     "#f59e0b",
                  connector: `${eng.toFixed(2)}% engagement`,
                },
              ].map((step, i) => (
                <div key={i}>
                  {/* Connector between steps */}
                  {step.connector && (
                    <div className="flex items-center gap-3 py-3 pl-1">
                      <div className="h-5 w-px bg-white/[0.07] ml-4 shrink-0" />
                      <span className="text-[11px] text-white/30">{step.connector}</span>
                    </div>
                  )}

                  {/* Step card */}
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ border: `1px solid ${step.color}22`, background: `${step.color}0a` }}
                  >
                    <div className="flex items-center justify-between px-5 py-4">
                      <span className="text-[13px] font-light text-white/50">{step.label}</span>
                      <span className="text-[26px] font-extralight" style={{ color: step.color }}>
                        {step.display}
                      </span>
                    </div>
                    {/* Thin progress bar */}
                    <div className="h-[3px] w-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${step.barPct}%`, background: step.color, opacity: 0.55 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rate comparison cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Like rate",        value: `${likeRate.toFixed(2)}%`,    avg: avgLikeRate,    positive: likeRate >= avgLikeRate },
              { label: "Comment rate",     value: `${commentRate.toFixed(2)}%`, avg: avgCommentRate, positive: commentRate >= avgCommentRate },
              { label: "Engagement total", value: `${eng.toFixed(2)}%`,         avg: avgEng,         positive: eng >= avgEng },
            ].map((card) => (
              <div key={card.label} className="glass-card px-5 py-5 text-center">
                <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">{card.label}</p>
                <p className="text-[26px] font-extralight text-white">{card.value}</p>
                <div className={`flex items-center justify-center gap-1 mt-2 text-[11px] ${card.positive ? "text-emerald-400" : "text-rose-400"}`}>
                  {card.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  vs {card.avg.toFixed(2)}% promedio
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ════════════════ ENGAGEMENT ════════════════ */}
      {tab === "engagement" && (
        <div className="space-y-5">

          {/* Big engagement number */}
          <div className="glass-card p-8 text-center">
            <p className="text-[11px] text-white/35 uppercase tracking-[0.1em] mb-3">Engagement rate</p>
            <p className="text-[64px] font-extralight tracking-[-0.03em]" style={{ color: eng >= avgEng ? "#34d399" : "#818cf8" }}>
              {eng.toFixed(2)}%
            </p>
            <p className="text-[13px] text-white/35 mt-2">(Likes + Comentarios) / Views</p>
            <div className={`inline-flex items-center gap-1.5 mt-3 text-[12px] ${eng >= avgEng ? "text-emerald-400" : "text-rose-400"}`}>
              {eng >= avgEng ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(eng - avgEng).toFixed(2)}pp vs promedio del canal ({avgEng.toFixed(2)}%)
            </div>
          </div>

          <div className="grid grid-cols-12 gap-5">
            {/* Donut */}
            {engDonut.length > 0 && (
              <div className="col-span-12 lg:col-span-5 glass-card p-6 flex flex-col">
                <p className="text-[13px] font-light text-white/50 mb-4">Desglose de interacciones</p>
                <div className="flex-1 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={engDonut} cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={3} dataKey="value">
                        {engDonut.map((entry, idx) => <Cell key={idx} fill={entry.color} opacity={0.85} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "rgba(0,0,0,0.92)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px", color: "white" }}
                        itemStyle={{ color: "white" }}
                        labelStyle={{ color: "rgba(255,255,255,0.4)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-1">
                  {engDonut.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                        <span className="text-white/40">{d.name}</span>
                      </div>
                      <span className="text-white font-light">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress bars vs channel avg */}
            <div className="col-span-12 lg:col-span-7 glass-card p-6">
              <p className="text-[13px] font-light text-white/50 mb-5">Métricas vs. promedio del canal</p>
              <div className="space-y-6">
                {[
                  { label: "Like rate",    count: video.like_count,    rate: likeRate,    avg: avgLikeRate,    color: "#818cf8" },
                  { label: "Comment rate", count: video.comment_count, rate: commentRate, avg: avgCommentRate, color: "#22d3ee" },
                  { label: "Engagement",   count: null,                rate: eng,         avg: avgEng,         color: "#34d399" },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] text-white/50">{row.label}</span>
                      <div className="flex items-center gap-3">
                        {row.count !== null && <span className="text-[11px] text-white/30">{fmt(row.count)}</span>}
                        <span className="text-[13px] font-light text-white">{row.rate.toFixed(2)}%</span>
                      </div>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-white/[0.06] overflow-visible">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full"
                        style={{ width: `${Math.min(100, row.rate * 8)}%`, background: row.color, opacity: 0.75 }}
                      />
                      <div
                        className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-white/35"
                        style={{ left: `${Math.min(100, row.avg * 8)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-white/25 mt-1.5">
                      Promedio canal: {row.avg.toFixed(2)}%
                      {row.rate >= row.avg
                        ? <span className="text-emerald-400 ml-2">▲ {(row.rate - row.avg).toFixed(2)}pp por encima</span>
                        : <span className="text-rose-400 ml-2">▼ {(row.avg - row.rate).toFixed(2)}pp por debajo</span>
                      }
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rank badges */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-5 text-center">
              <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Ranking por views</p>
              <p className="text-[36px] font-extralight text-violet-400">#{viewsRank}</p>
              <p className="text-[11px] text-white/30 mt-1">de {allVideos.length} videos en el período</p>
            </div>
            <div className="glass-card p-5 text-center">
              <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Ranking por engagement</p>
              <p className="text-[36px] font-extralight text-cyan-400">#{engRank}</p>
              <p className="text-[11px] text-white/30 mt-1">de {peers.length} videos con views</p>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

// ─── Videos Tab ───────────────────────────────────────────────────────────────

function VideosTab({ videos, workspaceId }: { videos: YTVideo[]; workspaceId: string }) {
  const [sortBy, setSortBy]           = useState<SortKey>("recent");
  const [selectedVideo, setSelectedVideo] = useState<YTVideo | null>(null);

  // Show analytics view when a video is selected
  if (selectedVideo) {
    return <VideoAnalyticsView video={selectedVideo} allVideos={videos} workspaceId={workspaceId} onBack={() => setSelectedVideo(null)} />;
  }

  const sorted = [...videos].sort((a, b) => {
    switch (sortBy) {
      case "views":      return b.view_count  - a.view_count;
      case "likes":      return b.like_count  - a.like_count;
      case "engagement": return (b.likes_per_view ?? 0) - (a.likes_per_view ?? 0);
      default:           return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
    }
  });

  const totalViews    = videos.reduce((s, v) => s + v.view_count, 0);
  const totalLikes    = videos.reduce((s, v) => s + v.like_count, 0);
  const totalComments = videos.reduce((s, v) => s + v.comment_count, 0);
  const avgViews      = videos.length > 0 ? totalViews / videos.length : 0;

  return (
    <div className="space-y-4">

      {/* Summary strip */}
      {videos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {[
            { label: "Videos",         value: fmt(videos.length),        icon: Play          },
            { label: "Views totales",  value: fmt(totalViews),           icon: Eye           },
            { label: "Views promedio", value: fmt(Math.round(avgViews)), icon: TrendingUp    },
            { label: "Likes totales",  value: fmt(totalLikes),           icon: ThumbsUp      },
            { label: "Comentarios",    value: fmt(totalComments),        icon: MessageSquare },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4 text-center">
              <s.icon className="h-3.5 w-3.5 text-white/25 mx-auto mb-2" />
              <p className="text-[18px] font-light text-white">{s.value}</p>
              <p className="text-[10px] text-white/25 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
          <h3 className="text-[14px] font-light text-white/50">
            Videos <span className="text-white/25 ml-1 text-[12px]">{videos.length}</span>
          </h3>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[11px] text-white/45 outline-none cursor-pointer"
            style={{ colorScheme: "dark" }}
          >
            <option value="recent">Más recientes</option>
            <option value="views">Más views</option>
            <option value="likes">Más likes</option>
            <option value="engagement">Mejor engagement</option>
          </select>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-12 gap-2 text-[10px] text-white/25 uppercase tracking-[0.1em] font-medium px-6 py-3 border-b border-white/[0.04]">
          <div className="col-span-6">Video</div>
          <div className="col-span-2 text-right">Views</div>
          <div className="col-span-1 text-right">Likes</div>
          <div className="col-span-1 text-right">Coment.</div>
          <div className="col-span-1 text-center">Eng%</div>
          <div className="col-span-1 text-center">Dur.</div>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-12 text-white/25 text-[13px]">
            No hay videos sincronizados. Click en Sincronizar para traer tus videos.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {sorted.map((video) => {
              const eng   = video.view_count > 0 ? ((video.like_count + video.comment_count) / video.view_count * 100) : 0;
              const isTop = avgViews > 0 && video.view_count >= avgViews * 2.5;

              return (
                <div
                  key={video.id}
                  onClick={() => setSelectedVideo(video)}
                  className="grid grid-cols-12 gap-2 items-center py-3.5 px-6 hover:bg-white/[0.025] transition-colors cursor-pointer group"
                >
                  {/* Thumbnail + title */}
                  <div className="col-span-6 flex items-center gap-3 min-w-0">
                    <div className="relative h-[52px] w-[92px] rounded-lg overflow-hidden shrink-0 bg-white/[0.04] border border-white/[0.06]">
                      {video.thumbnail_url ? (
                        <Image src={video.thumbnail_url} alt="" fill className="object-cover" sizes="92px" unoptimized />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Play className="h-4 w-4 text-white/20" />
                        </div>
                      )}
                      {isTop && (
                        <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-400 border border-black animate-pulse" />
                      )}
                      {video.duration_seconds && (
                        <div className="absolute bottom-0.5 right-0.5 bg-black/80 text-[9px] text-white/70 px-1 rounded">
                          {fmtDuration(video.duration_seconds)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] text-white/80 group-hover:text-white transition-colors line-clamp-2 leading-snug">
                        {video.title || "Sin título"}
                      </p>
                      <p className="text-[10px] text-white/25 mt-1">{timeAgo(video.published_at)}</p>
                    </div>
                  </div>

                  <div className="col-span-2 text-right text-[13px] font-light text-white/75">{fmt(video.view_count)}</div>
                  <div className="col-span-1 text-right text-[12px] text-white/40">{fmt(video.like_count)}</div>
                  <div className="col-span-1 text-right text-[12px] text-white/40">{fmt(video.comment_count)}</div>
                  <div className="col-span-1 text-center">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      eng >= 8 ? "text-emerald-400 bg-emerald-400/10"
                        : eng >= 4 ? "text-blue-400 bg-blue-400/10"
                        : "text-white/35 bg-white/[0.04]"
                    }`}>
                      {eng.toFixed(1)}%
                    </span>
                  </div>
                  <div className="col-span-1 text-center text-[11px] text-white/30">
                    {fmtDuration(video.duration_seconds)}
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

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "canal",  label: "Canal",  icon: LayoutDashboard },
  { key: "videos", label: "Videos", icon: Video },
];

export function YouTubeDashboard({ channel, videos, workspaceId }: YouTubeDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("canal");
  const [syncing, setSyncing]     = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div
        className="inline-flex items-center gap-1 p-1 rounded-full"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer ${
                active ? "text-white" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
              style={active ? {
                background: "rgba(255,255,255,0.1)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.22)",
                boxShadow: "0 1px 16px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.2)",
              } : undefined}
            >
              <tab.icon size={13} strokeWidth={active ? 2.2 : 1.6} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "canal" && (
        <CanalTab channel={channel} videos={videos} onSync={handleSync} syncing={syncing} />
      )}
      {activeTab === "videos" && (
        <VideosTab videos={videos} workspaceId={workspaceId} />
      )}
    </div>
  );
}
