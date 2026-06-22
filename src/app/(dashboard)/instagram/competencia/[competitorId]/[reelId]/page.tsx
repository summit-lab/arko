import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Eye, Heart, MessageSquare, Share2, Clock, ExternalLink,
  ChevronLeft, Hash, Music, Activity, TrendingUp,
  Sparkles, FileText, Brain, Target, Zap, BookOpen, Lightbulb,
  CheckCircle2, AlertCircle,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function pctStr(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

function extractHandle(igUrl: string): string {
  try {
    const url = new URL(igUrl.startsWith("http") ? igUrl : `https://${igUrl}`);
    return url.pathname.split("/").filter(Boolean)[0] ?? igUrl;
  } catch {
    return igUrl.replace(/^@/, "");
  }
}

type BenchVerdict = {
  label: string;
  color: string;
  /** signed delta in % vs the benchmark, or null if no benchmark */
  deltaPct: number | null;
};

function compareToBenchmark(value: number, benchmark: number | null): BenchVerdict {
  if (benchmark == null || benchmark <= 0) {
    return { label: "—", color: "text-white/25", deltaPct: null };
  }
  const ratio = value / benchmark;
  if (ratio >= 2)    return { label: `${ratio.toFixed(1)}x mejor`, color: "text-emerald-500 dark:text-emerald-400", deltaPct: (ratio - 1) * 100 };
  if (ratio >= 1.15) return { label: `+${((ratio - 1) * 100).toFixed(0)}%`, color: "text-emerald-500 dark:text-emerald-400", deltaPct: (ratio - 1) * 100 };
  if (ratio >= 0.9)  return { label: "Cerca del promedio", color: "text-amber-500 dark:text-amber-400", deltaPct: (ratio - 1) * 100 };
  return { label: `${((1 - ratio) * 100).toFixed(0)}% más bajo`, color: "text-rose-500 dark:text-rose-400", deltaPct: (ratio - 1) * 100 };
}

// Crude transcript splitter: turns a single paragraph into readable lines by
// breaking on sentence-ending punctuation. Not as good as Gemini's structured
// transcript_lines (we don't store those for competitors yet), but a big
// improvement over rendering one giant paragraph.
function splitTranscriptIntoLines(transcript: string): string[] {
  const trimmed = transcript.trim();
  if (!trimmed) return [];
  // First try splitting on existing line breaks (Gemini sometimes emits them).
  const byNewline = trimmed.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (byNewline.length >= 3) return byNewline;
  // Fall back to sentence-level split. Keep the trailing punctuation by using
  // a positive lookbehind. Filter very short fragments (< 3 words) by joining
  // them with the previous line so we don't end up with "Sí." on its own.
  const parts = trimmed.split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/u).map((s) => s.trim()).filter(Boolean);
  const merged: string[] = [];
  for (const part of parts) {
    const wordCount = part.split(/\s+/).length;
    if (wordCount < 3 && merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${part}`;
    } else {
      merged.push(part);
    }
  }
  return merged;
}

// ─── Reel trajectory chart (server-rendered SVG, neon dashboard style) ───
// Each point = one daily snapshot of THIS reel's views_count. Mirrors the
// Reach & Impressions area chart in <DashboardCharts /> visually but stays
// server-rendered (no Recharts in bundle). Smoothed cubic-Bézier line with
// gradient fill underneath and SVG glow filter on the stroke.

function ReelTrajectoryChart({
  points,
  maxValue,
  dateLocale,
}: {
  points: { date: string; ms: number; views: number }[];
  maxValue: number;
  dateLocale: string;
}) {
  const W = 600;
  const H = 140;
  const PAD = { t: 8, r: 8, b: 22, l: 8 };
  const CW = W - PAD.l - PAD.r;
  const CH = H - PAD.t - PAD.b;
  const n = points.length;
  if (n === 0) return null;

  const xAt = (i: number) => PAD.l + (i / Math.max(n - 1, 1)) * CW;
  const yAt = (v: number) => PAD.t + CH - (v / maxValue) * CH;

  // Smooth the line with a simple cardinal-like spline using cubic Béziers.
  const linePath = (() => {
    if (n === 1) return `M${xAt(0)},${yAt(points[0].views)}`;
    let d = `M${xAt(0)},${yAt(points[0].views)}`;
    for (let i = 0; i < n - 1; i++) {
      const x0 = xAt(Math.max(0, i - 1));
      const y0 = yAt(points[Math.max(0, i - 1)].views);
      const x1 = xAt(i);
      const y1 = yAt(points[i].views);
      const x2 = xAt(i + 1);
      const y2 = yAt(points[i + 1].views);
      const x3 = xAt(Math.min(n - 1, i + 2));
      const y3 = yAt(points[Math.min(n - 1, i + 2)].views);
      const tension = 0.18;
      const c1x = x1 + (x2 - x0) * tension;
      const c1y = y1 + (y2 - y0) * tension;
      const c2x = x2 - (x3 - x1) * tension;
      const c2y = y2 - (y3 - y1) * tension;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
    }
    return d;
  })();

  const fillPath = `${linePath} L${xAt(n - 1)},${PAD.t + CH} L${xAt(0)},${PAD.t + CH} Z`;

  const firstDay = new Date(points[0].ms).toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
  const lastDay = new Date(points[n - 1].ms).toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
  const lastIdx = n - 1;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id="trajectoryFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7A86E0" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#7A86E0" stopOpacity={0} />
          </linearGradient>
          <filter id="trajectoryGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal grid baseline */}
        <line x1={PAD.l} x2={PAD.l + CW} y1={PAD.t + CH} y2={PAD.t + CH}
          stroke="rgba(148,163,184,0.18)" strokeWidth="1" />

        {/* Area fill */}
        <path d={fillPath} fill="url(#trajectoryFill)" />

        {/* Smoothed line with neon glow */}
        <path d={linePath} fill="none" stroke="#7A86E0" strokeWidth="2" filter="url(#trajectoryGlow)" strokeLinecap="round" strokeLinejoin="round" />

        {/* Latest snapshot marker — small dot at the rightmost data point. */}
        {(() => {
          const cx = xAt(lastIdx);
          const cy = yAt(points[lastIdx].views);
          return (
            <circle cx={cx} cy={cy} r="3.5" fill="#AF6EC7" stroke="#fff" strokeWidth="1.5" />
          );
        })()}

        {/* Date labels (start / end) */}
        <text x={PAD.l} y={H - 6} fontSize="9" fill="rgba(148,163,184,0.55)" fontFamily="inherit">
          {firstDay}
        </text>
        <text x={W - PAD.r} y={H - 6} fontSize="9" fill="rgba(148,163,184,0.55)" textAnchor="end" fontFamily="inherit">
          {lastDay}
        </text>
      </svg>
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

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

const HOOK_TYPE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  transformacion: { bg: "rgba(139,92,246,0.12)",  text: "text-violet-700 dark:text-violet-300", ring: "ring-violet-500/30" },
  enemigo:        { bg: "rgba(244,63,94,0.12)",   text: "text-rose-700 dark:text-rose-300",     ring: "ring-rose-500/30" },
  negativo:       { bg: "rgba(245,158,11,0.12)",  text: "text-amber-700 dark:text-amber-300",   ring: "ring-amber-500/30" },
  promesa:        { bg: "rgba(20,184,166,0.12)",  text: "text-teal-700 dark:text-teal-300",     ring: "ring-teal-500/30" },
  curiosidad:     { bg: "rgba(56,189,248,0.12)",  text: "text-sky-700 dark:text-sky-300",       ring: "ring-sky-500/30" },
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function CompetitorReelDetailPage({
  params,
}: {
  params: Promise<{ competitorId: string; reelId: string }>;
}) {
  const { competitorId, reelId } = await params;
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) notFound();

  const locale = await getLocale();
  const dateLocale = locale === "en" ? "en-US" : "es-AR";
  const t = await getTranslations("igAdvanced");

  const [competitorRes, reelRes, allReelsRes] = await Promise.all([
    supabase
      .from("workspace_competitors")
      .select("id, name, ig_url, scraped_data")
      .eq("id", competitorId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),

    supabase
      .from("competitor_reels")
      .select(`
        id, short_code, permalink, caption,
        likes_count, comments_count, views_count, shares_count,
        duration_seconds, published_at, thumbnail_url, maybe_trial, transcript,
        hashtags, music_artist, music_name,
        competitor_reel_analysis (
          hook_text, hook_type, narrative_structure, content_type,
          cta_text, cta_type, topic_cluster, style_notes,
          strengths, weaknesses, ai_summary, model_used
        )
      `)
      .eq("id", reelId)
      .eq("competitor_id", competitorId)
      .maybeSingle(),

    supabase
      .from("competitor_reels")
      .select("id, published_at, views_count, likes_count, comments_count, shares_count")
      .eq("competitor_id", competitorId)
      .order("published_at", { ascending: true }),
  ]);

  const competitor = competitorRes.data;
  const reel = reelRes.data;
  if (!competitor || !reel) notFound();

  const allReels = allReelsRes.data ?? [];

  // Ensure today's snapshot exists. The cron writes one nightly + every manual
  // scrape writes one too, but on a fresh detail-page visit we lazily upsert
  // today's row using the metrics already in competitor_reels. This way the
  // user sees a data point immediately instead of "Trayectoria disponible
  // mañana" right after analyzing. Idempotent thanks to PK (reel_id,date).
  const todayIso = new Date().toISOString().slice(0, 10);
  if (reel.views_count != null) {
    await supabase
      .from("competitor_reel_snapshots")
      .upsert(
        {
          reel_id: reel.id,
          workspace_id: workspaceId,
          snapshot_date: todayIso,
          views_count: reel.views_count,
          likes_count: reel.likes_count,
          comments_count: reel.comments_count,
          shares_count: reel.shares_count,
        },
        { onConflict: "reel_id,snapshot_date", ignoreDuplicates: true },
      );
  }

  const snapshotsRes = await supabase
    .from("competitor_reel_snapshots")
    .select("snapshot_date, views_count, likes_count, comments_count, shares_count")
    .eq("reel_id", reelId)
    .order("snapshot_date", { ascending: true });

  const rawAnalysis = reel.competitor_reel_analysis;
  const analysis: ReelAnalysis | null = Array.isArray(rawAnalysis)
    ? (rawAnalysis[0] as ReelAnalysis | undefined) ?? null
    : (rawAnalysis as ReelAnalysis | null) ?? null;

  // ─── Metrics ─────────────────────────────────────────────────────────────
  const views    = reel.views_count    ?? 0;
  const likes    = reel.likes_count    ?? 0;
  const comments = reel.comments_count ?? 0;
  const shares   = reel.shares_count   ?? 0;
  const total    = likes + comments + shares;
  const engRate     = views > 0 ? (total    / views) * 100 : 0;
  const likesPct    = views > 0 ? (likes    / views) * 100 : 0;
  const commentsPct = views > 0 ? (comments / views) * 100 : 0;
  const sharesPct   = views > 0 ? (shares   / views) * 100 : 0;

  // ─── Benchmark from all competitor reels ──────────────────────────────────
  const withViews = allReels.filter((r) => (r.views_count ?? 0) > 0);
  function avg(fn: (r: (typeof withViews)[0]) => number): number | null {
    if (withViews.length === 0) return null;
    return withViews.reduce((s, r) => s + fn(r), 0) / withViews.length;
  }
  const avgViews       = avg((r) => r.views_count ?? 0);
  const avgLikesPct    = avg((r) => ((r.likes_count    ?? 0) / (r.views_count ?? 1)) * 100);
  const avgCommentsPct = avg((r) => ((r.comments_count ?? 0) / (r.views_count ?? 1)) * 100);
  const avgSharesPct   = avg((r) => ((r.shares_count   ?? 0) / (r.views_count ?? 1)) * 100);
  const avgEngPct      = avg((r) => {
    const v = r.views_count ?? 0;
    if (v === 0) return 0;
    return (((r.likes_count ?? 0) + (r.comments_count ?? 0) + (r.shares_count ?? 0)) / v) * 100;
  });

  const performerMultiple = avgViews && avgViews > 0 ? views / avgViews : null;

  // Per-day views trajectory for THIS reel. Reads competitor_reel_snapshots
  // (one row per day, populated by the daily cron + every manual scrape).
  // Each snapshot is a cumulative view count at that day's scrape, so the
  // line shows the growth curve of THIS specific reel. Drops the per-day
  // aggregation across all reels — that wasn't what the user wanted.
  const snapshotRows = (snapshotsRes.data ?? []) as Array<{
    snapshot_date: string;
    views_count: number | null;
    likes_count: number | null;
    comments_count: number | null;
    shares_count: number | null;
  }>;
  const trajectoryPoints = snapshotRows
    .filter((s) => s.views_count != null)
    .map((s) => ({
      date: s.snapshot_date,
      ms: new Date(s.snapshot_date).getTime(),
      views: s.views_count ?? 0,
    }))
    .sort((a, b) => a.ms - b.ms);
  const maxTrajectoryViews = Math.max(...trajectoryPoints.map((p) => p.views), 1);
  const trajectoryDelta = trajectoryPoints.length >= 2
    ? trajectoryPoints[trajectoryPoints.length - 1].views - trajectoryPoints[0].views
    : 0;

  const profile    = competitor.scraped_data as Record<string, unknown> | null;
  const handle     = (profile?.ig_username       as string | undefined) ?? extractHandle(competitor.ig_url ?? "");
  const profilePic = (profile?.ig_profile_pic_url as string | undefined) ?? null;
  const followers  = (profile?.ig_follower_count   as number | undefined) ?? null;

  const publishedStr = reel.published_at
    ? new Date(reel.published_at).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })
    : null;

  const hashtags = (reel.hashtags as string[] | null) ?? [];
  const transcriptLines = reel.transcript ? splitTranscriptIntoLines(reel.transcript) : [];

  // ─── KPI strip definition ────────────────────────────────────────────────
  // Each metric carries the absolute number, the % of views (when applicable),
  // and the verdict vs the competitor's own average. The user's feedback was:
  // "ponganlo así todas las métricas, con el promedio y después le ponemos el
  // porcentaje de cada uno". One row, no duplicates, every column tells a
  // story by itself.
  const viewsVerdict     = compareToBenchmark(views,       avgViews);
  const likesVerdict     = compareToBenchmark(likesPct,    avgLikesPct);
  const commentsVerdict  = compareToBenchmark(commentsPct, avgCommentsPct);
  const sharesVerdict    = compareToBenchmark(sharesPct,   avgSharesPct);
  const erVerdict        = compareToBenchmark(engRate,     avgEngPct);

  const KPIS: {
    icon: typeof Eye;
    label: string;
    value: string;
    sub?: string | null;
    verdict: BenchVerdict;
    accent?: string;
  }[] = [
    { icon: Eye,           label: "Views",        value: formatNumber(reel.views_count),    sub: null,                          verdict: viewsVerdict,    accent: "#7A86E0" },
    { icon: Heart,         label: "Me gusta",     value: formatNumber(reel.likes_count),    sub: views > 0 ? pctStr(likesPct)    : null, verdict: likesVerdict },
    { icon: MessageSquare, label: "Comentarios",  value: formatNumber(reel.comments_count), sub: views > 0 ? pctStr(commentsPct) : null, verdict: commentsVerdict },
    { icon: Share2,        label: "Compartidos",  value: formatNumber(reel.shares_count),   sub: views > 0 ? pctStr(sharesPct)   : null, verdict: sharesVerdict },
    { icon: Activity,      label: "Engagement",   value: pctStr(engRate),                   sub: views > 0 ? "sobre views"        : null, verdict: erVerdict },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-6 py-8 sm:px-10 lg:px-[4%] min-w-0 overflow-hidden">

      {/* ── Back ── */}
      <Link
        href="/instagram?tab=competencia"
        className="inline-flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver a Competencia
      </Link>

      {/* ── Competitor header ── */}
      <div className="flex items-center gap-3">
        {profilePic ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profilePic} alt={competitor.name ?? ""} className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-white/[0.08] flex items-center justify-center text-[13px] font-medium text-white/60">
            {(competitor.name ?? "?")[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-[15px] font-medium text-foreground">{competitor.name}</h1>
          <p className="text-[11px] text-white/40">
            @{handle}
            {followers ? ` · ${formatNumber(followers)} ${t("competitor.profile.followers")}` : ""}
          </p>
        </div>
      </div>

      {/* ── Hero: thumbnail + caption ── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
        {/* Thumbnail */}
        <div className="glass-panel rounded-2xl p-3 max-w-[260px] md:max-w-none md:sticky md:top-6 self-start">
          <div className="relative aspect-[9/14.8] overflow-hidden rounded-xl border border-white/[0.06] bg-black">
            {reel.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={reel.thumbnail_url} alt="Reel thumbnail" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Eye className="h-10 w-10 text-white/20" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
              {performerMultiple != null && performerMultiple >= 3 ? (
                <div className="rounded-lg px-2.5 py-1 text-[12px] font-bold text-black shadow-lg" style={{ background: "#4BCEAF" }}>
                  x{performerMultiple.toFixed(1)}
                </div>
              ) : <div />}
              {reel.duration_seconds != null && (
                <div className="flex items-center gap-1 rounded px-2 py-1 text-xs backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>
                  <Clock className="h-3 w-3" />
                  {formatDuration(reel.duration_seconds)}
                </div>
              )}
            </div>
          </div>

          {reel.permalink && (
            <div className="mt-3 flex justify-center">
              <a
                href={reel.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-medium text-white/50 transition-all cursor-pointer hover:text-white/80 hover:bg-white/[0.06]"
                style={{ border: "1px solid var(--border)" }}
              >
                <ExternalLink className="h-3 w-3" />
                Abrir en Instagram
              </a>
            </div>
          )}
        </div>

        {/* Caption + small chart */}
        <div className="flex flex-col gap-4">
          <div className="glass-panel rounded-2xl p-5">
            {reel.caption ? (
              <p className="text-[13px] leading-relaxed text-foreground/80">{reel.caption}</p>
            ) : (
              <p className="text-[13px] text-white/25 italic">Sin caption</p>
            )}
            {publishedStr && (
              <p className="mt-3 text-[12px] text-white/35">Publicado el {publishedStr}</p>
            )}
          </div>

          {/* Per-day views trajectory — what this reel accumulated day by day
              since it was scraped. Reads competitor_reel_snapshots, populated
              daily by the cron. Empty / single-point states show a CTA so the
              user understands the chart fills up over time. */}
          <div className="glass-panel rounded-xl p-5 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-medium text-foreground tracking-wide">
                Views día a día
              </p>
              {trajectoryPoints.length > 0 && (
                <span className="text-[10px] text-white/30">
                  {trajectoryPoints.length} {trajectoryPoints.length === 1 ? "día" : "días"} de datos
                </span>
              )}
            </div>
            <p className="text-[10px] text-white/20 mb-4">
              {trajectoryDelta > 0
                ? `+${formatNumber(trajectoryDelta)} desde el primer snapshot`
                : "Sincronización automática diaria"}
            </p>
            {trajectoryPoints.length >= 2 ? (
              <ReelTrajectoryChart points={trajectoryPoints} maxValue={maxTrajectoryViews} dateLocale={dateLocale} />
            ) : trajectoryPoints.length === 1 ? (
              // Single point — show it and explain the curve is on the way.
              <div className="h-[140px] flex flex-col items-center justify-center text-center px-4 gap-2">
                <p className="text-[28px] font-light leading-none tracking-tight" style={{ color: "#7A86E0" }}>
                  {formatNumber(trajectoryPoints[0].views)}
                </p>
                <p className="text-[10px] text-white/30">
                  Hoy. La curva aparece en cuanto haya un segundo snapshot (sync mañana 04:00 UTC).
                </p>
              </div>
            ) : (
              <div className="h-[140px] flex flex-col items-center justify-center text-center px-4 gap-1">
                <p className="text-[12px] text-foreground/50">Trayectoria disponible mañana</p>
                <p className="text-[10px] text-white/30">
                  El sync diario captura las views del reel cada noche.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI strip — single row, every metric carries its vs-avg verdict ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="glass-panel rounded-xl p-4 flex flex-col">
            <div className="flex items-center gap-1.5 mb-3">
              <kpi.icon className="h-3.5 w-3.5 text-white/55" strokeWidth={1.8} />
              <span className="text-[11px] font-medium text-white/45">{kpi.label}</span>
            </div>
            <p
              className="text-[26px] font-light leading-none tracking-tight text-foreground"
              style={kpi.accent ? { color: kpi.accent } : undefined}
            >
              {kpi.value}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              {kpi.sub ? (
                <span className="text-[11px] text-white/30">{kpi.sub}</span>
              ) : <span />}
              <span className={`text-[11px] font-medium ${kpi.verdict.color}`}>{kpi.verdict.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Secondary stats: duration + performance multiple ── */}
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="glass-panel rounded-xl p-3 flex items-center justify-between">
          <span className="text-[11px] text-white/35">Duración</span>
          <span className="text-[14px] font-light text-foreground">{formatDuration(reel.duration_seconds)}</span>
        </div>
        <div className="glass-panel rounded-xl p-3 flex items-center justify-between">
          <span className="text-[11px] text-white/35">Rendimiento</span>
          <span className="text-[14px] font-light text-foreground">
            {performerMultiple != null ? `${performerMultiple.toFixed(1)}x` : "—"}
          </span>
        </div>
      </div>

      {/* ── Moka AI analysis — separate cards, one section each ── */}
      {analysis ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            <h2 className="text-[12px] font-semibold text-foreground/85 uppercase tracking-wider">Análisis Moka AI</h2>
            {analysis.model_used && (
              <span className="text-[10px] text-white/25 ml-auto">{analysis.model_used}</span>
            )}
          </div>

          {/* Tipo de contenido — prominent pill, not buried in a grid */}
          {analysis.content_type && (
            <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
              <Target className="h-4 w-4 text-violet-500 dark:text-violet-400 shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-wider text-white/35 mb-0.5">Tipo de contenido</p>
                <p className={`text-[14px] font-medium ${
                  analysis.content_type === "reputacion"
                    ? "text-indigo-700 dark:text-indigo-300"
                    : analysis.content_type === "conexion"
                      ? "text-pink-700 dark:text-pink-300"
                      : "text-foreground"
                }`}>
                  {analysis.content_type === "reputacion" ? "Reputación" : analysis.content_type === "conexion" ? "Conexión" : analysis.content_type}
                </p>
              </div>
            </div>
          )}

          {/* Hook + Tema — two cards in a row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {analysis.hook_text && (() => {
              const hookKey = (analysis.hook_type ?? "").toLowerCase();
              const tone = HOOK_TYPE_COLORS[hookKey];
              return (
                <div className="glass-panel rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-wider text-white/35 flex items-center gap-1.5">
                      <Zap className="h-3 w-3" /> Hook
                    </p>
                    {analysis.hook_type && (
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ${tone?.text ?? "text-white/40"} ${tone?.ring ?? "ring-white/10"}`}
                        style={{ background: tone?.bg ?? "rgba(255,255,255,0.04)" }}
                      >
                        {analysis.hook_type}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-foreground/85 leading-relaxed">{analysis.hook_text}</p>
                </div>
              );
            })()}

            {analysis.topic_cluster && (
              <div className="glass-panel rounded-xl p-4 space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-white/35 flex items-center gap-1.5">
                  <BookOpen className="h-3 w-3" /> Tema y nicho
                </p>
                <p className="text-[13px] text-foreground/85">{analysis.topic_cluster}</p>
              </div>
            )}
          </div>

          {/* Estructura narrativa */}
          {analysis.narrative_structure && (
            <div className="glass-panel rounded-xl p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-white/35 flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> Estructura narrativa
              </p>
              <p className="text-[13px] text-foreground/80 leading-relaxed">{analysis.narrative_structure}</p>
            </div>
          )}

          {/* CTA — only if present */}
          {analysis.cta_text && (
            <div className="glass-panel rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-white/35 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> CTA
                </p>
                {analysis.cta_type && (
                  <span className="text-[10px] uppercase tracking-wider text-white/40 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
                    {analysis.cta_type}
                  </span>
                )}
              </div>
              <p className="text-[13px] text-foreground/80 leading-relaxed">{analysis.cta_text}</p>
            </div>
          )}

          {/* Concepto / resumen */}
          {analysis.ai_summary && (
            <div className="glass-panel rounded-xl p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-white/35 flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3" /> Concepto general
              </p>
              <div className="prose prose-sm max-w-none text-[13px] text-foreground/80 leading-relaxed prose-headings:text-foreground prose-strong:text-foreground prose-li:text-foreground/80 dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.ai_summary}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Fortalezas + Oportunidades — side by side */}
          {(analysis.strengths || analysis.weaknesses) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {analysis.strengths && (
                <div className="glass-panel rounded-xl p-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" /> Fortalezas
                  </p>
                  <div className="prose prose-sm max-w-none text-[12px] text-foreground/75 leading-relaxed prose-headings:text-foreground prose-strong:text-foreground prose-li:text-foreground/75 dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.strengths}</ReactMarkdown>
                  </div>
                </div>
              )}
              {analysis.weaknesses && (
                <div className="glass-panel rounded-xl p-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3" /> Oportunidades
                  </p>
                  <div className="prose prose-sm max-w-none text-[12px] text-foreground/75 leading-relaxed prose-headings:text-foreground prose-strong:text-foreground prose-li:text-foreground/75 dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.weaknesses}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Estilo visual — small card at the bottom */}
          {analysis.style_notes && (
            <div className="glass-panel rounded-xl p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-white/35 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3" /> Estilo visual
              </p>
              <p className="text-[12px] text-foreground/70 leading-relaxed">{analysis.style_notes}</p>
            </div>
          )}
        </section>
      ) : (
        <div className="glass-panel rounded-xl p-6 flex items-center justify-center min-h-[160px]">
          <p className="text-[13px] text-white/30">Este reel aún no tiene análisis IA.</p>
        </div>
      )}

      {/* ── Transcript — line by line, not a wall of text ── */}
      {transcriptLines.length > 0 && (
        <div className="glass-panel rounded-xl p-5 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-white/35 flex items-center gap-1.5">
            <FileText className="h-3 w-3" /> Transcripción
          </p>
          <ol className="space-y-1.5 mt-3">
            {transcriptLines.map((line, i) => (
              <li key={i} className="flex gap-3 text-[12px] text-foreground/75 leading-relaxed">
                <span className="text-white/20 font-mono text-[10px] pt-0.5 w-5 shrink-0 text-right tabular-nums">{i + 1}</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Hashtags + Music — collapsed-feeling small block at the end ── */}
      {(hashtags.length > 0 || reel.music_name) && (
        <details className="glass-panel rounded-xl p-4">
          <summary className="cursor-pointer flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/35 select-none">
            <Hash className="h-3 w-3" /> Hashtags y música
          </summary>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {hashtags.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Hashtags</p>
                <div className="flex flex-wrap gap-1.5">
                  {hashtags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] text-foreground/55">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {reel.music_name && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2 flex items-center gap-1">
                  <Music className="h-3 w-3" /> Música
                </p>
                <p className="text-[12px] text-foreground/75">{reel.music_name}</p>
                {reel.music_artist && (
                  <p className="text-[11px] text-white/40 mt-0.5">{reel.music_artist}</p>
                )}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
