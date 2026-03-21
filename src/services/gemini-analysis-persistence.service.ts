import { createClient } from "@/lib/supabase/server";
import type { GeminiVideoAnalysis, TranscriptLine as GeminiTranscriptLine } from "@/services/gemini-video.service";
import type {
  ReelAudioAnalysis,
  ReelNarrativeAnalysis,
  ReelTranscript,
  ReelVisualAnalysis,
  TimestampBlock,
  TranscriptLine as StoredTranscriptLine,
} from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const GEMINI_MODEL_NAME = "gemini-2.5-flash";
const GEMINI_ASR_PROVIDER = "gemini";

interface PersistGeminiAnalysisParams {
  supabase: SupabaseServerClient;
  reelId: string;
  workspaceId: string;
  analysis: GeminiVideoAnalysis;
}

interface HydrateGeminiAnalysisParams {
  transcript: ReelTranscript | null;
  narrative: ReelNarrativeAnalysis | null;
  visual: ReelVisualAnalysis | null;
  audio: ReelAudioAnalysis | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTranscriptLineType(value: unknown): value is GeminiTranscriptLine["type"] {
  return value === "hook"
    || value === "development"
    || value === "cta"
    || value === "closing"
    || value === "other";
}

function isGeminiTranscriptLine(value: unknown): value is GeminiTranscriptLine {
  return isRecord(value)
    && isTranscriptLineType(value.type)
    && typeof value.text === "string"
    && typeof value.start_sec === "number"
    && typeof value.end_sec === "number";
}

function isGeminiAnalysis(value: unknown): value is GeminiVideoAnalysis {
  if (!isRecord(value)) return false;

  const narrative = value.narrative;
  const visual = value.visual;
  const audio = value.audio;
  const insights = value.insights;

  return typeof value.transcript === "string"
    && Array.isArray(value.transcript_lines)
    && value.transcript_lines.every(isGeminiTranscriptLine)
    && isRecord(narrative)
    && typeof narrative.hook === "string"
    && typeof narrative.development_summary === "string"
    && (typeof narrative.cta_text === "string" || narrative.cta_text === null)
    && typeof narrative.has_cta === "boolean"
    && typeof narrative.core_promise === "string"
    && typeof narrative.topic_cluster === "string"
    && isRecord(visual)
    && typeof visual.format_type === "string"
    && typeof visual.scene_type === "string"
    && typeof visual.shot_type === "string"
    && (visual.orientation === "vertical" || visual.orientation === "horizontal")
    && typeof visual.people_count === "number"
    && typeof visual.face_visible === "boolean"
    && (typeof visual.text_on_screen === "string" || visual.text_on_screen === null)
    && typeof visual.background_context === "string"
    && (typeof visual.clothing_features === "string" || visual.clothing_features === null)
    && typeof visual.first_frame_hook_context === "string"
    && isRecord(audio)
    && typeof audio.tone === "string"
    && (audio.energy_level === "alto" || audio.energy_level === "medio" || audio.energy_level === "bajo")
    && (audio.speaking_rate === "rápido" || audio.speaking_rate === "normal" || audio.speaking_rate === "lento")
    && (audio.formality === "formal" || audio.formality === "semiformal" || audio.formality === "informal")
    && typeof audio.voice_type === "string"
    && typeof audio.estimated_wpm === "number"
    && Array.isArray(audio.filler_words_detected)
    && audio.filler_words_detected.every((word) => typeof word === "string")
    && typeof audio.notable_pauses === "boolean"
    && isRecord(insights)
    && Array.isArray(insights.strengths)
    && insights.strengths.every((item) => typeof item === "string")
    && Array.isArray(insights.improvements)
    && insights.improvements.every((item) => typeof item === "string")
    && (insights.viral_potential === "alto" || insights.viral_potential === "medio" || insights.viral_potential === "bajo")
    && typeof insights.viral_potential_reason === "string";
}

function countWords(text: string): number {
  return text.trim().match(/\S+/g)?.length ?? 0;
}

function mapTranscriptLines(lines: GeminiTranscriptLine[]): StoredTranscriptLine[] {
  return lines.map((line, index) => ({
    index,
    text: line.text,
    ...(line.type !== "other" ? { label: line.type } : {}),
  }));
}

function mapStoredTranscriptLinesToGemini(
  lines: StoredTranscriptLine[],
  timestamps: TimestampBlock[],
): GeminiTranscriptLine[] {
  return lines.map((line, i) => {
    const ts = timestamps[i];
    return {
      type: line.label ?? "other",
      text: line.text,
      start_sec: ts?.start_sec ?? 0,
      end_sec: ts?.end_sec ?? 0,
    };
  });
}

function parseStoredGeminiAnalysis(value: string | null | undefined): GeminiVideoAnalysis | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    return isGeminiAnalysis(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function inferSpeakingRate(wpm: number): GeminiVideoAnalysis["audio"]["speaking_rate"] {
  if (wpm >= 170) return "rápido";
  if (wpm > 0 && wpm <= 120) return "lento";
  return "normal";
}

export function normalizeSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function persistGeminiAnalysis({
  supabase,
  reelId,
  workspaceId,
  analysis,
}: PersistGeminiAnalysisParams): Promise<void> {
  const wordsTotal = countWords(analysis.transcript);
  const fillerDensity = wordsTotal > 0
    ? analysis.audio.filler_words_detected.length / wordsTotal
    : null;
  const pausesEstimate = analysis.audio.notable_pauses ? 1 : 0;
  const serializedAnalysis = JSON.stringify(analysis);

  const [
    transcriptResult,
    narrativeResult,
    visualResult,
    audioResult,
  ] = await Promise.all([
    supabase
      .from("reel_transcripts")
      .upsert({
        reel_id: reelId,
        workspace_id: workspaceId,
        transcript_raw: serializedAnalysis,
        transcript_clean: analysis.transcript,
        transcript_lines: mapTranscriptLines(analysis.transcript_lines),
        timestamps_per_block: analysis.transcript_lines.map((line) => ({
          start_sec: line.start_sec,
          end_sec: line.end_sec,
          text: line.text,
        })),
        asr_provider: GEMINI_ASR_PROVIDER,
        asr_language: "es",
        processing_status: "completed",
        error_message: null,
      }, { onConflict: "reel_id" }),
    supabase
      .from("reel_narrative_analysis")
      .upsert({
        reel_id: reelId,
        workspace_id: workspaceId,
        hook_text: analysis.narrative.hook,
        development_summary: analysis.narrative.development_summary,
        cta_text: analysis.narrative.cta_text,
        closing_text: null,
        core_promise: analysis.narrative.core_promise,
        topic_cluster: analysis.narrative.topic_cluster,
        language_specificity: null,
        niche_terms_detected: [],
        has_cta: analysis.narrative.has_cta,
        cta_type: analysis.narrative.has_cta ? "explicit" : null,
        llm_model: GEMINI_MODEL_NAME,
        processing_status: "completed",
        error_message: null,
        tokens_used: 0,
      }, { onConflict: "reel_id" }),
    supabase
      .from("reel_visual_analysis")
      .upsert({
        reel_id: reelId,
        workspace_id: workspaceId,
        frames_count: 0,
        frame_paths: [],
        orientation: analysis.visual.orientation,
        format_type: analysis.visual.format_type,
        scene_type: analysis.visual.scene_type,
        background_context: analysis.visual.background_context,
        text_on_screen: analysis.visual.text_on_screen,
        clothing_features: analysis.visual.clothing_features,
        hat_detected: null,
        people_count: analysis.visual.people_count,
        shot_type: analysis.visual.shot_type,
        first_frame_has_text: Boolean(analysis.visual.text_on_screen),
        first_frame_face_visible: analysis.visual.face_visible,
        first_frame_hook_context: analysis.visual.first_frame_hook_context,
        vision_model: GEMINI_MODEL_NAME,
        processing_status: "completed",
        error_message: null,
      }, { onConflict: "reel_id" }),
    supabase
      .from("reel_audio_analysis")
      .upsert({
        reel_id: reelId,
        workspace_id: workspaceId,
        words_total: wordsTotal,
        speaking_rate_wpm: analysis.audio.estimated_wpm,
        filler_density: fillerDensity,
        pauses_estimate: pausesEstimate,
        processing_status: "completed",
        error_message: null,
      }, { onConflict: "reel_id" }),
  ]);

  const errors = [
    transcriptResult.error,
    narrativeResult.error,
    visualResult.error,
    audioResult.error,
  ].filter((error): error is NonNullable<typeof transcriptResult.error> => error != null);

  if (errors.length > 0) {
    throw new Error(errors.map((error) => error.message).join(" | "));
  }
}

export function hydrateGeminiAnalysis({
  transcript,
  narrative,
  visual,
  audio,
}: HydrateGeminiAnalysisParams): GeminiVideoAnalysis | null {
  if (!transcript || !narrative || !visual || !audio) {
    return null;
  }

  if (
    transcript.processing_status !== "completed"
    || narrative.processing_status !== "completed"
    || visual.processing_status !== "completed"
    || audio.processing_status !== "completed"
  ) {
    return null;
  }

  const serializedAnalysis = parseStoredGeminiAnalysis(transcript.transcript_raw);
  if (serializedAnalysis) {
    return serializedAnalysis;
  }

  const narrativeLooksGemini = narrative.llm_model.toLowerCase().includes("gemini");
  const visualLooksGemini = visual.vision_model.toLowerCase().includes("gemini");
  const transcriptLooksGemini = transcript.asr_provider.toLowerCase() === GEMINI_ASR_PROVIDER;

  if (!narrativeLooksGemini && !visualLooksGemini && !transcriptLooksGemini) {
    return null;
  }

  return {
    transcript: transcript.transcript_clean ?? "",
    transcript_lines: mapStoredTranscriptLinesToGemini(transcript.transcript_lines, transcript.timestamps_per_block),
    narrative: {
      hook: narrative.hook_text ?? "",
      development_summary: narrative.development_summary ?? "",
      cta_text: narrative.cta_text,
      has_cta: narrative.has_cta,
      core_promise: narrative.core_promise ?? "",
      topic_cluster: narrative.topic_cluster ?? "",
    },
    visual: {
      format_type: visual.format_type ?? "",
      scene_type: visual.scene_type ?? "",
      shot_type: visual.shot_type ?? "",
      orientation: visual.orientation === "horizontal" ? "horizontal" : "vertical",
      people_count: visual.people_count ?? 0,
      face_visible: visual.first_frame_face_visible ?? false,
      text_on_screen: visual.text_on_screen,
      background_context: visual.background_context ?? "",
      clothing_features: visual.clothing_features,
      first_frame_hook_context: visual.first_frame_hook_context ?? "",
    },
    audio: {
      tone: "",
      energy_level: "medio",
      speaking_rate: inferSpeakingRate(audio.speaking_rate_wpm),
      formality: "semiformal",
      voice_type: "",
      estimated_wpm: Math.round(audio.speaking_rate_wpm),
      filler_words_detected: [],
      notable_pauses: (audio.pauses_estimate ?? 0) > 0,
    },
    insights: {
      strengths: [],
      improvements: [],
      viral_potential: "medio",
      viral_potential_reason: "",
    },
  };
}
