import { createClient } from "@/lib/supabase/server";
import { getLocale, getTranslations } from "next-intl/server";
import { getWorkspaceId } from "@/lib/workspace";
import { getServerTier } from "@/lib/tier/server";
import { hasFeature } from "@/lib/tier/config";
import { signStorageThumbs, pickThumb } from "@/lib/storage-thumbs";
import { hydrateGeminiAnalysis, normalizeSingleRelation } from "@/services/gemini-analysis-persistence.service";
import type { GeminiVideoAnalysis } from "@/services/gemini-video.service";
import { InstagramBackButton } from "@/components/instagram/InstagramBackButton";
import { ReelPerformanceChart } from "@/components/instagram/ReelPerformanceChart";
import { ReelAutoTitle } from "@/components/instagram/ReelAutoTitle";
import { ReelDailySparkline } from "@/components/instagram/ReelDailySparkline";
import { ReelDayRadar } from "@/components/instagram/ReelDayRadar";
import { ReelAISection } from "@/components/instagram/ReelAISection";
import { PostDetailView } from "@/components/instagram/PostDetailView";
import type { ReelAudioAnalysis, ReelNarrativeAnalysis, ReelTranscript, ReelVisualAnalysis } from "@/types/database";
import {
  Eye, Heart, Bookmark, MessageSquare, Share2,
  Clock, Play, Megaphone,
  ExternalLink, AlertTriangle, DollarSign,
} from "lucide-react";

// ─── Helpers ───

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatOptionalPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
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

function pctOf(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${((part / total) * 100).toFixed(2)}%`;
}

type BenchmarkTranslator = (key: string, vals?: Record<string, string | number>) => string;

function compareToBenchmark(value: number, benchmark: number | null, t: BenchmarkTranslator): { label: string; color: string; barClass: string } {
  if (benchmark == null || benchmark <= 0) return { label: t("noData"), color: "text-muted-foreground", barClass: "bg-white/[0.1]" };
  const ratio = value / benchmark;
  if (ratio >= 2) return { label: t("muchHigher", { ratio: ratio.toFixed(1) }), color: "text-emerald-400", barClass: "bg-gradient-to-r from-emerald-500 to-green-300" };
  if (ratio >= 1.15) return { label: t("higher", { pct: ((ratio - 1) * 100).toFixed(0) }), color: "text-emerald-400", barClass: "bg-gradient-to-r from-emerald-500 to-lime-300" };
  if (ratio >= 0.9) return { label: t("average"), color: "text-amber-300", barClass: "bg-gradient-to-r from-amber-500 to-lime-300" };
  return { label: t("lower", { pct: ((1 - ratio) * 100).toFixed(0) }), color: "text-rose-400", barClass: "bg-gradient-to-r from-rose-500 to-amber-400" };
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
  auto_title: null as string | null,
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
  const t = await getTranslations("instagram.detail");
  const benchT = await getTranslations("instagram.detail.benchmark");
  const locale = await getLocale();
  const dateLocale = locale === "en" ? "en-US" : "es-AR";

  // ─── First: detect if this is a Post/Carousel or a Reel ───
  if (workspaceId && !id.startsWith("demo")) {
    const { data: mediaCheck } = await supabase
      .from("reels")
      .select("media_type, media_product_type")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    const isPostOrCarousel = mediaCheck && (
      mediaCheck.media_type === "IMAGE" ||
      mediaCheck.media_type === "CAROUSEL_ALBUM"
    ) && mediaCheck.media_product_type !== "REELS";

    if (isPostOrCarousel) {
      // ─── POST / CAROUSEL detail view ───
      const [{ data: postData }, { data: carouselSlides }] = await Promise.all([
        supabase
          .from("reels")
          .select(`
            id, caption, permalink, thumbnail_url, media_url, media_storage_path, published_at,
            media_type, media_product_type,
            reel_metrics (impressions_org, reach_org, likes_total, comments_total, shares_total, saves_total, views_org)
          `)
          .eq("id", id)
          .eq("workspace_id", workspaceId)
          .single(),
        supabase
          .from("carousel_slides")
          .select("id, ig_media_id, slide_index, media_type, media_url, thumbnail_url")
          .eq("reel_id", id)
          .eq("workspace_id", workspaceId)
          .order("slide_index", { ascending: true }),
      ]);

      if (postData) {
        const rawM = postData.reel_metrics as unknown;
        type PostMetrics = { impressions_org: number | null; reach_org: number | null; likes_total: number; comments_total: number; shares_total: number; saves_total: number; views_org: number | null };
        const m = Array.isArray(rawM) ? (rawM as PostMetrics[])[0] : (rawM as PostMetrics | null);

        // Storage-first: la portada del post/carrusel padre ya se archiva en
        // reel-media (archiveReelThumbnails cubre la tabla reels) — firmamos el
        // path para servir una URL estable en vez de la cruda de scontent que
        // expira. Los slides del carrusel siguen con URL cruda + onError hasta
        // que carousel_slides tenga su propia columna de re-host (F3 del plan).
        const postSignedMap = await signStorageThumbs(
          supabase,
          "reel-media",
          [postData.media_storage_path as string | null]
        );

        // For posts/carousels: views_org is typically null (posts don't have "views").
        // Use impressions as the primary volume metric for engagement rate.
        const impressions = m?.impressions_org ?? 0;
        const reach = m?.reach_org ?? 0;
        const viewsOrImp = m?.views_org ?? impressions; // fallback to impressions if no views

        const postDetail = {
          id: postData.id,
          caption: postData.caption,
          permalink: postData.permalink,
          thumbnail_url: pickThumb(postSignedMap, postData.media_storage_path as string | null, postData.thumbnail_url),
          media_url: postData.media_url,
          published_at: postData.published_at,
          media_type: postData.media_type,
          likes: m?.likes_total ?? 0,
          saves: m?.saves_total ?? 0,
          comments: m?.comments_total ?? 0,
          shares: m?.shares_total ?? 0,
          views_total: viewsOrImp,
          reach,
          impressions,
          carousel_slides: (carouselSlides || []).map((s) => ({
            id: s.id,
            ig_media_id: s.ig_media_id,
            slide_index: s.slide_index,
            media_type: s.media_type,
            media_url: s.media_url,
            thumbnail_url: s.thumbnail_url,
          })),
        };

        return (
          <div className="mx-auto w-full max-w-[1600px] space-y-6 px-6 py-8 sm:px-10 lg:px-[4%] min-w-0 overflow-hidden">
            <InstagramBackButton tab="publicaciones" />
            <PostDetailView post={postDetail} />
          </div>
        );
      }
    }
  }

  // ─── REEL detail view (existing logic) ───
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
            id, caption, auto_title, permalink, thumbnail_url, media_url, published_at,
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
        // Benchmark is computed from org-only views (see reel-benchmarks.service.ts),
        // so numerator must also be org-only to avoid inflating the multiplier on promoted reels.
        const performerMultiple = benchmarkSnapshot.avg_views != null && benchmarkSnapshot.avg_views > 0
          ? viewsOrg / benchmarkSnapshot.avg_views
          : 0;

        const likesTotal = m?.likes_total || 0;
        const savesTotal = m?.saves_total || 0;
        const commentsTotal = m?.comments_total || 0;
        const sharesTotal = m?.shares_total || 0;

        reel = {
          ...DEMO_REEL,
          id: reelData.id,
          caption: reelData.caption || "",
          auto_title: (reelData as { auto_title?: string | null }).auto_title ?? null,
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
          likes: likesTotal,
          saves: savesTotal,
          comments: commentsTotal,
          shares: sharesTotal,
          follows: m?.follows_generated ?? null,
          impressions_org: impressionsOrg,
          impressions_paid: impressionsPaid,
          impressions_total: (impressionsOrg ?? 0) + impressionsPaid,
          reach_org: reachOrg,
          reach_paid: reachPaid,
          reach_total: reachOrg + reachPaid,
          profile_visits: m?.profile_visits ?? null,
          total_interactions: m?.total_interactions ?? (likesTotal + commentsTotal + savesTotal + sharesTotal),
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
      // First snapshot: take its cumulative value as the day's delta (the initial burst).
      // Matches the convention used in dayRadarData below.
      views: i === 0 ? d.cumulative : Math.max(0, d.cumulative - raw[i - 1].cumulative),
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

  const likesComp = compareToBenchmark(likesPct, reel.benchmark.avg_likes_pct, benchT);
  const savesComp = compareToBenchmark(savesPct, reel.benchmark.avg_saves_pct, benchT);
  const commentsComp = compareToBenchmark(commentsPct, reel.benchmark.avg_comments_pct, benchT);
  const sharesComp = compareToBenchmark(sharesPct, reel.benchmark.avg_shares_pct, benchT);
  const explicitRatioMetrics = [
    {
      label: locale === "en" ? "Interactions / Views" : "Interacciones / Views",
      numerator: reel.total_interactions,
      denominator: reel.views_total,
      color: "bg-emerald-400/80",
      helper: locale === "en" ? "raw engagement observed" : "engagement bruto observado",
    },
    {
      label: locale === "en" ? "Views Paid / Total Views" : "Views Paid / Views Totales",
      numerator: reel.views_paid,
      denominator: reel.views_total,
      color: "bg-purple-400/80",
      helper: locale === "en" ? "share of plays attributed to ads" : "parte de las reproducciones atribuida a ads",
      paidOnly: true,
    },
    {
      label: locale === "en" ? "Reach Paid / Total Reach" : "Reach Paid / Reach Total",
      numerator: reel.reach_paid,
      denominator: reel.reach_total,
      color: "bg-fuchsia-400/80",
      helper: locale === "en" ? "share of reach generated by ads" : "parte del alcance generada por ads",
      paidOnly: true,
    },
    {
      label: "Saves / Views",
      numerator: reel.saves,
      denominator: reel.views_total,
      color: "bg-amber-400/80",
      helper: locale === "en" ? "saves over plays" : "guardados sobre reproducciones",
    },
  ].filter((metric) => metric.denominator > 0 && (!metric.paidOnly || hasPaidBreakdown));
  const splitOrgLabel = locale === "en" ? "Organic" : "Orgánico";
  const splitMetrics = [
    {
      label: "Views",
      total: reel.views_total,
      segments: [
        { label: splitOrgLabel, value: reel.views_org, color: "bg-emerald-400/80" },
        ...(hasPaidSignals ? [{ label: "Paid", value: reel.views_paid, color: "bg-purple-400/80" }] : []),
      ],
    },
    {
      label: "Reach",
      total: reel.reach_total,
      segments: [
        { label: splitOrgLabel, value: reel.reach_org, color: "bg-sky-400/80" },
        ...(hasPaidSignals ? [{ label: "Paid", value: reel.reach_paid, color: "bg-fuchsia-400/80" }] : []),
      ],
    },
  ].filter((metric) => hasPaidBreakdown && metric.segments.some((segment) => segment.label === "Paid" && segment.value > 0));
  const interactionMetrics = [
    { label: t("kpis.likes"), count: reel.likes, ratio: likesPct, benchmark: reel.benchmark.avg_likes_pct, color: "bg-rose-400/80" },
    { label: t("kpis.saves"), count: reel.saves, ratio: savesPct, benchmark: reel.benchmark.avg_saves_pct, color: "bg-amber-400/80" },
    { label: t("kpis.comments"), count: reel.comments, ratio: commentsPct, benchmark: reel.benchmark.avg_comments_pct, color: "bg-emerald-400/80" },
    { label: t("kpis.shares"), count: reel.shares, ratio: sharesPct, benchmark: reel.benchmark.avg_shares_pct, color: "bg-blue-400/80" },
  ];
  const retentionRows = hasRetentionInputs
    ? [
        { label: t("retentionPanel.rows.reelStart"), value: 100, detail: t("retentionPanel.rows.reelStartDetail") },
        ...(averageWatchPct == null ? [] : [{ label: t("retentionPanel.rows.avgViewerReaches"), value: averageWatchPct, detail: t("retentionPanel.rows.avgViewerDetail", { watch: formatTime(reel.avg_watch_time_seconds), duration: durationStr }) }]),
        ...(retentionRate != null ? [{ label: t("retentionPanel.rows.estimatedRetention"), value: retentionRate, detail: t("retentionPanel.rows.estimatedRetentionDetail", { pct: retentionRate.toFixed(1) }) }] : []),
      ]
    : [];
  const reelPlaybackUrl = reel.media_url || null;
  const reelPosterUrl = reel.thumbnail_url || null;

  // Day-of-week views distribution for radar
  // reel_metrics_daily stores cumulative snapshots → compute delta per day first
  const DAYS_ES = t.raw("daysShort") as string[];
  const dowViews: number[] = Array(7).fill(0);
  const sortedDaily = [...(dailyMetricsData ?? [])].sort((a, b) => a.metric_date.localeCompare(b.metric_date));
  sortedDaily.forEach((d, i) => {
    const cumulative = (d.views_org || 0) + (d.views_paid || 0);
    const prev = sortedDaily[i - 1];
    // First snapshot: take its cumulative value as the day's delta (the initial burst).
    // Subsequent snapshots: delta = current lifetime - previous lifetime.
    const delta = i === 0 ? cumulative : Math.max(0, cumulative - (prev ? (prev.views_org || 0) + (prev.views_paid || 0) : 0));
    const [year, month, day] = d.metric_date.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    dowViews[date.getUTCDay()] += delta;
  });
  const dayRadarData = DAYS_ES.map((day, i) => ({ day, views: dowViews[i] }));

  // ─── REEL detail layout ─────────────────────────────────────────
  const PALETTE = ["#7A86E0", "#AF6EC7", "#4BCEAF", "#EB6991", "#373A71"] as const;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-6 py-8 sm:px-10 lg:px-[4%] min-w-0 overflow-hidden">
      <InstagramBackButton />

      {/* ── Section 1: Hero ── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* Video / Thumbnail */}
        <div className="glass-panel rounded-2xl p-3 max-w-[300px] md:max-w-none md:sticky md:top-6 self-start">
          <div className="relative aspect-[9/14.8] overflow-hidden rounded-xl border border-white/[0.06] bg-black">
            {reelPlaybackUrl ? (
              <video className="absolute inset-0 h-full w-full object-cover" controls playsInline preload="none" poster={reelPosterUrl ?? undefined}>
                <source src={reelPlaybackUrl} />
              </video>
            ) : reelPosterUrl ? (
              <img src={reelPosterUrl} alt={t("previewAlt")} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Play className="h-12 w-12 text-white/20" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
              {reel.performer_multiple >= 3 ? (
                <div className="rounded-lg px-2.5 py-1 text-[13px] font-bold text-black shadow-lg" style={{ background: "#4BCEAF" }}>
                  x{reel.performer_multiple.toFixed(1)}
                </div>
              ) : <div />}
              <div
                className="flex items-center gap-1 rounded px-2 py-1 text-xs backdrop-blur-sm"
                style={{ background: "rgba(0,0,0,0.7)", color: "#ffffff" }}
              >
                <Clock className="h-3 w-3" />
                {durationStr}
              </div>
            </div>
          </div>
          {reel.permalink && (
            <div className="mt-3 flex justify-center">
              <a href={reel.permalink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-medium text-white/50 transition-all cursor-pointer hover:text-white/80 hover:bg-white/[0.06]"
                style={{ border: "1px solid var(--border)" }}>
                <ExternalLink className="h-3 w-3" />
                {t("openInInstagram")}
              </a>
            </div>
          )}
        </div>

        {/* Right: Caption + 5 KPIs + Sparkline */}
        <div className="flex flex-col gap-4">
          {/* Caption */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {reel.reel_type === "trial_likely" && (
                <span className="flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
                  <AlertTriangle className="h-2.5 w-2.5" /> {t("trialReel")}
                </span>
              )}
              {hasPaidSignals && (
                <span className="flex items-center gap-1 rounded border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-200">
                  <Megaphone className="h-2.5 w-2.5" /> {t("promoted")}
                </span>
              )}
            </div>
            <ReelAutoTitle reelId={reel.id} autoTitle={reel.auto_title} workspaceId={workspaceId ?? null} />
            {reel.caption && (
              <p className="text-[12px] leading-relaxed text-white/40">{reel.caption}</p>
            )}
            <p className="mt-3 text-[12px] text-white/35">
              {reel.published_at
                ? t("publishedOn", { date: new Date(reel.published_at).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" }) })
                : "--"}
            </p>
          </div>

          {/* 5 KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: t("kpis.likes"),    pct: likesPct,    raw: reel.likes,    icon: Heart,         comp: likesComp    },
              { label: t("kpis.saves"),    pct: savesPct,    raw: reel.saves,    icon: Bookmark,      comp: savesComp    },
              { label: t("kpis.shares"),   pct: sharesPct,   raw: reel.shares,   icon: Share2,        comp: sharesComp   },
              { label: t("kpis.comments"), pct: commentsPct, raw: reel.comments, icon: MessageSquare, comp: commentsComp },
              { label: t("kpis.sales"),    pct: null,        raw: reel.sales_amount ?? 0, icon: DollarSign, comp: { label: reel.sales_amount != null && reel.sales_amount > 0 ? t("kpis.attributed") : t("kpis.noData"), color: reel.sales_amount != null && reel.sales_amount > 0 ? "text-emerald-400" : "text-white/25" }, isMoney: true },
            ].map((m) => (
              <div key={m.label} className="glass-panel rounded-xl p-4 flex flex-col">
                <div className="flex items-center gap-1.5 mb-3">
                  <m.icon className="h-3.5 w-3.5 text-white/60" strokeWidth={1.8} />
                  <span className="text-[11px] font-medium text-white/45">{m.label}</span>
                </div>
                <p className="text-[28px] font-light text-white leading-none tracking-tight">
                  {(m as { isMoney?: boolean }).isMoney ? (m.raw > 0 ? `$${formatNumber(m.raw)}` : "—") : formatNumber(m.raw)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {m.pct != null && <span className="text-[11px] text-white/30">{t("kpis.ofViews", { pct: m.pct.toFixed(2) })}</span>}
                  <span className={`text-[10px] font-medium ${m.comp.color}`}>{m.comp.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Sparkline — siempre visible */}
          <div className="glass-panel rounded-xl p-5 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="h-3.5 w-3.5 text-white/30" />
              <span className="text-[10px] font-medium text-white/35 uppercase tracking-[0.08em]">{t("sparkline.title")}</span>
            </div>
            {dailyViews.length >= 2 ? (
              <ReelDailySparkline data={dailyViews} />
            ) : (
              <p className="text-[12px] text-white/25 font-light mt-4 pb-2">{t("sparkline.empty")}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 2: Core Metrics Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: t("core.views"),       value: formatNumber(reel.views_total),              sub: t("core.orgPrefix", { value: formatNumber(reel.views_org) }) },
          { label: t("core.reach"),       value: formatNumber(reel.reach_total),               sub: hasPaidSignals ? t("core.paidPrefix", { value: formatNumber(reel.reach_paid) }) : t("core.totalReach") },
          { label: t("core.engagement"),  value: `${engagementRate.toFixed(1)}%`,              sub: t("core.intPerViews") },
          { label: t("core.watchTime"),   value: formatTime(reel.avg_watch_time_seconds),      sub: watchPct != null ? t("core.ofReel", { pct: watchPct }) : t("core.average") },
          { label: t("core.retention"),   value: formatOptionalPercent(retentionRate),         sub: t("core.estimated") },
          { label: t("core.performance"), value: reel.performer_multiple >= 0.01 ? `${reel.performer_multiple.toFixed(1)}x` : "—", sub: t("core.vsBenchmark") },
        ].map((kpi, i) => (
          <div key={kpi.label} className="glass-panel rounded-xl p-4">
            <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.07em] mb-2">{kpi.label}</p>
            <p className="text-[24px] font-light text-white leading-none tracking-tight" style={i === 0 ? { color: PALETTE[0] } : undefined}>{kpi.value}</p>
            <p className="mt-1.5 text-[10px] text-white/25">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Section 3: Charts Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
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

        {/* Right: Radar OR Retention visual */}
        <div className="glass-panel rounded-xl p-5 min-h-[340px]">
          {dayRadarData.some((d) => d.views > 0) ? (
            <ReelDayRadar data={dayRadarData} />
          ) : (
            <div>
              <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.08em] mb-0.5">{t("retentionPanel.title")}</p>
              <p className="text-[10px] text-white/20 mb-5">{t("retentionPanel.subtitle")}</p>
              {retentionRows.length > 0 ? (
                <div className="space-y-5">
                  {retentionRows.map((row) => (
                    <div key={row.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-light text-white/60">{row.label}</span>
                        <span className="font-light text-white">{row.value.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                        <div className="h-full rounded-full" style={{ width: `${row.value}%`, background: `linear-gradient(90deg, ${PALETTE[0]}, ${PALETTE[1]})` }} />
                      </div>
                      <p className="text-[11px] text-white/25">{row.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/[0.1] p-4 text-[12px] text-white/30 bg-white/[0.02]">
                  {retentionMissingMessage}
                </div>
              )}
              {/* Retention mini KPIs */}
              <div className="grid grid-cols-2 gap-2 mt-5">
                {[
                  { label: t("core.retention"),               value: formatOptionalPercent(retentionRate),     sub: t("retentionPanel.avgPerDuration") },
                  { label: t("retentionPanel.watchTime"),     value: formatTime(reel.avg_watch_time_seconds), sub: t("retentionPanel.average") },
                  { label: t("retentionPanel.duration"),      value: durationStr,                              sub: effectiveDuration ? t("retentionPanel.apifyOrDb") : t("retentionPanel.notAvailable") },
                  { label: t("retentionPanel.abandonment"),   value: formatTime(avgDropoffSeconds),            sub: t("retentionPanel.average") },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-lg p-3 bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[10px] text-white/30 mb-0.5">{kpi.label}</p>
                    <p className="text-[13px] font-light text-white">{kpi.value}</p>
                    <p className="text-[9px] text-white/20 mt-0.5">{kpi.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 4: Breakdowns ──
         Hybrid layout:
         • xl (3 cols): CSS Grid with items-stretch → short cards extend their bg to match the tallest.
         • md (2 cols): CSS Columns (masonry) → 3 uneven cards pack into 2 cols without leaving an
                        empty slot in a new row.
         • sm (1 col):  Cards stacked naturally. */}
      <div className="columns-1 md:columns-2 xl:columns-[unset] xl:grid xl:grid-cols-3 gap-5 xl:items-stretch [&>*]:mb-5 xl:[&>*]:mb-0 [&>*]:break-inside-avoid [&>*:last-child]:mb-0">
        {/* Interacciones vs Benchmark */}
        {hasInteractionBenchmark && (
          <div className="glass-panel rounded-xl p-5">
            <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.08em] mb-0.5">{t("breakdowns.interactionsTitle")}</p>
            <p className="text-[10px] text-white/20 mb-5">{t("breakdowns.interactionsSubtitle")}</p>
            <div className="space-y-4">
              {interactionMetrics.map((metric, i) => {
                const comparison = compareToBenchmark(metric.ratio, metric.benchmark, benchT);
                const width = metric.benchmark != null && metric.benchmark > 0
                  ? clampPercentage((metric.ratio / metric.benchmark) * 100)
                  : 0;
                return (
                  <div key={metric.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-light text-white/60">{metric.label}</span>
                      <span className="font-light text-white">{formatNumber(metric.count)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                      <div className="h-full rounded-full" style={{ width: `${width}%`, background: PALETTE[i % 4] }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-white/25">{t("breakdowns.current")} {metric.ratio.toFixed(2)}%</span>
                      <span className={comparison.color}>{comparison.label}</span>
                    </div>
                    <p className="text-[10px] text-white/20">{t("breakdowns.benchmark")} {metric.benchmark?.toFixed(2)}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ratios explícitos */}
        {explicitRatioMetrics.length > 0 && (
          <div className="glass-panel rounded-xl p-5">
            <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.08em] mb-0.5">{t("breakdowns.ratiosTitle")}</p>
            <p className="text-[10px] text-white/20 mb-5">{t("breakdowns.ratiosSubtitle")}</p>
            <div className="space-y-4">
              {explicitRatioMetrics.map((metric, i) => {
                const ratio = metric.denominator > 0 ? (metric.numerator / metric.denominator) * 100 : 0;
                return (
                  <div key={metric.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-light text-white/60">{metric.label}</span>
                      <span className="font-light text-white">{ratio.toFixed(2)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                      <div className="h-full rounded-full" style={{ width: `${clampPercentage(ratio)}%`, background: PALETTE[i % 4] }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-white/25">
                      <span>{formatNumber(metric.numerator)} {t("breakdowns.ofWord")} {formatNumber(metric.denominator)}</span>
                      <span>{metric.helper}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Paid details */}
            {hasPaidSignals && (
              <div className="mt-5 pt-4 border-t border-white/[0.05]">
                <p className="text-[10px] font-medium text-white/25 uppercase tracking-[0.08em] mb-3">{t("breakdowns.paidMetrics")}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "CTR",    value: formatOptionalPercent(paidCtr) },
                    { label: "CPV",    value: paidCpv == null ? "—" : `$${paidCpv.toFixed(3)}` },
                    { label: "CPM",    value: paidCpm == null ? "—" : `$${paidCpm.toFixed(2)}` },
                    { label: "Clicks", value: formatNumber(reel.paid_clicks) },
                    { label: "Plays",  value: formatNumber(reel.paid_video_plays) },
                    { label: "Spend",  value: `$${(reel.spend_cents / 100).toFixed(2)}` },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-lg p-2.5" style={{ background: "rgba(175,110,199,0.07)", border: "1px solid rgba(175,110,199,0.12)" }}>
                      <p className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">{kpi.label}</p>
                      <p className="text-[13px] font-light text-white">{kpi.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Split Org/Paid + Retention details (when radar is shown above) */}
        {(splitMetrics.length > 0 || (dayRadarData.some((d) => d.views > 0))) && (
          <div className="glass-panel rounded-xl p-5">
            {splitMetrics.length > 0 && (
              <>
                <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.08em] mb-0.5">{t("breakdowns.splitTitle")}</p>
                <p className="text-[10px] text-white/20 mb-5">{t("breakdowns.splitSubtitle")}</p>
                <div className="space-y-4">
                  {splitMetrics.map((metric) => (
                    <div key={metric.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-light text-white/60">{metric.label}</span>
                        <span className="font-light text-white">{formatNumber(metric.total)}</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.05]">
                        <div style={{ width: `${metric.total > 0 ? (metric.segments[0].value / metric.total) * 100 : 0}%`, background: PALETTE[2] }} className="h-full" />
                        {metric.segments[1] && (
                          <div style={{ width: `${metric.total > 0 ? (metric.segments[1].value / metric.total) * 100 : 0}%`, background: PALETTE[1] }} className="h-full" />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] text-white/25">
                        {metric.segments.map((seg, si) => (
                          <span key={seg.label}>
                            <span style={{ color: PALETTE[si === 0 ? 2 : 1] }}>{seg.label}</span>
                            {": "}{formatNumber(seg.value)} ({pctOf(seg.value, metric.total)})
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Retention mini KPIs (when radar is shown in section 3) */}
            {dayRadarData.some((d) => d.views > 0) && (
              <>
                {splitMetrics.length > 0 && <div className="mt-5 pt-4 border-t border-white/[0.05]" />}
                <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.08em] mb-3">{t("breakdowns.retentionMini")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Retención",  value: formatOptionalPercent(retentionRate),      sub: "avg / duración" },
                    { label: "Watch Time", value: formatTime(reel.avg_watch_time_seconds),   sub: "promedio" },
                    { label: "Duración",   value: durationStr,                               sub: effectiveDuration ? "Apify / DB" : "No disponible" },
                    { label: "Abandono",   value: formatTime(avgDropoffSeconds),              sub: "promedio" },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-lg p-3 bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-[10px] text-white/30 mb-0.5">{kpi.label}</p>
                      <p className="text-[13px] font-light text-white">{kpi.value}</p>
                      <p className="text-[9px] text-white/20 mt-0.5">{kpi.sub}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Section 5: Sales (conditional) ── */}
      {reel.sales_amount != null && reel.sales_amount > 0 && (
        <div className="rounded-xl p-5 backdrop-blur-xl shadow-lg shadow-foreground/5 dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)]" style={{ background: "rgba(75,206,175,0.04)", border: "1px solid rgba(75,206,175,0.12)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" style={{ color: PALETTE[2] }} />
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "rgba(75,206,175,0.7)" }}>{t("sales.title")}</span>
            </div>
            {reel.views_total > 0 && (
              <span className="text-[11px] text-white/25">{t("sales.perView", { value: (reel.sales_amount / reel.views_total).toFixed(2) })}</span>
            )}
          </div>
          <p className="text-[44px] font-light leading-none tracking-tight" style={{ color: PALETTE[2] }}>
            ${formatNumber(reel.sales_amount)}
          </p>
        </div>
      )}

      {/* ── Section 6: AI Analysis ── */}
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
          // `isDemo` acá es "reel de MUESTRA", no el tier: un demo con IG
          // conectado veía el chat en sus 12 reels reales y cada mensaje
          // moría en 403 — parecía roto, no bloqueado.
          showChat={!isDemo && hasFeature(await getServerTier(), 'mokaAI')}
        />
      )}
    </div>
  );
}
