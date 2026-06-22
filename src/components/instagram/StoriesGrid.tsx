"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Eye, MessageCircle, Image as ImageIcon, TrendingDown,
  ChevronLeft, ChevronRight, BookImage, ArrowLeft,
  ArrowRight, Users, Reply, BarChart3, Clock,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
} from "recharts";
import { useChartTheme } from "@/hooks/useChartTheme";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StorySlide {
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
  slides: StorySlide[];
  _demo?: boolean;
}

interface StoriesGridProps {
  sequences: StorySequence[];
  totalFollowers?: number;
}

// ─── Demo sequence (shows multi-slide layout while real data is single-slide) ─

const DEMO_SEQUENCE: StorySequence = {
  id: "demo-seq",
  ig_story_id: "demo",
  published_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  expires_at: null,
  total_impressions: 5240,
  total_reach: 4180,
  total_replies: 34,
  total_exits: 428,
  archived: true,
  _demo: true,
  slides: [
    { id: "d1", ig_media_id: "d1", slide_index: 0, media_type: "IMAGE", media_url: null, thumbnail_url: null, caption: null, impressions: 5240, reach: 4180, replies: 4, exits: 92, taps_forward: 3820, taps_back: 0, swipe_aways: 428, archived: true },
    { id: "d2", ig_media_id: "d2", slide_index: 1, media_type: "IMAGE", media_url: null, thumbnail_url: null, caption: null, impressions: 4810, reach: 3840, replies: 8, exits: 78, taps_forward: 3510, taps_back: 162, swipe_aways: 380, archived: true },
    { id: "d3", ig_media_id: "d3", slide_index: 2, media_type: "IMAGE", media_url: null, thumbnail_url: null, caption: null, impressions: 4290, reach: 3422, replies: 11, exits: 65, taps_forward: 3120, taps_back: 104, swipe_aways: 319, archived: true },
    { id: "d4", ig_media_id: "d4", slide_index: 3, media_type: "IMAGE", media_url: null, thumbnail_url: null, caption: null, impressions: 3870, reach: 3080, replies: 5, exits: 58, taps_forward: 2840, taps_back: 91, swipe_aways: 274, archived: true },
    { id: "d5", ig_media_id: "d5", slide_index: 4, media_type: "IMAGE", media_url: null, thumbnail_url: null, caption: null, impressions: 3520, reach: 2804, replies: 3, exits: 49, taps_forward: 2590, taps_back: 78, swipe_aways: 241, archived: true },
    { id: "d6", ig_media_id: "d6", slide_index: 5, media_type: "IMAGE", media_url: null, thumbnail_url: null, caption: null, impressions: 3210, reach: 2558, replies: 3, exits: 428, taps_forward: 0, taps_back: 62, swipe_aways: 210, archived: true },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDate(date: string, locale: string): string {
  const d = new Date(date);
  const dateLocale = locale === "en" ? "en-US" : "es-AR";
  return d.toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateShort(date: string, locale: string): string {
  const d = new Date(date);
  const dateLocale = locale === "en" ? "en-US" : "es-AR";
  return d.toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
}

function completionRate(slides: StorySlide[]): number {
  if (slides.length < 2) return 100;
  const first = slides[0].impressions;
  const last = slides[slides.length - 1].impressions;
  if (first === 0) return 0;
  return (last / first) * 100;
}

function dropPct(a: number, b: number): number {
  if (a === 0) return 0;
  return ((a - b) / a) * 100;
}

// ─── Glass tokens ─────────────────────────────────────────────────────────────

const glassCardClass = "glass-card";
const glassSectionClass = "glass-section";

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover text-popover-foreground px-2.5 py-1.5 text-[11px] pointer-events-none backdrop-blur-xl shadow-xl">
      {payload.map((e) => (
        <p key={e.name} style={{ color: e.payload.color }}>
          {e.name}: {fmt(e.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function StoriesSidebar({
  sequences,
  totalFollowers,
}: {
  sequences: StorySequence[];
  totalFollowers: number;
}) {
  const chart = useChartTheme();
  const t = useTranslations("igGrids");
  const locale = useLocale();
  // Only count real sequences for stats
  const realSeqs = sequences.filter((s) => !s._demo);
  const allSeqs = realSeqs.length > 0 ? realSeqs : sequences;

  const totalImpressions = allSeqs.reduce((s, q) => s + q.total_impressions, 0);
  const totalReplies = allSeqs.reduce((s, q) => s + q.total_replies, 0);
  const totalExits = allSeqs.reduce((s, q) => s + q.total_exits, 0);
  const avgImpressions = allSeqs.length > 0 ? totalImpressions / allSeqs.length : 0;

  // Completion rate — only multi-slide
  const multiSlide = allSeqs.filter((s) => s.slides.length > 1);
  const avgCompletion =
    multiSlide.length > 0
      ? multiSlide.reduce((s, q) => s + completionRate(q.slides), 0) / multiSlide.length
      : null;

  // Avg drop-off (first to last slide, multi-slide only)
  const avgDropOff =
    multiSlide.length > 0
      ? multiSlide.reduce((s, q) => {
          const first = q.slides[0]?.impressions ?? 0;
          const last = q.slides[q.slides.length - 1]?.impressions ?? first;
          return s + dropPct(first, last);
        }, 0) / multiSlide.length
      : null;

  // Avg reply rate
  const avgReplyRate =
    totalImpressions > 0 ? (totalReplies / totalImpressions) * 100 : 0;

  // % seguidores que ven historias
  const followerReach =
    totalFollowers > 0 ? (avgImpressions / totalFollowers) * 100 : null;

  // Donut: multi vs single slide
  const multiCount = allSeqs.filter((s) => s.slides.length > 1).length;
  const singleCount = allSeqs.length - multiCount;
  const donutData = [
    ...(multiCount > 0 ? [{ name: t("stories.multiSlide"), value: multiCount, color: "#7A86E0" }] : []),
    ...(singleCount > 0 ? [{ name: t("stories.oneSlide"), value: singleCount, color: "#AF6EC7" }] : []),
  ];

  // Timeline: impressions per sequence (last 15 real)
  const trendData = [...allSeqs]
    .sort((a, b) => a.published_at.localeCompare(b.published_at))
    .slice(-15)
    .map((s, i) => ({ idx: i + 1, date: fmtDateShort(s.published_at, locale), views: s.total_impressions }));

  // Top 5 by impressions
  const top5 = [...allSeqs].sort((a, b) => b.total_impressions - a.total_impressions).slice(0, 5);
  const maxImp = top5[0]?.total_impressions || 1;
  const barColors = [
    "#7A86E0",
    "#AF6EC7",
    "#4BCEAF",
    chart.isDark ? "rgba(255,255,255,0.25)" : "rgba(17,17,17,0.32)",
    chart.isDark ? "rgba(255,255,255,0.15)" : "rgba(17,17,17,0.22)",
  ];

  // Follower reach radial
  const followerReachCapped = Math.min(followerReach ?? 0, 100);
  const radialData = [{ name: "reach", value: followerReachCapped }];

  return (
    <div className="w-[360px] shrink-0 space-y-3 pb-6 sticky top-6 self-start">

      {/* ── Panel: Resumen ── */}
      <div className="glass-panel rounded-xl px-5 py-4">
        <p className="text-[10px] font-medium text-white/25 uppercase tracking-[0.12em] mb-4">
          {t("stories.summaryTitle", { count: allSeqs.length })}
        </p>

        <div className="flex items-center gap-4 mb-4">
          <div className="relative shrink-0" style={{ width: 100, height: 100 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={46} paddingAngle={2} strokeWidth={0}>
                  {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} position={{ x: 0, y: -36 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[18px] font-light text-white leading-none tracking-[-0.03em]">{allSeqs.length}</span>
              <span className="text-[8px] text-white/30 uppercase tracking-wider mt-0.5">{t("stories.storiesLabel")}</span>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            {donutData.map((d) => (
              <div key={d.name}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-[10px] text-white/40">{d.name}</span>
                </div>
                <p className="text-[15px] font-light text-white leading-none">{d.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-3 space-y-2">
          {[
            { label: t("stories.totals.impressions"), value: fmt(totalImpressions) },
            { label: t("stories.totals.replies"), value: fmt(totalReplies) },
            { label: t("stories.totals.exits"), value: fmt(totalExits) },
            { label: t("stories.totals.avgPerStory"), value: fmt(Math.round(avgImpressions)) },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[10px] text-white/30">{label}</span>
              <span className="text-[13px] font-light text-white">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Panel: KPIs de performance ── */}
      <div className="glass-panel rounded-xl px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em]">{t("stories.performance")}</p>
          <BarChart3 size={13} className="text-violet-400" />
        </div>

        <div className="space-y-4">
          {/* Avg reply rate */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Reply size={11} className="text-[#4BCEAF]" />
                <span className="text-[10px] text-white/40">{t("stories.avgReplyRate")}</span>
              </div>
              <span className="text-[13px] font-light text-white">{avgReplyRate.toFixed(2)}%</span>
            </div>
            <div className="h-[3px] w-full rounded-full" style={{ background: chart.trackFill }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(avgReplyRate * 20, 100)}%`, background: "#4BCEAF" }}
              />
            </div>
          </div>

          {/* Avg completion rate */}
          {avgCompletion !== null && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <TrendingDown size={11} className="text-[#7A86E0]" />
                  <span className="text-[10px] text-white/40">{t("stories.avgCompletion")}</span>
                </div>
                <span className="text-[13px] font-light text-white">{avgCompletion.toFixed(1)}%</span>
              </div>
              <div className="h-[3px] w-full rounded-full" style={{ background: chart.trackFill }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(avgCompletion, 100)}%`, background: "#7A86E0" }}
                />
              </div>
            </div>
          )}

          {/* Avg drop-off */}
          {avgDropOff !== null && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <TrendingDown size={11} className="text-rose-400" />
                  <span className="text-[10px] text-white/40">{t("stories.avgDropOff")}</span>
                </div>
                <span className="text-[13px] font-light" style={{ color: "#f472b6" }}>
                  -{avgDropOff.toFixed(1)}%
                </span>
              </div>
              <div className="h-[3px] w-full rounded-full" style={{ background: chart.trackFill }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(avgDropOff, 100)}%`, background: "#f472b6" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Panel: % seguidores que ven historias ── */}
      {followerReach !== null && (
        <div className="glass-panel rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em]">
              {t("stories.followerReachTitle")}
            </p>
            <Users size={13} className="text-[#AF6EC7]" />
          </div>

          <div className="flex items-center gap-5">
            <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%" cy="50%"
                  innerRadius={28} outerRadius={42}
                  startAngle={90} endAngle={-270}
                  data={radialData}
                >
                  <RadialBar dataKey="value" background={{ fill: chart.trackFill }} fill="#AF6EC7" cornerRadius={6} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[16px] font-light text-white leading-none">
                  {followerReach.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              <p className="text-[11px] text-white/60 leading-snug">
                {t("stories.followerReachDesc")}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: "#AF6EC7" }} />
                <span className="text-[10px] text-white/30">
                  {fmt(Math.round(avgImpressions))} {t("stories.viewsAvg")}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-white/[0.1]" />
                <span className="text-[10px] text-white/30">
                  {fmt(totalFollowers)} {t("stories.followers")}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Panel: Evolución ── */}
      {trendData.length >= 2 && (
        <div className="glass-panel rounded-xl px-5 py-4">
          <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em] mb-1">
            {t("stories.viewsTrend")}
          </p>
          <p className="text-[9px] text-white/20 mb-3">
            {t("stories.viewsTrendSubtitle", { count: trendData.length })}
          </p>
          <div style={{ height: 80 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="storiesTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7A86E0" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#7A86E0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                <XAxis dataKey="idx" hide />
                <Tooltip
                  cursor={{ stroke: chart.cursorLine, strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload as { date: string; views: number };
                    return (
                      <div className="rounded-lg border border-border bg-popover text-popover-foreground px-3 py-2 text-[11px] backdrop-blur-xl shadow-xl">
                        <p className="text-muted-foreground mb-0.5">{d.date}</p>
                        <p className="text-popover-foreground font-medium">{fmt(d.views)} {t("stories.views")}</p>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="views" stroke="#7A86E0" strokeWidth={2}
                  fill="url(#storiesTrendGrad)" dot={false}
                  activeDot={{ r: 4, fill: "#7A86E0", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Panel: Top 5 ── */}
      {top5.length > 0 && (
        <div className="glass-panel rounded-xl px-5 py-4">
          <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em] mb-4">
            {t("stories.top5Impressions")}
          </p>
          <div className="space-y-3">
            {top5.map((s, i) => {
              const pct = Math.round((s.total_impressions / maxImp) * 88);
              return (
                <div key={s.id}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-white/25 w-3 shrink-0 font-light">{i + 1}</span>
                    <span className="text-[10px] text-white/50 flex-1 font-light">
                      {fmtDateShort(s.published_at, locale)}{s._demo ? ` (${t("stories.exampleSuffix")})` : ""}
                    </span>
                    <span className="text-[11px] text-white font-light shrink-0">{fmt(s.total_impressions)}</span>
                  </div>
                  <div className="h-[3px] w-full rounded-full overflow-hidden ml-5" style={{ background: chart.trackFill }}>
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

// ─── Slide thumbnail with onError fallback ───────────────────────────────────
// Shared between StoryCard and SequenceDetail. Meta CDN URLs expire and then
// next/image returns 403 — without this, the thumb just shows as blank.

function SlideImage({ thumb, index, sizes }: { thumb: string | null; index: number; sizes: string }) {
  const t = useTranslations("igGrids");
  const [failed, setFailed] = useState(false);
  const show = !!thumb && !failed;
  if (!show) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <ImageIcon className="h-6 w-6 text-white/10" />
        <span className="text-[9px] text-white/15 uppercase tracking-wider">{t("stories.slide")} {index + 1}</span>
      </div>
    );
  }
  return (
    <Image
      src={thumb!}
      alt={`${t("stories.slide")} ${index + 1}`}
      fill
      className="object-cover"
      sizes={sizes}
      onError={() => setFailed(true)}
    />
  );
}

// ─── Story Card (gallery item) ────────────────────────────────────────────────

function StoryCard({ seq, onClick }: { seq: StorySequence; onClick: () => void }) {
  const t = useTranslations("igGrids");
  const locale = useLocale();
  const firstSlide = seq.slides[0];
  const thumb = firstSlide?.thumbnail_url ?? firstSlide?.media_url ?? null;
  const rate = completionRate(seq.slides);
  const isActive = !seq.archived && !!seq.expires_at && new Date(seq.expires_at) > new Date();
  // Meta CDN URLs expire after hours, so next/image proxy 403s for stale ones.
  // Track load errors and swap to the placeholder instead of leaving the card
  // visually empty.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!thumb && !imageFailed;

  return (
    <div
      onClick={onClick}
      className={`${glassCardClass} group rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl`}
    >
      {/* Thumbnail */}
      <div
        className="relative w-full overflow-hidden bg-white/[0.03]"
        style={{ aspectRatio: "9/16", maxHeight: 240 }}
      >
        {showImage ? (
          <Image
            src={thumb!}
            alt={`${t("stories.storyAlt")} ${fmtDateShort(seq.published_at, locale)}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            sizes="(max-width: 768px) 50vw, 200px"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <BookImage className="h-7 w-7 text-white/10" />
            {seq._demo && (
              <span className="text-[9px] text-white/20 uppercase tracking-wider">{t("stories.example")}</span>
            )}
          </div>
        )}

        {/* Slide count */}
        <div
          className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", color: "#ffffff" }}
        >
          <ImageIcon className="h-2.5 w-2.5" />
          {seq.slides.length}
        </div>

        {/* Demo badge */}
        {seq._demo && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-semibold"
            style={{ background: "rgba(251,191,36,0.20)", backdropFilter: "blur(8px)", color: "#fbbf24" }}>
            {t("stories.example")}
          </div>
        )}

        {/* Active badge (only real) */}
        {!seq._demo && isActive && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-semibold"
            style={{ background: "rgba(16,185,129,0.20)", backdropFilter: "blur(8px)", color: "#34d399" }}>
            {t("stories.active")}
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)" }} />

        {/* Views on image */}
        <div className="absolute bottom-2 left-3 flex items-center gap-1">
          <Eye className="h-3 w-3" style={{ color: "rgba(255,255,255,0.70)" }} />
          <span className="text-[12px] font-light" style={{ color: "#ffffff" }}>{fmt(seq.total_impressions)}</span>
        </div>
      </div>

      {/* Info row */}
      <div className="px-3 py-2.5">
        <p className="text-[12px] font-light text-white/80 leading-tight">{fmtDate(seq.published_at, locale)}</p>
        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {seq.slides.length > 1 && (
              <span className="text-[10px] text-white/35">{t("stories.completedPct", { pct: rate.toFixed(0) })}</span>
            )}
            {seq.total_replies > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-white/30">
                <MessageCircle className="h-2.5 w-2.5" />
                {seq.total_replies}
              </span>
            )}
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
        </div>
      </div>
    </div>
  );
}

// ─── Sequence Detail ──────────────────────────────────────────────────────────

function SequenceDetail({
  seq,
  sequences,
  onBack,
  onNavigate,
}: {
  seq: StorySequence;
  sequences: StorySequence[];
  onBack: () => void;
  onNavigate: (id: string) => void;
}) {
  const chart = useChartTheme();
  const t = useTranslations("igGrids");
  const locale = useLocale();
  const slides = seq.slides;
  const firstViews = slides[0]?.impressions ?? 0;
  const lastViews = slides[slides.length - 1]?.impressions ?? firstViews;
  const rate = firstViews > 0 ? (lastViews / firstViews) * 100 : 0;
  const isActive = !seq.archived && !!seq.expires_at && new Date(seq.expires_at) > new Date();

  const curveData = slides.map((s, i) => ({ name: `${i + 1}`, views: s.impressions }));
  const currentIdx = sequences.findIndex((s) => s.id === seq.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < sequences.length - 1;

  const [scrollRef, setScrollRef] = useState<HTMLDivElement | null>(null);
  const scrollBy = (dir: number) => scrollRef?.scrollBy({ left: dir * 300, behavior: "smooth" });

  return (
    <div className="space-y-6">

      {/* ── Nav bar ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[13px] font-light text-white/60 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("stories.backToStories")}
        </button>

        {sequences.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => hasPrev && onNavigate(sequences[currentIdx - 1].id)}
              disabled={!hasPrev}
              className={`${glassCardClass} flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-white/50 hover:text-white transition-colors disabled:opacity-25 cursor-pointer disabled:cursor-default`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t("stories.previous")}
            </button>
            <span className="text-[11px] text-white/25">{currentIdx + 1} / {sequences.length}</span>
            <button
              onClick={() => hasNext && onNavigate(sequences[currentIdx + 1].id)}
              disabled={!hasNext}
              className={`${glassCardClass} flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-white/50 hover:text-white transition-colors disabled:opacity-25 cursor-pointer disabled:cursor-default`}
            >
              {t("stories.next")}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <h2 className="text-[22px] font-light text-white tracking-[-0.02em]">
          {fmtDate(seq.published_at, locale)}
        </h2>
        <span className="text-white/20">·</span>
        <span className="text-[13px] text-white/35 font-light">{t("stories.slidesCount", { count: slides.length })}</span>
        {seq._demo && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
            {t("stories.example")}
          </span>
        )}
        {!seq._demo && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.04] text-white/25"
          }`}>
            {isActive ? t("stories.active") : t("stories.archived")}
          </span>
        )}
      </div>

      {/* ── 1. Sequence Flow (FIRST) ── */}
      {/* Grid + minmax(0, 1fr) trick: un hijo flex con `min-w-max` normalmente
          fuerza al padre a crecer y rompe el overflow-x-auto. Envolverlo en un
          grid de una sola columna con `minmax(0, 1fr)` constrana al hijo al
          ancho real del card, activando el scroll interno de manera confiable
          en todos los browsers. */}
      <div className={`${glassSectionClass} rounded-2xl p-6 overflow-hidden`}>
        <div className="flex items-center justify-between mb-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">
            {t("stories.sequenceFlow")}
          </p>
          {slides.length > 3 && (
            <div className="flex items-center gap-1">
              <button onClick={() => scrollBy(-1)}
                className="h-7 w-7 rounded-full flex items-center justify-center cursor-pointer transition-colors bg-white/[0.04] hover:bg-white/[0.08]">
                <ChevronLeft className="h-3.5 w-3.5 text-white/50" />
              </button>
              <button onClick={() => scrollBy(1)}
                className="h-7 w-7 rounded-full flex items-center justify-center cursor-pointer transition-colors bg-white/[0.04] hover:bg-white/[0.08]">
                <ChevronRight className="h-3.5 w-3.5 text-white/50" />
              </button>
            </div>
          )}
        </div>

        <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
          <div
            ref={setScrollRef}
            className="overflow-x-auto overflow-y-hidden pb-4 stories-scroll"
            style={{ scrollbarColor: `${chart.trackBorder} transparent` }}
          >
            <div className="flex items-start min-w-max">
            {slides.map((slide, i) => {
              const drop = i > 0 ? dropPct(slides[i - 1].impressions, slide.impressions) : 0;
              const thumb = slide.thumbnail_url ?? slide.media_url;

              return (
                <div key={slide.id} className="flex items-center">

                  {/* Drop-off connector */}
                  {i > 0 && (
                    <div className="flex flex-col items-center justify-center shrink-0" style={{ width: 64, marginBottom: 60 }}>
                      {/* Line with arrow */}
                      <div className="relative w-full flex items-center">
                        <div className="flex-1 h-[1px]" style={{ background: chart.panelBorder }} />
                        <ArrowRight className="h-3 w-3 text-white/20 shrink-0" />
                      </div>
                      {/* Drop badge */}
                      <div
                        className="mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: "rgba(244,114,182,0.14)", color: "#f472b6", border: "1px solid rgba(244,114,182,0.2)" }}
                      >
                        -{drop.toFixed(1)}%
                      </div>
                    </div>
                  )}

                  {/* Slide card */}
                  <div className="flex flex-col items-center shrink-0" style={{ width: 176 }}>
                    {/* Image */}
                    <div
                      className="relative w-full rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.08]"
                      style={{
                        height: 280,
                        boxShadow: chart.isDark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 4px 16px rgba(0,0,0,0.08)",
                      }}
                    >
                      <SlideImage thumb={thumb} index={i} sizes="176px" />

                      {/* Slide number pill */}
                      <div
                        className="absolute top-3 left-3 h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", color: "#ffffff" }}
                      >
                        {i + 1}
                      </div>

                      {/* Gradient overlay */}
                      <div
                        className="absolute inset-x-0 bottom-0 h-20"
                        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
                      />

                      {/* Views over image */}
                      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
                        <Eye className="h-3 w-3" style={{ color: "rgba(255,255,255,0.70)" }} />
                        <span className="text-[13px] font-medium" style={{ color: "#ffffff" }}>{fmt(slide.impressions)}</span>
                      </div>
                    </div>

                    {/* Metrics below image */}
                    <div className="mt-3 w-full px-1 space-y-1.5 text-center">
                      {/* Drop-off */}
                      {i > 0 ? (
                        <p className="text-[11px] font-medium" style={{ color: "#f472b6" }}>
                          {t("stories.dropOffLabel", { pct: drop.toFixed(1) })}
                        </p>
                      ) : (
                        <p className="text-[10px] text-white/25">{t("stories.entry")}</p>
                      )}

                      {/* Navigation metrics */}
                      <div className="flex items-center justify-center gap-3 text-[10px] text-white/30">
                        {slide.taps_forward > 0 && (
                          <span className="flex items-center gap-0.5">
                            <ArrowRight className="h-2.5 w-2.5" />
                            {fmt(slide.taps_forward)}
                          </span>
                        )}
                        {slide.taps_back > 0 && (
                          <span className="flex items-center gap-0.5">
                            <ArrowLeft className="h-2.5 w-2.5" />
                            {fmt(slide.taps_back)}
                          </span>
                        )}
                        {slide.replies > 0 && (
                          <span className="flex items-center gap-0.5">
                            <MessageCircle className="h-2.5 w-2.5" />
                            {slide.replies}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: t("stories.kpi.impressions"), value: fmt(firstViews) },
          { label: t("stories.kpi.completed"), value: fmt(lastViews) },
          { label: t("stories.kpi.completionRate"), value: `${rate.toFixed(1)}%` },
          { label: t("stories.kpi.slides"), value: slides.length.toString() },
          { label: t("stories.kpi.replies"), value: fmt(seq.total_replies) },
        ].map((kpi) => (
          <div key={kpi.label} className={`${glassCardClass} rounded-xl p-4`}>
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] mb-1.5 text-white/40">
              {kpi.label}
            </p>
            <p className="text-[28px] font-light tracking-[-0.02em] text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ── 3. Drop-off Curve ── */}
      {slides.length > 1 && (
        <div className={`${glassSectionClass} rounded-xl p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-3.5 w-3.5 text-rose-400/60" />
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/40">
              {t("stories.dropOffCurve")}
            </p>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: "#818cf8" }} />
              <span className="text-[10px] text-white/30">{t("stories.viewsPerSlide")}</span>
            </div>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curveData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${seq.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false}
                  tick={{ fill: chart.axisTick, fontSize: 11 }}
                  label={{ value: t("stories.slide"), position: "insideBottomRight", offset: -5, fill: chart.axisTickMuted, fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false}
                  tick={{ fill: chart.axisTick, fontSize: 11 }}
                  tickFormatter={(v: number) => fmt(v)} width={50} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-xl px-3 py-2 bg-popover text-popover-foreground border border-border backdrop-blur-xl shadow-xl">
                        <p className="text-[10px] uppercase tracking-[0.06em] mb-0.5 text-muted-foreground">
                          {t("stories.slide")} {label}
                        </p>
                        <p className="text-[15px] font-light text-popover-foreground">{fmt(payload[0].value as number)} {t("stories.views")}</p>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="views" stroke="#818cf8" strokeWidth={2}
                  fill={`url(#grad-${seq.id})`}
                  dot={{ fill: "#818cf8", r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#818cf8", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── 4. Slide stats table ── */}
      {slides.length > 1 && (
        <div className={`${glassSectionClass} rounded-xl p-5`}>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] mb-4 text-white/40">
            {t("stories.detailBySlide")}
          </p>
          <div className="space-y-1">
            <div className="grid gap-2 pb-2 border-b border-white/[0.06]"
              style={{ gridTemplateColumns: "1.5rem 1fr 1fr 1fr 1fr 1fr" }}>
              {[
                "#",
                t("stories.tableViews"),
                t("stories.tableDrop"),
                t("stories.tableForward"),
                t("stories.tableBack"),
                t("stories.tableReplies"),
              ].map((h) => (
                <p key={h} className="text-[9px] font-medium uppercase tracking-[0.08em] text-white/25">{h}</p>
              ))}
            </div>
            {slides.map((slide, i) => {
              const drop = i > 0 ? dropPct(slides[i - 1].impressions, slide.impressions) : null;
              return (
                <div key={slide.id} className="grid gap-2 py-1.5"
                  style={{ gridTemplateColumns: "1.5rem 1fr 1fr 1fr 1fr 1fr" }}>
                  <span className="text-[12px] text-white/40 font-light">{i + 1}</span>
                  <span className="text-[12px] text-white font-light">{fmt(slide.impressions)}</span>
                  <span className={`text-[12px] font-light ${drop !== null ? "" : "text-white/25"}`} style={drop !== null ? { color: "#f472b6" } : undefined}>
                    {drop !== null ? `-${drop.toFixed(1)}%` : "—"}
                  </span>
                  <span className="text-[12px] text-white/40 font-light">{fmt(slide.taps_forward)}</span>
                  <span className="text-[12px] text-white/40 font-light">{fmt(slide.taps_back)}</span>
                  <span className="text-[12px] text-white/40 font-light">{fmt(slide.replies)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  const t = useTranslations("igGrids");
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-14 w-14 rounded-full flex items-center justify-center mb-4 bg-white/[0.04]">
        <BookImage className="h-6 w-6 text-white/20" />
      </div>
      <h3 className="text-[15px] font-light text-white/50">{t("stories.empty.title")}</h3>
      <p className="mt-2 text-[12px] text-white/25 max-w-md font-light">
        {t("stories.empty.description")}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StoriesGrid({ sequences, totalFollowers = 0, initialSelectedId = null }: StoriesGridProps & { initialSelectedId?: string | null }) {
  const t = useTranslations("igGrids");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);

  // Inject demo sequence so the layout always looks populated
  const allSequences: StorySequence[] = [...sequences, DEMO_SEQUENCE];

  if (sequences.length === 0 && allSequences.length === 1) return <EmptyState />;

  const selected = allSequences.find((s) => s.id === selectedId) ?? null;

  if (selected) {
    return (
      <SequenceDetail
        seq={selected}
        sequences={allSequences}
        onBack={() => setSelectedId(null)}
        onNavigate={(id) => setSelectedId(id)}
      />
    );
  }

  const hasActiveWithNoMetrics = sequences.some(
    (s) => !s.archived && s.expires_at && new Date(s.expires_at) > new Date() && s.total_impressions === 0
  );

  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0 space-y-3">
        {hasActiveWithNoMetrics && (
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[12px] text-white/50 bg-white/[0.03] border border-white/[0.06]"
          >
            <Clock className="h-3.5 w-3.5 text-amber-400/60 shrink-0" />
            <span>{t("stories.metricsDelayHint")}</span>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {allSequences.map((seq) => (
            <StoryCard key={seq.id} seq={seq} onClick={() => setSelectedId(seq.id)} />
          ))}
        </div>
      </div>
      <StoriesSidebar sequences={allSequences} totalFollowers={totalFollowers} />
    </div>
  );
}
