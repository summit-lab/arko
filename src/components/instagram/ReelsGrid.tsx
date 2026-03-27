"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart, Bookmark, MessageCircle, Share2,
  Play, Clock, ArrowUpRight, Megaphone, AlertTriangle,
  UserPlus, ChevronDown, ArrowUpDown, Check, TrendingUp,
  ExternalLink, DollarSign, CheckCircle2, X, Eye,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, CartesianGrid,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Reel {
  id: string;
  caption: string | null;
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}sem`;
  return `${Math.floor(days / 30)}mes`;
}

// ─── Filter config ────────────────────────────────────────────────────────────

type SortKey = "views_total" | "views_org" | "likes" | "saves" | "comments" | "shares" | "performer_multiple" | "published_at";
type SortDir = "desc" | "asc";
type TypeFilter = "all" | "trial" | "normal";
type DistFilter = "all" | "organic" | "promoted";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "published_at", label: "Fecha" },
  { value: "views_total", label: "Views totales" },
  { value: "views_org", label: "Views orgánico" },
  { value: "likes", label: "Likes" },
  { value: "saves", label: "Guardados" },
  { value: "comments", label: "Comentarios" },
  { value: "shares", label: "Compartidos" },
  { value: "performer_multiple", label: "Multiplicador" },
];

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
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.08] cursor-pointer"
      >
        <span>{selected?.label}</span>
        <ChevronDown size={12} strokeWidth={2.5} className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-2xl shadow-black/50 backdrop-blur-2xl">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-6 px-3 py-2 text-[11px] font-medium transition-colors hover:bg-white/[0.08] cursor-pointer ${
                o.value === value ? "text-white" : "text-zinc-400 hover:text-zinc-200"
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
    <div className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11px] pointer-events-none"
      style={{ background: "rgba(10,10,20,0.95)", backdropFilter: "blur(20px)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
      {payload.map((e) => (
        <p key={e.name} style={{ color: e.payload.color }}>{e.name}: {fmt(e.value)}</p>
      ))}
    </div>
  );
}

// ─── Liquid glass active style (shared across filter pills + action buttons) ──

const LIQUID_GLASS = {
  background: "rgba(255,255,255,0.1)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.22)",
  boxShadow: "0 1px 16px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.2)",
} as const;

const LIQUID_GLASS_BUTTON = {
  background: "rgba(255,255,255,0.08)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.18)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 4px rgba(0,0,0,0.2)",
} as const;

// ─── ReelActions (Ver en IG + Ventas) ────────────────────────────────────────

function ReelActions({ reelId, initialAmount, permalink }: {
  reelId: string;
  initialAmount?: number | null;
  permalink?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(initialAmount?.toString() ?? "");
  const [saved, setSaved] = useState<number | null>(initialAmount ?? null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const amount = inputVal.trim() === "" ? null : parseFloat(inputVal);
    if (inputVal.trim() !== "" && (isNaN(amount!) || amount! < 0)) return;
    setLoading(true);
    try {
      await fetch(`/api/instagram/reels/${reelId}/sales`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sales_amount: amount }),
      });
      setSaved(amount);
      setEditing(false);
    } finally {
      setLoading(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <div
          className="flex-1 flex items-center gap-1 rounded-md px-2.5 py-2"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <DollarSign size={10} className="text-emerald-400/60 shrink-0" />
          <input
            ref={inputRef}
            type="number"
            min="0"
            step="0.01"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave(e as unknown as React.KeyboardEvent);
              if (e.key === "Escape") { e.stopPropagation(); setEditing(false); }
            }}
            className="flex-1 min-w-0 w-0 bg-transparent text-[13px] text-white outline-none placeholder:text-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder="0.00"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="h-[30px] w-[30px] flex items-center justify-center rounded-md cursor-pointer disabled:opacity-40 transition-colors shrink-0 hover:brightness-125"
          style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.25)" }}
        >
          <CheckCircle2 size={13} strokeWidth={2} className="text-emerald-400" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(false); }}
          className="h-[30px] w-[30px] flex items-center justify-center rounded-md cursor-pointer transition-colors hover:bg-white/[0.06] shrink-0"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <X size={12} strokeWidth={2} className="text-white/40" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      {permalink && (
        <a
          href={permalink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-semibold text-white transition-all cursor-pointer hover:brightness-125"
          style={LIQUID_GLASS_BUTTON}
        >
          <ExternalLink size={10} strokeWidth={2} />
          Ver en IG
        </a>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-semibold transition-all cursor-pointer hover:brightness-125 ${
          saved !== null ? "text-emerald-300" : "text-white"
        }`}
        style={saved !== null ? {
          background: "rgba(52,211,153,0.12)",
          border: "1px solid rgba(52,211,153,0.25)",
          backdropFilter: "blur(20px)",
          boxShadow: "inset 0 1px 0 rgba(52,211,153,0.15)",
        } : LIQUID_GLASS_BUTTON}
      >
        <DollarSign size={10} strokeWidth={2} />
        {saved !== null ? `$${fmt(saved)}` : "Ventas"}
      </button>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function ReelsSidebar({ summary, reels }: { summary: ReelsSummary; reels: Reel[] }) {
  const orgPct = 100 - summary.paidPct;
  const engagementRate = summary.totalViews > 0
    ? ((summary.totalLikes + summary.totalSaves + summary.totalComments) / summary.totalViews * 100).toFixed(1)
    : "0";

  const top5 = [...reels].sort((a, b) => b.views_total - a.views_total).slice(0, 5);
  const maxViews = top5[0]?.views_total || 1;

  // Donut data — traffic
  const trafficData = [
    { name: "Orgánico", value: summary.totalViewsOrg, color: "#818cf8" },
    ...(summary.totalViewsPaid > 0 ? [{ name: "Pagado", value: summary.totalViewsPaid, color: "#f472b6" }] : []),
  ];

  // Donut data — engagement breakdown
  const engData = [
    { name: "Likes",  value: summary.totalLikes,    color: "#f87171" },
    { name: "Saves",  value: summary.totalSaves,    color: "#fbbf24" },
    { name: "Cmts",   value: summary.totalComments, color: "#34d399" },
  ].filter((d) => d.value > 0);

  // Top 5 bar colors — neon palette
  const barColors = ["#fbbf24", "#818cf8", "#22d3ee", "rgba(255,255,255,0.25)", "rgba(255,255,255,0.15)"];

  return (
    <div className="w-[340px] shrink-0 space-y-3 pb-6 sticky top-6 self-start">

      {/* ── Panel 1: Views + Traffic donut ── */}
      <div className="glass-panel rounded-xl px-5 py-4">
        <p className="text-[10px] font-medium text-white/25 uppercase tracking-[0.12em] mb-4">
          Resumen · {reels.length} reels
        </p>

        <div className="flex items-center gap-4">
          {/* Donut */}
          <div className="relative shrink-0" style={{ width: 110, height: 110 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <filter id="pieGlow1">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <Pie data={trafficData} dataKey="value" cx="50%" cy="50%"
                  innerRadius={34} outerRadius={52} paddingAngle={2} strokeWidth={0}
                  style={{ filter: "url(#pieGlow1)" }}>
                  {trafficData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<SidebarPieTooltip />} position={{ x: 0, y: -40 }} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[20px] font-light text-white leading-none tracking-[-0.03em]">{fmt(summary.totalViews)}</span>
              <span className="text-[8px] text-white/30 uppercase tracking-wider mt-0.5">views</span>
            </div>
          </div>

          {/* Legend + stats */}
          <div className="flex-1 space-y-2">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="h-2 w-2 rounded-full bg-[#818cf8]" />
                <span className="text-[10px] text-white/40">Orgánico</span>
              </div>
              <p className="text-[17px] font-light text-white leading-none">{orgPct}%</p>
            </div>
            {summary.paidPct > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="h-2 w-2 rounded-full bg-[#f472b6]" />
                  <span className="text-[10px] text-white/40">Pagado</span>
                </div>
                <p className="text-[17px] font-light text-white leading-none">{summary.paidPct}%</p>
              </div>
            )}
            <div className="pt-2 border-t border-white/[0.06] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/30">Promedio</span>
                <span className="text-[14px] font-light text-white">{fmt(summary.avgViews)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/30">Top ×3+</span>
                <span className="text-[14px] font-light text-amber-300">{summary.topPerformers}</span>
              </div>
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
            caption: r.caption ? r.caption.slice(0, 30) + (r.caption.length > 30 ? "…" : "") : "Sin caption",
            date: timeAgo(r.published_at!),
            views: r.views_total,
          }));
        if (trendData.length < 2) return null;
        return (
          <div className="glass-panel rounded-xl px-5 py-4">
            <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em] mb-1">Evolución de Views</p>
            <p className="text-[9px] text-white/20 mb-3">Views cronológicos · últimos {trendData.length} reels</p>
            <div style={{ height: 90 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="sidebarViewsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.5} />
                      <stop offset="50%" stopColor="#818cf8" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                    <filter id="areaGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feFlood floodColor="#818cf8" floodOpacity="0.6" result="color" />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="idx" hide />
                  <Tooltip
                    cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as { caption: string; date: string; views: number };
                      return (
                        <div className="rounded-lg border border-white/10 px-3 py-2 text-[11px]"
                          style={{ background: "rgba(10,10,20,0.95)", backdropFilter: "blur(20px)", maxWidth: 180 }}>
                          <p className="text-white/50 mb-1 leading-snug">{d.caption}</p>
                          <p className="text-white font-medium">{fmt(d.views)} views</p>
                          <p className="text-white/30 text-[10px]">{d.date}</p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#818cf8"
                    strokeWidth={2.5}
                    fill="url(#sidebarViewsGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#818cf8", stroke: "#c4b5fd", strokeWidth: 2, filter: "url(#dotGlowSidebar)" }}
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
          <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em]">Engagement</p>
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
              { icon: Heart,         value: summary.totalLikes,    label: "Likes",       color: "#f87171" },
              { icon: Bookmark,      value: summary.totalSaves,    label: "Guardados",   color: "#fbbf24" },
              { icon: MessageCircle, value: summary.totalComments, label: "Comentarios", color: "#34d399" },
            ].map(({ icon: Icon, value, label, color }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon size={12} strokeWidth={1.5} style={{ color }} />
                <span className="text-[11px] text-white/35 flex-1">{label}</span>
                <span className="text-[14px] font-light text-white">{fmt(value)}</span>
              </div>
            ))}
            <p className="text-[9px] text-white/20 pt-1">likes + saves + cmts / views</p>
          </div>
        </div>
      </div>

      {/* ── Panel 3: Top 5 ── */}
      {top5.length > 0 && (
        <div className="glass-panel rounded-xl px-5 py-4">
          <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em] mb-4">Top 5 por Views</p>
          <div className="space-y-3">
            {top5.map((r, i) => {
              const pct = Math.round((r.views_total / maxViews) * 88); // cap at 88% so #1 never bleeds to edge
              const caption = r.caption
                ? r.caption.slice(0, 26) + (r.caption.length > 26 ? "…" : "")
                : "Sin caption";
              return (
                <div key={r.id}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-white/25 w-3 shrink-0 font-light">{i + 1}</span>
                    <span className="text-[10px] text-white/50 flex-1 truncate font-light">{caption}</span>
                    <span className="text-[12px] text-white/80 font-light shrink-0">{fmt(r.views_total)}</span>
                  </div>
                  <div className="h-[4px] w-full rounded-full overflow-hidden ml-5" style={{ background: "rgba(255,255,255,0.05)" }}>
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
        <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em] mb-3">Totales de contenido</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Heart,         value: summary.totalLikes,    label: "Likes",       color: "#f87171" },
            { icon: Bookmark,      value: summary.totalSaves,    label: "Guardados",   color: "#fbbf24" },
            { icon: MessageCircle, value: summary.totalComments, label: "Comentarios", color: "#34d399" },
            { icon: Share2,        value: reels.reduce((s, r) => s + r.shares, 0), label: "Shares",       color: "#60a5fa" },
          ].map(({ icon: Icon, value, label, color }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <Icon size={14} strokeWidth={1.5} style={{ color }} />
              <div>
                <p className="text-[15px] font-light text-white leading-none">{fmt(value)}</p>
                <p className="text-[9px] text-white/30 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReelsGrid({ reels, summary }: ReelsGridProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("published_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [distFilter, setDistFilter] = useState<DistFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [sortKey, sortDir, typeFilter, distFilter]);

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
        aVal = a.performer_multiple ?? 0;
        bVal = b.performer_multiple ?? 0;
      } else {
        aVal = a[sortKey] as number;
        bVal = b[sortKey] as number;
      }
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [reels, sortKey, sortDir, typeFilter, distFilter]);

  return (
    <div>

      {/* Filters bar — full width, above grid+sidebar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-500 whitespace-nowrap">Ordenar por</span>
            <Select value={sortKey} onChange={(v) => setSortKey(v as SortKey)} options={SORT_OPTIONS} className="w-36" />
          </div>
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-zinc-200 text-[11px] font-medium rounded-lg px-3 py-1.5 hover:bg-white/[0.08] hover:border-white/20 transition-colors cursor-pointer"
          >
            <ArrowUpDown size={12} strokeWidth={2.5} />
            {sortDir === "desc" ? "Mayor → Menor" : "Menor → Mayor"}
          </button>

          <div className="h-4 w-px bg-white/10" />

          {/* Type filter — pill container */}
          <div
            className="inline-flex items-center gap-1 p-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {([
              { key: "all", label: "Todos", icon: null },
              { key: "trial", label: "Trial", icon: AlertTriangle },
              { key: "normal", label: "No Trial", icon: null },
            ] as { key: TypeFilter; label: string; icon: React.ElementType | null }[]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setTypeFilter(opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer ${
                  typeFilter === opt.key
                    ? "text-white"
                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
                style={typeFilter === opt.key ? LIQUID_GLASS : undefined}
              >
                {opt.icon && <opt.icon size={11} strokeWidth={2} className="text-amber-400" />}
                {opt.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Dist filter — pill container */}
          <div
            className="inline-flex items-center gap-1 p-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {([
              { key: "all", label: "Todos", icon: null },
              { key: "organic", label: "Orgánico", icon: null, dot: true },
              { key: "promoted", label: "Pagado", icon: Megaphone },
            ] as { key: DistFilter; label: string; icon: React.ElementType | null; dot?: boolean }[]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setDistFilter(opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer ${
                  distFilter === opt.key
                    ? "text-white"
                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
                style={distFilter === opt.key ? LIQUID_GLASS : undefined}
              >
                {opt.dot && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                {opt.icon && <opt.icon size={11} strokeWidth={2} className="text-purple-400" />}
                {opt.label}
              </button>
            ))}
          </div>

          <span className="ml-auto text-[11px] text-zinc-600">
            {Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
          </span>
        </div>

      {/* Grid + Sidebar row — sidebar aligns with grid top */}
      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0">

        {/* Portrait grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {filtered.length === 0 && (
            <div className="col-span-4 py-16 text-center text-zinc-500 text-sm">
              No hay reels que coincidan con los filtros.
            </div>
          )}
          {filtered.slice(0, page * PAGE_SIZE).map((reel) => {
            const multiple = reel.performer_multiple || 0;
            const isPromoted = reel.has_ads || reel.views_paid > 0;
            const pillStyle =
              multiple >= 8
                ? "bg-black/80 backdrop-blur-sm border border-amber-400/60 text-amber-300"
                : multiple >= 5
                ? "bg-black/80 backdrop-blur-sm border border-emerald-400/60 text-emerald-300"
                : multiple >= 3
                ? "bg-black/80 backdrop-blur-sm border border-blue-400/60 text-blue-300"
                : multiple >= 1
                ? "bg-black/80 backdrop-blur-sm border border-emerald-500/40 text-emerald-300"
                : multiple >= 0.5
                ? "bg-black/80 backdrop-blur-sm border border-zinc-400/40 text-zinc-200"
                : "bg-black/80 backdrop-blur-sm border border-red-500/40 text-red-300";
            const glowColor =
              multiple >= 8 ? "rgba(251,191,36,0.10)"
              : multiple >= 5 ? "rgba(52,211,153,0.10)"
              : multiple >= 3 ? "rgba(96,165,250,0.08)"
              : "transparent";
            const durationStr = reel.duration_seconds
              ? `${Math.floor(reel.duration_seconds / 60)}:${String(Math.floor(reel.duration_seconds % 60)).padStart(2, "0")}`
              : "--";
            const caption = reel.caption
              ? reel.caption.length > 120 ? reel.caption.slice(0, 120) + "…" : reel.caption
              : "Sin caption";

            return (
              <div
                key={reel.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-white/[0.08] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_rgba(0,0,0,0.7)] hover:border-white/[0.14]"
                style={{
                  background: "linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.04) 100%)",
                  backdropFilter: "blur(12px)",
                  boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${glowColor}`,
                }}
              >
                {/* Glass shimmer */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] z-10"
                  style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 30%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.2) 70%, transparent 100%)" }} />
                <div className="pointer-events-none absolute inset-0 z-10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.06) 0%, transparent 60%)" }} />

                {/* ── Thumbnail — navigate on click ── */}
                <Link
                  href={`/instagram/${reel.id}`}
                  prefetch
                  onMouseEnter={() => router.prefetch(`/instagram/${reel.id}`)}
                  className="relative w-full overflow-hidden bg-zinc-900 block"
                  style={{ aspectRatio: "4/5" }}
                >
                  {reel.thumbnail_url ? (
                    <img
                      src={reel.thumbnail_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play size={24} className="text-white/10" />
                    </div>
                  )}
                  {/* Gradient overlay bottom */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  {/* Badges top-left */}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1 z-20">
                    {multiple > 0 && (
                      <span className={`rounded-md px-2 py-1 text-[11px] font-bold leading-none ${pillStyle}`}>
                        ×{multiple.toFixed(1)}
                      </span>
                    )}
                    {reel.reel_type === "trial_likely" && (
                      <span className="flex items-center gap-1 rounded-md border border-amber-500/50 bg-black/70 backdrop-blur-sm px-2 py-1 text-[11px] font-semibold leading-none text-amber-300">
                        <AlertTriangle size={10} strokeWidth={2} />Trial
                      </span>
                    )}
                    {isPromoted && (
                      <span className="flex items-center gap-1 rounded-md border border-purple-500/50 bg-black/70 backdrop-blur-sm px-2 py-1 text-[11px] font-semibold leading-none text-purple-300">
                        <Megaphone size={10} strokeWidth={2} />Ads
                      </span>
                    )}
                  </div>
                  {/* Arrow top-right */}
                  <div className="absolute top-2 right-2 z-20">
                    <ArrowUpRight size={14} className="text-white/30 group-hover:text-white/70 transition-colors" />
                  </div>
                  {/* Duration + date bottom */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-20">
                    <div className="flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white/60 backdrop-blur-sm">
                      <Clock size={8} className="mr-0.5" />
                      {durationStr}
                    </div>
                    <span className="text-[9px] text-white/40 font-light">
                      {reel.published_at ? timeAgo(reel.published_at) : "--"}
                    </span>
                  </div>
                </Link>

                {/* ── Content below thumbnail ── */}
                <div className="flex flex-col gap-2 p-3">

                  {/* Row 1: Views + metrics inline */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Eye size={14} strokeWidth={1.5} className="text-white/50 shrink-0" />
                      <span className="text-[24px] font-bold tracking-tight text-white leading-none">{fmt(reel.views_total)}</span>
                      <span className="text-[9px] font-medium text-white/25 uppercase tracking-wider">views</span>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {[
                        { value: reel.likes,    icon: Heart },
                        { value: reel.saves,    icon: Bookmark },
                        { value: reel.comments, icon: MessageCircle },
                        { value: reel.shares,   icon: Share2 },
                      ].map((m, i) => (
                        <div key={i} className="flex items-center gap-0.5">
                          <m.icon size={12} strokeWidth={0.5} fill="currentColor" className="text-white/70" />
                          <span className="text-[12px] font-medium text-white/80">{fmt(m.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Row 2: Distribution bar + label */}
                  <div>
                    <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
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
                        ? `${Math.round((reel.views_org / (reel.views_total || 1)) * 100)}% orgánico · ${Math.round((reel.views_paid / (reel.views_total || 1)) * 100)}% pagado`
                        : "100% orgánico"}
                    </p>
                  </div>

                  {/* Row 3: Caption — min-height so buttons always align */}
                  <p className="text-[10px] text-zinc-400 font-light leading-snug line-clamp-2 min-h-[2.5em]">{caption}</p>

                  {/* Row 4: Action buttons */}
                  <div className="pt-1 border-t border-white/[0.05]">
                    <ReelActions reelId={reel.id} initialAmount={reel.sales_amount} permalink={reel.permalink} />
                  </div>

                  {/* Follows */}
                  {reel.follows > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-cyan-400">
                      <UserPlus size={10} strokeWidth={1.5} />
                      +{reel.follows} seguidores
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
              className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-5 py-2 text-[13px] font-medium text-zinc-300 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white cursor-pointer"
            >
              Mostrar más
              <span className="text-zinc-500 text-[11px]">
                ({Math.min(PAGE_SIZE, filtered.length - page * PAGE_SIZE)} más)
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
