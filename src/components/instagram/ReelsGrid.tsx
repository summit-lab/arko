"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Heart, Bookmark, MessageCircle, Share2,
  Play, Clock, ArrowUpRight, Megaphone, AlertTriangle,
  UserPlus, ChevronDown, ArrowUpDown, Check, TrendingUp,
  ExternalLink, DollarSign, Eye,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, CartesianGrid,
} from "recharts";
import { ReelsScatterPlot } from "./ReelsScatterPlot";
import { ReelsHeatmap } from "./ReelsHeatmap";
import { ReelDayRadar } from "./ReelDayRadar";
import { useChartTheme } from "@/hooks/useChartTheme";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Reel {
  id: string;
  caption: string | null;
  auto_title: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  published_at: string | null;
  views_total: number;
  views_org: number;
  views_paid: number;
  likes: number;
  saves: number;
  comments: number;
  shares: number;
  follows: number;
  duration_seconds: number | null;
  reel_type: string | null;
  has_ads: boolean;
  performer_multiple: number | null;
  sales_amount?: number | null;
}

export interface ReelsSummary {
  totalViews: number;
  avgViews: number;
  totalViewsOrg: number;
  totalViewsPaid: number;
  totalLikes: number;
  totalSaves: number;
  totalComments: number;
  topPerformers: number;
  paidPct: number;
}

interface ReelsGridProps {
  reels: Reel[];
  summary?: ReelsSummary;
  benchmarksByType: { normal: number; trial: number; all: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function timeAgo(date: string, t: (k: string) => string): string {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return t("timeAgo.today");
  if (days === 1) return t("timeAgo.yesterday");
  if (days < 7) return `${days}${t("timeAgo.daySuffix")}`;
  if (days < 30) return `${Math.floor(days / 7)}${t("timeAgo.weekSuffix")}`;
  return `${Math.floor(days / 30)}${t("timeAgo.monthSuffix")}`;
}

// ─── Filter config ────────────────────────────────────────────────────────────

type SortKey = "views_total" | "views_org" | "likes" | "saves" | "comments" | "shares" | "performer_multiple" | "published_at";
type SortDir = "desc" | "asc";
type TypeFilter = "all" | "trial" | "normal";
type DistFilter = "all" | "organic" | "promoted";

// ─── Select component ─────────────────────────────────────────────────────────

function Select({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-white/80 transition-colors hover:border-white/[0.1] hover:bg-white/[0.08] cursor-pointer"
      >
        <span>{selected?.label}</span>
        <ChevronDown size={12} strokeWidth={2.5} className={`text-white/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl backdrop-blur-2xl">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-6 px-3 py-2 text-[11px] font-medium transition-colors hover:bg-white/[0.08] cursor-pointer ${
                o.value === value ? "text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              <span>{o.label}</span>
              {o.value === value && <Check size={12} strokeWidth={2.5} className="text-white" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 18;

// ─── Sidebar donut tooltip ────────────────────────────────────────────────────

function SidebarPieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover text-popover-foreground px-2.5 py-1.5 text-[11px] pointer-events-none backdrop-blur-xl shadow-xl">
      {payload.map((e) => (
        <p key={e.name} style={{ color: e.payload.color }}>{e.name}: {fmt(e.value)}</p>
      ))}
    </div>
  );
}

// ─── Liquid glass active style (shared across filter pills + action buttons) ──

const LIQUID_GLASS_CLASS = "bg-white/[0.1] border border-white/[0.1]";
const LIQUID_GLASS_BUTTON_CLASS = "bg-white/[0.08] border border-white/[0.1]";

// ─── ReelActions (Ver en IG) ─────────────────────────────────────────────────

function ReelActions({ permalink }: { permalink?: string | null }) {
  const t = useTranslations("igGrids");
  if (!permalink) return null;
  return (
    <a
      href={permalink}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-semibold text-white transition-all cursor-pointer hover:brightness-125 ${LIQUID_GLASS_BUTTON_CLASS}`}
    >
      <ExternalLink size={10} strokeWidth={2} />
      {t("reels.viewOnIg")}
    </a>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function ReelsSidebar({ summary, reels }: { summary: ReelsSummary; reels: Reel[] }) {
  const chart = useChartTheme();
  const t = useTranslations("igGrids");
  const engagementRate = summary.totalViews > 0
    ? ((summary.totalLikes + summary.totalSaves + summary.totalComments) / summary.totalViews * 100).toFixed(1)
    : "0";

  const top5 = [...reels].sort((a, b) => b.views_total - a.views_total).slice(0, 5);
  const maxViews = top5[0]?.views_total || 1;

  // Day-of-week radar — average views by publication day
  const DAYS_ES_R = t.raw("daysShort") as string[];
  const dowViews: number[] = Array(7).fill(0);
  const dowCount: number[] = Array(7).fill(0);
  reels.forEach((r) => {
    if (!r.published_at) return;
    const [y, m, d] = r.published_at.split("T")[0].split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    dowViews[dow] += r.views_total;
    dowCount[dow]++;
  });
  const dayRadarData = DAYS_ES_R.map((day, i) => ({
    day,
    views: dowCount[i] > 0 ? Math.round(dowViews[i] / dowCount[i]) : 0,
  }));

  // Donut data — engagement breakdown
  const engData = [
    { name: t("reels.donut.likes"),  value: summary.totalLikes,    color: "#f87171" },
    { name: t("reels.donut.saves"),  value: summary.totalSaves,    color: "#AF6EC7" },
    { name: t("reels.donut.cmts"),   value: summary.totalComments, color: "#4BCEAF" },
  ].filter((d) => d.value > 0);

  // Top 5 bar colors — neon palette
  const barColors = ["#7A86E0", "#AF6EC7", "#4BCEAF", chart.benchmarkDotStroke, chart.benchmarkDot];

  return (
    <div className="w-[340px] shrink-0 space-y-3 pb-6 sticky top-6 self-start">

      {/* ── Panel 1: Views Summary ── */}
      <div className="glass-panel rounded-xl px-5 py-4">
        <p className="text-[10px] font-medium text-white/25 uppercase tracking-[0.12em] mb-4">
          {t("reels.summary.title", { count: reels.length })}
        </p>

        <div className="space-y-3">
          <div>
            <p className="text-[10px] text-white/30 mb-1">{t("reels.summary.totalViews")}</p>
            <p className="text-[28px] font-light text-white leading-none tracking-[-0.02em]">{fmt(summary.totalViews)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.06]">
            <div>
              <span className="text-[10px] text-white/30">{t("reels.summary.average")}</span>
              <p className="text-[16px] font-light text-white">{fmt(summary.avgViews)}</p>
            </div>
            <div>
              <span className="text-[10px] text-white/30">{t("reels.summary.topX3")}</span>
              <p className="text-[16px] font-light text-amber-300">{summary.topPerformers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Panel: Evolución de Views ── */}
      {(() => {
        const trendData = [...reels]
          .filter((r) => r.published_at)
          .sort((a, b) => a.published_at!.localeCompare(b.published_at!))
          .slice(-12)
          .map((r, idx) => ({
            idx: idx + 1,
            caption: r.auto_title ?? (r.caption ? r.caption.slice(0, 30) + (r.caption.length > 30 ? "…" : "") : t("reels.noTitle")),
            date: timeAgo(r.published_at!, t),
            views: r.views_total,
          }));
        if (trendData.length < 2) return null;
        return (
          <div className="glass-panel rounded-xl px-5 py-4">
            <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em] mb-1">{t("reels.trend.title")}</p>
            <p className="text-[9px] text-white/20 mb-3">{t("reels.trend.subtitle", { count: trendData.length })}</p>
            <div style={{ height: 90 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="sidebarViewsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7A86E0" stopOpacity={0.5} />
                      <stop offset="50%" stopColor="#7A86E0" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#7A86E0" stopOpacity={0} />
                    </linearGradient>
                    <filter id="areaGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feFlood floodColor="#7A86E0" floodOpacity="0.6" result="color" />
                      <feComposite in="color" in2="blur" operator="in" result="glow" />
                      <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <filter id="dotGlowSidebar">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="idx" hide />
                  <Tooltip
                    cursor={{ stroke: chart.cursorLine, strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as { caption: string; date: string; views: number };
                      return (
                        <div className="rounded-lg border border-border bg-popover text-popover-foreground px-3 py-2 text-[11px] backdrop-blur-xl shadow-xl" style={{ maxWidth: 180 }}>
                          <p className="text-muted-foreground mb-1 leading-snug">{d.caption}</p>
                          <p className="text-popover-foreground font-medium">{fmt(d.views)} {t("reels.views")}</p>
                          <p className="text-muted-foreground text-[10px]">{d.date}</p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#7A86E0"
                    strokeWidth={2.5}
                    fill="url(#sidebarViewsGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#7A86E0", stroke: "#c4b5fd", strokeWidth: 2, filter: "url(#dotGlowSidebar)" }}
                    animationDuration={1200}
                    animationEasing="ease-out"
                    style={{ filter: "url(#areaGlow)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}

      {/* ── Panel 2: Engagement donut ── */}
      <div className="glass-panel rounded-xl px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em]">{t("reels.engagement")}</p>
          <TrendingUp size={13} className="text-violet-400" />
        </div>

        <div className="flex items-center gap-4">
          {/* Donut */}
          <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <filter id="pieGlow2">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <Pie data={engData} dataKey="value" cx="50%" cy="50%"
                  innerRadius={28} outerRadius={44} paddingAngle={2} strokeWidth={0}
                  style={{ filter: "url(#pieGlow2)" }}>
                  {engData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<SidebarPieTooltip />} position={{ x: 0, y: -38 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[16px] font-light text-white leading-none">{engagementRate}%</span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="flex-1 space-y-2.5">
            {[
              { icon: Heart,         value: summary.totalLikes,    label: t("common.likes"),       color: "#f87171" },
              { icon: Bookmark,      value: summary.totalSaves,    label: t("common.saves"),   color: "#AF6EC7" },
              { icon: MessageCircle, value: summary.totalComments, label: t("common.comments"), color: "#4BCEAF" },
            ].map(({ icon: Icon, value, label, color }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon size={12} strokeWidth={1.5} style={{ color }} />
                <span className="text-[11px] text-white/35 flex-1">{label}</span>
                <span className="text-[14px] font-light text-white">{fmt(value)}</span>
              </div>
            ))}
            <p className="text-[9px] text-white/20 pt-1">{t("reels.engagementFormula")}</p>
          </div>
        </div>
      </div>

      {/* ── Panel: Top Ventas ── */}
      {(() => {
        const topSales = [...reels]
          .filter((r) => r.sales_amount != null && r.sales_amount > 0)
          .sort((a, b) => (b.sales_amount ?? 0) - (a.sales_amount ?? 0))
          .slice(0, 5);
        const totalSales = reels.reduce((s, r) => s + (r.sales_amount ?? 0), 0);
        if (topSales.length === 0) return null;
        const maxSales = topSales[0]?.sales_amount ?? 1;
        const salesColors = ["#4BCEAF", "#7A86E0", "#AF6EC7", "rgba(75,206,175,0.4)", "rgba(75,206,175,0.25)"];
        return (
          <div className="glass-panel rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em]">{t("reels.topSales.title")}</p>
              <DollarSign size={13} className="text-emerald-400" />
            </div>
            <p className="text-[9px] text-white/20 mb-4">
              {t("reels.topSales.totalGenerated")} <span className="text-emerald-300 font-medium">${fmt(totalSales)}</span>
            </p>
            <div className="space-y-3">
              {topSales.map((r, i) => {
                const pct = Math.round(((r.sales_amount ?? 0) / maxSales) * 88);
                const label = r.auto_title ?? (r.caption
                  ? r.caption.slice(0, 26) + (r.caption.length > 26 ? "…" : "")
                  : t("reels.noTitle"));
                return (
                  <div key={r.id}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-white/25 w-3 shrink-0 font-light">{i + 1}</span>
                      <span className="text-[10px] text-white/50 flex-1 truncate font-light">{label}</span>
                      <span className="text-[12px] text-emerald-300 font-light shrink-0">${fmt(r.sales_amount ?? 0)}</span>
                    </div>
                    <div className="h-[4px] w-full rounded-full overflow-hidden ml-5 bg-white/[0.05]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: salesColors[i] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Panel 3: Top 5 ── */}
      {top5.length > 0 && (
        <div className="glass-panel rounded-xl px-5 py-4">
          <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em] mb-4">{t("reels.top5.title")}</p>
          <div className="space-y-3">
            {top5.map((r, i) => {
              const pct = Math.round((r.views_total / maxViews) * 88); // cap at 88% so #1 never bleeds to edge
              const label = r.auto_title ?? (r.caption
                ? r.caption.slice(0, 26) + (r.caption.length > 26 ? "…" : "")
                : t("reels.noTitle"));
              return (
                <div key={r.id}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-white/25 w-3 shrink-0 font-light">{i + 1}</span>
                    <span className="text-[10px] text-white/50 flex-1 truncate font-light">{label}</span>
                    <span className="text-[12px] text-white/80 font-light shrink-0">{fmt(r.views_total)}</span>
                  </div>
                  <div className="h-[4px] w-full rounded-full overflow-hidden ml-5 bg-white/[0.05]">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColors[i] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Panel 4: Engagement totals (shares included) ── */}
      <div className="glass-panel rounded-xl px-5 py-4">
        <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em] mb-3">{t("reels.contentTotals")}</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Heart,         value: summary.totalLikes,    label: t("common.likes"),       color: "#f87171" },
            { icon: Bookmark,      value: summary.totalSaves,    label: t("common.saves"),   color: "#AF6EC7" },
            { icon: MessageCircle, value: summary.totalComments, label: t("common.comments"), color: "#4BCEAF" },
            { icon: Share2,        value: reels.reduce((s, r) => s + r.shares, 0), label: t("common.shares"),  color: "#7A86E0" },
          ].map(({ icon: Icon, value, label, color }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 bg-white/[0.03] border border-white/[0.06]">
              <Icon size={14} strokeWidth={1.5} style={{ color }} />
              <div>
                <p className="text-[15px] font-light text-white leading-none">{fmt(value)}</p>
                <p className="text-[9px] text-white/30 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Radar día de semana ── */}
      {reels.length >= 3 && dayRadarData.some((d) => d.views > 0) && (
        <div className="glass-panel rounded-xl px-5 py-4">
          <ReelDayRadar data={dayRadarData} />
          <p className="text-[9px] text-white/20 mt-2">{t("reels.dayRadarFooter")}</p>
        </div>
      )}

      {/* ── Scatter plot ── */}
      {reels.length >= 3 && (
        <ReelsScatterPlot
          reels={reels.map((r) => ({
            id: r.id,
            caption: r.caption,
            published_at: r.published_at ?? "",
            views_total: r.views_total,
            performer_multiple: r.performer_multiple,
          })).filter((r) => r.published_at)}
          avgViews={summary.avgViews}
        />
      )}

      {/* ── Heatmap ── */}
      {reels.length >= 3 && (
        <ReelsHeatmap
          reels={reels
            .filter((r) => r.published_at)
            .map((r) => ({
              id: r.id,
              published_at: r.published_at!,
              views_total: r.views_total,
              caption: r.caption,
            }))}
        />
      )}

    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReelsGrid({ reels, summary, benchmarksByType }: ReelsGridProps) {
  const router = useRouter();
  const t = useTranslations("igGrids");
  const [sortKey, setSortKey] = useState<SortKey>("published_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("normal");
  const [distFilter, setDistFilter] = useState<DistFilter>("all");
  const [page, setPage] = useState(1);

  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "published_at", label: t("reels.sort.date") },
    { value: "views_total", label: t("reels.sort.totalViews") },
    { value: "views_org", label: t("reels.sort.organicViews") },
    { value: "likes", label: t("common.likes") },
    { value: "saves", label: t("common.saves") },
    { value: "comments", label: t("common.comments") },
    { value: "shares", label: t("common.shares") },
    { value: "performer_multiple", label: t("reels.sort.multiplier") },
  ];

  useEffect(() => { setPage(1); }, [sortKey, sortDir, typeFilter, distFilter]);

  // Multiplicador = views_org / benchmark_del_tipo_seleccionado.
  // Cambia con el filtro de tipo para permitir comparar trials entre trials
  // y normales entre normales. El numerador es siempre views_org para que
  // los reels con ads no inflen artificialmente su propia métrica.
  const activeBenchmark = useMemo(() => {
    if (typeFilter === "trial") return benchmarksByType.trial;
    if (typeFilter === "all")   return benchmarksByType.all;
    return benchmarksByType.normal;
  }, [typeFilter, benchmarksByType]);

  const computeMultiple = (r: Reel): number | null => {
    if (activeBenchmark <= 0) return null;
    return r.views_org / activeBenchmark;
  };

  const filtered = useMemo(() => {
    let result = [...reels];
    if (typeFilter === "trial") result = result.filter((r) => r.reel_type === "trial_likely");
    if (typeFilter === "normal") result = result.filter((r) => r.reel_type !== "trial_likely");
    if (distFilter === "organic") result = result.filter((r) => !r.has_ads && r.views_paid === 0);
    if (distFilter === "promoted") result = result.filter((r) => r.has_ads || r.views_paid > 0);

    result.sort((a, b) => {
      let aVal: number;
      let bVal: number;
      if (sortKey === "published_at") {
        aVal = a.published_at ? new Date(a.published_at).getTime() : 0;
        bVal = b.published_at ? new Date(b.published_at).getTime() : 0;
      } else if (sortKey === "performer_multiple") {
        aVal = computeMultiple(a) ?? 0;
        bVal = computeMultiple(b) ?? 0;
      } else {
        aVal = a[sortKey] as number;
        bVal = b[sortKey] as number;
      }
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reels, sortKey, sortDir, typeFilter, distFilter, activeBenchmark]);

  return (
    <div>

      {/* Filters bar — full width, above grid+sidebar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-white/40 whitespace-nowrap">{t("reels.sortBy")}</span>
            <Select value={sortKey} onChange={(v) => setSortKey(v as SortKey)} options={SORT_OPTIONS} className="w-36" />
          </div>
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.1] text-white/80 text-[11px] font-medium rounded-lg px-3 py-1.5 hover:bg-white/[0.08] hover:border-white/[0.1] transition-colors cursor-pointer"
          >
            <ArrowUpDown size={12} strokeWidth={2.5} />
            {sortDir === "desc" ? t("reels.sortDesc") : t("reels.sortAsc")}
          </button>

          <div className="h-4 w-px bg-white/[0.1]" />

          {/* Type filter — pill container */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
            {([
              { key: "normal", label: t("reels.typeFilter.reel"), icon: null },
              { key: "trial", label: t("reels.typeFilter.trial"), icon: AlertTriangle },
              { key: "all", label: t("reels.typeFilter.all"), icon: null },
            ] as { key: TypeFilter; label: string; icon: React.ElementType | null }[]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setTypeFilter(opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer border ${
                  typeFilter === opt.key
                    ? `text-white ${LIQUID_GLASS_CLASS}`
                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.04] border-transparent"
                }`}
              >
                {opt.icon && <opt.icon size={11} strokeWidth={2} className="text-amber-400" />}
                {opt.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-white/[0.1]" />

          {/* Dist filter — pill container */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
            {([
              { key: "all", label: t("reels.distFilter.all"), icon: null },
              { key: "organic", label: t("reels.distFilter.organic"), icon: null, dot: true },
              { key: "promoted", label: t("reels.distFilter.paid"), icon: Megaphone },
            ] as { key: DistFilter; label: string; icon: React.ElementType | null; dot?: boolean }[]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setDistFilter(opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer border ${
                  distFilter === opt.key
                    ? `text-white ${LIQUID_GLASS_CLASS}`
                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.04] border-transparent"
                }`}
              >
                {opt.dot && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                {opt.icon && <opt.icon size={11} strokeWidth={2} className="text-purple-400" />}
                {opt.label}
              </button>
            ))}
          </div>

          <span className="ml-auto text-[11px] text-white/30">
            {t("reels.pagination", { shown: Math.min(page * PAGE_SIZE, filtered.length), total: filtered.length })}
          </span>
        </div>

      {/* Grid + Sidebar row — sidebar aligns with grid top */}
      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0" style={{ containerType: "inline-size" }}>

        {/* Portrait grid */}
        <div className="grid grid-cols-2 gap-3 @[640px]:grid-cols-3 @[900px]:grid-cols-4">
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-white/40 text-sm">
              {t("reels.empty")}
            </div>
          )}
          {filtered.slice(0, page * PAGE_SIZE).map((reel) => {
            const multiple = computeMultiple(reel) ?? 0;
            const isPromoted = reel.has_ads || reel.views_paid > 0;
            // Inline styles so colors survive any light-mode CSS overrides (pill sits on a dark thumbnail).
            const pillInline: { background: string; borderColor: string; color: string } =
              multiple >= 8
                ? { background: "rgba(0,0,0,0.80)", borderColor: "rgba(251,191,36,0.60)", color: "#fcd34d" }
                : multiple >= 5
                ? { background: "rgba(0,0,0,0.80)", borderColor: "rgba(52,211,153,0.60)", color: "#6ee7b7" }
                : multiple >= 3
                ? { background: "rgba(0,0,0,0.80)", borderColor: "rgba(96,165,250,0.60)", color: "#93c5fd" }
                : multiple >= 1
                ? { background: "rgba(0,0,0,0.80)", borderColor: "rgba(16,185,129,0.40)", color: "#6ee7b7" }
                : multiple >= 0.5
                ? { background: "rgba(0,0,0,0.80)", borderColor: "rgba(161,161,170,0.40)", color: "#e4e4e7" }
                : { background: "rgba(0,0,0,0.80)", borderColor: "rgba(239,68,68,0.40)", color: "#fca5a5" };
            const glowColor =
              multiple >= 8 ? "rgba(251,191,36,0.10)"
              : multiple >= 5 ? "rgba(52,211,153,0.10)"
              : multiple >= 3 ? "rgba(96,165,250,0.08)"
              : "transparent";
            const durationStr = reel.duration_seconds
              ? `${Math.floor(reel.duration_seconds / 60)}:${String(Math.floor(reel.duration_seconds % 60)).padStart(2, "0")}`
              : "--";
            const displayTitle = reel.auto_title ?? (reel.caption
              ? reel.caption.length > 120 ? reel.caption.slice(0, 120) + "…" : reel.caption
              : t("reels.noCaption"));

            return (
              <div
                key={reel.id}
                className="glass-card group relative flex flex-col overflow-hidden rounded-xl transition-all duration-300 hover:-translate-y-1.5"
                style={{
                  boxShadow: `0 0 20px ${glowColor}`,
                }}
              >

                {/* ── Thumbnail — navigate on click ── */}
                <Link
                  href={`/instagram/${reel.id}`}
                  prefetch
                  onMouseEnter={() => router.prefetch(`/instagram/${reel.id}`)}
                  className="relative w-full overflow-hidden bg-muted block"
                  style={{ aspectRatio: "4/5" }}
                >
                  {reel.thumbnail_url ? (
                    <Image
                      src={reel.thumbnail_url}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 20vw"
                      loading="lazy"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play size={24} className="text-white/10" />
                    </div>
                  )}
                  {/* Gradient overlay bottom */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  {/* Badges top-left — inline styles only, to survive light-mode overrides */}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1 z-20">
                    {multiple > 0 && (
                      <span
                        className="rounded-md border backdrop-blur-sm px-2.5 py-1.5 text-[13px] font-bold leading-none"
                        style={pillInline}
                      >
                        ×{multiple.toFixed(1)}
                      </span>
                    )}
                    {reel.sales_amount != null && reel.sales_amount > 0 && (
                      <span
                        className="flex items-center gap-1 rounded-md border backdrop-blur-sm px-2.5 py-1.5 text-[13px] font-bold leading-none"
                        style={{ background: "rgba(0,0,0,0.80)", borderColor: "rgba(52,211,153,0.60)", color: "#6ee7b7" }}
                      >
                        <DollarSign size={11} strokeWidth={2.5} />
                        {fmt(reel.sales_amount)}
                      </span>
                    )}
                    {reel.reel_type === "trial_likely" && (
                      <span
                        className="flex items-center gap-1 rounded-md border backdrop-blur-sm px-2 py-1 text-[11px] font-semibold leading-none"
                        style={{ background: "rgba(0,0,0,0.70)", borderColor: "rgba(245,158,11,0.50)", color: "#fcd34d" }}
                      >
                        <AlertTriangle size={10} strokeWidth={2} />Trial
                      </span>
                    )}
                    {isPromoted && (
                      <span
                        className="flex items-center gap-1 rounded-md border backdrop-blur-sm px-2 py-1 text-[11px] font-semibold leading-none"
                        style={{ background: "rgba(0,0,0,0.70)", borderColor: "rgba(168,85,247,0.50)", color: "#d8b4fe" }}
                      >
                        <Megaphone size={10} strokeWidth={2} />Ads
                      </span>
                    )}
                  </div>
                  {/* Arrow top-right */}
                  <div className="absolute top-2 right-2 z-20">
                    <ArrowUpRight size={14} style={{ color: "rgba(255,255,255,0.6)" }} className="group-hover:opacity-100 transition-opacity" />
                  </div>
                  {/* Duration + date bottom — over image, must stay white in both themes */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-20">
                    <div
                      className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] backdrop-blur-sm"
                      style={{ background: "rgba(0,0,0,0.7)", color: "rgba(255,255,255,0.75)" }}
                    >
                      <Clock size={8} className="mr-0.5" />
                      {durationStr}
                    </div>
                    <span
                      className="text-[9px] font-light rounded px-1.5 py-0.5 backdrop-blur-sm"
                      style={{ background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.75)" }}
                    >
                      {reel.published_at ? timeAgo(reel.published_at, t) : "--"}
                    </span>
                  </div>
                </Link>

                {/* ── Content below thumbnail ── */}
                <div className="flex flex-col gap-2 p-3">

                  {/* Row 1: Views + metrics */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <div className="flex items-center gap-1.5">
                      <Eye size={14} strokeWidth={1.5} className="text-white/50 shrink-0" />
                      <span className="text-[22px] font-bold tracking-tight text-white leading-none">{fmt(reel.views_total)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                      {[
                        { value: reel.likes,    icon: Heart },
                        { value: reel.saves,    icon: Bookmark },
                        { value: reel.comments, icon: MessageCircle },
                        { value: reel.shares,   icon: Share2 },
                      ].map((m, i) => (
                        <div key={i} className="flex items-center gap-px">
                          <m.icon size={10} strokeWidth={0.5} fill="currentColor" className="text-white/70" />
                          <span className="text-[10px] font-medium text-white/80">{fmt(m.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Row 2: Distribution bar + label */}
                  <div>
                    <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
                      {isPromoted ? (
                        <div className="flex h-full w-full">
                          <div className="h-full bg-violet-500/70" style={{ width: `${Math.round((reel.views_org / (reel.views_total || 1)) * 100)}%` }} />
                          <div className="h-full bg-pink-500/70" style={{ width: `${Math.round((reel.views_paid / (reel.views_total || 1)) * 100)}%` }} />
                        </div>
                      ) : (
                        <div className="h-full w-full bg-violet-500/60" />
                      )}
                    </div>
                    <p className="text-[9px] text-white/20 mt-1 font-light">
                      {isPromoted
                        ? t("reels.distSplit", {
                            organic: Math.round((reel.views_org / (reel.views_total || 1)) * 100),
                            paid: Math.round((reel.views_paid / (reel.views_total || 1)) * 100),
                          })
                        : t("reels.fullyOrganic")}
                    </p>
                  </div>

                  {/* Row 3: Title — auto_title when available, else caption */}
                  <p className="text-[10px] text-white/50 font-light leading-snug line-clamp-2 min-h-[2.5em]">{displayTitle}</p>

                  {/* Row 4: Action buttons */}
                  <div className="pt-1 border-t border-white/[0.05]">
                    <ReelActions permalink={reel.permalink} />
                  </div>

                  {/* Follows */}
                  {reel.follows > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-cyan-400">
                      <UserPlus size={10} strokeWidth={1.5} />
                      +{reel.follows} {t("reels.followers")}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Load more */}
        {filtered.length > page * PAGE_SIZE && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.06] px-5 py-2 text-[13px] font-medium text-white/70 transition-all hover:border-white/[0.1] hover:bg-white/[0.08] hover:text-white cursor-pointer"
            >
              {t("reels.showMore")}
              <span className="text-white/40 text-[11px]">
                {t("reels.showMoreCount", { count: Math.min(PAGE_SIZE, filtered.length - page * PAGE_SIZE) })}
              </span>
            </button>
          </div>
        )}
        </div>{/* end flex-1 min-w-0 */}

        {/* ── Sidebar ── */}
        {summary && <ReelsSidebar summary={summary} reels={reels} />}

      </div>{/* end flex gap-5 grid+sidebar row */}

    </div>
  );
}
