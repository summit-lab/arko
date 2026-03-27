"use client";

import { useState, useCallback } from "react";
import { GeminiAnalysis } from "@/components/instagram/GeminiAnalysis";
import { ReelChatPanel } from "@/components/instagram/ReelChatPanel";
import type { GeminiVideoAnalysis } from "@/services/gemini-video.service";

// ─── Serializer ──────────────────────────────────────────────────────────────

function serializeGeminiForChat(analysis: GeminiVideoAnalysis): string {
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
      <div className="glass-panel rounded-3xl border border-violet-500/10 bg-black/35 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
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
