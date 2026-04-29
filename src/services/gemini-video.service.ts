/**
 * gemini-video.service.ts
 * Analiza un video MP4 (via URL pública) con Gemini 1.5 Flash.
 * Devuelve análisis visual, narrativo, tono de voz y transcripción en un único call.
 */

import { getGeminiKey, getOpenAIKey } from '@/lib/env';

const GEMINI_MODELS_TIERED = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
] as const;

const OPENAI_RESCUE_MODEL = 'gpt-4o';

function geminiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeminiVideoAnalysis {
  /** Transcripción completa del audio hablado */
  transcript: string;
  /** Líneas del guion separadas por tipo */
  transcript_lines: TranscriptLine[];

  /** Análisis narrativo */
  narrative: {
    hook: string;
    development_summary: string;
    cta_text: string | null;
    has_cta: boolean;
    core_promise: string;
    topic_cluster: string;
  };

  /** Análisis visual */
  visual: {
    format_type: string;
    scene_type: string;
    shot_type: string;
    orientation: 'vertical' | 'horizontal';
    people_count: number;
    face_visible: boolean;
    text_on_screen: string | null;
    background_context: string;
    clothing_features: string | null;
    first_frame_hook_context: string;
  };

  /** Análisis de audio / delivery */
  audio: {
    tone: string;
    energy_level: 'alto' | 'medio' | 'bajo';
    speaking_rate: 'rápido' | 'normal' | 'lento';
    formality: 'formal' | 'semiformal' | 'informal';
    voice_type: string;
    estimated_wpm: number;
    filler_words_detected: string[];
    notable_pauses: boolean;
  };

  /** Insights generales */
  insights: {
    strengths: string[];
    improvements: string[];
    viral_potential: 'alto' | 'medio' | 'bajo';
    viral_potential_reason: string;
  };
}

export interface TranscriptLine {
  type: 'hook' | 'development' | 'cta' | 'closing' | 'other';
  text: string;
  start_sec: number;
  end_sec: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTranscriptLineType(value: unknown): value is TranscriptLine['type'] {
  return value === 'hook'
    || value === 'development'
    || value === 'cta'
    || value === 'closing'
    || value === 'other';
}

function isTranscriptLine(value: unknown): value is TranscriptLine {
  return isRecord(value)
    && isTranscriptLineType(value.type)
    && typeof value.text === 'string'
    && typeof value.start_sec === 'number'
    && typeof value.end_sec === 'number';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isGeminiVideoAnalysis(value: unknown): value is GeminiVideoAnalysis {
  if (!isRecord(value)) return false;

  const narrative = value.narrative;
  const visual = value.visual;
  const audio = value.audio;
  const insights = value.insights;

  return typeof value.transcript === 'string'
    && Array.isArray(value.transcript_lines)
    && value.transcript_lines.every(isTranscriptLine)
    && isRecord(narrative)
    && typeof narrative.hook === 'string'
    && typeof narrative.development_summary === 'string'
    && (typeof narrative.cta_text === 'string' || narrative.cta_text === null)
    && typeof narrative.has_cta === 'boolean'
    && typeof narrative.core_promise === 'string'
    && typeof narrative.topic_cluster === 'string'
    && isRecord(visual)
    && typeof visual.format_type === 'string'
    && typeof visual.scene_type === 'string'
    && typeof visual.shot_type === 'string'
    && (visual.orientation === 'vertical' || visual.orientation === 'horizontal')
    && typeof visual.people_count === 'number'
    && typeof visual.face_visible === 'boolean'
    && (typeof visual.text_on_screen === 'string' || visual.text_on_screen === null)
    && typeof visual.background_context === 'string'
    && (typeof visual.clothing_features === 'string' || visual.clothing_features === null)
    && typeof visual.first_frame_hook_context === 'string'
    && isRecord(audio)
    && typeof audio.tone === 'string'
    && (audio.energy_level === 'alto' || audio.energy_level === 'medio' || audio.energy_level === 'bajo')
    && (audio.speaking_rate === 'rápido' || audio.speaking_rate === 'normal' || audio.speaking_rate === 'lento')
    && (audio.formality === 'formal' || audio.formality === 'semiformal' || audio.formality === 'informal')
    && typeof audio.voice_type === 'string'
    && typeof audio.estimated_wpm === 'number'
    && isStringArray(audio.filler_words_detected)
    && typeof audio.notable_pauses === 'boolean'
    && isRecord(insights)
    && isStringArray(insights.strengths)
    && isStringArray(insights.improvements)
    && (insights.viral_potential === 'alto' || insights.viral_potential === 'medio' || insights.viral_potential === 'bajo')
    && typeof insights.viral_potential_reason === 'string';
}

function extractJsonPayload(rawText: string): string {
  const unfenced = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');

  if (start === -1 || end === -1 || end < start) {
    return unfenced;
  }

  return unfenced.slice(start, end + 1).trim();
}

interface ParsedAnalysisResult {
  analysis: GeminiVideoAnalysis;
  /** True when the analysis is valid by schema and complete. */
  ok: boolean;
  /** Set when ok=false: human-readable reason the analysis is partial. */
  reason?: string;
}

function parseAnalysisResponse(
  parts: Array<{ text?: string }> | undefined,
  finishReason: string | undefined,
  usage: GeminiUsageMetadata | undefined,
): ParsedAnalysisResult {
  const rawText = parts?.map((part) => part.text ?? '').join('').trim();

  if (!rawText) {
    const reason = describeFinishReason(finishReason) ?? 'sin contenido devuelto';
    console.warn('[gemini-video] empty response', { finishReason, usage });
    return { analysis: buildSkeletonAnalysis('', reason), ok: false, reason };
  }

  const jsonPayload = extractJsonPayload(rawText);

  let parsed: unknown;
  let parseError: unknown = null;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch (err) {
    parseError = err;
  }

  if (parsed !== undefined && isGeminiVideoAnalysis(parsed)) {
    return { analysis: parsed, ok: true };
  }

  // Log diagnostics so we can tell truncation, safety blocks, and malformed JSON apart.
  console.error('[gemini-video] invalid response — salvaging', {
    finishReason,
    usage,
    parseError: parseError instanceof Error ? parseError.message : null,
    rawLength: rawText.length,
    payloadHead: jsonPayload.slice(0, 300),
  });

  const reason = describeFinishReason(finishReason)
    ?? (parseError ? 'JSON malformado' : 'estructura incompleta');

  return {
    analysis: salvagePartialAnalysis(jsonPayload, parsed, reason),
    ok: false,
    reason,
  };
}

function describeFinishReason(finishReason: string | undefined): string | null {
  switch (finishReason) {
    case 'MAX_TOKENS': return 'respuesta cortada por límite de tokens';
    case 'SAFETY': return 'bloqueado por filtros de seguridad';
    case 'RECITATION': return 'bloqueado por contenido protegido';
    case 'PROHIBITED_CONTENT':
    case 'SPII':
    case 'BLOCKLIST':
    case 'OTHER': return `motivo: ${finishReason}`;
    default: return null;
  }
}

/**
 * Builds a fully-valid skeleton analysis with neutral defaults so persistence
 * and UI never break. Used as last resort when Gemini fails completely.
 */
function buildSkeletonAnalysis(transcript: string, reason: string): GeminiVideoAnalysis {
  return {
    transcript,
    transcript_lines: [],
    narrative: {
      hook: '',
      development_summary: '',
      cta_text: null,
      has_cta: false,
      core_promise: '',
      topic_cluster: '',
    },
    visual: {
      format_type: '',
      scene_type: '',
      shot_type: '',
      orientation: 'vertical',
      people_count: 0,
      face_visible: false,
      text_on_screen: null,
      background_context: '',
      clothing_features: null,
      first_frame_hook_context: '',
    },
    audio: {
      tone: '',
      energy_level: 'medio',
      speaking_rate: 'normal',
      formality: 'semiformal',
      voice_type: '',
      estimated_wpm: 0,
      filler_words_detected: [],
      notable_pauses: false,
    },
    insights: {
      strengths: [],
      improvements: [],
      viral_potential: 'medio',
      viral_potential_reason: `Análisis incompleto (${reason}). Reintentá para obtener un análisis completo.`,
    },
  };
}

/**
 * Try to keep whatever fields the model did emit (typically the transcript)
 * and fill the rest with skeleton defaults. Worst case the JSON is unparseable,
 * in which case we regex out the transcript string and skeleton everything else.
 */
function salvagePartialAnalysis(
  jsonPayload: string,
  parsed: unknown,
  reason: string,
): GeminiVideoAnalysis {
  // Parsed but wrong shape — keep whatever's well-typed, default the rest.
  if (parsed !== undefined && parsed !== null && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const skeleton = buildSkeletonAnalysis(
      typeof obj.transcript === 'string' ? obj.transcript : '',
      reason,
    );
    if (Array.isArray(obj.transcript_lines) && obj.transcript_lines.every(isTranscriptLine)) {
      skeleton.transcript_lines = obj.transcript_lines;
    }
    return skeleton;
  }

  // Unparseable — extract a transcript string with regex if we can.
  const m = jsonPayload.match(/"transcript"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const transcript = m?.[1]?.replace(/\\"/g, '"').replace(/\\n/g, '\n') ?? '';
  return buildSkeletonAnalysis(transcript, reason);
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const ANALYSIS_PROMPT = `Sos Moka, consultor experto en marketing de contenido en Instagram. Analizás este Reel del usuario usando el Framework de Fran (Francisco Doglio).

RESPONDE 100% EN ESPAÑOL. Cada campo, cada palabra, todo en español.

=== LO MÁS IMPORTANTE: EL CONCEPTO ===

Según Fran, el CONCEPTO es lo que determina si un video funciona o no. La ejecución es secundaria. Dos videos con la misma ejecución pero distintos conceptos tienen resultados completamente diferentes.

Un concepto ganador cumple TODOS estos filtros:
1. ES INTERESANTE Y NOVEDOSO para el nicho — si es algo que "ya todo el mundo sabe", el concepto está muerto
2. INVITA A LA RETENCIÓN — obliga a ver el video COMPLETO para llevarse el valor (no entrega todo en los primeros segundos)
3. ES GUARDABLE O COMPARTIBLE — despierta "tengo que guardar esto para aplicarlo" (reputación) o "tengo que mandarle esto a alguien" (conexión)
4. NO ES UN PICO DE VALOR ÚNICO — tiene múltiples capas que se van revelando

Red flags de mal concepto: valor completo en primeros segundos, tema repetido muchas veces en el nicho, tan genérico que le sirve a todo el mundo, tan nichado que solo lo entiende alguien con contexto extremo.

=== TIPOS DE CONTENIDO (solo 2) ===

- REPUTACIÓN: Educa, muestra autoridad. Genera guardados. "Esto tengo que aplicarlo."
- CONEXIÓN: Emociona, conecta, entretiene. Genera compartidos. "Tengo que mandarle esto a alguien."

=== TIPOS DE HOOK (5 tipos) ===

- TRANSFORMACIÓN: Antes/después. "Nunca pensé que X me fuera a ir tan bien hasta que probé Y"
- ENEMIGO: Posiciona algo del nicho como el problema. "Si seguís usando X en 2026..."
- NEGATIVO: Error o consecuencia negativa. "El error que cometen el 90%..."
- PROMESA: "¿Cómo lograr X? Muy simple." Funciona SI es específico y usa códigos del nicho.
- CURIOSIDAD: Algo nuevo/sorprendente. "Descubrí algo nuevo sobre X"

El hook debe usar CÓDIGOS DE LENGUAJE DEL NICHO — palabras mainstream dentro del nicho que el seguidor ideal conoce pero una persona random no.

=== ESTRUCTURA NARRATIVA ===

- Dividir en 3 a 5 puntos (nunca 2 o 4)
- Cada punto hace que el anterior cobre más sentido (valor acumulativo)
- Hook = 5-10% del video, valor = 80-90%, CTA = 5%
- El valor se reparte a lo LARGO de todo el video, no concentrado al inicio

=== MÉTRICAS ===

Un video NO es bueno o malo por sus views absolutas. Lo que importa es cómo rinde COMPARADO CON EL PROMEDIO de la cuenta. Si tiene alcance alto pero la idea es genérica y atrae gente que no es el seguidor ideal, eso es viralidad vacía.

=== ANÁLISIS DEL VIDEO ===

Devuelve UN OBJETO JSON puro (sin markdown, sin backticks) con esta estructura EXACTA:

{
  "transcript": "Transcripción completa y limpia de todo lo que se dice en el video. Si no hay audio, usar cadena vacía.",
  "transcript_lines": [
    { "type": "hook|development|cta|closing|other", "text": "texto de la línea", "start_sec": 0.0, "end_sec": 3.5 }
  ],
  "narrative": {
    "hook": "Primeras palabras exactas del video (el hook textual)",
    "development_summary": "Estructura narrativa: cómo abre, desarrolla y cierra. ¿Cuántos puntos tiene? ¿El valor se acumula o se concentra al inicio? Ej: 'Abre con hook enemigo, desarrolla con 3 puntos acumulativos, cierra con CTA de recurso específico'.",
    "cta_text": "CTA exacto textual o null si no hay",
    "has_cta": true,
    "core_promise": "Propuesta de valor central del video en una oración",
    "topic_cluster": "Categoría temática en 2-4 palabras"
  },
  "visual": {
    "format_type": "Talking head|Tutorial|Screen recording|B-roll|Slideshow|Mixto",
    "scene_type": "Interior|Estudio|Exterior|Pantalla|Mixto",
    "shot_type": "Primer plano|Plano medio|Plano general|Mixto",
    "orientation": "vertical|horizontal",
    "people_count": 1,
    "face_visible": true,
    "text_on_screen": "Texto en pantalla o null",
    "background_context": "Descripción del fondo/entorno",
    "clothing_features": "Descripción de vestimenta o null",
    "first_frame_hook_context": "Qué se ve en el primer frame y cómo engancha visualmente"
  },
  "audio": {
    "tone": "Educativo|Motivacional|Casual|Autoritario|Conversacional",
    "energy_level": "alto|medio|bajo",
    "speaking_rate": "rápido|normal|lento",
    "formality": "formal|semiformal|informal",
    "voice_type": "Tipo de voz y delivery. Ej: 'Presentador masculino directo a cámara, tono conversacional'",
    "estimated_wpm": 150,
    "filler_words_detected": ["eh", "este"],
    "notable_pauses": false
  },
  "insights": {
    "strengths": ["Fortaleza específica según framework de Fran (concepto, estructura, guardable/compartible)"],
    "improvements": ["Mejora concreta y accionable basada en el framework"],
    "viral_potential": "alto|medio|bajo",
    "viral_potential_reason": "¿Es semi-viral (mainstream dentro del nicho, atrae seguidores ideales) o viral vacío (atrae gente random)? ¿O demasiado nichado? Justificar."
  }
}

Si no hay audio o no se puede transcribir, usa transcript: "" y transcript_lines: [].
Sé específico y orientado a acción. Cada fortaleza y mejora debe estar fundamentada en el framework de Fran (concepto > estructura > ejecución). Nunca uses frases genéricas como "el video es bueno".`;

// ─── Service ─────────────────────────────────────────────────────────────────

function getGeminiApiKey(): string | null {
  return getGeminiKey()?.trim() || null;
}

export function isGeminiEnabled(): boolean {
  return Boolean(getGeminiApiKey());
}

/**
 * Descarga el video desde videoUrl y lo sube a la Files API de Gemini
 * usando el protocolo resumable de Google (2 pasos).
 *
 * Paso 1 — Iniciar sesión de upload → obtener upload URL
 * Paso 2 — Enviar los bytes binarios a esa URL
 *
 * Ref: https://ai.google.dev/api/files
 */
const RETRY_DELAYS_MS = [2_000, 8_000, 30_000];
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Extracts a human-readable message from a Gemini error response. Avoids
 * dumping raw JSON into user-visible fields like viral_potential_reason.
 */
function cleanGeminiError(rawText: string): string {
  if (!rawText) return 'sin detalle';
  try {
    const parsed = JSON.parse(rawText) as { error?: { message?: string; status?: string } };
    const message = parsed.error?.message;
    if (message) {
      // Trim long stack-like messages and keep them on one line.
      return message.replace(/\s+/g, ' ').slice(0, 140);
    }
  } catch {
    // not JSON — fall through
  }
  return rawText.replace(/\s+/g, ' ').slice(0, 140);
}

async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number },
  label: string,
): Promise<Response> {
  const { timeoutMs = 60_000, ...rest } = init;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(url, {
        ...rest,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return response;

      if (RETRYABLE_STATUS.has(response.status) && attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(`[gemini-video] ${label} ${response.status} on attempt ${attempt + 1}, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        const errText = await response.text().catch(() => '');
        lastError = new Error(`${response.status}: ${errText.slice(0, 200)}`);
        continue;
      }

      const errText = await response.text().catch(() => '');
      throw new Error(`${label}: ${response.status} ${cleanGeminiError(errText)}`);
    } catch (err) {
      const transient = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      if (transient && attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(`[gemini-video] ${label} ${err.name} on attempt ${attempt + 1}, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error(`${label}: agotados los reintentos`);
}

async function uploadVideoToGeminiFiles(
  videoUrl: string,
  apiKey: string,
): Promise<string> {
  // ── Paso 0: Descargar el video en el servidor ──────────────────────────────
  const videoRes = await fetchWithRetry(
    videoUrl,
    { timeoutMs: 60_000 },
    'descarga de video',
  );

  const videoBuffer = await videoRes.arrayBuffer();
  const fileSizeBytes = videoBuffer.byteLength;

  if (fileSizeBytes > 2 * 1024 * 1024 * 1024) {
    throw new Error(`El video supera el límite de 2 GB del motor de archivos de ArkoAI.`);
  }

  const BASE = 'https://generativelanguage.googleapis.com';

  // ── Paso 1: Iniciar sesión de upload resumable ─────────────────────────────
  // Este request solo lleva metadata JSON y los headers de control.
  // NO debe llevar el archivo. La respuesta tiene el header x-goog-upload-url.
  const initRes = await fetchWithRetry(
    `${BASE}/upload/v1beta/files`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(fileSizeBytes),
        'X-Goog-Upload-Header-Content-Type': 'video/mp4',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: 'reel' } }),
      timeoutMs: 30_000,
    },
    'init upload Gemini Files',
  );

  const uploadUrl = initRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error('ArkoAI Files no devolvió x-goog-upload-url en el paso 1');
  }

  // ── Paso 2: Enviar los bytes binarios del video ────────────────────────────
  const uploadRes = await fetchWithRetry(
    uploadUrl,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
        'Content-Type': 'video/mp4',
      },
      body: videoBuffer,
      timeoutMs: 120_000,
    },
    'upload bytes Gemini Files',
  );

  const uploadData = await uploadRes.json() as { file?: { uri?: string; name?: string; state?: string } };
  const fileUri = uploadData.file?.uri;

  if (!fileUri) {
    throw new Error('ArkoAI Files no devolvió URI en la respuesta del upload');
  }

  return fileUri;
}

export interface GeminiUsageMetadata {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AnalyzeVideoResult {
  analysis: GeminiVideoAnalysis;
  usage: GeminiUsageMetadata;
  /** Model that produced the analysis. */
  model: string;
  /** True when the analysis is valid + complete. False when fields had to be defaulted. */
  complete: boolean;
  /** Set when complete=false: short reason. Surfaces in logs and (optionally) UI. */
  partialReason?: string;
}

export async function analyzeVideoWithGemini(videoUrl: string): Promise<AnalyzeVideoResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('ArkoAI no está configurado en el servidor. Falta la API key.');
  }

  // 1. Upload video to Gemini's Files API
  const fileUri = await uploadVideoToGeminiFiles(videoUrl, apiKey);

  // 2. Wait for Gemini to finish processing the file (PROCESSING → ACTIVE)
  await waitForGeminiFileActive(fileUri, apiKey);

  // 3. Walk the model tier list. Stop at the first complete result.
  //    Track the best partial result so we can rescue or return it as last resort.
  let best: AnalyzeVideoResult | null = null;
  for (const model of GEMINI_MODELS_TIERED) {
    const result = await tryAnalyzeWithModel(apiKey, fileUri, model);
    if (result.complete) return result;

    console.warn(
      `[gemini-video] ${model} returned partial (${result.partialReason}); will try next tier or rescue.`,
    );

    if (
      !best
      || result.analysis.transcript.length > best.analysis.transcript.length
    ) {
      best = result;
    }
  }

  // 4. All video calls returned partial. If we have a transcript, do a text-only
  //    follow-up that asks Gemini to fill in the structured analysis. Text-only
  //    calls are an order of magnitude cheaper and almost never get throttled.
  if (best && best.analysis.transcript.trim().length > 0) {
    const rescued = await rescueAnalysisFromTranscript(apiKey, best);
    if (rescued) {
      console.warn(`[gemini-video] rescued via text-only follow-up using ${rescued.model}`);
      return rescued;
    }

    // 5. Last cross-provider fallback: if all Gemini paths failed but we have
    //    a transcript, ask GPT-4o to generate the structured analysis from text.
    //    Different provider = different capacity pool.
    const openaiRescue = await rescueAnalysisWithOpenAI(best);
    if (openaiRescue) {
      console.warn(`[gemini-video] rescued via OpenAI ${OPENAI_RESCUE_MODEL} text-only`);
      return openaiRescue;
    }
  }

  console.error(
    `[gemini-video] all tiers failed. Returning best partial (model=${best?.model}, reason=${best?.partialReason}).`,
  );
  return best ?? {
    analysis: buildSkeletonAnalysis('', 'todos los modelos fallaron'),
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    model: GEMINI_MODELS_TIERED[0],
    complete: false,
    partialReason: 'todos los modelos fallaron',
  };
}

/**
 * Text-only follow-up: given a transcript we already extracted, ask Gemini to
 * generate the structured analysis. Much smaller than a video call, virtually
 * never hits 503/MAX_TOKENS for typical transcripts.
 */
async function rescueAnalysisFromTranscript(
  apiKey: string,
  best: AnalyzeVideoResult,
): Promise<AnalyzeVideoResult | null> {
  const transcript = best.analysis.transcript;
  const body = {
    contents: [
      {
        parts: [{
          text: `${ANALYSIS_PROMPT}\n\n=== TRANSCRIPCIÓN DEL VIDEO ===\n${transcript}\n\n=== INSTRUCCIONES DE RESCATE ===\nNo tenés acceso al video, solo a la transcripción de arriba. Inferí lo que puedas de los campos visuales y de audio en base al contenido textual. Para campos visuales que no podés determinar, usá valores neutros razonables. Devolvé el JSON COMPLETO con la estructura exacta especificada arriba, manteniendo el campo \"transcript\" igual al provisto.`,
        }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 16384,
      responseMimeType: 'application/json',
    },
  };

  for (const model of GEMINI_MODELS_TIERED) {
    let data: GeminiGenerateResponse;
    try {
      data = await callGeminiWithRetry(apiKey, body, model);
    } catch (err) {
      console.warn(`[gemini-video] rescue with ${model} failed: ${err instanceof Error ? err.message : 'unknown'}`);
      continue;
    }

    if (data.error) continue;

    const candidate = data.candidates?.[0];
    const parsed = parseAnalysisResponse(
      candidate?.content?.parts,
      candidate?.finishReason,
      undefined,
    );

    if (parsed.ok) {
      // Restore the original transcript in case the model paraphrased it.
      parsed.analysis.transcript = transcript;
      return {
        analysis: parsed.analysis,
        usage: {
          inputTokens: (best.usage.inputTokens) + (data.usageMetadata?.promptTokenCount ?? 0),
          outputTokens: (best.usage.outputTokens) + (data.usageMetadata?.candidatesTokenCount ?? 0),
          totalTokens: (best.usage.totalTokens) + (data.usageMetadata?.totalTokenCount ?? 0),
        },
        model: `${best.model}+${model}/rescue`,
        complete: true,
      };
    }
  }

  return null;
}

/**
 * Cross-provider rescue: when every Gemini path has failed but we have a
 * transcript, GPT-4o generates the structured analysis from the text alone.
 * Different provider = different capacity pool, so this survives Google-side
 * outages that take all Gemini models down at once.
 */
async function rescueAnalysisWithOpenAI(
  best: AnalyzeVideoResult,
): Promise<AnalyzeVideoResult | null> {
  const apiKey = getOpenAIKey()?.trim();
  if (!apiKey) {
    console.warn('[gemini-video] OpenAI rescue skipped: OPENAI_API_KEY not set');
    return null;
  }

  const transcript = best.analysis.transcript;
  const url = 'https://api.openai.com/v1/chat/completions';
  const body = {
    model: OPENAI_RESCUE_MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 4096,
    messages: [
      {
        role: 'system',
        content: `${ANALYSIS_PROMPT}\n\nNo tenés acceso al video, solo a la transcripción que te va a dar el usuario. Inferí lo que puedas de los campos visuales y de audio en base al contenido textual. Para campos visuales que no podés determinar, usá valores neutros razonables. Devolvé el JSON COMPLETO con la estructura exacta especificada arriba.`,
      },
      {
        role: 'user',
        content: `=== TRANSCRIPCIÓN DEL VIDEO ===\n${transcript}`,
      },
    ],
  };

  const RETRYABLE_OPENAI = new Set([408, 425, 429, 500, 502, 503, 504]);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        if (RETRYABLE_OPENAI.has(response.status) && attempt < RETRY_DELAYS_MS.length) {
          const delay = RETRY_DELAYS_MS[attempt];
          console.warn(`[gemini-video] OpenAI rescue ${response.status} attempt ${attempt + 1}, retrying in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          lastError = new Error(`${response.status} ${errText.slice(0, 140)}`);
          continue;
        }
        throw new Error(`OpenAI rescue ${response.status}: ${errText.slice(0, 140)}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;

      const parsed = parseAnalysisResponse([{ text: content }], 'STOP', undefined);
      if (!parsed.ok) {
        console.warn(`[gemini-video] OpenAI rescue produced invalid shape: ${parsed.reason}`);
        return null;
      }

      // Restore original transcript so the user sees what we actually transcribed.
      parsed.analysis.transcript = transcript;
      return {
        analysis: parsed.analysis,
        usage: {
          inputTokens: best.usage.inputTokens + (data.usage?.prompt_tokens ?? 0),
          outputTokens: best.usage.outputTokens + (data.usage?.completion_tokens ?? 0),
          totalTokens: best.usage.totalTokens + (data.usage?.total_tokens ?? 0),
        },
        model: `${best.model}+openai-${OPENAI_RESCUE_MODEL}/rescue`,
        complete: true,
      };
    } catch (err) {
      const transient = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      if (transient && attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(`[gemini-video] OpenAI rescue ${err.name} attempt ${attempt + 1}, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        lastError = err;
        continue;
      }
      console.error(`[gemini-video] OpenAI rescue failed: ${err instanceof Error ? err.message : 'unknown'}`);
      return null;
    }
  }

  console.error(`[gemini-video] OpenAI rescue exhausted retries: ${lastError?.message ?? 'unknown'}`);
  return null;
}

async function waitForGeminiFileActive(fileUri: string, apiKey: string): Promise<void> {
  const urlParts = new URL(fileUri);
  const fileName = urlParts.pathname.replace('/v1beta/', ''); // "files/XXXXX"
  const MAX_ATTEMPTS = 24; // 24 × 5s = 2 minutos
  let lastState = 'unknown';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, 5_000));
    try {
      const statusRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fileName}`,
        {
          headers: { 'x-goog-api-key': apiKey },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (statusRes.ok) {
        const statusData = await statusRes.json() as { state?: string };
        lastState = statusData.state ?? 'unknown';
        if (lastState === 'ACTIVE') return;
        if (lastState === 'FAILED') {
          throw new Error('ArkoAI no pudo procesar el video (estado FAILED).');
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('estado FAILED')) throw err;
      // Network error checking status — keep polling, the file may still go ACTIVE.
      console.warn(`[gemini-video] file status check ${attempt + 1} failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  throw new Error(
    `ArkoAI no terminó de procesar el video en 2 minutos (último estado: ${lastState}). Reintentá el análisis.`,
  );
}

async function tryAnalyzeWithModel(
  apiKey: string,
  fileUri: string,
  model: string,
): Promise<AnalyzeVideoResult> {
  const body = {
    contents: [
      {
        parts: [
          { file_data: { mime_type: 'video/mp4', file_uri: fileUri } },
          { text: ANALYSIS_PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 16384,
      responseMimeType: 'application/json',
    },
  };

  let data: GeminiGenerateResponse;
  try {
    data = await callGeminiWithRetry(apiKey, body, model);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'error desconocido';
    console.error(`[gemini-video] ${model} call failed completely: ${reason}`);
    return {
      analysis: buildSkeletonAnalysis('', `${model} no respondió: ${reason}`),
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model,
      complete: false,
      partialReason: reason,
    };
  }

  if (data.error) {
    const reason = data.error.message;
    console.error(`[gemini-video] ${model} returned error: ${reason}`);
    return {
      analysis: buildSkeletonAnalysis('', `${model}: ${reason}`),
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model,
      complete: false,
      partialReason: reason,
    };
  }

  const usage: GeminiUsageMetadata = {
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
  };

  const candidate = data.candidates?.[0];
  const parsed = parseAnalysisResponse(
    candidate?.content?.parts,
    candidate?.finishReason,
    usage,
  );

  return {
    analysis: parsed.analysis,
    usage,
    model,
    complete: parsed.ok,
    partialReason: parsed.reason,
  };
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message: string };
}

/**
 * Calls Gemini's generateContent with retry on transient failures.
 *
 * Retries on 429 (rate limit), 500 (internal), 503 (UNAVAILABLE) — Gemini's
 * "experiencing high demand" responses. Uses exponential backoff: 2s, 8s, 30s.
 * Total worst-case wait is ~40s before surfacing the error.
 */
async function callGeminiWithRetry(
  apiKey: string,
  body: unknown,
  model: string,
): Promise<GeminiGenerateResponse> {
  const url = geminiUrl(model);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });

      if (response.ok) {
        return (await response.json()) as GeminiGenerateResponse;
      }

      const errorText = await response.text();
      const cleanMsg = cleanGeminiError(errorText);

      if (RETRYABLE_STATUS.has(response.status) && attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(
          `[gemini-video] ${model} ${response.status} on attempt ${attempt + 1}, retrying in ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
        lastError = new Error(`${response.status} ${cleanMsg}`);
        continue;
      }

      throw new Error(`${response.status} ${cleanMsg}`);
    } catch (err) {
      // Network errors / timeouts also retry, on the same schedule.
      if (err instanceof Error && err.name === 'TimeoutError' && attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(`[gemini-video] ${model} timeout on attempt ${attempt + 1}, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error('ArkoAI no respondió después de varios reintentos.');
}
