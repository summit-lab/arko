import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Eye, Heart, MessageSquare, Share2, Clock, ExternalLink,
  AlertTriangle, ChevronLeft, Hash, Music,
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

function pctStr(value: number): string {
  return `${value.toFixed(2)}%`;
}

function extractHandle(igUrl: string): string {
  try {
    const url = new URL(igUrl.startsWith("http") ? igUrl : `https://${igUrl}`);
    return url.pathname.split("/").filter(Boolean)[0] ?? igUrl;
  } catch {
    return igUrl.replace(/^@/, "");
  }
}

type BenchResult = { label: string; color: string; barPct: number };

function compareToBenchmark(value: number, benchmark: number | null): BenchResult {
  if (benchmark == null || benchmark <= 0) {
    return { label: "—", color: "text-white/25", barPct: 50 };
  }
  const ratio = value / benchmark;
  const barPct = Math.min(100, Math.max(4, (ratio / 2) * 100));
  if (ratio >= 2)    return { label: `${ratio.toFixed(1)}x más alto`,              color: "text-emerald-400", barPct };
  if (ratio >= 1.15) return { label: `${((ratio - 1) * 100).toFixed(0)}% más alto`, color: "text-emerald-400", barPct };
  if (ratio >= 0.9)  return { label: "Cerca del promedio",                          color: "text-amber-300",   barPct };
  return { label: `${((1 - ratio) * 100).toFixed(0)}% más bajo`, color: "text-rose-400", barPct };
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

  // Normalize analysis (Supabase returns array for related tables)
  const rawAnalysis = reel.competitor_reel_analysis;
  const analysis: ReelAnalysis | null = Array.isArray(rawAnalysis)
    ? (rawAnalysis[0] as ReelAnalysis | undefined) ?? null
    : (rawAnalysis as ReelAnalysis | null) ?? null;

  // ─── Metrics (raw nullable for display, coalesced for math) ───────────────
  const views    = reel.views_count    ?? 0;
  const likes    = reel.likes_count    ?? 0;
  const comments = reel.comments_count ?? 0;
  const shares   = reel.shares_count   ?? 0;
  const total    = likes + comments + shares;
  const engRate      = views > 0 ? (total    / views) * 100 : 0;
  const likesPct     = views > 0 ? (likes    / views) * 100 : 0;
  const commentsPct  = views > 0 ? (comments / views) * 100 : 0;
  const sharesPct    = views > 0 ? (shares   / views) * 100 : 0;

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

  // ─── Chart 1: all reels sorted by date for the views bar chart ────────────
  const reelsSorted = [...allReels].sort(
    (a, b) =>
      new Date(a.published_at ?? "1970").getTime() -
      new Date(b.published_at ?? "1970").getTime(),
  );
  const maxViews = Math.max(...reelsSorted.map((r) => r.views_count ?? 0), 1);

  // ─── Competitor profile ───────────────────────────────────────────────────
  const profile    = competitor.scraped_data as Record<string, unknown> | null;
  const handle     = (profile?.ig_username       as string | undefined) ?? extractHandle(competitor.ig_url ?? "");
  const profilePic = (profile?.ig_profile_pic_url as string | undefined) ?? null;
  const followers  = (profile?.ig_follower_count   as number | undefined) ?? null;

  const publishedStr = reel.published_at
    ? `Publicado el ${new Date(reel.published_at).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })}`
    : null;

  const hashtags = (reel.hashtags as string[] | null) ?? [];

  const PALETTE = ["#7A86E0", "#AF6EC7", "#4BCEAF", "#EB6991", "#373A71"] as const;

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
          <img src={profilePic} alt={competitor.name ?? ""} className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-white/[0.08] flex items-center justify-center text-[13px] font-medium text-white/60">
            {(competitor.name ?? "?")[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-[15px] font-medium text-white">{competitor.name}</h1>
          <p className="text-[11px] text-white/40">
            @{handle}
            {followers ? ` · ${formatNumber(followers)} seguidores` : ""}
          </p>
        </div>
      </div>

      {/* ── Section 1: Hero ── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">

        {/* Left: Thumbnail */}
        <div className="glass-panel rounded-2xl p-3 max-w-[260px] md:max-w-none md:sticky md:top-6 self-start">
          <div className="relative aspect-[9/14.8] overflow-hidden rounded-xl border border-white/[0.06] bg-black">
            {reel.thumbnail_url ? (
              <img src={reel.thumbnail_url} alt="Reel thumbnail" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Eye className="h-10 w-10 text-white/20" />
              </div>
            )}

            {/* Top overlays */}
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

            {/* Trial badge */}
            {reel.maybe_trial && (
              <div className="pointer-events-none absolute bottom-3 left-3">
                <span className="flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                  <AlertTriangle className="h-2.5 w-2.5" /> Trial
                </span>
              </div>
            )}
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

        {/* Right: Caption + KPIs + Chart 1 */}
        <div className="flex flex-col gap-4">
          {/* Caption */}
          <div className="glass-panel rounded-2xl p-5">
            {reel.caption ? (
              <p className="text-[13px] leading-relaxed text-white/80">{reel.caption}</p>
            ) : (
              <p className="text-[13px] text-white/25 italic">Sin caption</p>
            )}
            {publishedStr && (
              <p className="mt-3 text-[12px] text-white/35">{publishedStr}</p>
            )}
          </div>

          {/* 4 KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Visualizaciones",
                value: formatNumber(reel.views_count),
                sub: null,
                icon: Eye,
                color: PALETTE[0],
              },
              {
                label: "Me gusta",
                value: formatNumber(reel.likes_count),
                sub: reel.likes_count != null && views > 0 ? `${pctStr(likesPct)} de viz.` : null,
                icon: Heart,
                color: undefined,
              },
              {
                label: "Comentarios",
                value: formatNumber(reel.comments_count),
                sub: reel.comments_count != null && views > 0 ? `${pctStr(commentsPct)} de viz.` : null,
                icon: MessageSquare,
                color: undefined,
              },
              {
                label: "Compartidos",
                value: formatNumber(reel.shares_count),
                sub: reel.shares_count != null && views > 0 ? `${pctStr(sharesPct)} de viz.` : null,
                icon: Share2,
                color: undefined,
              },
            ].map((m) => (
              <div key={m.label} className="glass-panel rounded-xl p-4 flex flex-col">
                <div className="flex items-center gap-1.5 mb-3">
                  <m.icon className="h-3.5 w-3.5 text-white/60" strokeWidth={1.8} />
                  <span className="text-[11px] font-medium text-white/45">{m.label}</span>
                </div>
                <p
                  className={`text-[28px] font-light leading-none tracking-tight ${m.color ? "" : "text-foreground"}`}
                  style={m.color ? { color: m.color } : undefined}
                >
                  {m.value}
                </p>
                {m.sub && <p className="mt-2 text-[11px] text-white/30">{m.sub}</p>}
              </div>
            ))}
          </div>

          {/* Chart 1: Visualizaciones por reel (todos los reels del competidor) */}
          <div className="glass-panel rounded-xl p-4 flex-1 flex flex-col">
            <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.08em]">
              Visualizaciones por reel · @{handle}
            </p>
            <p className="text-[10px] text-white/20 mt-0.5 mb-4">
              Reel actual resaltado en azul
            </p>
            {reelsSorted.length > 0 ? (
              <div className="flex items-end gap-[3px] h-[72px]">
                {reelsSorted.map((r) => {
                  const heightPct = Math.max(4, ((r.views_count ?? 0) / maxViews) * 100);
                  const isCurrent = r.id === reelId;
                  return (
                    <div
                      key={r.id}
                      className="flex-1 rounded-t-sm"
                      style={{
                        height: `${heightPct}%`,
                        background: isCurrent
                          ? "linear-gradient(180deg, #7A86E0, #AF6EC7)"
                          : "rgba(100,116,139,0.3)",
                        minWidth: "2px",
                        maxWidth: "32px",
                        boxShadow: isCurrent ? "0 0 8px rgba(122,134,224,0.4)" : undefined,
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="h-[72px] flex items-center justify-center">
                <p className="text-[12px] text-white/20">Sin datos</p>
              </div>
            )}
            <p className="mt-3 text-[10px] text-white/20">{allReels.length} reels totales</p>
          </div>
        </div>
      </div>

      {/* ── Section 2: Core metrics strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: "Visualizaciones",
            value: formatNumber(views),
            sub: `${allReels.length} reels totales`,
            color: PALETTE[0],
          },
          {
            label: "% Me gusta",
            value: pctStr(likesPct),
            sub: avgLikesPct != null ? `prom. ${pctStr(avgLikesPct)}` : "—",
            color: undefined,
          },
          {
            label: "% Comentarios",
            value: pctStr(commentsPct),
            sub: avgCommentsPct != null ? `prom. ${pctStr(avgCommentsPct)}` : "—",
            color: undefined,
          },
          {
            label: "% Compartidos",
            value: pctStr(sharesPct),
            sub: avgSharesPct != null ? `prom. ${pctStr(avgSharesPct)}` : "—",
            color: undefined,
          },
          {
            label: "Duración",
            value: formatDuration(reel.duration_seconds),
            sub: "del reel",
            color: undefined,
          },
          {
            label: "Rendimiento",
            value: performerMultiple != null ? `${performerMultiple.toFixed(1)}x` : "—",
            sub: "vs promedio del competidor",
            color: undefined,
          },
        ].map((kpi, i) => (
          <div key={kpi.label} className="glass-panel rounded-xl p-4">
            <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.07em] mb-2">{kpi.label}</p>
            <p
              className={`text-[24px] font-light leading-none tracking-tight ${(kpi.color || i === 0) ? "" : "text-foreground"}`}
              style={kpi.color ? { color: kpi.color } : i === 0 ? { color: PALETTE[0] } : undefined}
            >
              {kpi.value}
            </p>
            <p className="mt-1.5 text-[10px] text-white/25">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Section 3: Chart 2 (comparación visual) + AI Analysis ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Chart 2: Este reel vs promedio del competidor */}
        <div className="glass-panel rounded-xl p-5">
          <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.08em] mb-0.5">
            Este reel vs promedio del competidor
          </p>
          <p className="text-[10px] text-white/20 mb-5">
            Métricas de interacción como % de visualizaciones · @{handle}
          </p>

          <div className="space-y-5">
            {[
              { label: "Engagement Rate", value: engRate,     avg: avgEngPct },
              { label: "% Me gusta",       value: likesPct,   avg: avgLikesPct },
              { label: "% Comentarios",    value: commentsPct, avg: avgCommentsPct },
              { label: "% Compartidos",    value: sharesPct,  avg: avgSharesPct },
            ].map((m) => {
              const maxVal = Math.max(m.value, m.avg ?? 0, 0.001);
              const comp = compareToBenchmark(m.value, m.avg);
              const reelBarPct = Math.min(88, (m.value / maxVal) * 88);
              const avgBarPct  = m.avg != null ? Math.min(88, (m.avg  / maxVal) * 88) : 0;
              return (
                <div key={m.label}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-light text-white/60">{m.label}</span>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[12px] font-light text-white">{pctStr(m.value)}</span>
                      <span className={`text-[10px] font-medium ${comp.color}`}>{comp.label}</span>
                    </div>
                  </div>
                  {/* Este reel bar */}
                  <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${reelBarPct}%`,
                        background: "linear-gradient(90deg, #7A86E0, #AF6EC7)",
                      }}
                    />
                  </div>
                  {/* Promedio bar */}
                  {m.avg != null && (
                    <div className="mt-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white/20"
                        style={{ width: `${avgBarPct}%` }}
                      />
                    </div>
                  )}
                  {m.avg != null && (
                    <p className="text-[10px] text-white/20 mt-0.5">Promedio: {pctStr(m.avg)}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-5 mt-5 pt-4 border-t border-white/[0.04]">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-5 rounded-full" style={{ background: "linear-gradient(90deg, #7A86E0, #AF6EC7)" }} />
              <span className="text-[10px] text-white/30">Este reel</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-5 rounded-full bg-white/20" />
              <span className="text-[10px] text-white/30">Promedio @{handle}</span>
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        {analysis ? (
          <div className="glass-panel rounded-xl p-5 space-y-4">
            <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.08em]">Análisis IA</p>

            {/* Hook */}
            {analysis.hook_text && (
              <div>
                <p className="text-[10px] text-white/30 mb-1">Hook</p>
                <p className="text-[13px] text-white/80 leading-snug">{analysis.hook_text}</p>
                {analysis.hook_type && (
                  <span className="mt-1.5 inline-block rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">
                    {analysis.hook_type}
                  </span>
                )}
              </div>
            )}

            {/* Content type + Narrative */}
            {(analysis.content_type || analysis.narrative_structure) && (
              <div className="grid grid-cols-2 gap-3">
                {analysis.content_type && (
                  <div>
                    <p className="text-[10px] text-white/30 mb-1">Tipo de contenido</p>
                    <p className="text-[12px] text-white/70">{analysis.content_type}</p>
                  </div>
                )}
                {analysis.narrative_structure && (
                  <div>
                    <p className="text-[10px] text-white/30 mb-1">Estructura narrativa</p>
                    <p className="text-[12px] text-white/70">{analysis.narrative_structure}</p>
                  </div>
                )}
              </div>
            )}

            {/* CTA */}
            {analysis.cta_text && (
              <div>
                <p className="text-[10px] text-white/30 mb-1">CTA</p>
                <p className="text-[12px] text-white/70">{analysis.cta_text}</p>
                {analysis.cta_type && (
                  <span className="mt-1 inline-block rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">
                    {analysis.cta_type}
                  </span>
                )}
              </div>
            )}

            {/* Topic + Style */}
            {(analysis.topic_cluster || analysis.style_notes) && (
              <div className="grid grid-cols-2 gap-3">
                {analysis.topic_cluster && (
                  <div>
                    <p className="text-[10px] text-white/30 mb-1">Tema</p>
                    <p className="text-[12px] text-white/70">{analysis.topic_cluster}</p>
                  </div>
                )}
                {analysis.style_notes && (
                  <div>
                    <p className="text-[10px] text-white/30 mb-1">Estilo visual</p>
                    <p className="text-[12px] text-white/70">{analysis.style_notes}</p>
                  </div>
                )}
              </div>
            )}

            {analysis.model_used && (
              <p className="text-[10px] text-white/20">Analizado con {analysis.model_used}</p>
            )}
          </div>
        ) : (
          <div className="glass-panel rounded-xl p-5 flex items-center justify-center min-h-[200px]">
            <p className="text-[13px] text-white/30">Este reel aún no tiene análisis IA.</p>
          </div>
        )}
      </div>

      {/* ── Section 4: Strengths + Weaknesses + Summary ── */}
      {analysis && (analysis.strengths || analysis.weaknesses || analysis.ai_summary) && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {analysis.strengths && (
            <div className="glass-panel rounded-xl p-5">
              <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.08em] mb-3">Fortalezas</p>
              <div className="prose prose-sm prose-invert max-w-none text-[12px] text-white/60">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.strengths}</ReactMarkdown>
              </div>
            </div>
          )}
          {analysis.weaknesses && (
            <div className="glass-panel rounded-xl p-5">
              <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.08em] mb-3">Oportunidades</p>
              <div className="prose prose-sm prose-invert max-w-none text-[12px] text-white/60">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.weaknesses}</ReactMarkdown>
              </div>
            </div>
          )}
          {analysis.ai_summary && (
            <div className="glass-panel rounded-xl p-5">
              <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.08em] mb-3">Resumen IA</p>
              <div className="prose prose-sm prose-invert max-w-none text-[12px] text-white/60">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.ai_summary}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Section 5: Transcript ── */}
      {reel.transcript && (
        <div className="glass-panel rounded-xl p-5">
          <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.08em] mb-3">Transcripción</p>
          <p className="text-[13px] leading-relaxed text-white/60">{reel.transcript}</p>
        </div>
      )}

      {/* ── Section 6: Hashtags + Music ── */}
      {(hashtags.length > 0 || reel.music_name) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {hashtags.length > 0 && (
            <div className="glass-panel rounded-xl p-5">
              <div className="flex items-center gap-1.5 mb-3">
                <Hash className="h-3.5 w-3.5 text-white/30" />
                <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.08em]">Hashtags</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {hashtags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-white/50">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {reel.music_name && (
            <div className="glass-panel rounded-xl p-5">
              <div className="flex items-center gap-1.5 mb-3">
                <Music className="h-3.5 w-3.5 text-white/30" />
                <p className="text-[10px] font-medium text-white/35 uppercase tracking-[0.08em]">Música</p>
              </div>
              <p className="text-[13px] text-white/70">{reel.music_name}</p>
              {reel.music_artist && (
                <p className="text-[11px] text-white/40 mt-0.5">{reel.music_artist}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
