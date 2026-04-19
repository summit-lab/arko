"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  RefreshCw, Zap, ExternalLink, Users, Play, Heart, MessageCircle,
  Share2, CheckCircle2, Clock, AlertCircle, ChevronDown,
  Swords, TrendingUp, Brain, Lightbulb, BarChart3, BookOpen,
  ArrowUpDown, Calendar, Eye, BookMarked, X, Target, Sparkles,
  Layers, Shield, AlertTriangle, Palette, MousePointerClick,
} from "lucide-react";

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

interface Competitor {
  id: string;
  name: string | null;
  ig_url: string | null;
  why_better: string | null;
  scraped_data: ScrapedData;
  last_scraped_at: string | null;
  analysis_status: string;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const HOOK_TYPE_META: Record<string, { label: string; color: string; dot: string; hex: string }> = {
  transformacion: { label: "Transformación", color: "text-violet-400",  dot: "bg-violet-400",  hex: "#a78bfa" },
  enemigo:        { label: "Enemigo",         color: "text-rose-400",    dot: "bg-rose-400",    hex: "#fb7185" },
  negativo:       { label: "Negativo",        color: "text-amber-400",   dot: "bg-amber-400",   hex: "#fbbf24" },
  promesa:        { label: "Promesa",         color: "text-teal-400",    dot: "bg-teal-400",    hex: "#2dd4bf" },
  curiosidad:     { label: "Curiosidad",      color: "text-sky-400",     dot: "bg-sky-400",     hex: "#38bdf8" },
  desconocido:    { label: "Sin clasificar",  color: "text-white/30",    dot: "bg-white/20",    hex: "rgba(255,255,255,0.15)" },
};

const CHART_COLORS = { mine: "#7A86E0", competitor: "#AF6EC7" };

const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ElementType }[] = [
  { key: "views", label: "Views",  icon: Eye },
  { key: "likes", label: "Likes",  icon: Heart },
  { key: "date",  label: "Fecha",  icon: Calendar },
];

// ─── Glass styles ─────────────────────────────────────────────────────────────

const GLASS = {
  background: "rgba(255,255,255,0.08)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.15)",
  boxShadow: "0 1px 16px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.15)",
} as React.CSSProperties;

const GLASS_VIOLET = {
  background: "rgba(139,92,246,0.15)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(139,92,246,0.35)",
  boxShadow: "0 1px 16px rgba(139,92,246,0.1), inset 0 1px 0 rgba(255,255,255,0.12)",
} as React.CSSProperties;

const GLASS_SUBTLE = {
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.09)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
} as React.CSSProperties;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null || n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
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
      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
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
  const meta = HOOK_TYPE_META[type ?? "desconocido"] ?? HOOK_TYPE_META.desconocido;
  return (
    <span className={`flex items-center gap-1 font-semibold uppercase tracking-wider ${small ? "text-[9px]" : "text-[10px]"} ${meta.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}`} />
      {meta.label}
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

// ─── Analysis Modal ───────────────────────────────────────────────────────────

function AnalysisModal({ reel, analysis, competitor, onClose }: {
  reel: CompetitorReel;
  analysis: ReelAnalysis;
  competitor: Competitor;
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const hookMeta = HOOK_TYPE_META[analysis.hook_type ?? "desconocido"] ?? HOOK_TYPE_META.desconocido;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden flex"
        style={{ background: "rgba(12,12,20,0.98)", border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left: Thumbnail column ── */}
        <div className="w-52 shrink-0 flex flex-col"
          style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Portrait thumbnail */}
          <div className="relative flex-1 min-h-0" style={{ aspectRatio: "9/16", maxHeight: "420px" }}>
            <Thumbnail url={reel.thumbnail_url} duration={reel.duration_seconds} />
          </div>

          {/* Stats below thumbnail */}
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Eye,           v: fmt(reel.views_count),    l: "Views" },
                { icon: Heart,         v: fmt(reel.likes_count),    l: "Likes" },
                { icon: MessageCircle, v: fmt(reel.comments_count), l: "Comments" },
                { icon: Share2,        v: fmt(reel.shares_count),   l: "Shares" },
              ].map(({ icon: Icon, v, l }) => (
                <div key={l} className="rounded-lg p-2 text-center"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Icon size={11} className="text-white/25 mx-auto mb-0.5" />
                  <p className="text-[13px] font-light text-white/70">{v}</p>
                  <p className="text-[8px] text-white/20">{l}</p>
                </div>
              ))}
            </div>

            {/* Hook + content type badges */}
            <div className="space-y-1.5">
              <HookBadge type={analysis.hook_type} />
              {analysis.content_type && (
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  analysis.content_type === "reputacion"
                    ? "text-indigo-300 bg-indigo-500/10"
                    : "text-pink-300 bg-pink-500/10"
                }`}>
                  {analysis.content_type === "reputacion" ? "Reputación" : "Conexión"}
                </span>
              )}
              {analysis.topic_cluster && (
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] text-white/30 bg-white/[0.04]">
                  {analysis.topic_cluster}
                </span>
              )}
            </div>

            {/* Open in IG */}
            {reel.permalink && (
              <a href={reel.permalink} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full h-8 rounded-xl text-[11px] text-white/40 hover:text-white/65 transition-all"
                style={GLASS_SUBTLE}>
                <ExternalLink size={11} /> Ver en Instagram
              </a>
            )}
          </div>
        </div>

        {/* ── Right: Analysis content ── */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5"
            style={{ background: "rgba(12,12,20,0.95)", backdropFilter: "blur(16px)",
              borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-wider">{competitor.name}</p>
              <p className="text-[13px] text-white/70 font-light line-clamp-1 mt-0.5">
                {reel.caption ?? "Sin caption"}
              </p>
            </div>
            <button onClick={onClose}
              className="h-8 w-8 rounded-full flex items-center justify-center transition-all hover:bg-white/[0.08] cursor-pointer"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
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
                    Hook · {hookMeta.label}
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
                  <p className="text-[10px] text-violet-300/60 uppercase tracking-wider font-medium">Análisis Moka</p>
                </div>
                <p className="text-[13px] text-white/60 font-light leading-relaxed">
                  {analysis.ai_summary}
                </p>
              </div>
            )}

            {/* Narrative structure */}
            {analysis.narrative_structure && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Layers size={11} className="text-sky-400/70" />
                  <p className="text-[10px] text-white/25 uppercase tracking-wider">Estructura narrativa</p>
                </div>
                <p className="text-[12px] text-white/50 font-light leading-relaxed">
                  {analysis.narrative_structure}
                </p>
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
                      <p className="text-[9px] text-teal-400/70 uppercase tracking-wider">Fortalezas</p>
                    </div>
                    <p className="text-[12px] text-white/55 font-light leading-relaxed">
                      {analysis.strengths}
                    </p>
                  </div>
                )}
                {analysis.weaknesses && (
                  <div className="rounded-xl p-3.5"
                    style={{ background: "rgba(251,113,133,0.05)", border: "1px solid rgba(251,113,133,0.15)" }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle size={11} className="text-rose-400" />
                      <p className="text-[9px] text-rose-400/70 uppercase tracking-wider">Oportunidades</p>
                    </div>
                    <p className="text-[12px] text-white/55 font-light leading-relaxed">
                      {analysis.weaknesses}
                    </p>
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
                      <p className="text-[9px] text-white/20 uppercase tracking-wider">Estilo visual</p>
                    </div>
                    <p className="text-[12px] text-white/45 font-light leading-relaxed">
                      {analysis.style_notes}
                    </p>
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
              <div className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-[12px]">🎵</span>
                <p className="text-[11px] text-white/35 font-light truncate">
                  {reel.music_name}{reel.music_artist ? ` · ${reel.music_artist}` : ""}
                </p>
              </div>
            )}

            {analysis.model_used && (
              <p className="text-[9px] text-white/12 pb-1">Analizado con {analysis.model_used}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reel Gallery Card ────────────────────────────────────────────────────────

function ReelGalleryCard({ reel, competitorId, onAnalyze, analyzing, onOpenAnalysis }: {
  reel: CompetitorReel;
  competitorId: string;
  onAnalyze: (reelId: string) => void;
  analyzing: boolean;
  onOpenAnalysis: (reel: CompetitorReel, analysis: ReelAnalysis) => void;
}) {
  const analysis = getAnalysis(reel);
  const hasAnalysis = analysis !== null;

  void competitorId;

  return (
    <div className="rounded-xl overflow-hidden flex flex-col"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>

      {/* Thumbnail — portrait 4:5, relative for next/image fill */}
      <div className="relative overflow-hidden bg-zinc-900 shrink-0" style={{ aspectRatio: "4/5" }}>
        <Thumbnail url={reel.thumbnail_url} duration={reel.duration_seconds} />

        {/* Gradient overlay */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)" }} />

        {/* Analyzed dot + date (top) */}
        {hasAnalysis && (
          <div className="absolute top-2 left-2 h-2 w-2 rounded-full z-10"
            style={{ background: "#a78bfa", boxShadow: "0 0 8px rgba(167,139,250,0.9)" }} />
        )}
        <div className="absolute top-2 right-2 text-[9px] text-white/50 z-10 font-light"
          style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
          {fmtDate(reel.published_at)}
        </div>

        {/* External link (bottom-right corner of thumbnail) */}
        {reel.permalink && (
          <a href={reel.permalink} target="_blank" rel="noopener noreferrer"
            className="absolute bottom-2 right-2 h-6 w-6 rounded-lg flex items-center justify-center z-10 transition-all hover:scale-105"
            style={GLASS_SUBTLE}>
            <ExternalLink size={9} className="text-white/60" />
          </a>
        )}
      </div>

      {/* Footer — stats + caption + hook + action */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-1">
          {[
            { icon: Eye,           v: fmt(reel.views_count),    l: "Views" },
            { icon: Heart,         v: fmt(reel.likes_count),    l: "Likes" },
            { icon: MessageCircle, v: fmt(reel.comments_count), l: "Com." },
            { icon: Share2,        v: fmt(reel.shares_count),   l: "Comp." },
          ].map(({ icon: Icon, v, l }) => (
            <div key={l} className="flex flex-col items-center py-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)" }}>
              <Icon size={10} className="text-white/25 mb-0.5" />
              <span className="text-[11px] font-medium text-white/70 leading-none">{v}</span>
              <span className="text-[8px] text-white/25 mt-0.5">{l}</span>
            </div>
          ))}
        </div>

        {/* Caption */}
        <p className="text-[10px] text-white/50 font-light leading-relaxed line-clamp-2 flex-1">
          {reel.caption ?? <span className="italic text-white/20">Sin caption</span>}
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
            {analyzing ? "Analizando…" : "Analizar"}
          </button>
        ) : (
          <button
            onClick={() => onOpenAnalysis(reel, analysis)}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11px] font-medium text-violet-300 hover:text-violet-200 transition-all cursor-pointer"
            style={GLASS_VIOLET}
          >
            <Zap size={10} />
            Ver análisis
          </button>
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
  const profile = competitor.scraped_data as ScrapedData;
  const total = competitor.competitor_reels.length;
  const analyzed = competitor.competitor_reels.filter((r) => getAnalysis(r) !== null).length;
  const isAnalyzing = competitor.analysis_status === "analyzing";

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-3 transition-all cursor-pointer"
      style={selected ? {
        background: "rgba(255,255,255,0.09)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.2)",
        boxShadow: "0 1px 16px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.15)",
      } : {
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <Avatar url={profile?.ig_profile_pic_url} name={competitor.name} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-[13px] text-white/80 font-light truncate">{competitor.name ?? "Sin nombre"}</p>
            {profile?.ig_is_verified && <CheckCircle2 size={11} className="text-sky-400 shrink-0" />}
          </div>
          <p className="text-[11px] text-white/25 truncate">{extractUsername(competitor.ig_url)}</p>
        </div>
        <div className="shrink-0 text-right">
          {isAnalyzing ? (
            <span className="flex items-center gap-1 text-[10px] text-amber-400/70">
              <RefreshCw size={8} className="animate-spin" /> Analizando
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
  const reels = competitor.competitor_reels;
  const theirAvgViews    = (() => { const w = reels.filter(r => (r.views_count ?? 0) > 0); return w.length > 0 ? Math.round(w.reduce((s,r) => s+(r.views_count??0),0)/w.length) : 0; })();
  const theirAvgLikes    = (() => { const w = reels.filter(r => (r.likes_count ?? 0) > 0); return w.length > 0 ? Math.round(w.reduce((s,r) => s+(r.likes_count??0),0)/w.length) : 0; })();
  const theirAvgComments = (() => { const w = reels.filter(r => (r.comments_count ?? 0) > 0); return w.length > 0 ? Math.round(w.reduce((s,r) => s+(r.comments_count??0),0)/w.length) : 0; })();
  const theirFollowers   = (competitor.scraped_data as ScrapedData)?.ig_follower_count ?? 0;

  const metrics = [
    { label: "Avg Views",  yo: myStats.avgViews,    ellos: theirAvgViews },
    { label: "Avg Likes",  yo: myStats.avgLikes,    ellos: theirAvgLikes },
    { label: "Avg Com.",   yo: myStats.avgComments, ellos: theirAvgComments },
    { label: "Seguidores", yo: myStats.followers,   ellos: theirFollowers },
  ];

  return (
    <div className="rounded-xl p-3.5 space-y-3.5"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.025) 100%)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
      }}>
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-white/25 uppercase tracking-wider flex items-center gap-1.5">
          <BarChart3 size={9} /> Yo vs {competitor.name ?? "Competidor"}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-3 rounded-full" style={{ background: CHART_COLORS.mine }} />
            <span className="text-[9px] text-white/25">Yo</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-3 rounded-full" style={{ background: CHART_COLORS.competitor }} />
            <span className="text-[9px] text-white/25">{(competitor.name ?? "Ellos").split(" ")[0]}</span>
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
              <span className="text-[8px] text-white/15 w-4 text-right shrink-0">Yo</span>
              <div className="flex-1 h-4 rounded-md overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded-md flex items-center px-2 transition-all"
                  style={{ width: `${Math.max(yoPct, 6)}%`, background: `${CHART_COLORS.mine}55` }}>
                  <span className="text-[9px] text-white/60 font-medium">{fmt(yo)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-white/15 w-4 text-right shrink-0">Ell.</span>
              <div className="flex-1 h-4 rounded-md overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
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
    const dateStr = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

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
    <div className="rounded-xl p-3 space-y-2"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.025) 100%)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
      }}>
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-white/25 uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp size={9} /> Views por reel · en el tiempo
        </p>
        <div className="flex items-center gap-3">
          {myPts.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-3 rounded-full" style={{ background: CHART_COLORS.mine }} />
              <span className="text-[9px] text-white/25">Yo</span>
            </div>
          )}
          {theirPts.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-3 rounded-full" style={{ background: CHART_COLORS.competitor }} />
              <span className="text-[9px] text-white/25">{(competitor.name ?? "Ellos").split(" ")[0]}</span>
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
            stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        {/* Y-axis labels */}
        {yTicks.map(({ v, y }, i) => (
          <text key={i} x={PAD.l - 4} y={y + 3} textAnchor="end"
            fontSize="7" fill="rgba(255,255,255,0.2)" fontFamily="inherit">
            {fmtV(v)}
          </text>
        ))}
        {/* X-axis labels */}
        {xTickMs.map((ms, i) => (
          <text key={i} x={xScale(ms)} y={H - 2}
            textAnchor={i === 0 ? "start" : "end"}
            fontSize="7" fill="rgba(255,255,255,0.2)" fontFamily="inherit">
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
          if (tooltip.myV !== null) rows.push({ label: "Yo", val: fmtV(tooltip.myV), color: CHART_COLORS.mine });
          if (tooltip.theirV !== null) rows.push({ label: (competitor.name ?? "Ellos").split(" ")[0]!, val: fmtV(tooltip.theirV), color: CHART_COLORS.competitor });
          const boxH = 14 + rows.length * 13;
          return (
            <g>
              {/* Vertical guideline */}
              <line x1={tx} x2={tx} y1={PAD.t} y2={PAD.t + CH}
                stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 2" />
              {/* Tooltip box */}
              <rect x={boxX} y={PAD.t - 2} width={tooltipWidth} height={boxH} rx="5"
                fill="rgba(10,10,18,0.92)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
              <text x={boxX + tooltipWidth / 2} y={PAD.t + 8} textAnchor="middle"
                fontSize="7" fill="rgba(255,255,255,0.35)" fontFamily="inherit">
                {tooltip.dateStr}
              </text>
              {rows.map((row, i) => (
                <g key={i}>
                  <circle cx={boxX + 8} cy={PAD.t + 17 + i * 13} r="2.5" fill={row.color} />
                  <text x={boxX + 14} y={PAD.t + 20 + i * 13}
                    fontSize="8" fill="rgba(255,255,255,0.6)" fontFamily="inherit">
                    {row.label}: <tspan fontWeight="600" fill="rgba(255,255,255,0.85)">{row.val}</tspan>
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

    const dateStr = new Date(refMs).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    setTooltip({ svgX: xScale(refMs), myV: my?.v ?? null, theirV: their?.v ?? null, dateStr });
  };

  const tooltipWidth = 95;
  // If competitor has only 1 snapshot, show it as a dot + label (not a line)
  const theirCurrentFollowers = (competitor.scraped_data as ScrapedData)?.ig_follower_count ?? null;
  const noTheirHistory = theirPts.length < 2;

  return (
    <div className="rounded-xl p-3 space-y-2"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.025) 100%)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
      }}>
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-white/25 uppercase tracking-wider flex items-center gap-1.5">
          <Users size={9} /> Seguidores · crecimiento
        </p>
        <div className="flex items-center gap-3">
          {myPts.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-3 rounded-full" style={{ background: CHART_COLORS.mine }} />
              <span className="text-[9px] text-white/25">Yo</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-3 rounded-full" style={{ background: CHART_COLORS.competitor }} />
            <span className="text-[9px] text-white/25">{(competitor.name ?? "Ellos").split(" ")[0]}</span>
          </div>
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", cursor: "crosshair" }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
        {/* Grid lines */}
        {yTicks.map(({ y }, i) => (
          <line key={i} x1={PAD.l} x2={W - PAD.r} y1={y} y2={y}
            stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        {/* Y-axis labels */}
        {yTicks.map(({ v, y }, i) => (
          <text key={i} x={PAD.l - 4} y={y + 3} textAnchor="end"
            fontSize="7" fill="rgba(255,255,255,0.2)" fontFamily="inherit">
            {fmtV(v)}
          </text>
        ))}
        {/* X-axis labels */}
        {xTickMs.map((ms, i) => (
          <text key={i} x={xScale(ms)} y={H - 2}
            textAnchor={i === 0 ? "start" : "end"}
            fontSize="7" fill="rgba(255,255,255,0.2)" fontFamily="inherit">
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
          if (tooltip.myV !== null) rows.push({ label: "Yo", val: fmtV(tooltip.myV), color: CHART_COLORS.mine });
          if (tooltip.theirV !== null) rows.push({ label: (competitor.name ?? "Ellos").split(" ")[0]!, val: fmtV(tooltip.theirV), color: CHART_COLORS.competitor });
          if (rows.length === 0) return null;
          const boxH = 14 + rows.length * 13;
          return (
            <g>
              <line x1={tx} x2={tx} y1={PAD.t} y2={PAD.t + CH}
                stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 2" />
              <rect x={boxX} y={PAD.t - 2} width={tooltipWidth} height={boxH} rx="5"
                fill="rgba(10,10,18,0.92)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
              <text x={boxX + tooltipWidth / 2} y={PAD.t + 8} textAnchor="middle"
                fontSize="7" fill="rgba(255,255,255,0.35)" fontFamily="inherit">
                {tooltip.dateStr}
              </text>
              {rows.map((row, i) => (
                <g key={i}>
                  <circle cx={boxX + 8} cy={PAD.t + 17 + i * 13} r="2.5" fill={row.color} />
                  <text x={boxX + 14} y={PAD.t + 20 + i * 13}
                    fontSize="8" fill="rgba(255,255,255,0.6)" fontFamily="inherit">
                    {row.label}: <tspan fontWeight="600" fill="rgba(255,255,255,0.85)">{row.val}</tspan>
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
          El historial del competidor se acumula con cada re-análisis
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
          { v: reels.length.toString(),    l: "Reels" },
          { v: analyzed.length.toString(), l: "Analizados" },
          { v: fmt(reels.filter(r=>r.views_count).length > 0 ? Math.round(reels.filter(r=>r.views_count).reduce((s,r)=>s+(r.views_count??0),0)/reels.filter(r=>r.views_count).length) : 0), l: "Avg views" },
        ].map(({ v, l }) => (
          <div key={l} className="rounded-xl p-2.5 text-center"
            style={{
              background: "linear-gradient(160deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 100%)",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 4px 14px rgba(0,0,0,0.3), inset 0 1.5px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.12)",
            }}>
            <p className="text-[15px] font-light text-white/80">{v}</p>
            <p className="text-[8px] text-white/25 mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* Top reel */}
      {topReel && (
        <div className="rounded-xl p-2.5 flex gap-2.5"
          style={{
            background: "linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 3px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
          }}>
          {topReel.thumbnail_url && (
            <div className="shrink-0 w-10 h-12 rounded-lg overflow-hidden relative bg-black/30">
              <Thumbnail url={topReel.thumbnail_url} duration={null} showDuration={false} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[8px] text-teal-400/60 uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <TrendingUp size={8} /> Top reel
            </p>
            <p className="text-[10px] text-white/55 font-light line-clamp-2 leading-snug">
              {topReel.caption ?? "Sin caption"}
            </p>
            <p className="text-[9px] text-white/25 mt-1">{fmt(topReel.views_count)} views</p>
          </div>
        </div>
      )}

      <ComparisonCharts competitor={competitor} myStats={myStats} />

      <ViewsTimeline competitor={competitor} myReels={myReels} />

      <FollowerGrowth competitor={competitor} myFollowerHistory={myFollowerHistory} />

      {/* Hook types */}
      {hookCounts.filter(([k]) => k !== "desconocido").length > 0 && (
        <div className="rounded-xl p-3 space-y-2.5"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[9px] text-white/25 uppercase tracking-wider flex items-center gap-1.5">
            <Zap size={9} /> Tipos de hook
          </p>
          {hookCounts.filter(([k]) => k !== "desconocido").map(([type, count]) => {
            const meta = HOOK_TYPE_META[type] ?? HOOK_TYPE_META.desconocido;
            const pct = Math.round((count / analyzed.length) * 100);
            return (
              <div key={type} className="flex items-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}`} />
                <p className={`text-[10px] w-20 shrink-0 ${meta.color}`}>{meta.label}</p>
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
        <div className="rounded-xl p-3 space-y-2"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[9px] text-white/25 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen size={9} /> Temas frecuentes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {topTopics.map(([topic, count]) => (
              <span key={topic} className="px-2 py-0.5 rounded-full text-[9px] text-white/40 font-light"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {topic} <span className="text-white/20">·{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {analyzed.length === 0 && (
        <div className="rounded-xl p-4 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <Brain size={16} className="text-white/15 mx-auto mb-1.5" />
          <p className="text-[10px] text-white/20 font-light">Analizá los reels para ver patrones</p>
        </div>
      )}
    </div>
  );
}

// ─── Global insights ──────────────────────────────────────────────────────────

function GlobalInsights({ competitors }: { competitors: Competitor[] }) {
  const allAnalyzed = useMemo(
    () => competitors.flatMap((c) => c.competitor_reels).filter((r) => getAnalysis(r) !== null),
    [competitors]
  );

  const hookCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of allAnalyzed) {
      const t = getAnalysis(r)?.hook_type ?? "desconocido";
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return Object.entries(counts).filter(([k]) => k !== "desconocido").sort((a, b) => b[1] - a[1]);
  }, [allAnalyzed]);

  if (allAnalyzed.length === 0 || hookCounts.length === 0) return null;

  const topHook = hookCounts[0];
  const topMeta = HOOK_TYPE_META[topHook[0]] ?? HOOK_TYPE_META.desconocido;

  return (
    <div className="rounded-xl p-4 overflow-hidden relative"
      style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)" }}>
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full pointer-events-none"
        style={{ background: "rgba(139,92,246,0.08)", filter: "blur(32px)" }} />

      <div className="flex items-start gap-4 relative">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={12} className="text-violet-400 shrink-0" />
            <p className="text-[10px] text-violet-300/70 font-medium uppercase tracking-wider">
              Patrones globales — {allAnalyzed.length} reels analizados
            </p>
          </div>
          <div className="space-y-2">
            {hookCounts.slice(0, 5).map(([type, count]) => {
              const meta = HOOK_TYPE_META[type] ?? HOOK_TYPE_META.desconocido;
              const pct = Math.round((count / allAnalyzed.length) * 100);
              return (
                <div key={type} className="flex items-center gap-2.5">
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}`} />
                  <p className={`text-[11px] w-[88px] shrink-0 font-light ${meta.color}`}>{meta.label}</p>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: meta.hex, opacity: 0.8 }} />
                  </div>
                  <p className="text-[10px] text-white/30 w-7 text-right tabular-nums">{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 rounded-xl p-3 text-center min-w-[88px]"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className={`h-2 w-2 rounded-full mx-auto mb-1.5 ${topMeta.dot}`}
            style={{ boxShadow: `0 0 8px ${topMeta.hex}99` }} />
          <p className="text-[8px] text-white/25 uppercase tracking-wider mb-0.5">Hook top</p>
          <p className={`text-[11px] font-medium ${topMeta.color}`}>{topMeta.label}</p>
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SORT_OPTIONS.find((o) => o.key === value)!;

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
        className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] text-white/50 hover:text-white/75 transition-all cursor-pointer"
        style={GLASS}>
        <ArrowUpDown size={10} />
        <current.icon size={10} />
        {current.label}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 rounded-xl py-1 z-20 min-w-[120px]"
          style={{ background: "rgba(12,12,20,0.98)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          {SORT_OPTIONS.map((opt) => (
            <button key={opt.key} onClick={() => { onChange(opt.key); setOpen(false); }}
              className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors cursor-pointer ${
                value === opt.key ? "text-white/80" : "text-white/35 hover:text-white/60"
              }`}>
              <opt.icon size={10} />
              {opt.label}
              {value === opt.key && <span className="ml-auto text-violet-400 text-[10px]">✓</span>}
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
  const [competitors, setCompetitors] = useState<Competitor[]>(initialCompetitors ?? []);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialCompetitors?.[0]?.id ?? null);
  const [scraping, setScraping] = useState<string | null>(null);
  const [analyzingReels, setAnalyzingReels] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("views");
  // Modal state
  const [modal, setModal] = useState<{ reel: CompetitorReel; analysis: ReelAnalysis } | null>(null);

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
  }), [workspaceId]);

  // Re-fetch competitors from API (used after scrape/analyze operations)
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/competitors", { headers });
      if (!res.ok) throw new Error("Error cargando competidores");
      const json = await res.json() as { data: { competitors: Competitor[] } };
      const list = json.data.competitors;
      setCompetitors(list);
      setSelectedId((prev) => prev ?? list[0]?.id ?? null);
    } catch {
      setError("No se pudieron cargar los competidores.");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const handleScrapeAndAnalyze = useCallback(async (competitorId: string) => {
    setScraping(competitorId);
    setError(null);
    try {
      const scrapeRes = await fetch(`/api/v1/competitors/${competitorId}/scrape`, { method: "POST", headers });
      if (!scrapeRes.ok) {
        const err = await scrapeRes.json() as { error?: string };
        throw new Error(err.error ?? "Error en scraping");
      }
      const scrapeJson = await scrapeRes.json() as { data?: { reels_inserted?: number } };
      const newReels = scrapeJson.data?.reels_inserted ?? 0;

      // Only call analyze (Gemini AI = $$$) if scrape found new unanalyzed reels
      if (newReels > 0) {
        await fetch(`/api/v1/competitors/${competitorId}/analyze`, { method: "POST", headers });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al analizar");
    } finally {
      setScraping(null);
    }
  }, [headers, load]);

  const handleAnalyzeReel = useCallback(async (competitorId: string, reelId: string) => {
    setAnalyzingReels((prev) => new Set(prev).add(reelId));
    try {
      const res = await fetch(`/api/v1/competitors/${competitorId}/reels/${reelId}/analyze`, { method: "POST", headers });
      if (!res.ok) {
        const body = await res.json() as { message?: string; error?: string };
        setError(body.message ?? body.error ?? "Error analizando reel");
      } else {
        const body = await res.json() as { data?: { analysis?: ReelAnalysis } };
        const analysis = body.data?.analysis;
        if (analysis) {
          // Update local state directly — no round-trip needed
          setCompetitors((prev) => prev.map((c) => {
            if (c.id !== competitorId) return c;
            return {
              ...c,
              competitor_reels: c.competitor_reels.map((r) =>
                r.id === reelId ? { ...r, competitor_reel_analysis: analysis } : r
              ),
            };
          }));
        } else {
          // Fallback: full reload if analysis wasn't in response
          await load();
        }
      }
    } catch {
      setError("Error de red al analizar el reel");
    } finally {
      setAnalyzingReels((prev) => { const n = new Set(prev); n.delete(reelId); return n; });
    }
  }, [headers, load]);

  const selected = competitors.find((c) => c.id === selectedId) ?? null;
  const sortedReels = selected ? sortReels(selected.competitor_reels, sort) : [];

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
            <p className="text-white/60 font-light text-[15px] mb-1">No hay competidores configurados</p>
            <p className="text-white/30 text-[13px] font-light leading-relaxed">
              Agregá competidores en tu ADN de Comunicación para analizar su estrategia.
            </p>
          </div>
          <a href="/settings/adn"
            className="flex items-center gap-2 text-[13px] font-medium text-violet-300 px-5 py-2.5 rounded-full transition-all"
            style={GLASS_VIOLET}>
            <BookMarked size={14} /> Ir al ADN de Comunicación
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Analysis modal */}
      {modal && selected && (
        <AnalysisModal
          reel={modal.reel}
          analysis={modal.analysis}
          competitor={selected}
          onClose={() => setModal(null)}
        />
      )}

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
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-[11px] text-white/20 hover:text-white/40 transition-colors"
              style={{ border: "1px dashed rgba(255,255,255,0.07)" }}>
              + Agregar competidor
            </a>
          </div>

          {/* ── Reels gallery ── */}
          {selected && (
            <div className="space-y-3 min-w-0">
              {/* Profile header */}
              <div className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-start gap-3">
                  <Avatar url={(selected.scraped_data as ScrapedData)?.ig_profile_pic_url} name={selected.name} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-[15px] font-light text-white/85">{selected.name ?? "Sin nombre"}</h2>
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
                        <Pill icon={Users}    value={fmt((selected.scraped_data as ScrapedData).ig_follower_count)} label="seguidores" />
                      )}
                      {(selected.scraped_data as ScrapedData)?.ig_post_count && (
                        <Pill icon={BookOpen} value={fmt((selected.scraped_data as ScrapedData).ig_post_count)}    label="posts" />
                      )}
                      {selected.last_scraped_at && (
                        <span className="flex items-center gap-1 text-[10px] text-white/20">
                          <Clock size={9} /> Scrape: {fmtDate(selected.last_scraped_at)}
                        </span>
                      )}
                    </div>
                    {(selected.scraped_data as ScrapedData)?.ig_bio && (
                      <p className="text-[11px] text-white/30 font-light mt-1.5 leading-relaxed line-clamp-2">
                        {(selected.scraped_data as ScrapedData).ig_bio}
                      </p>
                    )}
                    {selected.why_better && (
                      <p className="text-[11px] text-violet-300/50 font-light mt-1 leading-snug">
                        Por qué son mejores: {selected.why_better}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleScrapeAndAnalyze(selected.id)}
                    disabled={scraping === selected.id || selected.analysis_status === "analyzing"}
                    className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium transition-all cursor-pointer disabled:opacity-40"
                    style={GLASS}
                  >
                    {(scraping === selected.id || selected.analysis_status === "analyzing") ? (
                      <><RefreshCw size={12} className="animate-spin text-white/40" /><span className="text-white/40">Analizando…</span></>
                    ) : selected.competitor_reels.length > 0 ? (
                      <><RefreshCw size={12} className="text-white/55" /><span className="text-white/55">Re-analizar</span></>
                    ) : (
                      <><Zap size={12} className="text-violet-400" /><span className="text-violet-300">Scrape + Analizar</span></>
                    )}
                  </button>
                </div>
              </div>

              {/* Reels header */}
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-white/25 uppercase tracking-wider">
                  Reels ({selected.competitor_reels.length})
                </p>
                {selected.competitor_reels.length > 1 && (
                  <SortDropdown value={sort} onChange={setSort} />
                )}
              </div>

              {/* Responsive gallery grid */}
              {selected.competitor_reels.length === 0 ? (
                <div className="py-12 text-center rounded-xl"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <Play size={18} className="text-white/12 mx-auto mb-2" />
                  <p className="text-[12px] text-white/25 font-light">No hay reels scrapeados aún</p>
                  <p className="text-[10px] text-white/15 mt-1">Hacé click en "Scrape + Analizar"</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {sortedReels.map((reel) => (
                    <ReelGalleryCard
                      key={reel.id}
                      reel={reel}
                      competitorId={selected.id}
                      onAnalyze={(reelId) => handleAnalyzeReel(selected.id, reelId)}
                      analyzing={analyzingReels.has(reel.id)}
                      onOpenAnalysis={(r, a) => setModal({ reel: r, analysis: a })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Insights panel ── */}
          {selected && (
            <div className="sticky top-4 space-y-3">
              <p className="text-[10px] text-white/25 uppercase tracking-wider flex items-center gap-1.5">
                <Brain size={10} /> Patrones y comparativa
              </p>
              <InsightsPanel competitor={selected} myStats={myStats} myReels={myReels} myFollowerHistory={myFollowerHistory} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
