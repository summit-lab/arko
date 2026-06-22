"use client";

import { useState, useCallback } from "react";
import { GeminiAnalysis } from "@/components/instagram/GeminiAnalysis";
import { ReelChatPanel } from "@/components/instagram/ReelChatPanel";
import type { GeminiVideoAnalysis } from "@/services/gemini-video.service";

// ─── Serializer ──────────────────────────────────────────────────────────────
// NOTE: This text is fed to the LLM as context — keep stable English labels
// regardless of the user's UI locale. The model normalizes its output to the
// user's voice elsewhere.

function serializeGeminiForChat(analysis: GeminiVideoAnalysis): string {
  const lines: string[] = [];
  if (analysis.transcript) {
    lines.push(`**Transcript:** ${analysis.transcript.substring(0, 500)}${analysis.transcript.length > 500 ? "..." : ""}`);
  }
  if (analysis.transcript_lines?.length) {
    lines.push("");
    lines.push("**Classified lines:**");
    for (const line of analysis.transcript_lines.slice(0, 10)) {
      lines.push(`- [${line.type}] ${line.text}`);
    }
  }
  if (analysis.narrative) {
    lines.push("");
    lines.push("**Narrative analysis:**");
    lines.push(`- Hook: ${analysis.narrative.hook || "—"}`);
    lines.push(`- Development: ${analysis.narrative.development_summary || "—"}`);
    lines.push(`- CTA: ${analysis.narrative.has_cta ? (analysis.narrative.cta_text || "Yes") : "Not detected"}`);
    lines.push(`- Core promise: ${analysis.narrative.core_promise || "—"}`);
    lines.push(`- Topic cluster: ${analysis.narrative.topic_cluster || "—"}`);
  }
  if (analysis.visual) {
    lines.push("");
    lines.push("**Visual analysis:**");
    lines.push(`- Format: ${analysis.visual.format_type || "—"}`);
    lines.push(`- Scene: ${analysis.visual.scene_type || "—"}`);
    lines.push(`- Shot: ${analysis.visual.shot_type || "—"}`);
    lines.push(`- People: ${analysis.visual.people_count ?? "—"}`);
    lines.push(`- On-screen text: ${analysis.visual.text_on_screen ? "Yes" : "No"}`);
  }
  if (analysis.audio) {
    lines.push("");
    lines.push("**Audio analysis:**");
    lines.push(`- Tone: ${analysis.audio.tone || "—"}`);
    lines.push(`- Energy: ${analysis.audio.energy_level || "—"}`);
    lines.push(`- Estimated WPM: ${analysis.audio.estimated_wpm ?? "—"}`);
    lines.push(`- Filler words: ${analysis.audio.filler_words_detected?.length ? "Yes" : "No"}`);
  }
  if (analysis.insights) {
    lines.push("");
    lines.push("**Insights:**");
    if (analysis.insights.strengths?.length) {
      lines.push(`- Strengths: ${analysis.insights.strengths.join("; ")}`);
    }
    if (analysis.insights.improvements?.length) {
      lines.push(`- Improvements: ${analysis.insights.improvements.join("; ")}`);
    }
    lines.push(`- Viral potential: ${analysis.insights.viral_potential || "—"} (${analysis.insights.viral_potential_reason || ""})`);
  }
  return lines.join("\n");
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReelAISectionProps {
  reelId: string;
  workspaceId: string;
  videoUrl: string | null;
  initialAnalysis: GeminiVideoAnalysis | null;
  initialGeminiSerialized: string | null;
  reelSummary: string;
  reelCaption: string;
  performerMultiple: number;
  showChat?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReelAISection({
  reelId,
  workspaceId,
  videoUrl,
  initialAnalysis,
  initialGeminiSerialized,
  reelSummary,
  reelCaption,
  performerMultiple,
  showChat = true,
}: ReelAISectionProps) {
  const [geminiAnalysisSerialized, setGeminiAnalysisSerialized] = useState<string | null>(
    initialGeminiSerialized,
  );
  const [hasGemini, setHasGemini] = useState(initialAnalysis !== null);

  const handleAnalysisComplete = useCallback(
    (analysis: GeminiVideoAnalysis) => {
      setGeminiAnalysisSerialized(serializeGeminiForChat(analysis));
      setHasGemini(true);
    },
    [],
  );

  return (
    <>
      {/* Análisis Profundo — Gemini (Capa 2) */}
      {/* outline is used instead of border because globals.css forces a brown border on .glass-panel in light mode (!important) — outline bypasses it. */}
      <div className="glass-panel rounded-3xl border border-violet-500/10 p-6 outline outline-1 -outline-offset-1 outline-violet-500/30 dark:outline-none">
        <GeminiAnalysis
          reelId={reelId}
          workspaceId={workspaceId}
          videoUrl={videoUrl}
          initialAnalysis={initialAnalysis}
          onAnalysisComplete={handleAnalysisComplete}
        />
      </div>

      {/* Arko AI — Reel-focused chat panel */}
      {showChat && (
        <ReelChatPanel
          reelId={reelId}
          workspaceId={workspaceId}
          reelSummary={reelSummary}
          geminiAnalysis={geminiAnalysisSerialized}
          reelCaption={reelCaption}
          performerMultiple={performerMultiple}
          hasGeminiAnalysis={hasGemini}
        />
      )}
    </>
  );
}
