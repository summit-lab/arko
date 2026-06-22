"use client";

import { useState, useMemo } from "react";
import { ReelThumbnail } from "./ReelThumbnail";
import {
  Heart, Bookmark, MessageCircle, Share2, Eye,
  Images, Grid2X2, ExternalLink, TrendingUp, Check, ChevronDown,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, CartesianGrid,
} from "recharts";
import { useChartTheme } from "@/hooks/useChartTheme";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Post {
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

export interface PostsSummary {
  totalPosts: number;
  totalCarruseles: number;
  totalLikes: number;
  totalSaves: number;
  totalComments: number;
  totalShares: number;
  avgLikes: number;
  avgComments: number;
  avgSaves: number;
}

interface PublicacionesGridProps {
  posts: Post[];
  summary?: PostsSummary;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const PALETTE = {
  indigo:  "#7A86E0",
  purple:  "#AF6EC7",
  teal:    "#4BCEAF",
  pink:    "#EB6991",
};

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

function fmtDateShort(date: string, locale: string): string {
  const d = new Date(date);
  const dateLocale = locale === "en" ? "en-US" : "es-AR";
  return d.toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
}

// ─── Sort dropdown ────────────────────────────────────────────────────────────

type SortKey = "published_at" | "likes" | "comments" | "saves" | "shares";

function SortSelect({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const t = useTranslations("igGrids");
  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "published_at", label: t("posts.sort.date") },
    { value: "likes",        label: t("common.likes") },
    { value: "comments",     label: t("common.comments") },
    { value: "saves",        label: t("common.saves") },
    { value: "shares",       label: t("common.shares") },
  ];
  const [open, setOpen] = useState(false);
  const selected = SORT_OPTIONS.find((o) => o.value === value);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-foreground/80 transition-colors hover:border-white/[0.1] hover:bg-white/[0.08] cursor-pointer"
      >
        <span>{selected?.label}</span>
        <ChevronDown size={11} className={`text-foreground/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl backdrop-blur-2xl">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-6 px-3 py-2 text-[11px] font-medium transition-colors hover:bg-white/[0.08] cursor-pointer ${
                o.value === value ? "text-foreground" : "text-foreground/50 hover:text-foreground/80"
              }`}
            >
              <span>{o.label}</span>
              {o.value === value && <Check size={11} className="text-foreground" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar tooltips ─────────────────────────────────────────────────────────

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover text-popover-foreground px-2.5 py-1.5 text-[11px] pointer-events-none backdrop-blur-xl shadow-xl">
      {payload.map((e) => (
        <p key={e.name} style={{ color: e.payload.color }}>{e.name}: {fmt(e.value)}</p>
      ))}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function PublicacionesSidebar({ posts, summary }: { posts: Post[]; summary: PostsSummary }) {
  const chart = useChartTheme();
  const t = useTranslations("igGrids");
  const locale = useLocale();
  const totalEngagement = summary.totalLikes + summary.totalSaves + summary.totalComments;

  // Distribución donut
  const distData = [
    ...(summary.totalCarruseles > 0 ? [{ name: t("posts.carousels"), value: summary.totalCarruseles, color: PALETTE.indigo }] : []),
    ...(summary.totalPosts > 0      ? [{ name: t("posts.posts"),     value: summary.totalPosts,      color: PALETTE.purple }] : []),
  ];

  // Engagement breakdown donut
  const engData = [
    { name: t("common.likes"),       value: summary.totalLikes,    color: PALETTE.pink   },
    { name: t("common.saves"),   value: summary.totalSaves,    color: PALETTE.purple },
    { name: t("common.comments"), value: summary.totalComments, color: PALETTE.teal   },
  ].filter((d) => d.value > 0);

  // Timeline: likes per post chronologically (last 15)
  const trendData = [...posts]
    .filter((p) => p.published_at)
    .sort((a, b) => a.published_at!.localeCompare(b.published_at!))
    .slice(-15)
    .map((p, i) => ({
      idx: i + 1,
      date: fmtDateShort(p.published_at!, locale),
      caption: p.caption?.slice(0, 28) ?? t("posts.noDescription"),
      likes: p.likes,
    }));

  // Top 5 by likes
  const top5 = [...posts].sort((a, b) => b.likes - a.likes).slice(0, 5);
  const maxLikes = top5[0]?.likes || 1;
  const barColors = [
    PALETTE.indigo,
    PALETTE.purple,
    PALETTE.teal,
    chart.isDark ? "rgba(255,255,255,0.25)" : "rgba(17,17,17,0.32)",
    chart.isDark ? "rgba(255,255,255,0.15)" : "rgba(17,17,17,0.22)",
  ];

  return (
    <div className="w-[360px] shrink-0 space-y-3 pb-6 sticky top-6 self-start">

      {/* ── Panel: Resumen ── */}
      <div className="glass-panel rounded-xl px-5 py-4">
        <p className="text-[10px] font-medium text-white/25 uppercase tracking-[0.12em] mb-4">
          {t("posts.summaryTitle", { count: posts.length })}
        </p>

        {/* Type breakdown — text only, no chart */}
        <div className="flex items-center gap-3 mb-4">
          {distData.map((d) => (
            <div key={d.name} className="flex-1 rounded-lg px-3 py-2.5 bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: d.color }} />
                <span className="text-[9px] text-white/35 uppercase tracking-wider">{d.name}</span>
              </div>
              <p className="text-[22px] font-light text-white leading-none">{d.value}</p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="space-y-2">
          {[
            { label: t("posts.totals.likes"),       value: fmt(summary.totalLikes)    },
            { label: t("posts.totals.saves"),       value: fmt(summary.totalSaves)    },
            { label: t("posts.totals.comments"),    value: fmt(summary.totalComments) },
            { label: t("posts.totals.shares"),      value: fmt(summary.totalShares)   },
            { label: t("posts.totals.avgPerPost"),  value: fmt(summary.avgLikes)      },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[10px] text-white/30">{label}</span>
              <span className="text-[13px] font-light text-white">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Panel: Engagement ── */}
      <div className="glass-panel rounded-xl px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em]">{t("posts.engagement")}</p>
          <TrendingUp size={13} className="text-violet-400" />
        </div>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={engData} dataKey="value" cx="50%" cy="50%"
                  innerRadius={28} outerRadius={44} paddingAngle={2} strokeWidth={0}>
                  {engData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} position={{ x: 0, y: -38 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[15px] font-light text-white leading-none">{fmt(totalEngagement)}</span>
            </div>
          </div>
          <div className="flex-1 space-y-2.5">
            {[
              { icon: Heart,         value: summary.totalLikes,    label: t("common.likes"),       avg: summary.avgLikes,    color: PALETTE.pink   },
              { icon: Bookmark,      value: summary.totalSaves,    label: t("common.saves"),   avg: summary.avgSaves,    color: PALETTE.purple },
              { icon: MessageCircle, value: summary.totalComments, label: t("common.comments"), avg: summary.avgComments, color: PALETTE.teal   },
            ].map(({ icon: Icon, value, label, avg, color }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon size={12} strokeWidth={1.5} style={{ color }} />
                <span className="text-[11px] text-white/35 flex-1">{label}</span>
                <div className="text-right">
                  <p className="text-[13px] font-light text-white leading-none">{fmt(value)}</p>
                  <p className="text-[9px] text-white/20">~{fmt(avg)} {t("posts.avgShort")}</p>
                </div>
              </div>
            ))}
            {summary.totalShares > 0 && (
              <div className="flex items-center gap-2">
                <Share2 size={12} strokeWidth={1.5} style={{ color: PALETTE.indigo }} />
                <span className="text-[11px] text-white/35 flex-1">{t("common.shares")}</span>
                <p className="text-[13px] font-light text-white">{fmt(summary.totalShares)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Panel: Evolución de likes ── */}
      {trendData.length >= 2 && (
        <div className="glass-panel rounded-xl px-5 py-4">
          <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em] mb-1">{t("posts.likesTrend")}</p>
          <p className="text-[9px] text-white/20 mb-3">{t("posts.likesTrendSubtitle", { count: trendData.length })}</p>
          <div style={{ height: 90 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="pubLikesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PALETTE.indigo} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={PALETTE.indigo} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                <XAxis dataKey="idx" hide />
                <Tooltip
                  cursor={{ stroke: chart.cursorLine, strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload as { caption: string; date: string; likes: number };
                    return (
                      <div className="rounded-lg border border-border bg-popover text-popover-foreground px-3 py-2 text-[11px] backdrop-blur-xl shadow-xl" style={{ maxWidth: 180 }}>
                        <p className="text-muted-foreground mb-1 leading-snug">{d.caption}</p>
                        <p className="text-popover-foreground font-medium">{fmt(d.likes)} {t("common.likes").toLowerCase()}</p>
                        <p className="text-muted-foreground text-[10px]">{d.date}</p>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="likes" stroke={PALETTE.indigo} strokeWidth={2}
                  fill="url(#pubLikesGrad)" dot={false}
                  activeDot={{ r: 4, fill: PALETTE.indigo, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Panel: Top 5 por likes ── */}
      {top5.length > 0 && (
        <div className="glass-panel rounded-xl px-5 py-4">
          <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em] mb-4">{t("posts.top5Likes")}</p>
          <div className="space-y-3">
            {top5.map((p, i) => {
              const pct = Math.round((p.likes / maxLikes) * 88);
              const label = p.caption ? p.caption.slice(0, 28) + (p.caption.length > 28 ? "…" : "") : t("posts.noTitle");
              return (
                <div key={p.id}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-white/25 w-3 shrink-0 font-light">{i + 1}</span>
                    <span className="text-[10px] text-white/50 flex-1 truncate font-light">{label}</span>
                    <span className="text-[11px] text-white font-light shrink-0">{fmt(p.likes)}</span>
                  </div>
                  <div className="h-[3px] w-full rounded-full overflow-hidden ml-5 bg-white/[0.05]">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColors[i] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Post card ───────────────────────────────────────────────────────────────

function PostCard({ post }: { post: Post }) {
  const t = useTranslations("igGrids");
  const isCarrusel = post.media_type === "CAROUSEL_ALBUM";

  return (
    <a
      href={post.permalink ?? "#"}
      target={post.permalink ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="glass-card group block rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-xl cursor-pointer"
      onClick={!post.permalink ? (e) => e.preventDefault() : undefined}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "1/1" }}>
        <ReelThumbnail
          src={post.thumbnail_url}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          placeholder={
            <div className="flex items-center justify-center h-full bg-white/[0.03]">
              <Grid2X2 className="h-8 w-8 text-white/10" />
            </div>
          }
        />

        {/* Type badge */}
        <div
          className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        >
          {isCarrusel
            ? <Images className="h-2.5 w-2.5" style={{ color: PALETTE.indigo }} />
            : <Grid2X2 className="h-2.5 w-2.5" style={{ color: PALETTE.purple }} />
          }
          <span style={{ color: "rgba(255,255,255,0.80)" }}>{isCarrusel ? t("posts.carouselSingular") : t("posts.postSingular")}</span>
        </div>

        {/* Time badge */}
        {post.published_at && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px]"
            style={{ background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.80)" }}>
            {timeAgo(post.published_at, t)}
          </div>
        )}

        {/* Gradient */}
        <div className="absolute inset-x-0 bottom-0 h-10"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)" }} />

        {/* External link hint */}
        {post.permalink && (
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="h-3 w-3" style={{ color: "rgba(255,255,255,0.70)" }} />
          </div>
        )}
      </div>

      {/* Caption + stats */}
      <div className="p-3 space-y-2">
        <p className="text-[11px] font-light text-white/55 group-hover:text-white/75 transition-colors line-clamp-2 leading-relaxed">
          {post.caption?.slice(0, 80) || t("posts.noDescription")}
        </p>
        {post.impressions > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-white/45">
            <Eye className="h-2.5 w-2.5 text-white/30" />
            <span>{fmt(post.impressions)} {t("posts.impressionsLower")}</span>
          </div>
        )}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] text-white/40">
            <Heart className="h-2.5 w-2.5 text-white/35" />
            {fmt(post.likes)}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/40">
            <Bookmark className="h-2.5 w-2.5 text-white/35" />
            {post.saves !== null ? fmt(post.saves) : "—"}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/40">
            <MessageCircle className="h-2.5 w-2.5 text-white/35" />
            {fmt(post.comments)}
          </span>
          {post.shares > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-white/30">
              <Share2 className="h-2.5 w-2.5 text-white/30" />
              {fmt(post.shares)}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PublicacionesGrid({ posts, summary }: PublicacionesGridProps) {
  const t = useTranslations("igGrids");
  const [typeFilter, setTypeFilter] = useState<"all" | "post" | "carrusel">("all");
  const [sortKey, setSortKey] = useState<SortKey>("published_at");

  const filtered = useMemo(() => {
    const base = posts.filter((p) => {
      if (typeFilter === "carrusel") return p.media_type === "CAROUSEL_ALBUM";
      if (typeFilter === "post")     return p.media_type !== "CAROUSEL_ALBUM";
      return true;
    });
    return [...base].sort((a, b) => {
      if (sortKey === "published_at") return (b.published_at ?? "").localeCompare(a.published_at ?? "");
      return ((b[sortKey] as number) ?? 0) - ((a[sortKey] as number) ?? 0);
    });
  }, [posts, typeFilter, sortKey]);

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-14 w-14 rounded-full flex items-center justify-center mb-4 bg-white/[0.04]">
          <Grid2X2 className="h-6 w-6 text-white/20" />
        </div>
        <h3 className="text-[15px] font-light text-white/50">{t("posts.empty.title")}</h3>
        <p className="mt-2 text-[12px] text-white/25 font-light">
          {t("posts.empty.description")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 items-start">
      {/* ── Grid (main) ── */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Filters row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Type pills */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            {([
              { key: "all"      as const, label: t("posts.typeFilter.all")       },
              { key: "post"     as const, label: t("posts.typeFilter.posts")     },
              { key: "carrusel" as const, label: t("posts.typeFilter.carousels") },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  typeFilter === key ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/55"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <SortSelect value={sortKey} onChange={setSortKey} />

          <span className="text-[11px] text-white/25">{t("posts.count", { count: filtered.length })}</span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>

      {/* ── Sidebar ── */}
      {summary && <PublicacionesSidebar posts={posts} summary={summary} />}
    </div>
  );
}
