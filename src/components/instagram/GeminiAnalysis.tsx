"use client";

import { useEffect, useState, type ElementType, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Brain, ChevronDown, ChevronUp, Mic, Eye, Zap, FileText,
  TrendingUp, AlertCircle, Loader2, Sparkles,
} from "lucide-react";
import type { GeminiVideoAnalysis } from "@/services/gemini-video.service";

// ─── Props ────────────────────────────────────────────────────────────────────

interface GeminiAnalysisProps {
  reelId: string;
  workspaceId: string;
  videoUrl: string | null;
  initialAnalysis: GeminiVideoAnalysis | null;
  onAnalysisComplete?: (analysis: GeminiVideoAnalysis) => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  iconColor,
  children,
}: {
  icon: ElementType;
  title: string;
  iconColor: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

function BadgePill({
  value,
  colorMap,
}: {
  value: string;
  colorMap: Record<string, string>;
}) {
  const color = colorMap[value] ?? "border-border bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {value}
    </span>
  );
}

const energyColors: Record<string, string> = {
  alto: "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  medio: "border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  bajo: "border-border bg-muted text-muted-foreground",
};

const viralColors: Record<string, string> = {
  alto: "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  medio: "border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  bajo: "border-border bg-muted text-muted-foreground",
};

// ─── Main component ───────────────────────────────────────────────────────────

export function GeminiAnalysis({ reelId, workspaceId, videoUrl, initialAnalysis, onAnalysisComplete }: GeminiAnalysisProps) {
  const t = useTranslations("igAdvanced");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    initialAnalysis ? "done" : "idle",
  );
  const [analysis, setAnalysis] = useState<GeminiVideoAnalysis | null>(initialAnalysis);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setAnalysis(initialAnalysis);
    setStatus(initialAnalysis ? "done" : "idle");
    setErrorMsg(null);
  }, [initialAnalysis]);

  async function handleAnalyze() {
    if (!videoUrl) {
      setErrorMsg(t("ai.errors.noVideoUrl"));
      setStatus("error");
      return;
    }

    const hasExistingAnalysis = analysis !== null;
    setStatus("loading");
    setErrorMsg(null);

    try {
      const res = await fetch(
        `/api/v1/reels/${reelId}/arkoai-analyze?workspace_id=${workspaceId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_url: videoUrl }),
        },
      );

      const json = await res.json() as { data?: { analysis: GeminiVideoAnalysis }; error?: string; message?: string };

      if (!res.ok || json.error) {
        throw new Error(json.message ?? json.error ?? `Error ${res.status}`);
      }

      const newAnalysis = json.data!.analysis;
      setAnalysis(newAnalysis);
      setStatus("done");
      onAnalysisComplete?.(newAnalysis);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t("ai.errors.unknown"));
      setStatus(hasExistingAnalysis ? "done" : "error");
    }
  }

  // ── Idle state ──
  if (status === "idle") {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-border bg-card p-6 backdrop-blur-xl shadow-lg shadow-foreground/10 dark:shadow-2xl dark:shadow-black/30">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Sparkles className="h-5 w-5 text-violet-500 dark:text-violet-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{t("ai.idle.title")}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {t("ai.idle.body")}
              </p>
              {!videoUrl && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {t("ai.idle.noVideoHint")}
                </p>
              )}
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!videoUrl}
              className="on-color flex-shrink-0 flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-xs font-semibold text-white transition-colors"
            >
              <Brain className="h-4 w-4" />
              {t("ai.actions.analyzeDeep")}
            </button>
          </div>
        </div>

      </div>
    );
  }

  // ── Loading state ──
  if (status === "loading") {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 backdrop-blur-xl shadow-lg shadow-foreground/10 dark:shadow-2xl dark:shadow-black/30">
        <div className="flex items-center gap-4">
          <Loader2 className="h-5 w-5 animate-spin text-violet-500 dark:text-violet-400" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t("ai.loading.title")}</p>
            <p className="text-xs text-muted-foreground">{t("ai.loading.body")}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (status === "error") {
    return (
      <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500 dark:text-red-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{t("ai.error.title")}</p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{errorMsg}</p>
          </div>
          <button
            onClick={() => setStatus("idle")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("ai.actions.retry")}
          </button>
        </div>
      </div>
    );
  }

  // ── Done state ──
  if (!analysis) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500 dark:text-violet-400" />
          <h3 className="text-sm font-semibold text-foreground">{t("ai.done.heading")}</h3>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={!videoUrl}
          className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("ai.actions.reanalyze")}
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Transcript */}
      <SectionCard icon={FileText} title={t("ai.sections.transcript")} iconColor="text-sky-500 dark:text-sky-400">
        {analysis.transcript ? (
          <div className="space-y-2">
            {analysis.transcript_lines.length > 0 ? (
              analysis.transcript_lines.map((line, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="flex flex-shrink-0 flex-col items-center gap-0.5 pt-0.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      line.type === "hook" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" :
                      line.type === "cta" ? "bg-violet-500/20 text-violet-700 dark:text-violet-300" :
                      line.type === "closing" ? "bg-rose-500/20 text-rose-700 dark:text-rose-300" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {line.type}
                    </span>
                    {line.start_sec > 0 || i === 0 ? (
                      <span className="text-[9px] tabular-nums text-muted-foreground">
                        {Math.floor(line.start_sec / 60)}:{String(Math.floor(line.start_sec) % 60).padStart(2, "0")}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{line.text}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-foreground leading-relaxed">{analysis.transcript}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">{t("ai.transcript.noAudio")}</p>
        )}
      </SectionCard>

      {/* Narrative */}
      <SectionCard icon={Brain} title={t("ai.sections.narrative")} iconColor="text-violet-500 dark:text-violet-400">
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{t("ai.narrative.hook")}</p>
            <p className="text-sm text-foreground">{analysis.narrative.hook || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{t("ai.narrative.development")}</p>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{analysis.narrative.development_summary || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{t("ai.narrative.corePromise")}</p>
            <p className="text-sm text-foreground">{analysis.narrative.core_promise || "—"}</p>
          </div>
          {analysis.narrative.has_cta && analysis.narrative.cta_text && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{t("ai.narrative.ctaDetected")}</p>
              <p className="text-sm text-violet-600 dark:text-violet-300 font-medium">{analysis.narrative.cta_text}</p>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <span className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-700 dark:text-sky-300">
              {analysis.narrative.topic_cluster}
            </span>
            {!analysis.narrative.has_cta && (
              <span className="rounded border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {t("ai.narrative.noCta")}
              </span>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Visual */}
      <SectionCard icon={Eye} title={t("ai.sections.visual")} iconColor="text-emerald-500 dark:text-emerald-400">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: t("ai.visual.format"), value: analysis.visual.format_type },
            { label: t("ai.visual.shotType"), value: analysis.visual.shot_type },
            { label: t("ai.visual.scene"), value: analysis.visual.scene_type },
            { label: t("ai.visual.orientation"), value: analysis.visual.orientation },
            { label: t("ai.visual.people"), value: String(analysis.visual.people_count) },
            { label: t("ai.visual.faceVisible"), value: analysis.visual.face_visible ? t("ai.common.yes") : t("ai.common.no") },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="text-xs text-foreground mt-0.5 font-medium">{item.value}</p>
            </div>
          ))}
        </div>
        {analysis.visual.text_on_screen && (
          <div className="mt-3 rounded-lg border border-border bg-muted px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{t("ai.visual.onScreenText")}</p>
            <p className="text-xs text-foreground">{analysis.visual.text_on_screen}</p>
          </div>
        )}
        <div className="mt-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{t("ai.visual.firstFrame")}</p>
          <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{analysis.visual.first_frame_hook_context}</p>
        </div>
        {analysis.visual.background_context && (
          <div className="mt-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{t("ai.visual.backgroundEnvironment")}</p>
            <p className="text-xs text-foreground/90 whitespace-pre-wrap">{analysis.visual.background_context}</p>
          </div>
        )}
      </SectionCard>

      {/* Audio / Delivery */}
      <SectionCard icon={Mic} title={t("ai.sections.audio")} iconColor="text-amber-500 dark:text-amber-400">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <BadgePill value={analysis.audio.energy_level} colorMap={energyColors} />
            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              {analysis.audio.tone}
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              {analysis.audio.formality}
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              {analysis.audio.speaking_rate}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("ai.audio.voiceType")}</p>
              <p className="text-xs text-foreground mt-0.5">{analysis.audio.voice_type}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("ai.audio.estimatedRate")}</p>
              <p className="text-xs text-foreground mt-0.5 font-semibold">{analysis.audio.estimated_wpm} WPM</p>
            </div>
          </div>

          {analysis.audio.filler_words_detected.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{t("ai.audio.fillerWords")}</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.audio.filler_words_detected.map((word) => (
                  <span key={word} className="rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-700 dark:text-rose-300">
                    &ldquo;{word}&rdquo;
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Insights */}
      <SectionCard icon={TrendingUp} title={t("ai.sections.insights")} iconColor="text-rose-500 dark:text-rose-400">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("ai.insights.viralPotential")}</p>
            <BadgePill value={analysis.insights.viral_potential} colorMap={viralColors} />
          </div>
          <p className="text-xs text-foreground/90 leading-relaxed -mt-1 whitespace-pre-wrap">{analysis.insights.viral_potential_reason}</p>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-emerald-500 dark:text-emerald-400" /> {t("ai.insights.strengths")}
            </p>
            <ul className="space-y-1.5">
              {analysis.insights.strengths.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs text-foreground/90">
                  <span className="mt-0.5 flex-shrink-0 text-emerald-500 dark:text-emerald-400">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">{t("ai.insights.improvements")}</p>
            <ul className="space-y-1.5">
              {analysis.insights.improvements.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs text-foreground/90">
                  <span className="mt-0.5 flex-shrink-0 text-amber-500 dark:text-amber-400">→</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
