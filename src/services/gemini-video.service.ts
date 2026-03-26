/**
 * gemini-video.service.ts
 * Analiza un video MP4 (via URL pública) con Gemini 1.5 Flash.
 * Devuelve análisis visual, narrativo, tono de voz y transcripción en un único call.
 */

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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

function parseAnalysisResponse(
  parts: Array<{ text?: string }> | undefined,
  finishReason: string | undefined,
): GeminiVideoAnalysis {
  const rawText = parts?.map((part) => part.text ?? '').join('').trim();

  if (!rawText) {
    throw new Error('ArkoAI no devolvió contenido para este video.');
  }

  const jsonPayload = extractJsonPayload(rawText);

  try {
    const parsed = JSON.parse(jsonPayload) as unknown;

    if (!isGeminiVideoAnalysis(parsed)) {
      throw new Error('shape');
    }

    return parsed;
  } catch {
    if (finishReason === 'MAX_TOKENS') {
      throw new Error('ArkoAI devolvió una respuesta incompleta. Reintentá el análisis.');
    }

    throw new Error(`ArkoAI devolvió una respuesta inválida. ${jsonPayload.slice(0, 200)}`);
  }
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const ANALYSIS_PROMPT = `Sos Arko, consultor experto en marketing de contenido en Instagram. Analizás este Reel del usuario usando el Framework de Fran (Francisco Doglio).

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
  return process.env.GEMINI_API_KEY?.trim() || null;
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
async function uploadVideoToGeminiFiles(
  videoUrl: string,
  apiKey: string,
): Promise<string> {
  // ── Paso 0: Descargar el video en el servidor ──────────────────────────────
  const videoRes = await fetch(videoUrl, {
    signal: AbortSignal.timeout(60_000),
  });

  if (!videoRes.ok) {
    throw new Error(`No se pudo descargar el video desde Apify: HTTP ${videoRes.status}`);
  }

  const videoBuffer = await videoRes.arrayBuffer();
  const fileSizeBytes = videoBuffer.byteLength;

  if (fileSizeBytes > 2 * 1024 * 1024 * 1024) {
    throw new Error(`El video supera el límite de 2 GB del motor de archivos de ArkoAI.`);
  }

  const BASE = 'https://generativelanguage.googleapis.com';

  // ── Paso 1: Iniciar sesión de upload resumable ─────────────────────────────
  // Este request solo lleva metadata JSON y los headers de control.
  // NO debe llevar el archivo. La respuesta tiene el header x-goog-upload-url.
  const initRes = await fetch(`${BASE}/upload/v1beta/files`, {
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
    signal: AbortSignal.timeout(30_000),
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`ArkoAI Files (inicio sesión): ${initRes.status} — ${errText}`);
  }

  const uploadUrl = initRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error('ArkoAI Files no devolvió x-goog-upload-url en el paso 1');
  }

  // ── Paso 2: Enviar los bytes binarios del video ────────────────────────────
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type': 'video/mp4',
    },
    body: videoBuffer,
    signal: AbortSignal.timeout(120_000),
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`ArkoAI Files (upload bytes): ${uploadRes.status} — ${errText}`);
  }

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

export async function analyzeVideoWithGemini(
  videoUrl: string,
): Promise<{ analysis: GeminiVideoAnalysis; usage: GeminiUsageMetadata }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('ArkoAI no está configurado en el servidor. Falta la API key.');
  }

  // 1. Subir el video a la Files API de Gemini
  const fileUri = await uploadVideoToGeminiFiles(videoUrl, apiKey);

  // 2. Esperar a que Gemini procese el archivo (PROCESSING → ACTIVE)
  //    El URI tiene forma: https://.../v1beta/files/XXXXX
  //    El "name" del archivo es la parte "files/XXXXX" del path
  const urlParts = new URL(fileUri);
  const fileName = urlParts.pathname.replace('/v1beta/', ''); // "files/XXXXX"

  for (let attempt = 0; attempt < 24; attempt++) {
    await new Promise((r) => setTimeout(r, 5_000)); // esperar 5s entre checks
    const statusRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}`,
      { headers: { 'x-goog-api-key': apiKey } },
    );
    if (statusRes.ok) {
      const statusData = await statusRes.json() as { state?: string };
      if (statusData.state === 'ACTIVE') break;
      if (statusData.state === 'FAILED') {
        throw new Error('ArkoAI no pudo procesar el video (estado FAILED).');
      }
    }
  }

  const body = {
    contents: [
      {
        parts: [
          {
            file_data: {
              mime_type: 'video/mp4',
              file_uri: fileUri,
            },
          },
          {
            text: ANALYSIS_PROMPT,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ArkoAI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json() as {
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
  };

  if (data.error) {
    throw new Error(`ArkoAI error: ${data.error.message}`);
  }

  const candidate = data.candidates?.[0];
  const analysis = parseAnalysisResponse(candidate?.content?.parts, candidate?.finishReason);

  return {
    analysis,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
    },
  };
}
