"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  RefreshCw, Zap, ExternalLink, Users, Play, Heart, MessageCircle,
  Share2, CheckCircle2, Clock, AlertCircle, ChevronDown,
  Swords, TrendingUp, Brain, Lightbulb, BarChart3, BookOpen,
  ArrowUpDown, Calendar, Eye, BookMarked, X, Target, Sparkles,
  Layers, Shield, AlertTriangle, Palette, MousePointerClick,
  Download, Database, CheckCircle, Loader2,
} from "lucide-react";
import { useChartTheme } from "@/hooks/useChartTheme";
import { AIMarkdown } from "@/components/ai/AIMarkdown";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReelAnalysis {
  hook_text: string | null;
  hook_type: string | null;
  narrative_structure: string | null;
  content_type: string | null;
  cta_text: string | null;
  cta_type: string | null;
  topic_cluster: string | null;
  style_notes: string | null;
  strengths: string | null;
  weaknesses: string | null;
  ai_summary: string | null;
  model_used: string | null;
}

interface CompetitorReel {
  id: string;
  short_code: string | null;
  permalink: string | null;
  caption: string | null;
  likes_count: number | null;
  comments_count: number | null;
  views_count: number | null;
  shares_count: number | null;
  duration_seconds: number | null;
  published_at: string | null;
  thumbnail_url: string | null;
  maybe_trial: boolean | null;
  transcript: string | null;
  hashtags: string[];
  music_artist: string | null;
  music_name: string | null;
  competitor_reel_analysis: ReelAnalysis | ReelAnalysis[] | null;
}

interface ScrapedData {
  ig_username?: string;
  ig_full_name?: string | null;
  ig_bio?: string | null;
  ig_follower_count?: number | null;
  ig_following_count?: number | null;
  ig_post_count?: number | null;
  ig_profile_pic_url?: string | null;
  ig_is_verified?: boolean;
  ig_is_business?: boolean;
  ig_business_category?: string | null;
}

interface FollowerSnapshot {
  snapshot_date: string; // YYYY-MM-DD
  follower_count: number;
}

interface ScrapeProgress {
  phase: string;
  message: string;
  current?: number;
  total?: number;
}

interface Competitor {
  id: string;
  name: string | null;
  ig_url: string | null;
  why_better: string | null;
  scraped_data: ScrapedData;
  last_scraped_at: string | null;
  analysis_status: string;
  scrape_progress?: ScrapeProgress | null;
  competitor_reels: CompetitorReel[];
  competitor_follower_snapshots: FollowerSnapshot[];
}

export interface MyStats {
  avgViews: number;
  followers: number;
  avgLikes: number;
  avgComments: number;
}

export interface MyReel {
  published_at: string | null;
  views_total: number;
}

export interface MyFollowerPoint {
  date: string; // YYYY-MM-DD
  followers: number;
}

type SortKey = "views" | "likes" | "date";
type TypeFilter = "all" | "trial" | "normal";

// ─── Constants ────────────────────────────────────────────────────────────────

// Hook type meta — labels translated at consumer site via t("competitor.hookTypes.<key>")
const HOOK_TYPE_META: Record<string, { color: string; dot: string; hex: string }> = {
  transformacion: { color: "text-violet-700 dark:text-violet-400",  dot: "bg-violet-400",  hex: "#a78bfa" },
  enemigo:        { color: "text-rose-700 dark:text-rose-400",      dot: "bg-rose-400",    hex: "#fb7185" },
  negativo:       { color: "text-amber-700 dark:text-amber-400",    dot: "bg-amber-400",   hex: "#fbbf24" },
  promesa:        { color: "text-teal-700 dark:text-teal-400",      dot: "bg-teal-400",    hex: "#2dd4bf" },
  curiosidad:     { color: "text-sky-700 dark:text-sky-400",        dot: "bg-sky-400",     hex: "#38bdf8" },
  desconocido:    { color: "text-muted-foreground",                 dot: "bg-muted-foreground/40", hex: "rgb(148,148,148)" },
};

const HOOK_TYPE_KEYS = ["transformacion", "enemigo", "negativo", "promesa", "curiosidad", "desconocido"] as const;

const CHART_COLORS = { mine: "#7A86E0", competitor: "#AF6EC7" };

const SORT_OPTION_KEYS: { key: SortKey; icon: React.ElementType }[] = [
  { key: "views", icon: Eye },
  { key: "likes", icon: Heart },
  { key: "date",  icon: Calendar },
];

// ─── Glass styles ─────────────────────────────────────────────────────────────

const GLASS = {
  background: "color-mix(in srgb, var(--foreground) 8%, transparent)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid var(--border)",
} as React.CSSProperties;

const GLASS_VIOLET = {
  background: "rgba(139,92,246,0.15)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(139,92,246,0.35)",
} as React.CSSProperties;

const GLASS_SUBTLE = {
  background: "color-mix(in srgb, var(--foreground) 4%, transparent)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid var(--border)",
} as React.CSSProperties;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null || n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(iso: string | null, dateLocale: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
}

function extractUsername(igUrl: string | null): string {
  if (!igUrl) return "";
  const clean = igUrl.trim().replace(/\/$/, "");
  if (clean.startsWith("@")) return clean;
  try {
    const parts = new URL(clean.startsWith("http") ? clean : `https://${clean}`)
      .pathname.split("/").filter(Boolean);
    return parts[0] ? `@${parts[0]}` : clean;
  } catch { return clean; }
}

function getAnalysis(reel: CompetitorReel): ReelAnalysis | null {
  if (!reel.competitor_reel_analysis) return null;
  if (Array.isArray(reel.competitor_reel_analysis)) return reel.competitor_reel_analysis[0] ?? null;
  return reel.competitor_reel_analysis;
}

function sortReels(reels: CompetitorReel[], key: SortKey): CompetitorReel[] {
  return [...reels].sort((a, b) => {
    if (key === "views") return (b.views_count ?? 0) - (a.views_count ?? 0);
    if (key === "likes") return (b.likes_count ?? 0) - (a.likes_count ?? 0);
    return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
  });
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────
// Uses <img> (not next/image) — competitor thumbnails come from various Instagram
// CDN hostnames (cdninstagram.com, lookaside.fbcdn.net, etc.) that can't all be
// whitelisted statically. next/image throws at render time for unknown hostnames.

function Thumbnail({ url, duration, showDuration = true }: {
  url: string | null;
  duration: number | null;
  showDuration?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted">
        <Play size={20} className="text-white/10" />
      </div>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
      {showDuration && duration && (
        <div className="absolute bottom-2 right-2 rounded-md px-1.5 py-0.5 text-[9px] text-white/90 font-medium z-10"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}>
          {Math.round(duration)}s
        </div>
      )}
    </>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ url, name, size = 40 }: { url?: string | null; name: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initial = (name ?? "?").charAt(0).toUpperCase();

  if (!url || failed) {
    return (
      <div className="rounded-full flex items-center justify-center shrink-0 text-white/50 font-light"
        style={{ width: size, height: size, background: "rgba(139,92,246,0.15)", fontSize: size * 0.4,
          border: "1px solid rgba(139,92,246,0.25)" }}>
        {initial}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }} onError={() => setFailed(true)} />
  );
}

// ─── Hook badge ───────────────────────────────────────────────────────────────

function HookBadge({ type, small = false }: { type: string | null; small?: boolean }) {
  const t = useTranslations("igAdvanced");
  const key = (type ?? "desconocido") in HOOK_TYPE_META ? (type ?? "desconocido") : "desconocido";
  const meta = HOOK_TYPE_META[key]!;
  return (
    <span className={`flex items-center gap-1 font-semibold uppercase tracking-wider ${small ? "text-[9px]" : "text-[10px]"} ${meta.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}`} />
      {t(`competitor.hookTypes.${key}`)}
    </span>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

function Pill({ icon: Icon, value, label }: { icon: React.ElementType; value: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <Icon size={10} className="text-white/25" />
      <span className="text-[11px] text-white/50">{value}</span>
      <span className="text-[10px] text-white/20">{label}</span>
    </span>
  );
}

// ─── Live progress overlay (blur + barra + fases) ────────────────────────────
// Se renderiza sobre el panel central del competidor seleccionado mientras el
// scrape+analyze corre. Lee scrape_progress del servidor (vía polling) y lo
// traduce a UI rica: paso actual, porcentaje, contador X/Y, checkpoints.

const PROGRESS_PHASES = [
  { key: "starting", icon: Zap },
  { key: "scraping_reels", icon: Download },
  { key: "uploading_thumbs", icon: Layers },
  { key: "saving", icon: Database },
  { key: "analyzing", icon: Brain },
  { key: "done", icon: CheckCircle },
] as const;

function ScrapeProgressOverlay({ competitor }: { competitor: Competitor }) {
  const t = useTranslations("igAdvanced");
  const progress = competitor.scrape_progress ?? { phase: "starting", message: t("competitor.progress.preparing") };
  const currentIdx = Math.max(0, PROGRESS_PHASES.findIndex((p) => p.key === progress.phase));
  const pct = (() => {
    if (progress.total && progress.current != null) {
      const phaseBase = (currentIdx / (PROGRESS_PHASES.length - 1)) * 100;
      const phaseSlice = (1 / (PROGRESS_PHASES.length - 1)) * 100;
      const withinPhase = (progress.current / progress.total) * phaseSlice;
      return Math.min(100, phaseBase + withinPhase);
    }
    return ((currentIdx + 0.5) / (PROGRESS_PHASES.length - 1)) * 100;
  })();

  const CurrentIcon = PROGRESS_PHASES[currentIdx]?.icon ?? Loader2;

  return (
    <div className="absolute inset-0 z-20 flex items-center rounded-xl overflow-hidden">
      {/* Blur sobre el profile header — sólo esa card, no el resto del panel */}
      <div className="absolute inset-0 bg-background/75 dark:bg-black/55 backdrop-blur-md" />

      {/* Contenido inline (se adapta al alto del profile header) */}
      <div className="relative w-full px-5 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <CurrentIcon size={15} className="text-violet-400 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-white/90 truncate">
              {progress.message || t("competitor.progress.working")}
            </p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">
              {t("competitor.progress.analyzingName", { name: competitor.name ?? t("competitor.fallbackName") })}
            </p>
          </div>
          <div className="shrink-0 text-right tabular-nums">
            <div className="text-[13px] font-medium text-violet-300">{Math.round(pct)}%</div>
            {progress.total != null && progress.current != null && (
              <div className="text-[10px] text-white/40">{progress.current}/{progress.total}</div>
            )}
          </div>
        </div>

        {/* Barra + fases en una sola fila */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1 rounded-full bg-white/[0.08] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-400 transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {PROGRESS_PHASES.filter((p) => p.key !== "done").map((phase, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <div
                  key={phase.key}
                  title={t(`competitor.progress.phases.${phase.key}`)}
                  className={`h-1.5 w-1.5 rounded-full transition-all ${
                    done
                      ? "bg-emerald-400"
                      : active
                      ? "bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.8)]"
                      : "bg-white/15"
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Analysis Modal ───────────────────────────────────────────────────────────

function AnalysisModal({ reel, analysis, competitor, onClose }: {
  reel: CompetitorReel;
  analysis: ReelAnalysis;
  competitor: Competitor;
  onClose: () => void;
}) {
  const t = useTranslations("igAdvanced");
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "es-AR";

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const hookKey = (analysis.hook_type ?? "desconocido") in HOOK_TYPE_META ? (analysis.hook_type ?? "desconocido") : "desconocido";
  const hookMeta = HOOK_TYPE_META[hookKey]!;
  const hookLabel = t(`competitor.hookTypes.${hookKey}`);

  const publishedFormatted = reel.published_at
    ? new Date(reel.published_at).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex bg-popover text-popover-foreground border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left: Thumbnail column ── */}
        <div className="w-60 shrink-0 flex flex-col border-r border-border">
          {/* Portrait thumbnail */}
          <div className="relative shrink-0" style={{ aspectRatio: "9/16", maxHeight: "400px" }}>
            <Thumbnail url={reel.thumbnail_url} duration={null} showDuration={false} />
            {/* Duration overlay on thumbnail */}
            {reel.duration_seconds && (
              <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] text-white/80 font-medium z-10"
                style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}>
                <Play size={8} />
                {Math.round(reel.duration_seconds)}s
              </div>
            )}
            {/* Trial badge on thumbnail */}
            {reel.maybe_trial === true && (
              <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full z-10"
                style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", backdropFilter: "blur(4px)" }}>
                <AlertTriangle size={8} className="text-amber-400" />
                <span className="text-[8px] text-amber-300 font-medium">{t("competitor.modal.trialBadge")}</span>
              </div>
            )}
          </div>

          {/* Stats + metadata below thumbnail */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* 4 core metrics */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Eye,           v: fmt(reel.views_count),    l: t("competitor.stats.views") },
                { icon: Heart,         v: fmt(reel.likes_count),    l: t("competitor.stats.likes") },
                { icon: MessageCircle, v: fmt(reel.comments_count), l: t("competitor.stats.comments") },
                { icon: Share2,        v: fmt(reel.shares_count),   l: t("competitor.stats.shares") },
              ].map(({ icon: Icon, v, l }) => (
                <div key={l} className="rounded-lg p-2 text-center bg-white/[0.04] border border-white/[0.06]">
                  <Icon size={11} className="text-white/25 mx-auto mb-0.5" />
                  <p className="text-[13px] font-light text-white/70">{v}</p>
                  <p className="text-[8px] text-white/20">{l}</p>
                </div>
              ))}
            </div>

            {/* Date */}
            {publishedFormatted && (
              <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                <Calendar size={9} />
                <span>{publishedFormatted}</span>
              </div>
            )}

            {/* Hook + content type + topic badges */}
            <div className="space-y-1.5">
              <HookBadge type={analysis.hook_type} />
              {analysis.content_type && (
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  analysis.content_type === "reputacion"
                    ? "text-indigo-300 bg-indigo-500/10"
                    : "text-pink-300 bg-pink-500/10"
                }`}>
                  {analysis.content_type === "reputacion" ? t("competitor.contentTypes.reputation") : t("competitor.contentTypes.connection")}
                </span>
              )}
              {analysis.topic_cluster && (
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] text-white/30 bg-white/[0.04]">
                  {analysis.topic_cluster}
                </span>
              )}
            </div>

            {/* Hashtags */}
            {reel.hashtags && reel.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {reel.hashtags.slice(0, 8).map((h) => (
                  <span key={h} className="text-[9px] text-white/20 bg-white/[0.04] px-1.5 py-0.5 rounded-full">
                    #{h}
                  </span>
                ))}
                {reel.hashtags.length > 8 && (
                  <span className="text-[9px] text-white/15">+{reel.hashtags.length - 8}</span>
                )}
              </div>
            )}

            {/* Open in IG */}
            {reel.permalink && (
              <a href={reel.permalink} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full h-8 rounded-xl text-[11px] text-white/40 hover:text-white/65 transition-all"
                style={GLASS_SUBTLE}>
                <ExternalLink size={11} /> {t("competitor.viewOnInstagram")}
              </a>
            )}
          </div>
        </div>

        {/* ── Right: Analysis content ── */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 bg-popover text-popover-foreground border-b border-border backdrop-blur-md">
            <div className="min-w-0 flex-1 mr-3">
              <p className="text-[10px] text-white/25 uppercase tracking-wider">{competitor.name}</p>
              <p className="text-[13px] text-white/70 font-light line-clamp-2 mt-0.5 leading-snug">
                {reel.caption ?? t("competitor.noCaption")}
              </p>
            </div>
            <button onClick={onClose}
              className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-all hover:bg-white/[0.08] cursor-pointer border border-white/[0.1]">
              <X size={14} className="text-white/40" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5">

            {/* Hook (big and prominent) */}
            {analysis.hook_text && (
              <div className="rounded-xl p-4"
                style={{ background: `${hookMeta.hex}10`, border: `1px solid ${hookMeta.hex}30` }}>
                <div className="flex items-center gap-2 mb-2">
                  <Target size={12} style={{ color: hookMeta.hex }} />
                  <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: hookMeta.hex }}>
                    {t("competitor.modal.hookPrefix")} · {hookLabel}
                  </span>
                </div>
                <p className="text-[15px] text-white/80 font-light italic leading-relaxed">
                  "{analysis.hook_text}"
                </p>
              </div>
            )}

            {/* AI Summary */}
            {analysis.ai_summary && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles size={11} className="text-violet-400" />
                  <p className="text-[10px] text-violet-700 dark:text-violet-300/60 uppercase tracking-wider font-medium">{t("competitor.modal.mokaAnalysis")}</p>
                </div>
                <AIMarkdown>{analysis.ai_summary}</AIMarkdown>
              </div>
            )}

            {/* Narrative structure */}
            {analysis.narrative_structure && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Layers size={11} className="text-sky-400/70" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("competitor.modal.narrativeStructure")}</p>
                </div>
                <AIMarkdown variant="compact">{analysis.narrative_structure}</AIMarkdown>
              </div>
            )}

            {/* Strengths + Weaknesses */}
            {(analysis.strengths || analysis.weaknesses) && (
              <div className="grid grid-cols-2 gap-3">
                {analysis.strengths && (
                  <div className="rounded-xl p-3.5"
                    style={{ background: "rgba(45,212,191,0.05)", border: "1px solid rgba(45,212,191,0.15)" }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Shield size={11} className="text-teal-400" />
                      <p className="text-[9px] text-teal-400/70 uppercase tracking-wider">{t("competitor.modal.strengths")}</p>
                    </div>
                    <AIMarkdown variant="compact">{analysis.strengths}</AIMarkdown>
                  </div>
                )}
                {analysis.weaknesses && (
                  <div className="rounded-xl p-3.5"
                    style={{ background: "rgba(251,113,133,0.05)", border: "1px solid rgba(251,113,133,0.15)" }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle size={11} className="text-rose-400" />
                      <p className="text-[9px] text-rose-400/70 uppercase tracking-wider">{t("competitor.modal.opportunities")}</p>
                    </div>
                    <AIMarkdown variant="compact">{analysis.weaknesses}</AIMarkdown>
                  </div>
                )}
              </div>
            )}

            {/* Style + CTA */}
            {(analysis.style_notes || analysis.cta_text) && (
              <div className="grid grid-cols-2 gap-3">
                {analysis.style_notes && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Palette size={11} className="text-white/25" />
                      <p className="text-[9px] text-white/20 uppercase tracking-wider">{t("competitor.modal.visualStyle")}</p>
                    </div>
                    <AIMarkdown variant="compact">{analysis.style_notes}</AIMarkdown>
                  </div>
                )}
                {analysis.cta_text && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <MousePointerClick size={11} className="text-white/25" />
                      <p className="text-[9px] text-white/20 uppercase tracking-wider">CTA</p>
                    </div>
                    <p className="text-[13px] text-white/60 font-light italic">
                      "{analysis.cta_text}"
                    </p>
                    {analysis.cta_type && (
                      <p className="text-[10px] text-white/25 mt-0.5">{analysis.cta_type}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Music */}
            {(reel.music_artist || reel.music_name) && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[12px]">🎵</span>
                <p className="text-[11px] text-white/35 font-light truncate">
                  {reel.music_name}{reel.music_artist ? ` · ${reel.music_artist}` : ""}
                </p>
              </div>
            )}

            {/* Transcript */}
            {reel.transcript && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <BookOpen size={11} className="text-white/25" />
                  <p className="text-[9px] text-white/20 uppercase tracking-wider">{t("competitor.modal.transcript")}</p>
                </div>
                <div className="rounded-xl p-3.5 bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[12px] text-white/45 font-light leading-relaxed whitespace-pre-wrap">
                    {reel.transcript}
                  </p>
                </div>
              </div>
            )}

            {analysis.model_used && (
              <p className="text-[9px] text-white/12 pb-1">{t("competitor.modal.analyzedWith", { model: analysis.model_used })}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reel Gallery Card ────────────────────────────────────────────────────────

function ReelGalleryCard({ reel, competitorId, onAnalyze, analyzing }: {
  reel: CompetitorReel;
  competitorId: string;
  onAnalyze: (reelId: string) => void;
  analyzing: boolean;
}) {
  const t = useTranslations("igAdvanced");
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "es-AR";
  const analysis = getAnalysis(reel);
  const hasAnalysis = analysis !== null;

  return (
    <div className="rounded-xl overflow-hidden flex flex-col bg-white/[0.03] border border-white/[0.07]">

      {/* Thumbnail — portrait 4:5, clickeable → detalle del reel */}
      <Link
        href={`/instagram/competencia/${competitorId}/${reel.id}`}
        className="relative overflow-hidden bg-muted shrink-0 block"
        style={{ aspectRatio: "4/5" }}
      >
        <Thumbnail url={reel.thumbnail_url} duration={reel.duration_seconds} />

        {/* Gradient overlay */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)" }} />

        {/* Top-left: analyzed dot OR trial badge */}
        {reel.maybe_trial === true ? (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full z-10"
            style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", backdropFilter: "blur(4px)" }}>
            <AlertTriangle size={8} className="text-amber-400" />
            <span className="text-[8px] text-amber-300 font-medium">Trial</span>
          </div>
        ) : hasAnalysis ? (
          <div className="absolute top-2 left-2 h-2 w-2 rounded-full z-10"
            style={{ background: "#a78bfa", boxShadow: "0 0 8px rgba(167,139,250,0.9)" }} />
        ) : null}
        <div className="absolute top-2 right-2 text-[9px] text-white/50 z-10 font-light"
          style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
          {fmtDate(reel.published_at, dateLocale)}
        </div>

        {/* External link (bottom-right corner of thumbnail) */}
        {reel.permalink && (
          <a href={reel.permalink} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-2 right-2 h-6 w-6 rounded-lg flex items-center justify-center z-10 transition-all hover:scale-105"
            style={GLASS_SUBTLE}>
            <ExternalLink size={9} className="text-white/60" />
          </a>
        )}
      </Link>

      {/* Footer — stats + caption + hook + action */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-1">
          {[
            { icon: Eye,           v: fmt(reel.views_count),    l: t("competitor.stats.views") },
            { icon: Heart,         v: fmt(reel.likes_count),    l: t("competitor.stats.likes") },
            { icon: MessageCircle, v: fmt(reel.comments_count), l: t("competitor.stats.commentsShort") },
            { icon: Share2,        v: fmt(reel.shares_count),   l: t("competitor.stats.sharesShort") },
          ].map(({ icon: Icon, v, l }) => (
            <div key={l} className="flex flex-col items-center py-1.5 rounded-lg bg-white/[0.04]">
              <Icon size={10} className="text-white/25 mb-0.5" />
              <span className="text-[11px] font-medium text-white/70 leading-none">{v}</span>
              <span className="text-[8px] text-white/25 mt-0.5">{l}</span>
            </div>
          ))}
        </div>

        {/* Caption */}
        <p className="text-[10px] text-white/50 font-light leading-relaxed line-clamp-2 flex-1">
          {reel.caption ?? <span className="italic text-white/20">{t("competitor.noCaption")}</span>}
        </p>

        {/* Hook badge */}
        {hasAnalysis && analysis && <HookBadge type={analysis.hook_type} small />}

        {/* Action button */}
        {!hasAnalysis ? (
          <button
            onClick={() => onAnalyze(reel.id)}
            disabled={analyzing}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11px] font-medium text-white/40 hover:text-white/70 transition-all cursor-pointer disabled:opacity-30"
            style={GLASS_SUBTLE}
          >
            {analyzing ? <RefreshCw size={10} className="animate-spin" /> : <Brain size={10} />}
            {analyzing ? t("competitor.actions.analyzing") : t("competitor.actions.analyze")}
          </button>
        ) : (
          <Link
            href={`/instagram/competencia/${competitorId}/${reel.id}`}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11px] font-medium text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-200 transition-all cursor-pointer"
            style={GLASS_VIOLET}
          >
            <Zap size={10} />
            {t("competitor.actions.viewAnalysis")}
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Competitor sidebar card ──────────────────────────────────────────────────

function CompetitorCard({ competitor, selected, onClick }: {
  competitor: Competitor;
  selected: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("igAdvanced");
  const profile = competitor.scraped_data as ScrapedData;
  const total = competitor.competitor_reels.length;
  const analyzed = competitor.competitor_reels.filter((r) => getAnalysis(r) !== null).length;
  const isAnalyzing = competitor.analysis_status === "analyzing";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl p-3 transition-all cursor-pointer border ${
        selected
          ? "bg-white/[0.1] border-white/[0.1]"
          : "bg-white/[0.02] border-white/[0.06]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Avatar url={profile?.ig_profile_pic_url} name={competitor.name} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-[13px] text-white/80 font-light truncate">{competitor.name ?? t("competitor.unnamed")}</p>
            {profile?.ig_is_verified && <CheckCircle2 size={11} className="text-sky-400 shrink-0" />}
          </div>
          <p className="text-[11px] text-white/25 truncate">{extractUsername(competitor.ig_url)}</p>
        </div>
        <div className="shrink-0 text-right">
          {isAnalyzing ? (
            <span className="flex items-center gap-1 text-[10px] text-amber-400/70">
              <RefreshCw size={8} className="animate-spin" /> {t("competitor.actions.analyzingShort")}
            </span>
          ) : total > 0 ? (
            <span className="text-[10px] text-white/25">{analyzed}/{total}</span>
          ) : null}
          {profile?.ig_follower_count && (
            <p className="text-[10px] text-white/20 flex items-center gap-0.5 justify-end">
              <Users size={8} />{fmt(profile.ig_follower_count)}
            </p>
          )}
        </div>
      </div>
      {total > 0 && (
        <div className="mt-2 h-0.5 rounded-full bg-white/[0.05] overflow-hidden">
          <div className="h-full rounded-full bg-violet-500/40 transition-all"
            style={{ width: `${(analyzed / total) * 100}%` }} />
        </div>
      )}
    </button>
  );
}

// ─── Comparison charts ────────────────────────────────────────────────────────

function ComparisonCharts({ competitor, myStats }: { competitor: Competitor; myStats: MyStats }) {
  const t = useTranslations("igAdvanced");
  const reels = competitor.competitor_reels;
  // NOTE: these filters (views_count > 0, likes_count > 0, comments_count > 0)
  // MUST stay in sync with the "Yo" side in InstagramShell.tsx (which filters
  // views_total > 0 before averaging). Asymmetric denominators biased "Yo vs
  // Ellos" against the user because day-1 reels diluted the user's averages
  // while the competitor side was already filtered. Do not remove these filters.
  const theirAvgViews    = (() => { const w = reels.filter(r => (r.views_count ?? 0) > 0); return w.length > 0 ? Math.round(w.reduce((s,r) => s+(r.views_count??0),0)/w.length) : 0; })();
  const theirAvgLikes    = (() => { const w = reels.filter(r => (r.likes_count ?? 0) > 0); return w.length > 0 ? Math.round(w.reduce((s,r) => s+(r.likes_count??0),0)/w.length) : 0; })();
  const theirAvgComments = (() => { const w = reels.filter(r => (r.comments_count ?? 0) > 0); return w.length > 0 ? Math.round(w.reduce((s,r) => s+(r.comments_count??0),0)/w.length) : 0; })();
  const theirFollowers   = (competitor.scraped_data as ScrapedData)?.ig_follower_count ?? 0;

  const metrics = [
    { label: t("competitor.compare.avgViews"),  yo: myStats.avgViews,    ellos: theirAvgViews },
    { label: t("competitor.compare.avgLikes"),  yo: myStats.avgLikes,    ellos: theirAvgLikes },
    { label: t("competitor.compare.avgCom"),    yo: myStats.avgComments, ellos: theirAvgComments },
    { label: t("competitor.compare.followers"), yo: myStats.followers,   ellos: theirFollowers },
  ];

  return (
    <div className="glass-card rounded-xl p-3.5 space-y-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <BarChart3 size={9} /> {t("competitor.compare.youVs", { name: competitor.name ?? t("competitor.unnamed") })}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-3 rounded-full" style={{ background: CHART_COLORS.mine }} />
            <span className="text-[9px] text-muted-foreground">{t("competitor.compare.you")}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-3 rounded-full" style={{ background: CHART_COLORS.competitor }} />
            <span className="text-[9px] text-muted-foreground">{(competitor.name ?? t("competitor.compare.them")).split(" ")[0]}</span>
          </div>
        </div>
      </div>

      {metrics.map(({ label, yo, ellos }) => {
        const max = Math.max(yo, ellos, 1);
        const yoPct    = Math.round((yo    / max) * 100);
        const ellosPct = Math.round((ellos / max) * 100);
        const diff = ellos > 0 ? Math.round(((yo - ellos) / ellos) * 100) : 0;
        return (
          <div key={label} className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-white/20 uppercase tracking-wider">{label}</p>
              {ellos > 0 && (
                <span className={`text-[10px] font-medium ${diff >= 0 ? "text-teal-400" : "text-rose-400"}`}>
                  {diff >= 0 ? "+" : ""}{diff}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-white/15 w-4 text-right shrink-0">{t("competitor.compare.youShort")}</span>
              <div className="flex-1 h-4 rounded-md overflow-hidden bg-white/[0.04]">
                <div className="h-full rounded-md flex items-center px-2 transition-all"
                  style={{ width: `${Math.max(yoPct, 6)}%`, background: `${CHART_COLORS.mine}55` }}>
                  <span className="text-[9px] text-white/60 font-medium">{fmt(yo)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-white/15 w-4 text-right shrink-0">{t("competitor.compare.themShort")}</span>
              <div className="flex-1 h-4 rounded-md overflow-hidden bg-white/[0.04]">
                <div className="h-full rounded-md flex items-center px-2 transition-all"
                  style={{ width: `${Math.max(ellosPct, 6)}%`, background: `${CHART_COLORS.competitor}55` }}>
                  <span className="text-[9px] text-white/60 font-medium">{fmt(ellos)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Views Timeline chart ─────────────────────────────────────────────────────

function ViewsTimeline({ competitor, myReels }: { competitor: Competitor; myReels: MyReel[] }) {
  const chart = useChartTheme();
  const t = useTranslations("igAdvanced");
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "es-AR";
  const W = 260; const H = 140; const PAD = { t: 10, r: 6, b: 22, l: 38 };
  const CW = W - PAD.l - PAD.r;
  const CH = H - PAD.t - PAD.b;

  const [tooltip, setTooltip] = useState<{ svgX: number; svgY: number; myV: number | null; theirV: number | null; dateStr: string } | null>(null);

  const { myPts, theirPts, maxV, minMs, maxMs } = useMemo(() => {
    const my = myReels
      .filter((r) => r.published_at)
      .map((r) => ({ ms: new Date(r.published_at!).getTime(), v: r.views_total }))
      .sort((a, b) => a.ms - b.ms);
    const theirs = competitor.competitor_reels
      .filter((r) => r.published_at && (r.views_count ?? 0) > 0)
      .map((r) => ({ ms: new Date(r.published_at!).getTime(), v: r.views_count! }))
      .sort((a, b) => a.ms - b.ms);
    const allVals = [...my.map((p) => p.v), ...theirs.map((p) => p.v)];
    const allMs  = [...my.map((p) => p.ms), ...theirs.map((p) => p.ms)];
    return {
      myPts: my, theirPts: theirs,
      maxV:  allVals.length ? Math.max(...allVals) : 1,
      minMs: allMs.length  ? Math.min(...allMs)   : 0,
      maxMs: allMs.length  ? Math.max(...allMs)   : 1,
    };
  }, [competitor.competitor_reels, myReels]);

  if (myPts.length === 0 && theirPts.length === 0) return null;

  const xScale = (ms: number) => PAD.l + ((ms - minMs) / Math.max(maxMs - minMs, 1)) * CW;
  const yScale = (v: number)  => PAD.t + CH - (v / maxV) * CH;

  const toPolyline = (pts: { ms: number; v: number }[]) =>
    pts.map((p) => `${xScale(p.ms).toFixed(1)},${yScale(p.v).toFixed(1)}`).join(" ");

  const fmtV = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v);

  const yTicks = [0, 0.5, 1].map((r) => ({ v: Math.round(maxV * r), y: yScale(maxV * r) }));
  const allMs = [...myPts.map((p) => p.ms), ...theirPts.map((p) => p.ms)].sort((a, b) => a - b);
  const xTickMs = allMs.length > 1 ? [allMs[0]!, allMs[allMs.length - 1]!] : allMs;
  const fmtMs = (ms: number) => { const d = new Date(ms); return `${d.getDate()}/${d.getMonth() + 1}`; };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const ratio = Math.max(0, Math.min(1, (svgPt.x - PAD.l) / CW));
    const ms = minMs + ratio * (maxMs - minMs);

    const nearest = (pts: { ms: number; v: number }[]) =>
      pts.length === 0 ? null : pts.reduce((b, p) => Math.abs(p.ms - ms) < Math.abs(b.ms - ms) ? p : b);

    const my = nearest(myPts);
    const their = nearest(theirPts);
    const refMs = my && their
      ? (Math.abs(my.ms - ms) < Math.abs(their.ms - ms) ? my.ms : their.ms)
      : (my?.ms ?? their?.ms ?? ms);

    const d = new Date(refMs);
    const dateStr = d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });

    setTooltip({
      svgX: xScale(refMs),
      svgY: PAD.t,
      myV: my ? my.v : null,
      theirV: their ? their.v : null,
      dateStr,
    });
  };

  const tooltipWidth = 80;

  return (
    <div className="glass-card rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp size={9} /> {t("competitor.charts.viewsTimeline")}
        </p>
        <div className="flex items-center gap-3">
          {myPts.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-3 rounded-full" style={{ background: CHART_COLORS.mine }} />
              <span className="text-[9px] text-muted-foreground">{t("competitor.compare.you")}</span>
            </div>
          )}
          {theirPts.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-3 rounded-full" style={{ background: CHART_COLORS.competitor }} />
              <span className="text-[9px] text-muted-foreground">{(competitor.name ?? t("competitor.compare.them")).split(" ")[0]}</span>
            </div>
          )}
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}>
        {/* Grid lines */}
        {yTicks.map(({ y }, i) => (
          <line key={i} x1={PAD.l} x2={W - PAD.r} y1={y} y2={y}
            stroke={chart.grid} strokeWidth="1" />
        ))}
        {/* Y-axis labels */}
        {yTicks.map(({ v, y }, i) => (
          <text key={i} x={PAD.l - 4} y={y + 3} textAnchor="end"
            fontSize="7" fill={chart.axisTickMuted} fontFamily="inherit">
            {fmtV(v)}
          </text>
        ))}
        {/* X-axis labels */}
        {xTickMs.map((ms, i) => (
          <text key={i} x={xScale(ms)} y={H - 2}
            textAnchor={i === 0 ? "start" : "end"}
            fontSize="7" fill={chart.axisTickMuted} fontFamily="inherit">
            {fmtMs(ms)}
          </text>
        ))}
        {/* My line */}
        {myPts.length > 1 && (
          <polyline points={toPolyline(myPts)} fill="none"
            stroke={CHART_COLORS.mine} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* Their line */}
        {theirPts.length > 1 && (
          <polyline points={toPolyline(theirPts)} fill="none"
            stroke={CHART_COLORS.competitor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* Dots */}
        {myPts.map((p, i) => (
          <circle key={i} cx={xScale(p.ms)} cy={yScale(p.v)} r="2.5"
            fill={CHART_COLORS.mine} opacity={0.9} />
        ))}
        {theirPts.map((p, i) => (
          <circle key={i} cx={xScale(p.ms)} cy={yScale(p.v)} r="2.5"
            fill={CHART_COLORS.competitor} opacity={0.9} />
        ))}

        {/* Hover guideline + tooltip */}
        {tooltip && (() => {
          const tx = tooltip.svgX;
          const clampedTx = Math.min(tx, W - PAD.r - tooltipWidth / 2);
          const boxX = Math.max(PAD.l, clampedTx - tooltipWidth / 2);
          const rows: { label: string; val: string; color: string }[] = [];
          if (tooltip.myV !== null) rows.push({ label: t("competitor.compare.you"), val: fmtV(tooltip.myV), color: CHART_COLORS.mine });
          if (tooltip.theirV !== null) rows.push({ label: (competitor.name ?? t("competitor.compare.them")).split(" ")[0]!, val: fmtV(tooltip.theirV), color: CHART_COLORS.competitor });
          const boxH = 14 + rows.length * 13;
          return (
            <g>
              {/* Vertical guideline */}
              <line x1={tx} x2={tx} y1={PAD.t} y2={PAD.t + CH}
                stroke={chart.benchmarkDot} strokeWidth="1" strokeDasharray="3 2" />
              {/* Tooltip box */}
              <rect x={boxX} y={PAD.t - 2} width={tooltipWidth} height={boxH} rx="5"
                fill={chart.tooltipBg} stroke={chart.tooltipBorder} strokeWidth="0.5" />
              <text x={boxX + tooltipWidth / 2} y={PAD.t + 8} textAnchor="middle"
                fontSize="7" fill={chart.tooltipTextMuted} fontFamily="inherit">
                {tooltip.dateStr}
              </text>
              {rows.map((row, i) => (
                <g key={i}>
                  <circle cx={boxX + 8} cy={PAD.t + 17 + i * 13} r="2.5" fill={row.color} />
                  <text x={boxX + 14} y={PAD.t + 20 + i * 13}
                    fontSize="8" fill={chart.tooltipText} fontFamily="inherit">
                    {row.label}: <tspan fontWeight="600" fill={chart.tooltipText}>{row.val}</tspan>
                  </text>
                </g>
              ))}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ─── Follower Growth chart ────────────────────────────────────────────────────
// Shows my daily follower line vs competitor's historical snapshots (one per scrape-day).
// Competitor data accumulates over time — the first scrape gives 1 point, subsequent
// scrapes build the trend. Shows an informational placeholder when <2 competitor points.

function FollowerGrowth({ competitor, myFollowerHistory }: { competitor: Competitor; myFollowerHistory: MyFollowerPoint[] }) {
  const chart = useChartTheme();
  const t = useTranslations("igAdvanced");
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "es-AR";
  const W = 260; const H = 120; const PAD = { t: 10, r: 6, b: 22, l: 38 };
  const CW = W - PAD.l - PAD.r;
  const CH = H - PAD.t - PAD.b;

  const [tooltip, setTooltip] = useState<{ svgX: number; myV: number | null; theirV: number | null; dateStr: string } | null>(null);

  const { myPts, theirPts, minMs, maxMs, maxV } = useMemo(() => {
    const my = myFollowerHistory
      .filter((p) => p.followers > 0)
      .map((p) => ({ ms: new Date(p.date).getTime(), v: p.followers }))
      .sort((a, b) => a.ms - b.ms);
    const theirs = (competitor.competitor_follower_snapshots ?? [])
      .filter((s) => s.follower_count > 0)
      .map((s) => ({ ms: new Date(s.snapshot_date).getTime(), v: s.follower_count }))
      .sort((a, b) => a.ms - b.ms);
    const allMs  = [...my.map((p) => p.ms), ...theirs.map((p) => p.ms)];
    const allVals = [...my.map((p) => p.v), ...theirs.map((p) => p.v)];
    return {
      myPts: my, theirPts: theirs,
      minMs: allMs.length ? Math.min(...allMs) : 0,
      maxMs: allMs.length ? Math.max(...allMs) : 1,
      maxV:  allVals.length ? Math.max(...allVals) * 1.05 : 1,
    };
  }, [myFollowerHistory, competitor.competitor_follower_snapshots]);

  if (myPts.length === 0 && theirPts.length === 0) return null;

  const xScale = (ms: number) => PAD.l + ((ms - minMs) / Math.max(maxMs - minMs, 1)) * CW;
  const yScale = (v: number)  => PAD.t + CH - (v / maxV) * CH;
  const fmtV = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v);

  const yTicks = [0, 0.5, 1].map((r) => ({ v: Math.round(maxV * r), y: yScale(maxV * r) }));
  const allMs  = [...myPts.map((p) => p.ms), ...theirPts.map((p) => p.ms)].sort((a, b) => a - b);
  const xTickMs = allMs.length > 1 ? [allMs[0]!, allMs[allMs.length - 1]!] : allMs;
  const fmtMs = (ms: number) => { const d = new Date(ms); return `${d.getDate()}/${d.getMonth() + 1}`; };

  const myPolyline    = myPts.map((p) => `${xScale(p.ms).toFixed(1)},${yScale(p.v).toFixed(1)}`).join(" ");
  const theirPolyline = theirPts.map((p) => `${xScale(p.ms).toFixed(1)},${yScale(p.v).toFixed(1)}`).join(" ");

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const allPts = [...myPts, ...theirPts];
    if (allPts.length === 0) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const ratio = Math.max(0, Math.min(1, (svgPt.x - PAD.l) / CW));
    const ms = minMs + ratio * (maxMs - minMs);

    const nearest = (pts: { ms: number; v: number }[]) =>
      pts.length === 0 ? null : pts.reduce((b, p) => Math.abs(p.ms - ms) < Math.abs(b.ms - ms) ? p : b);

    const my = nearest(myPts);
    const their = nearest(theirPts);
    const refMs = my && their
      ? (Math.abs(my.ms - ms) < Math.abs(their.ms - ms) ? my.ms : their.ms)
      : (my?.ms ?? their?.ms ?? ms);

    const dateStr = new Date(refMs).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });
    setTooltip({ svgX: xScale(refMs), myV: my?.v ?? null, theirV: their?.v ?? null, dateStr });
  };

  const tooltipWidth = 95;
  // If competitor has only 1 snapshot, show it as a dot + label (not a line)
  const theirCurrentFollowers = (competitor.scraped_data as ScrapedData)?.ig_follower_count ?? null;
  const noTheirHistory = theirPts.length < 2;

  return (
    <div className="glass-card rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Users size={9} /> {t("competitor.charts.followerGrowth")}
        </p>
        <div className="flex items-center gap-3">
          {myPts.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-3 rounded-full" style={{ background: CHART_COLORS.mine }} />
              <span className="text-[9px] text-muted-foreground">{t("competitor.compare.you")}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-3 rounded-full" style={{ background: CHART_COLORS.competitor }} />
            <span className="text-[9px] text-muted-foreground">{(competitor.name ?? t("competitor.compare.them")).split(" ")[0]}</span>
          </div>
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", cursor: "crosshair" }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
        {/* Grid lines */}
        {yTicks.map(({ y }, i) => (
          <line key={i} x1={PAD.l} x2={W - PAD.r} y1={y} y2={y}
            stroke={chart.grid} strokeWidth="1" />
        ))}
        {/* Y-axis labels */}
        {yTicks.map(({ v, y }, i) => (
          <text key={i} x={PAD.l - 4} y={y + 3} textAnchor="end"
            fontSize="7" fill={chart.axisTickMuted} fontFamily="inherit">
            {fmtV(v)}
          </text>
        ))}
        {/* X-axis labels */}
        {xTickMs.map((ms, i) => (
          <text key={i} x={xScale(ms)} y={H - 2}
            textAnchor={i === 0 ? "start" : "end"}
            fontSize="7" fill={chart.axisTickMuted} fontFamily="inherit">
            {fmtMs(ms)}
          </text>
        ))}

        {/* My follower line */}
        {myPts.length > 1 && (
          <polyline points={myPolyline} fill="none"
            stroke={CHART_COLORS.mine} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {myPts.filter((_, i) => i % Math.ceil(myPts.length / 12) === 0 || i === myPts.length - 1).map((p, i) => (
          <circle key={i} cx={xScale(p.ms)} cy={yScale(p.v)} r="2"
            fill={CHART_COLORS.mine} opacity={0.85} />
        ))}

        {/* Competitor line (once ≥2 snapshots) */}
        {!noTheirHistory && (
          <>
            <polyline points={theirPolyline} fill="none"
              stroke={CHART_COLORS.competitor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {theirPts.filter((_, i) => i % Math.ceil(theirPts.length / 8) === 0 || i === theirPts.length - 1).map((p, i) => (
              <circle key={i} cx={xScale(p.ms)} cy={yScale(p.v)} r="2"
                fill={CHART_COLORS.competitor} opacity={0.85} />
            ))}
          </>
        )}

        {/* If only 1 competitor snapshot — show as dot + current value label */}
        {noTheirHistory && theirCurrentFollowers && myPts.length > 0 && (() => {
          const cy = yScale(theirCurrentFollowers);
          const cx = xScale(maxMs);
          return (
            <>
              <circle cx={cx} cy={cy} r="3" fill={CHART_COLORS.competitor} opacity={0.85} />
              <text x={cx + 5} y={cy + 3} fontSize="7" fill={CHART_COLORS.competitor} fontFamily="inherit" opacity={0.8}>
                {fmtV(theirCurrentFollowers)}
              </text>
            </>
          );
        })()}

        {/* Hover guideline + tooltip */}
        {tooltip && (() => {
          const tx = tooltip.svgX;
          const boxX = Math.max(PAD.l, Math.min(tx - tooltipWidth / 2, W - PAD.r - tooltipWidth));
          const rows: { label: string; val: string; color: string }[] = [];
          if (tooltip.myV !== null) rows.push({ label: t("competitor.compare.you"), val: fmtV(tooltip.myV), color: CHART_COLORS.mine });
          if (tooltip.theirV !== null) rows.push({ label: (competitor.name ?? t("competitor.compare.them")).split(" ")[0]!, val: fmtV(tooltip.theirV), color: CHART_COLORS.competitor });
          if (rows.length === 0) return null;
          const boxH = 14 + rows.length * 13;
          return (
            <g>
              <line x1={tx} x2={tx} y1={PAD.t} y2={PAD.t + CH}
                stroke={chart.benchmarkDot} strokeWidth="1" strokeDasharray="3 2" />
              <rect x={boxX} y={PAD.t - 2} width={tooltipWidth} height={boxH} rx="5"
                fill={chart.tooltipBg} stroke={chart.tooltipBorder} strokeWidth="0.5" />
              <text x={boxX + tooltipWidth / 2} y={PAD.t + 8} textAnchor="middle"
                fontSize="7" fill={chart.tooltipTextMuted} fontFamily="inherit">
                {tooltip.dateStr}
              </text>
              {rows.map((row, i) => (
                <g key={i}>
                  <circle cx={boxX + 8} cy={PAD.t + 17 + i * 13} r="2.5" fill={row.color} />
                  <text x={boxX + 14} y={PAD.t + 20 + i * 13}
                    fontSize="8" fill={chart.tooltipText} fontFamily="inherit">
                    {row.label}: <tspan fontWeight="600" fill={chart.tooltipText}>{row.val}</tspan>
                  </text>
                </g>
              ))}
            </g>
          );
        })()}
      </svg>

      {/* Hint when competitor has <2 snapshots */}
      {noTheirHistory && (
        <p className="text-[8px] text-white/20 font-light text-center pb-0.5">
          {t("competitor.charts.historyAccumulates")}
        </p>
      )}
    </div>
  );
}

// ─── Insights panel ───────────────────────────────────────────────────────────

function InsightsPanel({ competitor, myStats, myReels, myFollowerHistory }: {
  competitor: Competitor;
  myStats: MyStats;
  myReels: MyReel[];
  myFollowerHistory: MyFollowerPoint[];
}) {
  const t = useTranslations("igAdvanced");
  const reels = competitor.competitor_reels;
  const analyzed = reels.filter((r) => getAnalysis(r) !== null);

  const hookCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of analyzed) {
      const t = getAnalysis(r)?.hook_type ?? "desconocido";
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [analyzed]);


  const topTopics = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of analyzed) {
      const topic = getAnalysis(r)?.topic_cluster;
      if (topic) counts[topic] = (counts[topic] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [analyzed]);

  const topReel = useMemo(
    () => [...reels].sort((a, b) => (b.views_count ?? 0) - (a.views_count ?? 0))[0] ?? null,
    [reels]
  );

  return (
    <div className="space-y-3">
      {/* KPIs — 3D liquid glass */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { v: reels.length.toString(),    l: t("competitor.insights.reels") },
          { v: analyzed.length.toString(), l: t("competitor.insights.analyzed") },
          { v: fmt(reels.filter(r=>r.views_count).length > 0 ? Math.round(reels.filter(r=>r.views_count).reduce((s,r)=>s+(r.views_count??0),0)/reels.filter(r=>r.views_count).length) : 0), l: t("competitor.insights.avgViews") },
        ].map(({ v, l }) => (
          <div key={l} className="glass-card rounded-xl p-2.5 text-center">
            <p className="text-[15px] font-light text-white/80">{v}</p>
            <p className="text-[8px] text-white/25 mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* Top reel */}
      {topReel && (
        <div className="glass-card rounded-xl p-2.5 flex gap-2.5">
          {topReel.thumbnail_url && (
            <div className="shrink-0 w-10 h-12 rounded-lg overflow-hidden relative bg-muted">
              <Thumbnail url={topReel.thumbnail_url} duration={null} showDuration={false} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[8px] text-teal-400/60 uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <TrendingUp size={8} /> {t("competitor.insights.topReel")}
            </p>
            <p className="text-[10px] text-white/55 font-light line-clamp-2 leading-snug">
              {topReel.caption ?? t("competitor.noCaption")}
            </p>
            <p className="text-[9px] text-white/25 mt-1">{t("competitor.insights.viewsCount", { count: fmt(topReel.views_count) })}</p>
          </div>
        </div>
      )}

      <ComparisonCharts competitor={competitor} myStats={myStats} />

      <ViewsTimeline competitor={competitor} myReels={myReels} />

      <FollowerGrowth competitor={competitor} myFollowerHistory={myFollowerHistory} />

      {/* Hook types */}
      {hookCounts.filter(([k]) => k !== "desconocido").length > 0 && (
        <div className="rounded-xl p-3 space-y-2.5 bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[9px] text-white/25 uppercase tracking-wider flex items-center gap-1.5">
            <Zap size={9} /> {t("competitor.insights.hookTypes")}
          </p>
          {hookCounts.filter(([k]) => k !== "desconocido").map(([type, count]) => {
            const metaKey = type in HOOK_TYPE_META ? type : "desconocido";
            const meta = HOOK_TYPE_META[metaKey]!;
            const pct = Math.round((count / analyzed.length) * 100);
            return (
              <div key={type} className="flex items-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}`} />
                <p className={`text-[10px] w-20 shrink-0 ${meta.color}`}>{t(`competitor.hookTypes.${metaKey}`)}</p>
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.hex }} />
                </div>
                <p className="text-[9px] text-white/25 w-7 text-right">{pct}%</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Topics */}
      {topTopics.length > 0 && (
        <div className="rounded-xl p-3 space-y-2 bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[9px] text-white/25 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen size={9} /> {t("competitor.insights.frequentTopics")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {topTopics.map(([topic, count]) => (
              <span key={topic} className="px-2 py-0.5 rounded-full text-[9px] text-white/40 font-light bg-white/[0.05] border border-white/[0.08]">
                {topic} <span className="text-white/20">·{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {analyzed.length === 0 && (
        <div className="rounded-xl p-4 text-center bg-white/[0.02] border border-white/[0.06]">
          <Brain size={16} className="text-white/15 mx-auto mb-1.5" />
          <p className="text-[10px] text-white/20 font-light">{t("competitor.insights.analyzePrompt")}</p>
        </div>
      )}
    </div>
  );
}

// ─── Global insights ──────────────────────────────────────────────────────────

function GlobalInsights({ competitors }: { competitors: Competitor[] }) {
  const t = useTranslations("igAdvanced");
  const allAnalyzed = useMemo(
    () => competitors.flatMap((c) => c.competitor_reels).filter((r) => getAnalysis(r) !== null),
    [competitors]
  );

  const hookCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of allAnalyzed) {
      const hk = getAnalysis(r)?.hook_type ?? "desconocido";
      counts[hk] = (counts[hk] ?? 0) + 1;
    }
    return Object.entries(counts).filter(([k]) => k !== "desconocido").sort((a, b) => b[1] - a[1]);
  }, [allAnalyzed]);

  if (allAnalyzed.length === 0 || hookCounts.length === 0) return null;

  const topHook = hookCounts[0];
  const topKey = topHook[0] in HOOK_TYPE_META ? topHook[0] : "desconocido";
  const topMeta = HOOK_TYPE_META[topKey]!;

  return (
    <div className="rounded-xl p-4 overflow-hidden relative"
      style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)" }}>
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full pointer-events-none"
        style={{ background: "rgba(139,92,246,0.08)", filter: "blur(32px)" }} />

      <div className="flex items-start gap-4 relative">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={12} className="text-violet-400 shrink-0" />
            <p className="text-[10px] text-violet-700 dark:text-violet-300/70 font-medium uppercase tracking-wider">
              {t("competitor.global.patterns", { count: allAnalyzed.length })}
            </p>
          </div>
          <div className="space-y-2">
            {hookCounts.slice(0, 5).map(([type, count]) => {
              const metaKey = type in HOOK_TYPE_META ? type : "desconocido";
              const meta = HOOK_TYPE_META[metaKey]!;
              const pct = Math.round((count / allAnalyzed.length) * 100);
              return (
                <div key={type} className="flex items-center gap-2.5">
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}`} />
                  <p className={`text-[11px] w-[88px] shrink-0 font-light ${meta.color}`}>{t(`competitor.hookTypes.${metaKey}`)}</p>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: meta.hex, opacity: 0.8 }} />
                  </div>
                  <p className="text-[10px] text-white/30 w-7 text-right tabular-nums">{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 rounded-xl p-3 text-center min-w-[88px] bg-white/[0.04] border border-white/[0.07]">
          <div className={`h-2 w-2 rounded-full mx-auto mb-1.5 ${topMeta.dot}`}
            style={{ boxShadow: `0 0 8px ${topMeta.hex}99` }} />
          <p className="text-[8px] text-white/25 uppercase tracking-wider mb-0.5">{t("competitor.global.topHook")}</p>
          <p className={`text-[11px] font-medium ${topMeta.color}`}>{t(`competitor.hookTypes.${topKey}`)}</p>
          <p className="text-[9px] text-white/20 mt-0.5">
            {Math.round((topHook[1] / allAnalyzed.length) * 100)}%
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Sort dropdown ────────────────────────────────────────────────────────────

function SortDropdown({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  const t = useTranslations("igAdvanced");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SORT_OPTION_KEYS.find((o) => o.key === value)!;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] text-white/50 hover:text-white/75 transition-all cursor-pointer bg-white/[0.08] border border-white/[0.1]">
        <ArrowUpDown size={10} />
        <current.icon size={10} />
        {t(`competitor.sort.${current.key}`)}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 rounded-xl py-1 z-20 min-w-[120px] bg-popover text-popover-foreground border border-border shadow-xl backdrop-blur-xl">
          {SORT_OPTION_KEYS.map((opt) => (
            <button key={opt.key} onClick={() => { onChange(opt.key); setOpen(false); }}
              className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors cursor-pointer ${
                value === opt.key ? "text-white/80" : "text-white/35 hover:text-white/60"
              }`}>
              <opt.icon size={10} />
              {t(`competitor.sort.${opt.key}`)}
              {value === opt.key && <span className="ml-auto text-violet-600 dark:text-violet-400 text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CompetitorTab({ workspaceId, initialCompetitors, myStats, myReels, myFollowerHistory }: {
  workspaceId: string | null;
  initialCompetitors?: Competitor[];
  myStats: MyStats;
  myReels: MyReel[];
  myFollowerHistory: MyFollowerPoint[];
}) {
  const t = useTranslations("igAdvanced");
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "es-AR";
  const router = useRouter();
  const [competitors, setCompetitors] = useState<Competitor[]>(initialCompetitors ?? []);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialCompetitors?.[0]?.id ?? null);
  const [scraping, setScraping] = useState<string | null>(null);
  const [analyzingReels, setAnalyzingReels] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("views");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  // Paginación del grid de reels del competidor seleccionado: 20 por página.
  // Reset a 1 cada vez que cambia de competidor, sort o filtro de tipo.
  const [reelsPage, setReelsPage] = useState(1);
  const REELS_PAGE_SIZE = 20;

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
  }), [workspaceId]);

  // Re-fetch competitors from API (used after scrape/analyze operations)
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/competitors", { headers });
      if (!res.ok) throw new Error(t("competitor.errors.loading"));
      const json = await res.json() as { data: { competitors: Competitor[] } };
      const list = json.data.competitors;
      setCompetitors(list);
      setSelectedId((prev) => prev ?? list[0]?.id ?? null);
    } catch {
      setError(t("competitor.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [headers, t]);

  const handleScrapeAndAnalyze = useCallback(async (competitorId: string) => {
    setScraping(competitorId);
    setError(null);
    // Optimistic: marcamos el competidor como 'analyzing' en el state local
    // para que el useEffect de polling arranque YA y el botón empiece a
    // pintar scrape_progress.message en vivo. Sin esto el polling no dispara
    // hasta que termine el scrape (60-90s) y load() traiga el status real.
    setCompetitors((prev) => prev.map((c) =>
      c.id === competitorId
        ? { ...c, analysis_status: "analyzing", scrape_progress: { phase: "starting", message: t("competitor.progress.preparing") } }
        : c,
    ));
    try {
      const scrapeRes = await fetch(`/api/v1/competitors/${competitorId}/scrape`, { method: "POST", headers });
      if (!scrapeRes.ok) {
        const err = await scrapeRes.json() as { error?: string };
        throw new Error(err.error ?? t("competitor.errors.scraping"));
      }
      const scrapeJson = await scrapeRes.json() as { data?: { reels_inserted?: number } };
      const newReels = scrapeJson.data?.reels_inserted ?? 0;

      // setScraping(null) temprano — el spinner del botón puede apagarse,
      // el polling se encarga de mostrar el progress del analyze que sigue.
      setScraping(null);

      if (newReels > 0) {
        // NO llamamos load() acá: entre scrape terminado e analyze iniciado,
        // el server queda momentáneamente en 'idle' y load() apagaría el
        // polling justo antes de que el analyze levante analysis_status de
        // nuevo a 'analyzing'. Mantenemos el state local optimistic y
        // dejamos que el useEffect de polling refresque al detectar la
        // transición analyzing→idle cuando el analyze termine.
        fetch(`/api/v1/competitors/${competitorId}/analyze`, { method: "POST", headers })
          .catch((err) => console.warn('[competitor-analyze] background analyze failed:', err));
      } else {
        // No hay reels para analizar — reset local + refetch ya.
        setCompetitors((prev) => prev.map((c) =>
          c.id === competitorId
            ? { ...c, analysis_status: "idle", scrape_progress: null }
            : c,
        ));
        await load();
      }
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("competitor.errors.analyze"));
      // Reset optimistic state tras un error.
      setCompetitors((prev) => prev.map((c) =>
        c.id === competitorId
          ? { ...c, analysis_status: "idle", scrape_progress: null }
          : c,
      ));
    } finally {
      setScraping(null);
    }
  }, [headers, load, t]);

  const handleAnalyzeReel = useCallback(async (competitorId: string, reelId: string) => {
    setAnalyzingReels((prev) => new Set(prev).add(reelId));
    try {
      const res = await fetch(`/api/v1/competitors/${competitorId}/reels/${reelId}/analyze`, { method: "POST", headers });
      if (!res.ok) {
        const body = await res.json() as { message?: string; error?: string };
        setError(body.message ?? body.error ?? t("competitor.errors.analyzeReel"));
      } else {
        // Navigate to the detail page — it fetches fresh data from the DB
        router.push(`/instagram/competencia/${competitorId}/${reelId}`);
      }
    } catch {
      setError(t("competitor.errors.analyzeReelNetwork"));
    } finally {
      setAnalyzingReels((prev) => { const n = new Set(prev); n.delete(reelId); return n; });
    }
  }, [headers, router, t]);

  const selected = competitors.find((c) => c.id === selectedId) ?? null;
  const filteredReels = selected
    ? selected.competitor_reels.filter((r) => {
        if (typeFilter === "trial") return r.maybe_trial === true;
        if (typeFilter === "normal") return r.maybe_trial !== true;
        return true;
      })
    : [];
  const sortedReels = sortReels(filteredReels, sort);
  const totalPages = Math.max(1, Math.ceil(sortedReels.length / REELS_PAGE_SIZE));
  const currentPage = Math.min(reelsPage, totalPages);
  const paginatedReels = sortedReels.slice(
    (currentPage - 1) * REELS_PAGE_SIZE,
    currentPage * REELS_PAGE_SIZE,
  );

  // Reset page when competitor, sort or type filter changes.
  useEffect(() => { setReelsPage(1); }, [selectedId, sort, typeFilter]);

  // Polling live progress. Seguimos polleando mientras haya AL MENOS UNA de
  // estas dos señales activas para el competidor:
  //   - analysis_status === "analyzing"
  //   - scrape_progress !== null (el scrape deja "done" entre scrape y analyze;
  //     analyze limpia a null cuando termina todo)
  // Esto cubre el intervalo ~500ms entre scrape (idle) y analyze (analyzing)
  // donde sólo con analysis_status perderíamos el handoff y apagaríamos el
  // poll antes de tiempo.
  const pollingCompetitorId = useMemo(
    () => competitors.find((c) => c.analysis_status === "analyzing" || c.scrape_progress != null)?.id ?? null,
    [competitors],
  );
  useEffect(() => {
    if (!pollingCompetitorId) return;
    let cancelled = false;
    let prevProgress: ScrapeProgress | null = { phase: "starting", message: "" };

    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/competitors/${pollingCompetitorId}`, { headers });
        if (!res.ok || cancelled) return;
        const json = await res.json() as { data?: { analysis_status: string; scrape_progress: ScrapeProgress | null } };
        const status = json.data?.analysis_status ?? "idle";
        const progress = json.data?.scrape_progress ?? null;

        setCompetitors((prev) => prev.map((c) =>
          c.id === pollingCompetitorId
            ? { ...c, analysis_status: status, scrape_progress: progress }
            : c,
        ));

        // Transición a "todo terminado": status idle + progress null.
        // Refrescamos la lista para traer reels + análisis nuevos.
        if (status === "idle" && progress === null && prevProgress !== null) {
          await load();
        }
        prevProgress = progress;
      } catch { /* ignore transient network errors */ }
    };

    // Primer tick inmediato, luego cada 2s.
    poll();
    const interval = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [pollingCompetitorId, headers, load]);

  if (loading) {
    return (
      <div className="grid grid-cols-[240px_1fr_300px] gap-4 animate-pulse">
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-white/[0.04]" />)}</div>
        <div className="space-y-3">
          <div className="h-24 rounded-xl bg-white/[0.025]" />
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {[1,2,3,4,5,6].map(i => <div key={i} className="rounded-xl bg-white/[0.025]" style={{ aspectRatio: "4/5" }} />)}
          </div>
        </div>
        <div className="h-[400px] rounded-xl bg-white/[0.025]" />
      </div>
    );
  }

  if (competitors.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="inline-flex flex-col items-center gap-4 max-w-sm">
          <div className="h-14 w-14 rounded-full bg-white/[0.05] flex items-center justify-center">
            <Swords size={22} className="text-white/25" />
          </div>
          <div>
            <p className="text-white/60 font-light text-[15px] mb-1">{t("competitor.empty.title")}</p>
            <p className="text-white/30 text-[13px] font-light leading-relaxed">
              {t("competitor.empty.body")}
            </p>
          </div>
          <a href="/settings/adn"
            className="flex items-center gap-2 text-[13px] font-medium text-violet-700 dark:text-violet-300 px-5 py-2.5 rounded-full transition-all"
            style={GLASS_VIOLET}>
            <BookMarked size={14} /> {t("competitor.empty.cta")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] text-rose-300 font-light"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <AlertCircle size={13} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-white/30 hover:text-white/60 cursor-pointer">✕</button>
          </div>
        )}

        <GlobalInsights competitors={competitors} />

        <div className="grid grid-cols-[240px_1fr_300px] gap-4 items-start">

          {/* ── Sidebar ── */}
          <div className="space-y-2">
            {competitors.map((c) => (
              <CompetitorCard key={c.id} competitor={c} selected={c.id === selectedId} onClick={() => setSelectedId(c.id)} />
            ))}
            <a href="/settings/adn"
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-[11px] text-white/20 hover:text-white/40 transition-colors border border-dashed border-white/[0.08]">
              {t("competitor.addCompetitor")}
            </a>
          </div>

          {/* ── Reels gallery ── */}
          {selected && (
            <div className="space-y-3 min-w-0">
              {/* Profile header — el overlay de progreso se monta sólo sobre este card */}
              <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.08] relative">
                {(selected.analysis_status === "analyzing" || selected.scrape_progress != null) && (
                  <ScrapeProgressOverlay competitor={selected} />
                )}
                <div className="flex items-start gap-3">
                  <Avatar url={(selected.scraped_data as ScrapedData)?.ig_profile_pic_url} name={selected.name} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-[15px] font-light text-white/85">{selected.name ?? t("competitor.unnamed")}</h2>
                      {(selected.scraped_data as ScrapedData)?.ig_is_verified && <CheckCircle2 size={13} className="text-sky-400" />}
                      {selected.ig_url && (
                        <a href={selected.ig_url.startsWith("http") ? selected.ig_url : `https://instagram.com/${selected.ig_url}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-white/25 hover:text-white/50 transition-colors flex items-center gap-1">
                          {extractUsername(selected.ig_url)} <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {(selected.scraped_data as ScrapedData)?.ig_follower_count && (
                        <Pill icon={Users}    value={fmt((selected.scraped_data as ScrapedData).ig_follower_count)} label={t("competitor.profile.followers")} />
                      )}
                      {(selected.scraped_data as ScrapedData)?.ig_post_count && (
                        <Pill icon={BookOpen} value={fmt((selected.scraped_data as ScrapedData).ig_post_count)}    label={t("competitor.profile.posts")} />
                      )}
                      {selected.last_scraped_at && (
                        <span className="flex items-center gap-1 text-[10px] text-white/20">
                          <Clock size={9} /> {t("competitor.profile.scrape")}: {fmtDate(selected.last_scraped_at, dateLocale)}
                        </span>
                      )}
                    </div>
                    {(selected.scraped_data as ScrapedData)?.ig_bio && (
                      <p className="text-[11px] text-white/30 font-light mt-1.5 leading-relaxed line-clamp-2">
                        {(selected.scraped_data as ScrapedData).ig_bio}
                      </p>
                    )}
                    {selected.why_better && (
                      <p className="text-[11px] text-violet-700 dark:text-violet-300/50 font-light mt-1 leading-snug">
                        {t("competitor.profile.whyBetter")}: {selected.why_better}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleScrapeAndAnalyze(selected.id)}
                    disabled={scraping === selected.id || selected.analysis_status === "analyzing"}
                    className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium transition-all cursor-pointer disabled:opacity-40 max-w-[320px]"
                    style={GLASS}
                  >
                    {(scraping === selected.id || selected.analysis_status === "analyzing") ? (
                      <>
                        <RefreshCw size={12} className="animate-spin text-white/40 shrink-0" />
                        <span className="text-white/50 truncate">
                          {selected.scrape_progress?.message ?? t("competitor.actions.analyzing")}
                        </span>
                      </>
                    ) : selected.competitor_reels.length > 0 ? (
                      <><RefreshCw size={12} className="text-white/55" /><span className="text-white/55">{t("competitor.actions.reanalyze")}</span></>
                    ) : (
                      <><Zap size={12} className="text-violet-600 dark:text-violet-400" /><span className="text-violet-700 dark:text-violet-300">{t("competitor.actions.scrapeAndAnalyze")}</span></>
                    )}
                  </button>
                </div>
              </div>

              {/* Reels header */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[11px] text-white/25 uppercase tracking-wider shrink-0">
                  {t("competitor.reelsHeader", { count: sortedReels.length })}
                  {typeFilter !== "all" && (
                    <span className="ml-1.5 text-white/15">/ {selected.competitor_reels.length}</span>
                  )}
                </p>
                {selected.competitor_reels.length > 1 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Type filter pills — mismo diseño que ReelsGrid */}
                    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                      {(
                        [
                          { key: "normal" as TypeFilter, label: t("competitor.typeFilter.reel"),  icon: null },
                          { key: "trial"  as TypeFilter, label: t("competitor.typeFilter.trial"), icon: AlertTriangle },
                          { key: "all"    as TypeFilter, label: t("competitor.typeFilter.all"),   icon: null },
                        ]
                      ).map(({ key, label, icon: Icon }) => {
                        const trialCount = selected.competitor_reels.filter((r) => r.maybe_trial === true).length;
                        return (
                          <button
                            key={key}
                            onClick={() => setTypeFilter(key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer border ${
                              typeFilter === key
                                ? "text-white bg-white/[0.1] border-white/[0.1]"
                                : "text-white/40 hover:text-white/60 hover:bg-white/[0.04] border-transparent"
                            }`}
                          >
                            {Icon && <Icon size={10} className={typeFilter === key ? "text-amber-400" : "text-white/30"} />}
                            {label}
                            {key === "trial" && trialCount > 0 && (
                              <span className="text-[10px] text-amber-400/70 tabular-nums">{trialCount}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <SortDropdown value={sort} onChange={setSort} />
                  </div>
                )}
              </div>

              {/* Responsive gallery grid */}
              {selected.competitor_reels.length === 0 ? (
                <div className="py-12 text-center rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <Play size={18} className="text-white/12 mx-auto mb-2" />
                  <p className="text-[12px] text-white/25 font-light">{t("competitor.noReels.title")}</p>
                  <p className="text-[10px] text-white/15 mt-1">{t("competitor.noReels.hint")}</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {paginatedReels.map((reel) => (
                      <ReelGalleryCard
                        key={reel.id}
                        reel={reel}
                        competitorId={selected.id}
                        onAnalyze={(reelId) => handleAnalyzeReel(selected.id, reelId)}
                        analyzing={analyzingReels.has(reel.id)}
                      />
                    ))}
                  </div>

                  {/* Footer de paginación — solo si hay más de una página */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-1">
                      <span className="text-[11px] text-white/30">
                        {t("competitor.pagination.range", {
                          from: (currentPage - 1) * REELS_PAGE_SIZE + 1,
                          to: Math.min(currentPage * REELS_PAGE_SIZE, sortedReels.length),
                          total: sortedReels.length,
                        })}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setReelsPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/60 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {t("competitor.pagination.previous")}
                        </button>
                        <span className="text-[11px] text-white/40 px-2 tabular-nums">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setReelsPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/60 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {t("competitor.pagination.next")}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Insights panel ── */}
          {selected && (
            <div className="sticky top-4 space-y-3">
              <p className="text-[10px] text-white/25 uppercase tracking-wider flex items-center gap-1.5">
                <Brain size={10} /> {t("competitor.insights.heading")}
              </p>
              <InsightsPanel competitor={selected} myStats={myStats} myReels={myReels} myFollowerHistory={myFollowerHistory} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
