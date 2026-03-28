import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { hydrateGeminiAnalysis, normalizeSingleRelation } from "@/services/gemini-analysis-persistence.service";
import type { GeminiVideoAnalysis } from "@/services/gemini-video.service";
import { InstagramBackButton } from "@/components/instagram/InstagramBackButton";
import { ReelPerformanceChart } from "@/components/instagram/ReelPerformanceChart";
import { ReelDailySparkline } from "@/components/instagram/ReelDailySparkline";
import { ReelDayRadar } from "@/components/instagram/ReelDayRadar";
import { ReelAISection } from "@/components/instagram/ReelAISection";
import type { ReelAudioAnalysis, ReelNarrativeAnalysis, ReelTranscript, ReelVisualAnalysis } from "@/types/database";
import {
  Eye, Heart, Bookmark, MessageSquare, Share2,
  Clock, Play, Megaphone, TrendingUp,
  ExternalLink, AlertTriangle, DollarSign,
} from "lucide-react";

// ─── Helpers ───

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatOptionalNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return formatNumber(n);
}

function formatOptionalPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
}

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatTime(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const roundedSeconds = Math.round(seconds);
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const secs = roundedSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(secs).padStart(2, "0")}s`;
  return `${secs}s`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateText(value: string, maxLength = 180): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function pctOf(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${((part / total) * 100).toFixed(2)}%`;
}

function compareToBenchmark(value: number, benchmark: number | null): { label: string; color: string; barClass: string } {
  if (benchmark == null || benchmark <= 0) return { label: "Sin benchmark", color: "text-zinc-500", barClass: "bg-zinc-600/60" };
  const ratio = value / benchmark;
  if (ratio >= 2) return { label: `${ratio.toFixed(1)}x más alto`, color: "text-emerald-400", barClass: "bg-gradient-to-r from-emerald-500 to-green-300" };
  if (ratio >= 1.15) return { label: `${((ratio - 1) * 100).toFixed(0)}% más alto`, color: "text-emerald-400", barClass: "bg-gradient-to-r from-emerald-500 to-lime-300" };
  if (ratio >= 0.9) return { label: "Cerca del promedio", color: "text-amber-300", barClass: "bg-gradient-to-r from-amber-500 to-lime-300" };
  return { label: `${((1 - ratio) * 100).toFixed(0)}% más bajo`, color: "text-rose-400", barClass: "bg-gradient-to-r from-rose-500 to-amber-400" };
}

function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function normalizeRateToPercent(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return clampPercentage(value <= 1 ? value * 100 : value);
}


// ─── Serializers for Arko AI context ───

function serializeReelForArko(r: typeof DEMO_REEL, bench: typeof DEMO_REEL.benchmark, engRate: number, retRate: number | null): string {
  const lines: string[] = [];
  lines.push(`**Caption:** ${r.caption}`);
  lines.push(`**Publicado:** ${r.published_at ? new Date(r.published_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) : "—"}`);
  lines.push(`**Duración:** ${r.duration_seconds ? `${r.duration_seconds}s` : "No disponible"}`);
  lines.push(`**Tipo:** ${r.reel_type}${r.has_ads ? " | Promocionado" : ""}`);
  lines.push("");
  lines.push("**Métricas principales:**");
  lines.push(`- Views totales: ${formatNumber(r.views_total)} (org: ${formatNumber(r.views_org)}, paid: ${formatNumber(r.views_paid)})`);
  lines.push(`- Likes: ${formatNumber(r.likes)} (${r.views_total > 0 ? ((r.likes / r.views_total) * 100).toFixed(2) : 0}% de views)`);
  lines.push(`- Saves: ${formatNumber(r.saves)} (${r.views_total > 0 ? ((r.saves / r.views_total) * 100).toFixed(2) : 0}% de views)`);
  lines.push(`- Comments: ${formatNumber(r.comments)} (${r.views_total > 0 ? ((r.comments / r.views_total) * 100).toFixed(2) : 0}% de views)`);
  lines.push(`- Shares: ${formatNumber(r.shares)} (${r.views_total > 0 ? ((r.shares / r.views_total) * 100).toFixed(2) : 0}% de views)`);
  lines.push(`- Interacciones totales: ${formatNumber(r.total_interactions)}`);
  lines.push(`- Engagement rate: ${engRate.toFixed(2)}%`);
  lines.push(`- Reach total: ${formatNumber(r.reach_total)} (org: ${formatNumber(r.reach_org)}, paid: ${formatNumber(r.reach_paid)})`);
  if (r.avg_watch_time_seconds != null) {
    lines.push(`- Watch time promedio: ${formatTime(r.avg_watch_time_seconds)}`);
  }
  if (retRate != null) {
    lines.push(`- Retención estimada: ${retRate.toFixed(1)}%`);
  }
  if (r.performer_multiple > 0) {
    lines.push(`- Performer multiple: ${r.performer_multiple.toFixed(1)}x vs promedio`);
  }
  if (r.has_ads) {
    lines.push("");
    lines.push("**Métricas pagas:**");
    lines.push(`- Spend: $${(r.spend_cents / 100).toFixed(2)}`);
    lines.push(`- Clicks pagos: ${formatNumber(r.paid_clicks)}`);
    lines.push(`- Video plays pagos: ${formatNumber(r.paid_video_plays)}`);
  }
  lines.push("");
  lines.push("**Benchmarks 90d del workspace:**");
  lines.push(`- Avg views: ${bench.avg_views != null ? formatNumber(bench.avg_views) : "—"}`);
  lines.push(`- Avg likes/views: ${bench.avg_likes_pct != null ? `${bench.avg_likes_pct.toFixed(2)}%` : "—"}`);
  lines.push(`- Avg saves/views: ${bench.avg_saves_pct != null ? `${bench.avg_saves_pct.toFixed(2)}%` : "—"}`);
  lines.push(`- Avg engagement rate: ${bench.avg_engagement_rate != null ? `${bench.avg_engagement_rate.toFixed(2)}%` : "—"}`);
  lines.push(`- Avg retención: ${bench.avg_retention_rate != null ? `${bench.avg_retention_rate.toFixed(1)}%` : "—"}`);
  lines.push(`- Reels en ventana: ${bench.reels_in_window}`);
  return lines.join("\n");
}

function serializeGeminiForArko(analysis: GeminiVideoAnalysis): string {
  const lines: string[] = [];
  if (analysis.transcript) {
    lines.push(`**Transcripción:** ${analysis.transcript.substring(0, 500)}${analysis.transcript.length > 500 ? "..." : ""}`);
  }
  if (analysis.transcript_lines?.length) {
    lines.push("");
    lines.push("**Líneas con clasificación:**");
    for (const line of analysis.transcript_lines.slice(0, 10)) {
      lines.push(`- [${line.type}] ${line.text}`);
    }
  }
  if (analysis.narrative) {
    lines.push("");
    lines.push("**Análisis narrativo:**");
    lines.push(`- Hook: ${analysis.narrative.hook || "—"}`);
    lines.push(`- Desarrollo: ${analysis.narrative.development_summary || "—"}`);
    lines.push(`- CTA: ${analysis.narrative.has_cta ? (analysis.narrative.cta_text || "Sí") : "No detectado"}`);
    lines.push(`- Promesa central: ${analysis.narrative.core_promise || "—"}`);
    lines.push(`- Topic cluster: ${analysis.narrative.topic_cluster || "—"}`);
  }
  if (analysis.visual) {
    lines.push("");
    lines.push("**Análisis visual:**");
    lines.push(`- Formato: ${analysis.visual.format_type || "—"}`);
    lines.push(`- Escena: ${analysis.visual.scene_type || "—"}`);
    lines.push(`- Plano: ${analysis.visual.shot_type || "—"}`);
    lines.push(`- Personas: ${analysis.visual.people_count ?? "—"}`);
    lines.push(`- Texto en pantalla: ${analysis.visual.text_on_screen ? "Sí" : "No"}`);
  }
  if (analysis.audio) {
    lines.push("");
    lines.push("**Análisis de audio:**");
    lines.push(`- Tono: ${analysis.audio.tone || "—"}`);
    lines.push(`- Energía: ${analysis.audio.energy_level || "—"}`);
    lines.push(`- WPM estimado: ${analysis.audio.estimated_wpm ?? "—"}`);
    lines.push(`- Muletillas: ${analysis.audio.filler_words_detected?.length ? "Sí" : "No"}`);
  }
  if (analysis.insights) {
    lines.push("");
    lines.push("**Insights:**");
    if (analysis.insights.strengths?.length) {
      lines.push(`- Fortalezas: ${analysis.insights.strengths.join("; ")}`);
    }
    if (analysis.insights.improvements?.length) {
      lines.push(`- Mejoras: ${analysis.insights.improvements.join("; ")}`);
    }
    lines.push(`- Potencial viral: ${analysis.insights.viral_potential || "—"} (${analysis.insights.viral_potential_reason || ""})`);
  }
  return lines.join("\n");
}

// ─── Demo Data ───

const DEMO_REEL = {
  id: "demo-1",
  caption: "Errores que te cuestan $10K/mes en tu negocio digital — y cómo evitarlos paso a paso",
  permalink: "https://instagram.com/reel/demo",
  thumbnail_url: null as string | null,
  media_url: null as string | null,
  published_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  duration_seconds: 47,
  reel_type: "normal",
  has_ads: true,
  views_org: 184000, views_paid: 50000, views_total: 234000,
  likes: 8100, saves: 3200, comments: 412, shares: 1800, follows: 340 as number | null,
  impressions_org: 250000 as number | null, impressions_paid: 60000, impressions_total: 310000,
  reach_org: 240000, reach_paid: 40000, reach_total: 280000,
  profile_visits: 1200 as number | null,
  total_interactions: 13512,
  avg_watch_time_seconds: 29.1 as number | null,
  completion_rate: 38 as number | null,
  total_watch_time_seconds: 6809400 as number | null,
  paid_clicks: 1260,
  spend_cents: 945000,
  paid_video_plays: 50000,
  sales_amount: null as number | null,
  performer_multiple: 5.2,
  transcript: {
    status: "completed",
    lines: [
      { type: "hook", text: "Hay 3 errores que literalmente te están costando $10K al mes y ni siquiera lo sabés." },
      { type: "development", text: "El primero: estás creando contenido sin un sistema. Publicás cuando se te ocurre, no cuando tu audiencia está activa." },
      { type: "development", text: "El segundo: no estás midiendo nada. Si no sabés qué funciona, estás tirando contenido al vacío." },
      { type: "development", text: "Y el tercero, el más costoso: no tenés un CTA claro. Tu audiencia consume, pero nunca convierte." },
      { type: "cta", text: "Guardá este Reel y comentá 'SISTEMA' para que te mande mi framework completo de contenido." },
    ],
    central_promise: "Identificar los 3 errores de contenido más costosos y sus soluciones",
    specificity_level: "high" as const,
    niche_terms: ["sistema de contenido", "CTA", "audiencia activa", "framework"],
  },
  narrative: {
    status: "completed",
    hook_classification: "Declaración contraintuitiva con número específico",
    cta_detected: true,
    cta_type: "save + comment trigger",
    topic_cluster: "Errores de contenido / Sistemas",
  },
  visual: {
    status: "completed",
    frames: [
      { timestamp: 0, classification: "Persona hablando a cámara, primer plano, gorra" },
      { timestamp: 12, classification: "Texto en pantalla: 'Error #1', fondo oscuro" },
      { timestamp: 28, classification: "Persona gesticulando, plano medio" },
      { timestamp: 40, classification: "Texto en pantalla: 'SISTEMA', fondo con gradiente" },
    ],
    format_type: "Talking head con text overlay",
    has_text_overlay: true,
    person_detected: true,
  },
  audio: {
    status: "completed",
    wpm: 168,
    filler_count: 2,
    avg_pause_duration: 0.8,
  },
  diagnostic: null as null | { status: string; summary: string; strengths: string[]; improvements: string[] },
  benchmark: { avg_views: 45000 as number | null, avg_likes_pct: 2.8 as number | null, avg_saves_pct: 1.2 as number | null, avg_comments_pct: 0.15 as number | null, avg_shares_pct: 0.6 as number | null, avg_engagement_rate: 4.75 as number | null, avg_retention_rate: 62 as number | null, avg_duration_seconds: 38 as number | null, avg_reach_per_view: 0.82 as number | null, reels_in_window: 24 },
};

// ─── Page ───

export default async function ReelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId();

  let reel = DEMO_REEL;
  let isDemo = true;
  let initialGeminiAnalysis: GeminiVideoAnalysis | null = null;
  let dailyMetricsData: { metric_date: string; views_org: number; views_paid: number }[] | null = null;

  if (workspaceId && !id.startsWith("demo")) {
      const [
        { data: reelData },
        { data: benchmarkData },
        { data: dailyRaw },
      ] = await Promise.all([
        supabase
          .from("reels")
          .select(`
            id, caption, permalink, thumbnail_url, media_url, published_at,
            duration_seconds, reel_type, has_ads, media_type, media_product_type, sales_amount,
            reel_metrics (views_org, impressions_org, reach_org, likes_total, comments_total, shares_total, saves_total, total_interactions, follows_generated, profile_visits, avg_watch_time_sec, completion_rate),
            reel_metrics_paid (views_paid, impressions_paid, reach_paid, clicks, spend_cents, video_plays),
            reel_transcripts (*),
            reel_narrative_analysis (*),
            reel_visual_analysis (*),
            reel_audio_analysis (*)
          `)
          .eq("id", id)
          .eq("workspace_id", workspaceId)
          .single(),
        supabase
          .from("reel_benchmarks")
          .select("reels_in_window, avg_views_90d, avg_likes_per_view, avg_saves_per_view, avg_comments_per_view, avg_shares_per_view, avg_engagement_rate, avg_retention_rate, avg_duration_seconds, avg_reach_per_view")
          .eq("workspace_id", workspaceId)
          .order("calculated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("reel_metrics_daily")
          .select("metric_date, views_org, views_paid")
          .eq("reel_id", id)
          .eq("workspace_id", workspaceId)
          .order("metric_date", { ascending: true }),
      ]);

      dailyMetricsData = dailyRaw;

      if (reelData) {
        isDemo = false;
        type MetricsRow = {
          views_org: number;
          impressions_org: number | null;
          reach_org: number;
          likes_total: number;
          comments_total: number;
          shares_total: number;
          saves_total: number;
          total_interactions: number;
          follows_generated: number | null;
          profile_visits: number | null;
          avg_watch_time_sec: number | null;
          completion_rate: number | null;
        };
        type PaidRow = {
          views_paid: number;
          impressions_paid: number;
          reach_paid: number;
          clicks: number;
          spend_cents: number;
          video_plays: number;
        };
        const rawM = reelData.reel_metrics as unknown;
        const rawP = reelData.reel_metrics_paid as unknown;
        const rawTranscript = reelData.reel_transcripts as unknown;
        const rawNarrative = reelData.reel_narrative_analysis as unknown;
        const rawVisual = reelData.reel_visual_analysis as unknown;
        const rawAudio = reelData.reel_audio_analysis as unknown;
        const m = Array.isArray(rawM) ? (rawM as MetricsRow[])[0] : (rawM as MetricsRow | null);
        const p = Array.isArray(rawP) ? (rawP as PaidRow[])[0] : (rawP as PaidRow | null);
        const transcriptRow = normalizeSingleRelation(rawTranscript as ReelTranscript | ReelTranscript[] | null);
        const narrativeRow = normalizeSingleRelation(rawNarrative as ReelNarrativeAnalysis | ReelNarrativeAnalysis[] | null);
        const visualRow = normalizeSingleRelation(rawVisual as ReelVisualAnalysis | ReelVisualAnalysis[] | null);
        const audioRow = normalizeSingleRelation(rawAudio as ReelAudioAnalysis | ReelAudioAnalysis[] | null);
        const viewsOrg = m?.views_org || 0;
        const viewsPaid = p?.views_paid || 0;
        const impressionsOrg = m?.impressions_org ?? null;
        const impressionsPaid = p?.impressions_paid || 0;
        const reachOrg = m?.reach_org || 0;
        const reachPaid = p?.reach_paid || 0;
        initialGeminiAnalysis = hydrateGeminiAnalysis({
          transcript: transcriptRow,
          narrative: narrativeRow,
          visual: visualRow,
          audio: audioRow,
        });
        const benchmarkSnapshot = benchmarkData
          ? {
              avg_views: benchmarkData.avg_views_90d > 0 ? benchmarkData.avg_views_90d : null,
              avg_likes_pct: benchmarkData.avg_likes_per_view > 0 ? benchmarkData.avg_likes_per_view * 100 : null,
              avg_saves_pct: benchmarkData.avg_saves_per_view > 0 ? benchmarkData.avg_saves_per_view * 100 : null,
              avg_comments_pct: benchmarkData.avg_comments_per_view > 0 ? benchmarkData.avg_comments_per_view * 100 : null,
              avg_shares_pct: benchmarkData.avg_shares_per_view > 0 ? benchmarkData.avg_shares_per_view * 100 : null,
              avg_engagement_rate: benchmarkData.avg_engagement_rate > 0 ? benchmarkData.avg_engagement_rate : null,
              avg_retention_rate: benchmarkData.avg_retention_rate > 0 ? benchmarkData.avg_retention_rate : null,
              avg_duration_seconds: benchmarkData.avg_duration_seconds > 0 ? benchmarkData.avg_duration_seconds : null,
              avg_reach_per_view: benchmarkData.avg_reach_per_view > 0 ? benchmarkData.avg_reach_per_view : null,
              reels_in_window: benchmarkData.reels_in_window || 0,
            }
          : {
              avg_views: null,
              avg_likes_pct: null,
              avg_saves_pct: null,
              avg_comments_pct: null,
              avg_shares_pct: null,
              avg_engagement_rate: null,
              avg_retention_rate: null,
              avg_duration_seconds: null,
              avg_reach_per_view: null,
              reels_in_window: 0,
            };
        const performerMultiple = benchmarkSnapshot.avg_views != null && benchmarkSnapshot.avg_views > 0
          ? (viewsOrg + viewsPaid) / benchmarkSnapshot.avg_views
          : 0;

        reel = {
          ...DEMO_REEL,
          id: reelData.id,
          caption: reelData.caption || "",
          permalink: reelData.permalink,
          thumbnail_url: reelData.thumbnail_url,
          media_url: reelData.media_url,
          published_at: reelData.published_at,
          duration_seconds: reelData.duration_seconds ?? null as number | null,
          reel_type: reelData.reel_type,
          has_ads: reelData.has_ads,
          views_org: viewsOrg,
          views_paid: viewsPaid,
          views_total: viewsOrg + viewsPaid,
          likes: m?.likes_total || 0,
          saves: m?.saves_total || 0,
          comments: m?.comments_total || 0,
          shares: m?.shares_total || 0,
          follows: m?.follows_generated ?? null,
          impressions_org: impressionsOrg,
          impressions_paid: impressionsPaid,
          impressions_total: (impressionsOrg ?? 0) + impressionsPaid,
          reach_org: reachOrg,
          reach_paid: reachPaid,
          reach_total: reachOrg + reachPaid,
          profile_visits: m?.profile_visits ?? null,
          total_interactions: m?.total_interactions || 0,
          avg_watch_time_seconds: m?.avg_watch_time_sec ?? null,
          completion_rate: m?.completion_rate ?? null,
          total_watch_time_seconds: m?.avg_watch_time_sec != null
            ? m.avg_watch_time_sec * viewsOrg
            : null,
          paid_clicks: p?.clicks || 0,
          spend_cents: p?.spend_cents || 0,
          paid_video_plays: p?.video_plays || 0,
          sales_amount: reelData.sales_amount ?? null,
          performer_multiple: performerMultiple,
          transcript: { ...DEMO_REEL.transcript, status: "pending" },
          narrative: { ...DEMO_REEL.narrative, status: "pending" },
          visual: { ...DEMO_REEL.visual, status: "pending" },
          audio: { ...DEMO_REEL.audio, status: "pending" },
          diagnostic: null,
          benchmark: benchmarkSnapshot,
        };
      }
  }

  void isDemo;

  const dailyViews = (() => {
    const raw = (dailyMetricsData ?? []).map((d) => ({
      date: new Date(d.metric_date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
      cumulative: (d.views_org ?? 0) + (d.views_paid ?? 0),
    }));
    return raw.map((d, i) => ({
      date: d.date,
      views: i === 0 ? 0 : Math.max(0, d.cumulative - raw[i - 1].cumulative),
      cumulative: d.cumulative,
    }));
  })();

  const effectiveDuration = reel.duration_seconds ?? null;

  const durationStr = effectiveDuration
    ? `${Math.floor(effectiveDuration / 60)}:${String(Math.round(effectiveDuration) % 60).padStart(2, "0")}`
    : "--";
  const averageWatchPct = effectiveDuration && reel.avg_watch_time_seconds
    ? clampPercentage((reel.avg_watch_time_seconds / effectiveDuration) * 100)
    : null;
  const watchPct = averageWatchPct == null ? null : Math.round(averageWatchPct);
  const completionRatePct = normalizeRateToPercent(reel.completion_rate);
  const avgDropoffSeconds = effectiveDuration && reel.avg_watch_time_seconds != null
    ? Math.max(effectiveDuration - reel.avg_watch_time_seconds, 0)
    : null;

  const retentionRate = reel.avg_watch_time_seconds != null && effectiveDuration && effectiveDuration > 0
    ? Math.min(100, (reel.avg_watch_time_seconds / effectiveDuration) * 100)
    : null;
  const engagementRate = reel.views_total > 0
    ? (reel.total_interactions / reel.views_total) * 100
    : 0;
  const paidCtr = reel.impressions_paid > 0
    ? (reel.paid_clicks / reel.impressions_paid) * 100
    : null;
  const paidCpv = reel.paid_video_plays > 0
    ? reel.spend_cents / 100 / reel.paid_video_plays
    : null;
  const paidCpm = reel.impressions_paid > 0
    ? reel.spend_cents / 100 / (reel.impressions_paid / 1000)
    : null;
  const knownImpressionsTotal = reel.impressions_org != null
    ? reel.impressions_org + reel.impressions_paid
    : (reel.impressions_paid > 0 ? reel.impressions_paid : null);
  const viewsPerReach = reel.reach_total > 0
    ? reel.views_total / reel.reach_total
    : null;
  const hasPaidSignals = reel.has_ads
    || reel.views_paid > 0
    || reel.reach_paid > 0
    || reel.impressions_paid > 0
    || reel.paid_clicks > 0
    || reel.spend_cents > 0
    || reel.paid_video_plays > 0;
  const hasPaidBreakdown = reel.views_paid > 0 || reel.reach_paid > 0;
  const hasBenchmark = reel.benchmark.avg_views != null && reel.benchmark.avg_views > 0;
  const hasInteractionBenchmark = [
    reel.benchmark.avg_likes_pct,
    reel.benchmark.avg_saves_pct,
    reel.benchmark.avg_comments_pct,
    reel.benchmark.avg_shares_pct,
  ].some((value) => value != null && value > 0);
  const hasRetentionInputs = reel.avg_watch_time_seconds != null && effectiveDuration != null && effectiveDuration > 0;
  const retentionMissingMessage = effectiveDuration == null
    ? "Falta la duración del Reel. Hasta que el sync no la enriquezca, no se puede estimar retención ni abandono promedio."
    : reel.avg_watch_time_seconds == null
      ? "Meta no devolvió avg watch time para este Reel, así que la retención estimada queda no disponible."
      : null;

  // Metric ratios vs benchmark
  const likesPct = reel.views_total > 0 ? (reel.likes / reel.views_total) * 100 : 0;
  const savesPct = reel.views_total > 0 ? (reel.saves / reel.views_total) * 100 : 0;
  const commentsPct = reel.views_total > 0 ? (reel.comments / reel.views_total) * 100 : 0;
  const sharesPct = reel.views_total > 0 ? (reel.shares / reel.views_total) * 100 : 0;

  const likesComp = compareToBenchmark(likesPct, reel.benchmark.avg_likes_pct);
  const savesComp = compareToBenchmark(savesPct, reel.benchmark.avg_saves_pct);
  const commentsComp = compareToBenchmark(commentsPct, reel.benchmark.avg_comments_pct);
  const sharesComp = compareToBenchmark(sharesPct, reel.benchmark.avg_shares_pct);
  const absoluteOverviewMetrics = [
    { label: "Views totales", value: reel.views_total, accent: "text-white" },
    { label: "Reach total", value: reel.reach_total, accent: "text-sky-300" },
    { label: "Impresiones conocidas", value: knownImpressionsTotal, accent: "text-amber-300", note: reel.impressions_org == null ? "Meta no expone impresiones orgánicas en todos los Reels." : null },
    { label: "Interacciones", value: reel.total_interactions, accent: "text-emerald-300" },
    { label: "Watch time promedio", value: formatTime(reel.avg_watch_time_seconds), accent: "text-cyan-300" },
    ...(hasPaidSignals ? [{ label: "Plays pagos", value: reel.paid_video_plays, accent: "text-purple-300" }] : []),
  ];
  const explicitRatioMetrics = [
    {
      label: "Interacciones / Views",
      numerator: reel.total_interactions,
      denominator: reel.views_total,
      color: "bg-emerald-400/80",
      helper: "engagement bruto observado",
    },
    {
      label: "Views Paid / Views Totales",
      numerator: reel.views_paid,
      denominator: reel.views_total,
      color: "bg-purple-400/80",
      helper: "parte de las reproducciones atribuida a ads",
      paidOnly: true,
    },
    {
      label: "Reach Paid / Reach Total",
      numerator: reel.reach_paid,
      denominator: reel.reach_total,
      color: "bg-fuchsia-400/80",
      helper: "parte del alcance generada por ads",
      paidOnly: true,
    },
    {
      label: "Saves / Views",
      numerator: reel.saves,
      denominator: reel.views_total,
      color: "bg-amber-400/80",
      helper: "guardados sobre reproducciones",
    },
  ].filter((metric) => metric.denominator > 0 && (!metric.paidOnly || hasPaidBreakdown));
  const splitMetrics = [
    {
      label: "Views",
      total: reel.views_total,
      segments: [
        { label: "Orgánico", value: reel.views_org, color: "bg-emerald-400/80" },
        ...(hasPaidSignals ? [{ label: "Paid", value: reel.views_paid, color: "bg-purple-400/80" }] : []),
      ],
    },
    {
      label: "Reach",
      total: reel.reach_total,
      segments: [
        { label: "Orgánico", value: reel.reach_org, color: "bg-sky-400/80" },
        ...(hasPaidSignals ? [{ label: "Paid", value: reel.reach_paid, color: "bg-fuchsia-400/80" }] : []),
      ],
    },
  ].filter((metric) => hasPaidBreakdown && metric.segments.some((segment) => segment.label === "Paid" && segment.value > 0));
  const interactionMetrics = [
    { label: "Likes", count: reel.likes, ratio: likesPct, benchmark: reel.benchmark.avg_likes_pct, color: "bg-rose-400/80" },
    { label: "Saves", count: reel.saves, ratio: savesPct, benchmark: reel.benchmark.avg_saves_pct, color: "bg-amber-400/80" },
    { label: "Comments", count: reel.comments, ratio: commentsPct, benchmark: reel.benchmark.avg_comments_pct, color: "bg-emerald-400/80" },
    { label: "Shares", count: reel.shares, ratio: sharesPct, benchmark: reel.benchmark.avg_shares_pct, color: "bg-blue-400/80" },
  ];
  const retentionRows = hasRetentionInputs
    ? [
        { label: "Inicio del Reel", value: 100, detail: "Base de reproducciones" },
        ...(averageWatchPct == null ? [] : [{ label: "Viewer promedio llega hasta", value: averageWatchPct, detail: `${formatTime(reel.avg_watch_time_seconds)} de ${durationStr}` }]),
        ...(retentionRate != null ? [{ label: "Retención estimada", value: retentionRate, detail: `${retentionRate.toFixed(1)}% del Reel visto en promedio` }] : []),
      ]
    : [];
  const reelPlaybackUrl = reel.media_url || null;
  const reelPosterUrl = reel.thumbnail_url || null;

  // Day-of-week views distribution for radar
  const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const dowViews: number[] = Array(7).fill(0);
  (dailyMetricsData ?? []).forEach((d) => {
    const [year, month, day] = d.metric_date.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    dowViews[date.getUTCDay()] += (d.views_org || 0) + (d.views_paid || 0);
  });
  const dayRadarData = DAYS_ES.map((day, i) => ({ day, views: dowViews[i] }));

  // ─── REEL detail layout ─────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Back nav */}
      <InstagramBackButton />

      {/* Hero: Thumbnail + Title + Meta */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* Thumbnail / Video */}
        <div className="glass-panel rounded-3xl border border-white/10 bg-black/35 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-4 self-start">
          <div className="relative aspect-[9/14.8] overflow-hidden rounded-[20px] border border-white/10 bg-black">
            {reelPlaybackUrl ? (
              <video
                className="absolute inset-0 h-full w-full object-cover"
                controls
                playsInline
                preload="none"
                poster={reelPosterUrl ?? undefined}
              >
                <source src={reelPlaybackUrl} />
              </video>
            ) : reelPosterUrl ? (
              <img src={reelPosterUrl} alt="Preview del Reel" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Play className="h-12 w-12 text-white/20" />
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
              {reel.performer_multiple >= 3 ? (
                <div className="rounded-lg bg-gradient-to-r from-emerald-400 to-green-500 px-2.5 py-1 text-sm font-bold text-black shadow-lg">
                  x{reel.performer_multiple.toFixed(1)}
                </div>
              ) : <div />}
              <div className="flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs text-white backdrop-blur-sm">
                <Clock className="h-3 w-3" />
                {durationStr}
              </div>
            </div>
          </div>

          {reel.permalink && (
            <div className="mt-3 flex justify-center">
              <a
                href={reel.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-medium text-white/60 transition-all cursor-pointer hover:text-white hover:bg-white/[0.06]"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <ExternalLink className="h-3 w-3" />
                Abrir en Instagram
              </a>
            </div>
          )}

        </div>

        {/* Caption + Quick Info */}
        <div className="flex min-h-full flex-col gap-5">
          <div className="glass-panel rounded-3xl border border-white/10 bg-black/35 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              {reel.reel_type === "trial_likely" && (
                <span className="flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
                  <AlertTriangle className="h-2.5 w-2.5" /> Trial Reel
                </span>
              )}
              {hasPaidSignals && (
                <span className="flex items-center gap-1 rounded border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-200">
                  <Megaphone className="h-2.5 w-2.5" /> Promocionado
                </span>
              )}
            </div>
            <p className="text-base leading-relaxed text-zinc-100 sm:text-lg">{reel.caption}</p>
            <p className="mt-3 text-xs text-zinc-300">
              Publicado: {reel.published_at ? new Date(reel.published_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) : "--"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {[
              { label: "Likes", pct: `${likesPct.toFixed(2)}%`, raw: reel.likes, icon: Heart, comp: likesComp },
              { label: "Saves", pct: `${savesPct.toFixed(2)}%`, raw: reel.saves, icon: Bookmark, comp: savesComp },
              { label: "Shares", pct: `${sharesPct.toFixed(2)}%`, raw: reel.shares, icon: Share2, comp: sharesComp },
              { label: "Comments", pct: `${commentsPct.toFixed(2)}%`, raw: reel.comments, icon: MessageSquare, comp: commentsComp },
            ].map((m) => (
              <div key={m.label} className="glass-panel min-h-[120px] rounded-xl border border-white/10 bg-black/35 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
                <div className="flex items-center gap-2 mb-3">
                  <m.icon className="h-4 w-4 text-white" fill="currentColor" strokeWidth={0.5} />
                  <span className="text-[11px] font-medium text-zinc-400">{m.label}</span>
                </div>
                <p className="text-[32px] font-light text-white leading-none tracking-tight">{formatNumber(m.raw)}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[13px] font-light text-white/40">{m.pct} de views</span>
                  <span className={`text-[11px] font-medium ${m.comp.color}`}>{m.comp.label}</span>
                </div>
              </div>
            ))}
          </div>

          {reel.sales_amount != null && reel.sales_amount > 0 && (
            <div className="glass-panel rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  <span className="text-[11px] font-medium text-emerald-400/70 uppercase tracking-wider">Ventas generadas</span>
                </div>
                {reel.views_total > 0 && (
                  <span className="text-[11px] text-white/30">
                    ${(reel.sales_amount / reel.views_total).toFixed(2)} por view
                  </span>
                )}
              </div>
              <p className="text-[42px] font-light text-emerald-300 leading-none tracking-tight">
                ${formatNumber(reel.sales_amount)}
              </p>
              {reel.views_total > 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-500/10">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/30">Conversión estimada</span>
                    <span className="text-emerald-400/70">{((reel.saves / reel.views_total) * 100).toFixed(2)}% saves → compra</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="glass-panel rounded-xl border border-white/10 bg-black/35 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <Eye className="h-3.5 w-3.5 text-zinc-400" />
              Evolución de Views
            </h3>
            <ReelDailySparkline data={dailyViews} />
          </div>
        </div>
      </div>

      {/* Full-width: Métricas Extendidas + Interacciones vs Benchmark */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="glass-panel rounded-xl border border-white/10 bg-black/35 p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <TrendingUp className="h-3.5 w-3.5 text-zinc-400" />
            Métricas Extendidas
          </h3>
          {(() => {
            const extMetrics = [
              { label: "Views Org", value: formatNumber(reel.views_org), color: "text-emerald-400" },
              { label: "Views Total", value: formatNumber(reel.views_total), color: "text-white" },
              { label: "Reach Org", value: formatNumber(reel.reach_org), color: "text-sky-300" },
              { label: "Reach Total", value: formatNumber(reel.reach_total), color: "text-white" },
              { label: "Interacciones", value: formatNumber(reel.total_interactions), color: "text-amber-300" },
              { label: "Watch Total", value: formatTime(reel.total_watch_time_seconds), color: "text-cyan-300" },
              ...(hasPaidSignals ? [
                { label: "Views Paid", value: formatNumber(reel.views_paid), color: "text-purple-400" },
                { label: "Reach Paid", value: formatNumber(reel.reach_paid), color: "text-purple-300" },
                { label: "Impr. Paid", value: formatNumber(reel.impressions_paid), color: "text-zinc-100" },
              ] : []),
              ...(reel.impressions_total > 0 ? [{ label: "Impr. Total", value: formatNumber(reel.impressions_total), color: "text-zinc-100" }] : []),
            ];
            const ratioMetrics = [
              { label: "Watch Prom.", value: formatTime(reel.avg_watch_time_seconds), sub: watchPct != null ? `${watchPct}%` : null },
              { label: "Engagement", value: `${engagementRate.toFixed(1)}%`, sub: "int/views" },
              { label: "Views/Reach", value: viewsPerReach == null ? "—" : `${viewsPerReach.toFixed(2)}x`, sub: "frecuencia" },
              { label: "Retención", value: formatOptionalPercent(retentionRate), sub: "avg/dur" },
              { label: "Saves/Views", value: `${savesPct.toFixed(2)}%`, sub: null },
              { label: "Abandono", value: formatTime(avgDropoffSeconds), sub: "promedio" },
              ...(reel.profile_visits != null ? [{ label: "Profile Visits", value: formatNumber(reel.profile_visits), sub: null }] : []),
              ...(reel.follows != null ? [{ label: "Follows", value: `+${formatNumber(reel.follows)}`, sub: null, color: "text-cyan-400" }] : []),
              ...(hasPaidSignals ? [
                { label: "CTR Pago", value: formatOptionalPercent(paidCtr), sub: null },
                { label: "CPV", value: paidCpv == null ? "—" : formatCents(Math.round(paidCpv * 100)), sub: null },
                { label: "CPM", value: paidCpm == null ? "—" : formatCents(Math.round(paidCpm * 100)), sub: null },
                { label: "Clicks", value: formatNumber(reel.paid_clicks), sub: null },
                { label: "Spend", value: formatCents(reel.spend_cents), sub: null, color: "text-purple-300" },
              ] : []),
            ].filter((m) => m.value !== "—" && m.value !== "--");
            return (
              <>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${extMetrics.length}, minmax(0, 1fr))` }}>
                  {extMetrics.map((m) => (
                    <div key={m.label} className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-center whitespace-nowrap overflow-hidden">
                      <p className={`text-[18px] font-light ${m.color || "text-zinc-100"}`}>{m.value}</p>
                      <p className="text-[10px] text-zinc-400 mt-1">{m.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid gap-2 border-t border-white/5 pt-3" style={{ gridTemplateColumns: `repeat(${ratioMetrics.length}, minmax(0, 1fr))` }}>
                  {ratioMetrics.map((m) => (
                    <div key={m.label} className="rounded-lg bg-white/5 px-2 py-1.5">
                      <p className="text-[10px] text-zinc-500">{m.label}</p>
                      <p className={`text-sm font-semibold ${(m as { color?: string }).color || "text-white"}`}>
                        {m.value}
                        {m.sub && <span className="ml-1 text-[10px] font-normal text-zinc-500">{m.sub}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>

        <div className="space-y-4">
          <ReelPerformanceChart
            likes={reel.likes}
            saves={reel.saves}
            comments={reel.comments}
            shares={reel.shares}
            viewsTotal={reel.views_total}
            benchmarkLikes={reel.benchmark.avg_likes_pct}
            benchmarkSaves={reel.benchmark.avg_saves_pct}
            benchmarkComments={reel.benchmark.avg_comments_pct}
            benchmarkShares={reel.benchmark.avg_shares_pct}
          />
          {dayRadarData.some((d) => d.views > 0) && (
            <div className="glass-panel rounded-xl border border-white/10 bg-black/35 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
              <ReelDayRadar data={dayRadarData} />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="glass-panel rounded-xl border border-white/10 bg-black/35 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl min-w-0">
          <h3 className="mb-1 text-base font-semibold text-zinc-100">Volumen absoluto y ratios claros</h3>
          <p className="mb-4 text-xs text-zinc-300">Acá no hay barras sin base: arriba ves valores absolutos y abajo barras del tipo x de y.</p>
          <div className="grid grid-cols-2 gap-3">
            {absoluteOverviewMetrics.map((metric) => (
              <div key={metric.label} className="rounded-xl bg-white/6 p-4 ring-1 ring-white/5">
                <p className="mb-1 text-[11px] font-medium text-zinc-300">{metric.label}</p>
                <p className={`text-xl font-semibold ${metric.accent}`}>{typeof metric.value === "number" ? formatNumber(metric.value) : (metric.value ?? "—")}</p>
                {metric.note ? <p className="mt-1 text-[10px] text-zinc-500">{metric.note}</p> : null}
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-4 border-t border-white/5 pt-4">
            {explicitRatioMetrics.map((metric) => {
              const ratio = metric.denominator > 0 ? (metric.numerator / metric.denominator) * 100 : 0;

              return (
                <div key={metric.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-zinc-200">{metric.label}</span>
                    <span className="font-semibold text-white">{ratio.toFixed(2)}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                    <div className={metric.color} style={{ width: `${clampPercentage(ratio)}%`, height: "100%" }} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-300">
                    <span>{formatNumber(metric.numerator)} de {formatNumber(metric.denominator)}</span>
                    <span>{metric.helper}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 border-t border-white/5 pt-4">
            {splitMetrics.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {splitMetrics.map((metric) => (
                  <div key={metric.label} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-zinc-200">{metric.label}</span>
                      <span className="font-semibold text-white">{formatNumber(metric.total)}</span>
                    </div>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
                      {metric.segments.map((segment) => (
                        <div
                          key={`${metric.label}-${segment.label}`}
                          className={segment.color}
                          style={{ width: `${metric.total > 0 ? (segment.value / metric.total) * 100 : 0}%` }}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] text-zinc-300">
                      {metric.segments.map((segment) => (
                        <span key={`${metric.label}-${segment.label}-legend`}>
                          {segment.label}: {formatNumber(segment.value)} ({pctOf(segment.value, metric.total)})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-xs text-zinc-300">
                No hay un split orgánico/pagado útil para mostrar en este Reel. Si no existen métricas paid reales, asumir 100% orgánico es técnicamente cierto pero visualmente engañoso.
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-xl border border-white/10 bg-black/35 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl min-w-0">
          <h3 className="mb-1 text-base font-semibold text-zinc-100">Interacción sobre views vs promedio 90d</h3>
          <p className="mb-4 text-xs text-zinc-300">Cada fila compara el porcentaje actual sobre views totales del Reel contra el benchmark de los últimos 90 días.</p>
          {hasInteractionBenchmark ? (
            <div className="space-y-4">
              {interactionMetrics.map((metric) => {
                const comparison = compareToBenchmark(metric.ratio, metric.benchmark);
                const width = metric.benchmark != null && metric.benchmark > 0
                  ? clampPercentage((metric.ratio / metric.benchmark) * 100)
                  : 0;

                return (
                  <div key={metric.label} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-zinc-200">{metric.label}</span>
                      <span className="font-semibold text-white">{formatNumber(metric.count)}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                      <div className={`h-full rounded-full ${comparison.barClass}`} style={{ width: `${width}%` }} />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[11px]">
                      <span className="text-zinc-300">Actual {metric.ratio.toFixed(2)}%</span>
                      <span className={comparison.color}>{comparison.label}</span>
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Promedio 90d {metric.benchmark?.toFixed(2)}%
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-4 text-xs text-zinc-300">
              Todavía no hay benchmark 90d usable para este workspace. En vez de mostrar promedios falsos en `0.00%`, la ficha deja esta comparación en espera hasta que exista un snapshot real.
            </div>
          )}
        </div>

        <div className="glass-panel rounded-xl border border-white/10 bg-black/35 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl min-w-0">
          <h3 className="mb-1 text-base font-semibold text-zinc-100">Retención estimada</h3>
          <p className="mb-4 text-xs text-zinc-300">Calculado con avg watch time (Meta) + duración (Apify). No es curva real por segundo.</p>
          {retentionRows.length > 0 ? (
            <div className="space-y-4">
              {retentionRows.map((row) => (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-zinc-200">{row.label}</span>
                    <span className="font-semibold text-white">{row.value.toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400" style={{ width: `${row.value}%` }} />
                  </div>
                  <p className="text-[11px] text-zinc-300">{row.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-4 text-xs text-zinc-300">
              {retentionMissingMessage}
            </div>
          )}
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
            <div className="rounded-xl bg-white/6 p-3 ring-1 ring-white/5">
              <p className="mb-1 text-[11px] font-medium text-zinc-300">Retención</p>
              <p className="text-base font-semibold text-white">{formatOptionalPercent(retentionRate)}</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">avg_watch / duración</p>
            </div>
            <div className="rounded-xl bg-white/6 p-3 ring-1 ring-white/5">
              <p className="mb-1 text-[11px] font-medium text-zinc-300">Watch Time Prom.</p>
              <p className="text-base font-semibold text-white">{formatTime(reel.avg_watch_time_seconds)}</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">ig_reels_avg_watch_time</p>
            </div>
            <div className="rounded-xl bg-white/6 p-3 ring-1 ring-white/5">
              <p className="mb-1 text-[11px] font-medium text-zinc-300">Duración</p>
              <p className="text-base font-semibold text-white">{durationStr}</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">{effectiveDuration ? "Apify / DB" : "No disponible"}</p>
            </div>
            <div className="rounded-xl bg-white/6 p-3 ring-1 ring-white/5">
              <p className="mb-1 text-[11px] font-medium text-zinc-300">Abandono prom.</p>
              <p className="text-base font-semibold text-white">{formatTime(avgDropoffSeconds)}</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">duración - avg_watch</p>
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 3: Análisis Profundo + Chat Arko AI */}
      {workspaceId && (
        <ReelAISection
          reelId={reel.id}
          workspaceId={workspaceId}
          videoUrl={reel.media_url || null}
          initialAnalysis={initialGeminiAnalysis}
          initialGeminiSerialized={initialGeminiAnalysis ? serializeGeminiForArko(initialGeminiAnalysis) : null}
          reelSummary={serializeReelForArko(reel, reel.benchmark, engagementRate, retentionRate)}
          reelCaption={reel.caption}
          performerMultiple={reel.performer_multiple}
          showChat={!isDemo}
        />
      )}

    </div>
  );
}
