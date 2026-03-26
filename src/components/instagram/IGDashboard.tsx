"use client";

import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Eye, Users, TrendingUp, Heart, MessageSquare, Bookmark,
  Trophy, Play, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import Image from "next/image";
import { CountUp } from "@/components/ui/CountUp";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DayInsight {
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
}

interface ReelSummary {
  id: string;
  caption: string | null;
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
}

interface IGDashboardProps {
  dailyInsights: DayInsight[];
  reels: ReelSummary[];
  totalFollowers: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-").map(Number);
  if (!month || !day) return dateStr;
  const d = new Date(Date.UTC(2026, (month ?? 1) - 1, day));
  return `${day} ${d.toLocaleString("es", { month: "short", timeZone: "UTC" })}`;
}

function pctChange(current: number, previous: number): { value: string; positive: boolean } {
  if (previous === 0) return { value: "+0%", positive: true };
  const pct = ((current - previous) / previous) * 100;
  return { value: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, positive: pct >= 0 };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DashChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const impressions = payload.find((p) => p.dataKey === "impressions");
  const reach = payload.find((p) => p.dataKey === "reach");
  return (
    <div
      className="rounded-lg border border-white/[0.08] px-3.5 py-2.5"
      style={{
        background: "rgba(12,12,20,0.94)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.6), 0 0 20px rgba(129,140,248,0.06), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <p className="text-white/30 text-[9px] font-medium uppercase tracking-[0.1em] mb-1.5">{label}</p>
      <div className="flex gap-5">
        {impressions && (
          <div>
            <p className="text-[9px] text-white/35 uppercase tracking-[0.06em]">Impresiones</p>
            <div className="flex items-baseline gap-1">
              <span className="text-[18px] font-light tracking-[-0.02em] text-white">{fmt(impressions.value)}</span>
              <ArrowUpRight className="h-3 w-3 text-emerald-400" />
            </div>
          </div>
        )}
        {reach && (
          <div>
            <p className="text-[9px] text-white/35 uppercase tracking-[0.06em]">Alcance</p>
            <div className="flex items-baseline gap-1">
              <span className="text-[18px] font-light tracking-[-0.02em] text-cyan-400">{fmt(reach.value)}</span>
              <ArrowUpRight className="h-3 w-3 text-emerald-400" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill: string } }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border border-white/[0.08] px-3 py-2"
      style={{
        background: "rgba(10,10,20,0.92)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
      }}
    >
      {payload.map((entry) => (
        <p key={entry.name} className="text-[13px] font-light" style={{ color: entry.payload.fill }}>
          {entry.name}: {fmt(entry.value)}
        </p>
      ))}
    </div>
  );
}

function ChartCursor({ points, height }: { points?: Array<{ x: number; y: number }>; height?: number }) {
  if (!points?.[0]) return null;
  return (
    <line
      x1={points[0].x}
      y1={0}
      x2={points[0].x}
      y2={height ?? 220}
      stroke="rgba(129,140,248,0.3)"
      strokeWidth={1}
      strokeDasharray="4 3"
    />
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function IGDashboard({ dailyInsights, reels, totalFollowers }: IGDashboardProps) {
  if (dailyInsights.length === 0 && reels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Eye className="h-12 w-12 text-zinc-600 mb-4" />
        <h3 className="text-lg font-light text-zinc-300">Sin datos disponibles</h3>
        <p className="mt-2 text-sm text-zinc-500 max-w-md">
          Sincroniza tu cuenta de Instagram para ver el dashboard completo.
        </p>
      </div>
    );
  }

  // ── Compute aggregates ──
  const sorted = [...dailyInsights].sort((a, b) => a.metric_date.localeCompare(b.metric_date));
  const halfIdx = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, halfIdx);
  const secondHalf = sorted.slice(halfIdx);

  const totalImpressions = sorted.reduce((s, d) => s + d.impressions, 0);
  const totalReach = sorted.reduce((s, d) => s + d.reach, 0);
  const totalProfileViews = sorted.reduce((s, d) => s + d.profile_views, 0);
  const totalLikes = sorted.reduce((s, d) => s + d.likes, 0);
  const totalComments = sorted.reduce((s, d) => s + d.comments, 0);
  // follower_count is a daily net change (delta) from Meta — sum directly
  const totalFollowersGained = sorted.reduce((s, d) => s + d.follower_count, 0);

  // Period-over-period comparison
  const firstHalfImpressions = firstHalf.reduce((s, d) => s + d.impressions, 0);
  const secondHalfImpressions = secondHalf.reduce((s, d) => s + d.impressions, 0);
  const impressionsTrend = pctChange(secondHalfImpressions, firstHalfImpressions);

  const firstHalfProfileViews = firstHalf.reduce((s, d) => s + d.profile_views, 0);
  const secondHalfProfileViews = secondHalf.reduce((s, d) => s + d.profile_views, 0);
  const profileViewsTrend = pctChange(secondHalfProfileViews, firstHalfProfileViews);

  // Conversion rate: profile_views → followers
  const conversionRate = totalProfileViews > 0
    ? ((totalFollowersGained / totalProfileViews) * 100).toFixed(1)
    : "0";

  // Organic vs Paid split
  const totalViewsOrg = reels.reduce((s, r) => s + r.views_org, 0);
  const totalViewsPaid = reels.reduce((s, r) => s + r.views_paid, 0);
  const totalViewsAll = totalViewsOrg + totalViewsPaid;
  const orgPct = totalViewsAll > 0 ? Math.round((totalViewsOrg / totalViewsAll) * 100) : 100;
  const paidPct = 100 - orgPct;

  // Chart data
  const chartData = sorted.map((d) => ({
    date: fmtDate(d.metric_date),
    impressions: d.impressions,
    reach: d.reach,
  }));

  // Best reel by views
  const sortedReels = [...reels].sort((a, b) => b.views_total - a.views_total);
  const bestReel = sortedReels[0] ?? null;
  const recentReels = sortedReels.slice(0, 7);

  // Pie data for organic vs paid
  const trafficPieData = [
    { name: "Orgánico", value: totalViewsOrg },
    ...(totalViewsPaid > 0 ? [{ name: "Pagado", value: totalViewsPaid }] : []),
  ];
  const PIE_COLORS_TRAFFIC = ["#818cf8", "#f472b6"];

  return (
    <div className="space-y-6">
      {/* ═══ ROW 1: Main chart + side KPIs ═══ */}
      <div className="grid grid-cols-12 gap-5">
        {/* ── Rendimiento de visitas (8 cols) ── */}
        <div className="col-span-12 lg:col-span-8 glass-section p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="stat-label mb-1">Rendimiento de visitas</p>
              <div className="flex items-baseline gap-6">
                <div>
                  <span className="stat-number-xl">{fmt(totalImpressions)}</span>
                  <span className="ml-2 text-[11px] text-white/30 uppercase tracking-[0.06em]">Impresiones</span>
                </div>
                <div>
                  <span className="text-[28px] font-light tracking-[-0.02em] text-cyan-400">{fmt(totalReach)}</span>
                  <span className="ml-2 text-[11px] text-white/30 uppercase tracking-[0.06em]">Alcance</span>
                </div>
              </div>
            </div>
            <div className={`flex items-center gap-1 text-[13px] font-medium ${impressionsTrend.positive ? "text-emerald-400" : "text-rose-400"}`}>
              {impressionsTrend.positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {impressionsTrend.value}
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="dashImpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.35} />
                    <stop offset="40%" stopColor="#818cf8" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashReachGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.25} />
                    <stop offset="40%" stopColor="#22d3ee" stopOpacity={0.06} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  {/* Glow filters for neon lines */}
                  <filter id="glowViolet" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feFlood floodColor="#818cf8" floodOpacity="0.6" result="color" />
                    <feComposite in="color" in2="blur" operator="in" result="glow" />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feFlood floodColor="#22d3ee" floodOpacity="0.5" result="color" />
                    <feComposite in="color" in2="blur" operator="in" result="glow" />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  {/* Active dot glow */}
                  <filter id="dotGlow">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.floor(chartData.length / 6) - 1)}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  tickFormatter={(v: number) => fmt(v)}
                />
                <Tooltip
                  content={<DashChartTooltip />}
                  cursor={<ChartCursor />}
                />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  name="Impresiones"
                  stroke="#818cf8"
                  fill="url(#dashImpGrad)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: "#818cf8", stroke: "#c4b5fd", strokeWidth: 2, filter: "url(#dotGlow)" }}
                  style={{ filter: "url(#glowViolet)" }}
                />
                <Area
                  type="monotone"
                  dataKey="reach"
                  name="Alcance"
                  stroke="#22d3ee"
                  fill="url(#dashReachGrad)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#22d3ee", stroke: "#67e8f9", strokeWidth: 2, filter: "url(#dotGlow)" }}
                  style={{ filter: "url(#glowCyan)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Side KPIs (4 cols) ── */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">
          {/* Conversión de perfil */}
          <div className="glass-card p-6 flex-1">
            <div className="flex items-center justify-between mb-3">
              <p className="stat-label">Conversión de perfil</p>
              <div className="flex h-9 w-9 items-center justify-center rounded-full text-violet-400"
                style={{ background: "rgba(255,255,255,0.06)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)" }}>
                <TrendingUp className="h-[16px] w-[16px]" />
              </div>
            </div>
            <CountUp value={`${conversionRate}%`} className="stat-number-xl text-violet-400" />
            <div className="flex items-center gap-4 mt-2">
              <span className="text-[13px] font-light text-white/50">{fmt(totalProfileViews)} visitas</span>
              <span className="text-[13px] font-light text-white/50">→ {fmt(totalFollowersGained)} seguidores</span>
            </div>
            <div className={`flex items-center gap-1 mt-2 text-[12px] font-medium ${profileViewsTrend.positive ? "text-emerald-400" : "text-rose-400"}`}>
              {profileViewsTrend.positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {profileViewsTrend.value} vs período anterior
            </div>
          </div>

          {/* Crecimiento de perfil */}
          <div className="glass-card p-6 flex-1">
            <div className="flex items-center justify-between mb-3">
              <p className="stat-label">Crecimiento de perfil</p>
              <div className="flex h-9 w-9 items-center justify-center rounded-full text-emerald-400"
                style={{ background: "rgba(255,255,255,0.06)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)" }}>
                <Users className="h-[16px] w-[16px]" />
              </div>
            </div>
            <CountUp value={fmt(totalFollowers)} className="stat-number-xl" />
            <p className="text-[13px] font-light text-emerald-400 mt-1">+{fmt(followersGainedLast30d)} últimos 30 días</p>
          </div>
        </div>
      </div>

      {/* ═══ ROW 2: Desglose + Interacciones + Mejor Reel ═══ */}
      <div className="grid grid-cols-12 gap-5">
        {/* ── Desglose orgánico/pagado (4 cols) ── */}
        <div className="col-span-12 md:col-span-4 glass-card p-6">
          <p className="stat-label mb-5">Desglose de tráfico</p>
          <div className="flex items-center gap-6">
            <div className="h-[140px] w-[140px] neon-line-violet">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={trafficPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={64}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {trafficPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS_TRAFFIC[i % PIE_COLORS_TRAFFIC.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#818cf8" }} />
                <div>
                  <p className="text-[12px] text-white/40">Orgánico</p>
                  <p className="text-[18px] font-light text-white">{orgPct}%</p>
                </div>
              </div>
              {totalViewsPaid > 0 && (
                <div className="flex items-center gap-2.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#f472b6" }} />
                  <div>
                    <p className="text-[12px] text-white/40">Pagado</p>
                    <p className="text-[18px] font-light text-white">{paidPct}%</p>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-white/25 mt-2">{fmt(totalViewsAll)} views totales</p>
            </div>
          </div>
        </div>

        {/* ── Interacciones clave (4 cols) ── */}
        <div className="col-span-12 md:col-span-4 glass-card p-6">
          <p className="stat-label mb-5">Interacciones clave</p>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Heart className="h-4 w-4 text-rose-400" />
                <span className="text-[11px] text-white/40 uppercase tracking-[0.06em]">Likes</span>
              </div>
              <p className="stat-number">{fmt(totalLikes)}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-emerald-400" />
                <span className="text-[11px] text-white/40 uppercase tracking-[0.06em]">Comentarios</span>
              </div>
              <p className="stat-number">{fmt(totalComments)}</p>
            </div>
          </div>
          {/* Interaction sparklines — mini bars */}
          <div className="mt-5 space-y-3">
            {[
              { label: "Guardados", value: sorted.reduce((s, d) => s + d.saves, 0), color: "#fbbf24", icon: Bookmark },
              { label: "Compartidos", value: sorted.reduce((s, d) => s + d.shares, 0), color: "#60a5fa", icon: Play },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className="h-3.5 w-3.5" style={{ color: item.color }} />
                  <span className="text-[12px] font-light text-white/45">{item.label}</span>
                </div>
                <span className="text-[16px] font-light text-white">{fmt(item.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mejor Reel del período (4 cols) ── */}
        <div className="col-span-12 md:col-span-4 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="stat-label">Mejor Reel</p>
            <Trophy className="h-4 w-4 text-amber-400" />
          </div>
          {bestReel ? (
            <div className="flex gap-4">
              {/* Thumbnail */}
              <div className="relative w-[90px] h-[160px] rounded-lg overflow-hidden flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.04)" }}>
                {bestReel.thumbnail_url ? (
                  <Image
                    src={bestReel.thumbnail_url}
                    alt="Best reel"
                    fill
                    className="object-cover"
                    sizes="90px"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Play className="h-6 w-6 text-white/20" />
                  </div>
                )}
              </div>
              {/* Metrics */}
              <div className="flex flex-col justify-between flex-1 min-w-0">
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-[0.06em] mb-1">
                    1° de {reels.length} Reels
                  </p>
                  <p className="stat-number text-[28px]">{fmt(bestReel.views_total)}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">views totales</p>
                </div>
                <div className="space-y-1.5 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/35">Likes</span>
                    <span className="text-[13px] font-light text-white">{fmt(bestReel.likes)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/35">Guardados</span>
                    <span className="text-[13px] font-light text-white">{fmt(bestReel.saves)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/35">Comentarios</span>
                    <span className="text-[13px] font-light text-white">{fmt(bestReel.comments)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-white/30 font-light">Sin reels en el período</p>
          )}
        </div>
      </div>

      {/* ═══ ROW 3: Recent reels strip ═══ */}
      {recentReels.length > 0 && (
        <div className="glass-section p-6">
          <p className="stat-label mb-4">Reels recientes</p>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
            {recentReels.map((reel, idx) => (
              <a
                key={reel.id}
                href={`/instagram/${reel.id}`}
                className="flex-shrink-0 group cursor-pointer"
              >
                <div className="relative w-[100px] h-[140px] rounded-lg overflow-hidden mb-2 transition-transform duration-200 group-hover:scale-[1.03]"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {reel.thumbnail_url ? (
                    <Image
                      src={reel.thumbnail_url}
                      alt={reel.caption?.slice(0, 30) || `Reel ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="100px"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Play className="h-5 w-5 text-white/15" />
                    </div>
                  )}
                  {/* Rank badge */}
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                    style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
                    #{idx + 1}
                  </div>
                </div>
                <p className="text-[11px] font-light text-white/50 text-center">{fmt(reel.views_total)}</p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
