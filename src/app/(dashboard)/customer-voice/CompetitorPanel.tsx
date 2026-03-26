"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Swords, Eye, Heart, MessageSquare, Share2,
  Clock, Loader2, Sparkles, ChevronDown, ChevronRight,
  Instagram, Users, FileText, Trash2, Plus, Search,
  Info, X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CompetitorProfile {
  ig_username?: string;
  ig_full_name?: string;
  ig_bio?: string;
  ig_follower_count?: number;
  ig_following_count?: number;
  ig_post_count?: number;
  ig_is_verified?: boolean;
  ig_business_category?: string;
  scraped_at?: string;
}

interface ReelAnalysis {
  hook_text: string | null;
  hook_type: string | null;
  content_type: string | null;
  topic_cluster: string | null;
  style_notes: string | null;
  narrative_structure: string | null;
  strengths: string | null;
  weaknesses: string | null;
  ai_summary: string | null;
  cta_type: string | null;
}

interface CompetitorReel {
  id: string;
  caption: string | null;
  views_count: number | null;
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
  duration_seconds: number | null;
  published_at: string | null;
  transcript: string | null;
  competitor_reel_analysis: ReelAnalysis | null;
}

interface Competitor {
  id: string;
  name: string | null;
  ig_url: string | null;
  why_better: string | null;
  scraped_data: CompetitorProfile | null;
  last_scraped_at: string | null;
  analysis_status: string;
  reels: CompetitorReel[];
  reels_count: number;
}

interface CompetitorPanelProps {
  competitors: Competitor[];
  workspaceId: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatNumber(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const HOOK_TYPES: Record<string, { label: string; color: string; description: string }> = {
  transformacion: {
    label: "Transformación",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    description: "Muestra un antes/después o cambio personal",
  },
  enemigo: {
    label: "Enemigo",
    color: "text-red-400 bg-red-500/10 border-red-500/20",
    description: "Señala un problema oculto o enemigo común",
  },
  negativo: {
    label: "Negativo",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    description: "Advierte sobre errores o cosas que no hacer",
  },
  promesa: {
    label: "Promesa",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    description: "Promete enseñar o revelar algo valioso",
  },
  curiosidad: {
    label: "Curiosidad",
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    description: "Genera intriga con preguntas o datos sorprendentes",
  },
  desconocido: {
    label: "Sin clasificar",
    color: "text-white/30 bg-white/[0.03] border-white/[0.06]",
    description: "No se detectó un tipo de hook conocido",
  },
};

function getHookInfo(type: string | null) {
  return HOOK_TYPES[type ?? "desconocido"] ?? HOOK_TYPES["desconocido"];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CompetitorPanel({ competitors, workspaceId }: CompetitorPanelProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [analyzingReel, setAnalyzingReel] = useState<Record<string, boolean>>({});
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null);
  const [expandedReel, setExpandedReel] = useState<string | null>(null);
  const [statusMessages, setStatusMessages] = useState<Record<string, string>>({});
  const [addReelOpen, setAddReelOpen] = useState<string | null>(null);
  const [reelUrl, setReelUrl] = useState("");
  const [addingReel, setAddingReel] = useState(false);
  const [hookTooltip, setHookTooltip] = useState<string | null>(null);

  // Auto-refresh when any competitor has analysis in progress (persisted state)
  // Uses router.refresh() to re-fetch server data WITHOUT full page reload
  const hasServerAnalyzing = competitors.some((c) => c.analysis_status === "analyzing");
  useEffect(() => {
    if (!hasServerAnalyzing) return;
    const interval = setInterval(() => {
      router.refresh();
    }, 15_000); // Poll every 15s
    return () => clearInterval(interval);
  }, [hasServerAnalyzing, router]);

  if (competitors.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-12 text-center animate-slide-up">
        <div className="h-12 w-12 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
          <Swords className="h-6 w-6 text-rose-400" />
        </div>
        <p className="text-[16px] text-white/60 font-light mb-1.5">
          No tenés competidores configurados
        </p>
        <p className="text-[13px] text-white/30 font-light max-w-md mx-auto">
          Agregá competidores desde el onboarding de ADN o editando tu perfil.
        </p>
      </div>
    );
  }

  // ─── Handlers ───────────────────────────────────────────────────────────

  async function handleAnalyzeAll(competitorId: string) {
    setProcessing((prev) => ({ ...prev, [competitorId]: true }));
    setStatusMessages((prev) => ({ ...prev, [competitorId]: "Descargando perfil y reels..." }));

    try {
      const scrapeRes = await fetch(`/api/v1/competitors/${competitorId}/scrape`, {
        method: "POST",
        headers: { "x-workspace-id": workspaceId },
      });
      const scrapeJson = await scrapeRes.json();
      if (!scrapeRes.ok) {
        setStatusMessages((prev) => ({ ...prev, [competitorId]: `Error: ${scrapeJson.message ?? "Error descargando datos"}` }));
        return;
      }

      const reelsFound = scrapeJson.data?.reels_found ?? 0;
      if (reelsFound === 0) {
        setStatusMessages((prev) => ({ ...prev, [competitorId]: "No se encontraron reels públicos" }));
        return;
      }

      setStatusMessages((prev) => ({ ...prev, [competitorId]: `${reelsFound} reels descargados. Analizando top 5 con IA...` }));

      const analyzeRes = await fetch(`/api/v1/competitors/${competitorId}/analyze`, {
        method: "POST",
        headers: { "x-workspace-id": workspaceId },
      });
      const analyzeJson = await analyzeRes.json();

      if (!analyzeRes.ok) {
        setStatusMessages((prev) => ({ ...prev, [competitorId]: `Reels descargados pero error en análisis: ${analyzeJson.message ?? ""}` }));
        setTimeout(() => router.refresh(), 1500);
        return;
      }

      setStatusMessages((prev) => ({
        ...prev,
        [competitorId]: `Listo: ${reelsFound} reels descargados, ${analyzeJson.data?.reels_analyzed ?? 0} analizados con IA`,
      }));
      setTimeout(() => router.refresh(), 1500);
    } catch {
      setStatusMessages((prev) => ({ ...prev, [competitorId]: "Error de conexión" }));
    } finally {
      setProcessing((prev) => ({ ...prev, [competitorId]: false }));
    }
  }

  async function handleAnalyzeReel(competitorId: string, reelId: string) {
    setAnalyzingReel((prev) => ({ ...prev, [reelId]: true }));
    try {
      const res = await fetch(`/api/v1/competitors/${competitorId}/reels/${reelId}/analyze`, {
        method: "POST",
        headers: { "x-workspace-id": workspaceId },
      });
      if (res.ok) {
        setTimeout(() => router.refresh(), 800);
      }
    } catch { /* ignore */ }
    finally { setAnalyzingReel((prev) => ({ ...prev, [reelId]: false })); }
  }

  async function handleDeleteReel(competitorId: string, reelId: string) {
    const res = await fetch(`/api/v1/competitors/${competitorId}/reels`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
      body: JSON.stringify({ reelId }),
    });
    if (res.ok) {
      router.refresh();
    }
  }

  async function handleAddReel(competitorId: string) {
    if (!reelUrl.trim()) return;
    setAddingReel(true);
    try {
      const res = await fetch(`/api/v1/competitors/${competitorId}/reels`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
        body: JSON.stringify({ url: reelUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatusMessages((prev) => ({ ...prev, [competitorId]: json.message ?? "Error agregando reel" }));
      } else {
        setReelUrl("");
        setAddReelOpen(null);
        router.refresh();
      }
    } catch {
      setStatusMessages((prev) => ({ ...prev, [competitorId]: "Error de conexión" }));
    } finally {
      setAddingReel(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3 animate-slide-up">
      {competitors.map((comp) => {
        const profile = comp.scraped_data;
        const hasProfile = profile && Object.keys(profile).length > 0;
        const hasReels = comp.reels_count > 0;
        const isProcessing = (processing[comp.id] ?? false) || comp.analysis_status === "analyzing";
        const status = statusMessages[comp.id];
        const isExpanded = expandedCompetitor === comp.id;
        const analyzedCount = comp.reels.filter((r) => r.competitor_reel_analysis).length;
        const unanalyzedCount = comp.reels_count - analyzedCount;
        const hasPendingAnalysis = hasReels && unanalyzedCount > 0;

        return (
          <div key={comp.id} className="glass-panel rounded-xl overflow-hidden">
            {/* ─── Collapsed header (always visible) ─── */}
            <button
              onClick={() => setExpandedCompetitor(isExpanded ? null : comp.id)}
              className="w-full px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
              <div className="h-9 w-9 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/15 shrink-0">
                <span className="text-[13px] text-rose-400 font-semibold">
                  {(comp.name ?? "?")[0].toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-medium text-white/85 truncate">{comp.name}</h3>
                  {hasProfile && profile.ig_is_verified && (
                    <span className="text-[9px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/20">✓</span>
                  )}
                </div>
                <p className="text-[11px] text-white/25 font-light truncate">{comp.ig_url}</p>
              </div>

              {/* Quick stats */}
              <div className="flex items-center gap-4 shrink-0">
                {hasProfile && (
                  <span className="text-[11px] text-white/30 font-light">
                    {formatNumber(profile.ig_follower_count ?? null)} seguidores
                  </span>
                )}
                {hasReels && (
                  <span className="text-[11px] text-white/30 font-light flex items-center gap-1.5">
                    {comp.reels_count} reels · {analyzedCount} analizados
                    {isProcessing && (
                      <span className="flex items-center gap-1 text-violet-400/60">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-[10px] animate-pulse">procesando...</span>
                      </span>
                    )}
                    {!isProcessing && hasPendingAnalysis && (
                      <span className="text-[10px] text-amber-400/50">
                        · {unanalyzedCount} sin analizar
                      </span>
                    )}
                  </span>
                )}
                {!hasReels && (
                  <span className="text-[11px] text-white/20 font-light">Sin datos</span>
                )}
              </div>

              {/* Analyze button (stop propagation to not toggle) */}
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); if (!isProcessing) handleAnalyzeAll(comp.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !isProcessing) { e.stopPropagation(); handleAnalyzeAll(comp.id); } }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                  isProcessing
                    ? "text-white/30 bg-white/[0.03] border-white/[0.06] cursor-not-allowed"
                    : "text-violet-300/70 hover:text-violet-300 bg-violet-500/[0.08] hover:bg-violet-500/[0.15] border-violet-500/20 cursor-pointer"
                }`}
              >
                {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {isProcessing ? "Analizando..." : hasReels ? "Re-analizar" : "Analizar"}
              </div>

              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-white/20 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-white/20 shrink-0" />
              )}
            </button>

            {/* Status message */}
            {(status || isProcessing) && (
              <div className="px-5 pb-2">
                <div className="flex items-center gap-2">
                  {isProcessing && (
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                      <Loader2 className="h-3 w-3 text-violet-400/60 animate-spin" />
                    </div>
                  )}
                  <p className={`text-[11px] font-light ${isProcessing ? "text-violet-300/50" : "text-white/40"}`}>
                    {status ?? "Analizando reels con IA... esto puede tomar hasta 2 minutos"}
                  </p>
                </div>
              </div>
            )}

            {/* ─── Expanded content ─── */}
            {isExpanded && (
              <div className="border-t border-white/[0.04]">
                {/* Profile stats */}
                {hasProfile && (
                  <div className="px-5 py-4 grid grid-cols-4 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Users className="h-3 w-3 text-white/20" />
                        <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Followers</span>
                      </div>
                      <p className="text-[15px] text-white/70 font-medium">{formatNumber(profile.ig_follower_count ?? null)}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Instagram className="h-3 w-3 text-white/20" />
                        <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Posts</span>
                      </div>
                      <p className="text-[15px] text-white/70 font-medium">{formatNumber(profile.ig_post_count ?? null)}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <FileText className="h-3 w-3 text-white/20" />
                        <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Reels</span>
                      </div>
                      <p className="text-[15px] text-white/70 font-medium">{comp.reels_count}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="h-3 w-3 text-white/20" />
                        <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Último análisis</span>
                      </div>
                      <p className="text-[12px] text-white/50 font-light">
                        {comp.last_scraped_at ? new Date(comp.last_scraped_at).toLocaleDateString("es-AR") : "Nunca"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Bio */}
                {hasProfile && profile.ig_bio && (
                  <div className="px-5 pb-4">
                    <p className="text-[12px] text-white/40 font-light leading-[1.6]">{profile.ig_bio}</p>
                  </div>
                )}

                {/* Reels list */}
                {comp.reels.length > 0 && (
                  <div className="border-t border-white/[0.04]">
                    <div className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-white/25 uppercase tracking-[0.12em] font-medium">
                          Top Reels ({comp.reels.length})
                        </span>
                        {/* Hook type legend */}
                        <div className="relative">
                          <button
                            onClick={() => setHookTooltip(hookTooltip === comp.id ? null : comp.id)}
                            className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/40 transition-colors cursor-pointer"
                          >
                            <Info className="h-3 w-3" />
                            <span>Tipos de hook</span>
                          </button>
                          {hookTooltip === comp.id && (
                            <div className="absolute left-0 top-6 z-50 w-[280px] rounded-xl p-4 space-y-2 backdrop-blur-xl"
                              style={{ background: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 12px 48px rgba(0,0,0,0.6)" }}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] text-white/60 font-medium">Tipos de Hook (Framework Fran)</span>
                                <button onClick={() => setHookTooltip(null)} className="cursor-pointer"><X className="h-3 w-3 text-white/30" /></button>
                              </div>
                              {Object.entries(HOOK_TYPES).map(([key, info]) => (
                                <div key={key} className="flex items-start gap-2">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${info.color}`}>{info.label}</span>
                                  <span className="text-[10px] text-white/40 leading-[1.4]">{info.description}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Add reel button */}
                      <button
                        onClick={() => setAddReelOpen(addReelOpen === comp.id ? null : comp.id)}
                        className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/50 transition-colors cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        Agregar reel
                      </button>
                    </div>

                    {/* Add reel input */}
                    {addReelOpen === comp.id && (
                      <div className="px-5 pb-3 flex items-center gap-2">
                        <div className="flex-1 relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
                          <input
                            type="text"
                            value={reelUrl}
                            onChange={(e) => setReelUrl(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleAddReel(comp.id); }}
                            placeholder="instagram.com/reel/ABC123..."
                            className="w-full pl-9 pr-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[12px] text-white/70 placeholder:text-white/20 focus:outline-none focus:border-violet-500/30"
                          />
                        </div>
                        <button
                          onClick={() => handleAddReel(comp.id)}
                          disabled={addingReel || !reelUrl.trim()}
                          className="px-3 py-2 rounded-lg text-[11px] font-medium text-violet-300/70 bg-violet-500/[0.08] border border-violet-500/20 hover:bg-violet-500/[0.15] transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {addingReel ? <Loader2 className="h-3 w-3 animate-spin" /> : "Agregar"}
                        </button>
                      </div>
                    )}

                    <div className="px-5 pb-4 space-y-1.5">
                      {comp.reels.map((reel) => {
                        const analysis = reel.competitor_reel_analysis;
                        const isReelExpanded = expandedReel === reel.id;
                        const hookInfo = getHookInfo(analysis?.hook_type ?? null);
                        const isAnalyzingThis = analyzingReel[reel.id] ?? false;

                        return (
                          <div
                            key={reel.id}
                            className={`rounded-lg border cursor-pointer transition-colors ${
                              isAnalyzingThis
                                ? "border-violet-500/20 bg-white/[0.02]"
                                : analysis
                                  ? "border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]"
                                  : "border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03]"
                            }`}
                            onClick={() => setExpandedReel(isReelExpanded ? null : reel.id)}
                          >
                            {/* Reel row */}
                            <div className="flex items-center gap-3 px-3 py-2.5">
                              <p className={`text-[11px] font-light truncate flex-1 min-w-0 ${analysis ? "text-white/55" : "text-white/25"}`}>
                                {reel.caption?.substring(0, 80) ?? "(sin caption)"}
                              </p>

                              {/* Metrics */}
                              <div className={`flex items-center gap-3 shrink-0 ${analysis ? "" : "opacity-40"}`}>
                                <div className="flex items-center gap-1">
                                  <Eye className="h-2.5 w-2.5 text-white/15" />
                                  <span className="text-[10px] text-white/40">{formatNumber(reel.views_count)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Heart className="h-2.5 w-2.5 text-white/15" />
                                  <span className="text-[10px] text-white/40">{formatNumber(reel.likes_count)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <MessageSquare className="h-2.5 w-2.5 text-white/15" />
                                  <span className="text-[10px] text-white/40">{formatNumber(reel.comments_count)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Share2 className="h-2.5 w-2.5 text-white/15" />
                                  <span className="text-[10px] text-white/40">{formatNumber(reel.shares_count)}</span>
                                </div>
                              </div>

                              {/* Analyzing indicator */}
                              {isAnalyzingThis && (
                                <span className="flex items-center gap-1 text-[9px] text-violet-400/60 shrink-0">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Analizando...
                                </span>
                              )}

                              {/* Hook badge */}
                              {!isAnalyzingThis && (analysis?.hook_type ? (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${hookInfo.color}`}>
                                  {hookInfo.label}
                                </span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.5 rounded border text-white/10 bg-white/[0.01] border-white/[0.03] shrink-0">
                                  Sin análisis
                                </span>
                              ))}

                              {/* Actions */}
                              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleAnalyzeReel(comp.id, reel.id)}
                                  disabled={isAnalyzingThis}
                                  className="h-6 w-6 rounded flex items-center justify-center text-white/20 hover:text-violet-400 hover:bg-violet-500/10 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                  title={analysis ? "Re-analizar con IA" : "Analizar con IA"}
                                >
                                  {isAnalyzingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteReel(comp.id, reel.id)}
                                  className="h-6 w-6 rounded flex items-center justify-center text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                                  title="Eliminar reel"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>

                              {isReelExpanded ? (
                                <ChevronDown className="h-3 w-3 text-white/15 shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-white/15 shrink-0" />
                              )}
                            </div>

                            {/* Expanded analysis */}
                            {isReelExpanded && analysis && (
                              <div className="px-3 pb-3 pt-1 border-t border-white/[0.03] space-y-2.5" onClick={(e) => e.stopPropagation()}>
                                {analysis.hook_text && (
                                  <div>
                                    <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Hook</span>
                                    <p className="text-[11px] text-white/55 font-light mt-0.5">&ldquo;{analysis.hook_text}&rdquo;</p>
                                  </div>
                                )}

                                {/* Video format / style */}
                                {analysis.style_notes && (
                                  <div>
                                    <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Formato del video</span>
                                    <p className="text-[11px] text-white/50 font-light mt-0.5 leading-[1.5]">{analysis.style_notes}</p>
                                  </div>
                                )}

                                {/* Narrative structure */}
                                {analysis.narrative_structure && (
                                  <div>
                                    <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Estructura narrativa</span>
                                    <p className="text-[11px] text-white/50 font-light mt-0.5 leading-[1.5]">{analysis.narrative_structure}</p>
                                  </div>
                                )}

                                {/* Transcript */}
                                {reel.transcript && (
                                  <div>
                                    <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Transcripción</span>
                                    <p className="text-[11px] text-white/40 font-light mt-0.5 leading-[1.5] italic">{reel.transcript}</p>
                                  </div>
                                )}

                                {analysis.ai_summary && (
                                  <div>
                                    <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Resumen IA</span>
                                    <p className="text-[11px] text-white/50 font-light mt-0.5 leading-[1.5]">{analysis.ai_summary}</p>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                  {analysis.strengths && (
                                    <div>
                                      <span className="text-[10px] text-emerald-400/50 uppercase tracking-[0.12em]">Fortalezas</span>
                                      <p className="text-[10px] text-white/45 font-light mt-0.5 leading-[1.5]">{analysis.strengths}</p>
                                    </div>
                                  )}
                                  {analysis.weaknesses && (
                                    <div>
                                      <span className="text-[10px] text-rose-400/50 uppercase tracking-[0.12em]">Debilidades</span>
                                      <p className="text-[10px] text-white/45 font-light mt-0.5 leading-[1.5]">{analysis.weaknesses}</p>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {analysis.content_type && (
                                    <span className="text-[9px] text-white/30 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.06]">
                                      {analysis.content_type === "reputacion" ? "Reputación" : "Conexión"}
                                    </span>
                                  )}
                                  {analysis.topic_cluster && (
                                    <span className="text-[9px] text-white/30 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.06]">
                                      {analysis.topic_cluster}
                                    </span>
                                  )}
                                  {analysis.cta_type && analysis.cta_type !== "ninguno" && (
                                    <span className="text-[9px] text-white/30 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.06]">
                                      CTA: {analysis.cta_type}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {isReelExpanded && !analysis && (
                              <div className="px-3 pb-3 pt-2 border-t border-white/[0.03]" onClick={(e) => e.stopPropagation()}>
                                <p className="text-[10px] text-white/25 font-light">
                                  Sin análisis IA. Hacé click en <Sparkles className="h-2.5 w-2.5 inline text-violet-400/50" /> para analizar este reel.
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Why user is better */}
                {comp.why_better && (
                  <div className="px-5 pb-4 border-t border-white/[0.04] pt-3">
                    <span className="text-[10px] text-emerald-400/40 uppercase tracking-[0.12em] font-medium">Por qué vos sos mejor</span>
                    <p className="text-[11px] text-white/45 font-light mt-1 leading-[1.6]">{comp.why_better}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
