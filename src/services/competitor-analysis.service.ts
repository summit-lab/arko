/**
 * competitor-analysis.service.ts
 * AI analysis of competitor reels using Gemini video analysis.
 * Uploads the actual video to Gemini for visual + audio + narrative analysis.
 * Falls back to caption-only analysis via Claude if no video_url is available.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getGeminiKey } from '@/lib/env';
import { isGeminiEnabled } from './gemini-video.service';
import { callLLM, type LLMMessage } from './llm.service';
import { getLLMConfig } from './llm-config';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CompetitorReel {
  id: string;
  caption: string | null;
  video_url: string | null;
  likes_count: number | null;
  comments_count: number | null;
  views_count: number | null;
  shares_count: number | null;
  duration_seconds: number | null;
  hashtags: string[];
  music_artist: string | null;
}

interface ReelAnalysisData {
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
  model_used: string;
  tokens_used: number;
}

export interface AnalysisResult {
  reelId: string;
  success: boolean;
  tokensUsed: number;
  error?: string;
}

// ─── Hook type classification ───────────────────────────────────────────────

const HOOK_TYPE_KEYWORDS: Record<string, string[]> = {
  transformacion: ['antes', 'después', 'pasé de', 'transformé', 'cambié', 'logré'],
  enemigo: ['el problema es', 'lo que nadie te dice', 'te están mintiendo', 'cuidado con'],
  negativo: ['no hagas', 'dejá de', 'error', 'peor', 'nunca', 'mal'],
  promesa: ['vas a', 'te voy a', 'aprende', 'descubrí', 'secreto', 'truco'],
  curiosidad: ['sabías que', 'por qué', 'qué pasa si', 'increíble', 'no vas a creer'],
};

function classifyHookType(hookText: string): string {
  const lower = hookText.toLowerCase();
  for (const [hookType, keywords] of Object.entries(HOOK_TYPE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return hookType;
  }
  return 'desconocido';
}

// ─── Fallback: caption-only analysis via Claude ─────────────────────────────

const FALLBACK_SYSTEM_PROMPT = `Sos Arko, consultor experto en marketing de contenido en Instagram. Usás el Framework de Fran (Francisco Doglio).

RESPONDE 100% EN ESPAÑOL.

Framework clave:
- Tipos de contenido: REPUTACIÓN (educa, muestra autoridad, genera guardados) vs CONEXIÓN (emociona, conecta, genera compartidos)
- Tipos de hook: transformacion (antes/después), enemigo (posiciona algo como el problema), negativo (error/consecuencia), promesa (cómo lograr X), curiosidad (algo nuevo/sorprendente)
- Jerarquía: Concepto > Estructura narrativa > Ejecución
- Un buen concepto es: interesante/novedoso, invita a retención, es guardable o compartible

Respondé SOLO con un JSON válido (sin markdown, sin backticks):
{
  "hook_text": "texto del hook o inicio del caption",
  "hook_type": "transformacion|enemigo|negativo|promesa|curiosidad|desconocido",
  "narrative_structure": "estructura narrativa inferida del caption",
  "content_type": "reputacion|conexion",
  "cta_text": "texto del CTA o null",
  "cta_type": "recurso|clase|consulta|seguir|comentar|ninguno",
  "topic_cluster": "tema en 2-4 palabras",
  "style_notes": "no disponible sin video",
  "strengths": "fortalezas según framework de Fran (concepto, estructura, guardable/compartible)",
  "weaknesses": "debilidades según framework de Fran",
  "ai_summary": "Análisis de Arko: por qué funciona o no este contenido según el framework. Concepto + estructura + acción (guardable/compartible). 3-4 oraciones."
}`;

async function analyzeReelFallback(reel: CompetitorReel): Promise<ReelAnalysisData> {
  const content = `Analizá este reel de un competidor usando el Framework de Fran (solo caption disponible, sin video):

CAPTION: ${reel.caption || '(sin caption)'}

MÉTRICAS:
- Views: ${reel.views_count ?? 'N/A'}
- Likes: ${reel.likes_count ?? 'N/A'}
- Comments: ${reel.comments_count ?? 'N/A'}
- Shares: ${reel.shares_count ?? 'N/A'}
- Duración: ${reel.duration_seconds ? `${reel.duration_seconds}s` : 'N/A'}

HASHTAGS: ${reel.hashtags.length > 0 ? reel.hashtags.join(', ') : 'ninguno'}
MÚSICA: ${reel.music_artist ? `${reel.music_artist}` : 'N/A'}`;

  const messages: LLMMessage[] = [{ role: 'user', content }];
  const config = getLLMConfig('ai-agents');

  const response = await callLLM({
    provider: config.provider,
    model: config.model,
    messages,
    system: FALLBACK_SYSTEM_PROMPT,
    maxTokens: 1024,
  });

  let analysis: Record<string, string | null>;
  try {
    const cleaned = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    analysis = JSON.parse(cleaned);
  } catch {
    analysis = {
      hook_text: null, hook_type: 'desconocido', narrative_structure: null,
      content_type: null, cta_text: null, cta_type: 'ninguno',
      topic_cluster: null, style_notes: null, strengths: null,
      weaknesses: null, ai_summary: response.text.substring(0, 500),
    };
  }

  return {
    hook_text: analysis.hook_text ?? null,
    hook_type: analysis.hook_type ?? null,
    narrative_structure: analysis.narrative_structure ?? null,
    content_type: analysis.content_type ?? null,
    cta_text: analysis.cta_text ?? null,
    cta_type: analysis.cta_type ?? null,
    topic_cluster: analysis.topic_cluster ?? null,
    style_notes: analysis.style_notes ?? null,
    strengths: analysis.strengths ?? null,
    weaknesses: analysis.weaknesses ?? null,
    ai_summary: analysis.ai_summary ?? null,
    model_used: config.model,
    tokens_used: response.totalTokens,
  };
}

// ─── Relaxed Gemini JSON parser for competitor analysis ─────────────────────
// The strict isGeminiVideoAnalysis validator rejects responses with minor shape
// issues (null where string expected, etc.). For competitor analysis we only need
// a subset of the fields, so we parse more tolerantly.

function safeStr(val: unknown): string | null {
  if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  return null;
}

function safeStrArr(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
  return [];
}

function parseGeminiResponseRelaxed(text: string): {
  mapped: Omit<ReelAnalysisData, 'model_used' | 'tokens_used'>;
  transcript: string | null;
} | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return null;

    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;

    const narrative = parsed.narrative as Record<string, unknown> | undefined;
    const visual = parsed.visual as Record<string, unknown> | undefined;
    const audio = parsed.audio as Record<string, unknown> | undefined;
    const insights = parsed.insights as Record<string, unknown> | undefined;

    const hookText = safeStr(narrative?.hook) ?? safeStr(parsed.hook_text);

    // Prefer Gemini's hook_type classification, fallback to keyword-based
    const geminiHookType = safeStr(narrative?.hook_type)?.toLowerCase();
    const VALID_HOOK_TYPES = ['transformacion', 'enemigo', 'negativo', 'promesa', 'curiosidad'];
    const hookType = geminiHookType && VALID_HOOK_TYPES.includes(geminiHookType)
      ? geminiHookType
      : hookText ? classifyHookType(hookText) : 'desconocido';

    // Prefer Gemini's content_type, fallback to tone-based inference
    const geminiContentType = safeStr(narrative?.content_type)?.toLowerCase();
    const contentType = (geminiContentType === 'reputacion' || geminiContentType === 'conexion')
      ? geminiContentType
      : (() => {
          const toneLC = (safeStr(audio?.tone) ?? '').toLowerCase();
          return (toneLC.includes('educa') || toneLC.includes('autoridad')) ? 'reputacion' : 'conexion';
        })();

    let ctaType = 'ninguno';
    const ctaText = safeStr(narrative?.cta_text);
    if (ctaText) {
      const ctaLC = ctaText.toLowerCase();
      if (ctaLC.includes('descarg') || ctaLC.includes('recurso') || ctaLC.includes('link')) ctaType = 'recurso';
      else if (ctaLC.includes('clase') || ctaLC.includes('curso')) ctaType = 'clase';
      else if (ctaLC.includes('consult') || ctaLC.includes('agenda')) ctaType = 'consulta';
      else if (ctaLC.includes('segu') || ctaLC.includes('follow')) ctaType = 'seguir';
      else if (ctaLC.includes('coment') || ctaLC.includes('respond')) ctaType = 'comentar';
      else ctaType = 'recurso';
    }

    const strengths = safeStrArr(insights?.strengths);
    const improvements = safeStrArr(insights?.improvements);
    const replicable = safeStrArr(insights?.replicable_elements);
    const transcript = safeStr(parsed.transcript);

    // Build richer style_notes with editing + music info
    const styleComponents = [
      safeStr(visual?.format_type),
      safeStr(visual?.scene_type),
      safeStr(visual?.editing_style),
      safeStr(audio?.tone) ? `Tono: ${audio!.tone}` : null,
      safeStr(audio?.energy_level) ? `Energía: ${audio!.energy_level}` : null,
      safeStr(audio?.music_style) ? `Música: ${audio!.music_style}` : null,
    ].filter(Boolean);

    // Build enriched ai_summary with Arko's analysis
    const whyItWorks = safeStr(insights?.why_it_works);
    const conceptQuality = safeStr(insights?.winning_concept);
    const ctaAnalysis = safeStr(narrative?.cta_analysis);
    const saveableOrShareable = safeStr(insights?.saveable_or_shareable);

    const summaryParts = [
      whyItWorks ? `Por qué funciona: ${whyItWorks}` : null,
      conceptQuality ? `Concepto: ${conceptQuality}` : null,
      safeStr(insights?.viral_potential) ? `Potencial viral: ${insights!.viral_potential}. ${safeStr(insights?.viral_potential_reason) ?? ''}` : null,
      saveableOrShareable ? `Acción: ${saveableOrShareable}` : null,
      ctaAnalysis ? `CTA: ${ctaAnalysis}` : null,
      safeStr(narrative?.core_promise) ? `Promesa central: ${narrative!.core_promise}` : null,
      replicable.length > 0 ? `Elementos replicables: ${replicable.join(', ')}` : null,
    ].filter(Boolean);

    return {
      mapped: {
        hook_text: hookText,
        hook_type: hookType,
        narrative_structure: safeStr(narrative?.development_summary),
        content_type: contentType,
        cta_text: ctaText,
        cta_type: ctaType,
        topic_cluster: safeStr(narrative?.topic_cluster),
        style_notes: styleComponents.length > 0 ? styleComponents.join('. ') : null,
        strengths: strengths.length > 0 ? strengths.join('. ') : null,
        weaknesses: improvements.length > 0 ? improvements.join('. ') : null,
        ai_summary: summaryParts.length > 0 ? summaryParts.join(' | ') : null,
      },
      transcript,
    };
  } catch {
    return null;
  }
}

// ─── Analyze a single reel with Gemini video ────────────────────────────────

async function analyzeReelWithGemini(reel: CompetitorReel): Promise<ReelAnalysisData & { transcript: string | null }> {
  if (!reel.video_url) {
    throw new Error('NO_VIDEO_URL');
  }

  // Call Gemini Files API directly with relaxed parsing
  // (the strict analyzeVideoWithGemini validator rejects minor shape issues)
  const apiKey = getGeminiKey()?.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  // 1. Download video
  const videoRes = await fetch(reel.video_url, { signal: AbortSignal.timeout(30_000) });
  if (!videoRes.ok) throw new Error(`Download failed: ${videoRes.status}`);
  const videoBuffer = await videoRes.arrayBuffer();

  // 2. Upload to Gemini Files API (resumable)
  const BASE = 'https://generativelanguage.googleapis.com';
  const initRes = await fetch(`${BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(videoBuffer.byteLength),
      'X-Goog-Upload-Header-Content-Type': 'video/mp4',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'competitor-reel' } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!initRes.ok) throw new Error(`Upload init failed: ${initRes.status}`);

  const uploadUrl = initRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('No upload URL');

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type': 'video/mp4',
    },
    body: videoBuffer,
    signal: AbortSignal.timeout(30_000),
  });
  if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);

  const uploadData = await uploadRes.json() as { file?: { uri?: string; name?: string } };
  const fileUri = uploadData.file?.uri;
  if (!fileUri) throw new Error('No file URI');

  // 3. Wait for ACTIVE
  const urlParts = new URL(fileUri);
  const fileName = urlParts.pathname.replace('/v1beta/', '');
  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise((r) => setTimeout(r, 3_000));
    const statusRes = await fetch(`${BASE}/v1beta/${fileName}`, { headers: { 'x-goog-api-key': apiKey } });
    if (statusRes.ok) {
      const sd = await statusRes.json() as { state?: string };
      if (sd.state === 'ACTIVE') break;
      if (sd.state === 'FAILED') throw new Error('File processing FAILED');
    }
  }

  // 4. Generate with Fran framework-enriched prompt for competitor analysis
  const COMPETITOR_PROMPT = `Sos Arko, consultor experto en marketing de contenido en Instagram. Analizás este Reel de un competidor usando el Framework de Fran (Francisco Doglio).

RESPONDE 100% EN ESPAÑOL. Cada campo, cada palabra, todo en español.

=== LO MÁS IMPORTANTE: EL CONCEPTO ===

Según Fran, el CONCEPTO es lo que determina si un video funciona o no. La ejecución es secundaria. Dos videos con la misma ejecución pero distintos conceptos tienen resultados completamente diferentes.

Un concepto ganador cumple TODOS estos filtros:
1. ES INTERESANTE Y NOVEDOSO para el nicho — si es algo que "ya todo el mundo sabe", el concepto está muerto
2. INVITA A LA RETENCIÓN — obliga a ver el video COMPLETO para llevarse el valor (no entrega todo en los primeros segundos)
3. ES GUARDABLE O COMPARTIBLE — despierta "tengo que guardar esto para aplicarlo" (reputación) o "tengo que mandarle esto a alguien" (conexión)
4. NO ES UN PICO DE VALOR ÚNICO — tiene múltiples capas que se van revelando

Red flags de mal concepto: valor completo en primeros segundos, tema repetido muchas veces en el nicho, tan genérico que le sirve a todo el mundo, tan nichado que solo lo entiende alguien con contexto extremo.

IMPORTANTE sobre métricas: Un video NO es bueno o malo por sus views absolutas. Lo que importa es cómo rinde COMPARADO CON EL PROMEDIO de la cuenta. Si tiene alcance alto pero la idea es genérica y atrae gente que no es el seguidor ideal, eso es viralidad vacía — no sirve aunque tenga muchas views.

=== TIPOS DE CONTENIDO (solo 2) ===

- REPUTACIÓN: Educa, muestra autoridad. Genera guardados. "Esto tengo que aplicarlo."
- CONEXIÓN: Emociona, conecta, entretiene. Genera compartidos. "Tengo que mandarle esto a alguien."

=== TIPOS DE HOOK (5 tipos) ===

- TRANSFORMACIÓN: Antes/después. "Nunca pensé que X me fuera a ir tan bien hasta que probé Y"
- ENEMIGO: Posiciona algo del nicho como el problema. "Si seguís usando X en 2026..."
- NEGATIVO: Error o consecuencia negativa. "El error que cometen el 90%..."
- PROMESA: "¿Cómo lograr X? Muy simple." Funciona SI es específico y usa códigos del nicho.
- CURIOSIDAD: Algo nuevo/sorprendente. "Descubrí algo nuevo sobre X"

El hook debe usar CÓDIGOS DE LENGUAJE DEL NICHO — palabras mainstream dentro del nicho que el seguidor ideal conoce pero una persona random no. Esto filtra: atrae a quien le interesa, repele a quien no.

=== ESTRUCTURA NARRATIVA ===

- Dividir en 3 a 5 puntos (nunca 2 o 4)
- Cada punto hace que el anterior cobre más sentido (valor acumulativo)
- Hook = 5-10% del video, valor = 80-90%, CTA = 5%
- El valor se reparte a lo LARGO de todo el video, no concentrado al inicio

=== ANÁLISIS DEL VIDEO ===

Devuelve UN OBJETO JSON puro (sin markdown, sin backticks):
{
  "transcript": "Transcripción COMPLETA palabra por palabra de todo lo que se dice en el video. Si no se habla, poner null.",
  "narrative": {
    "hook": "Primeras palabras exactas del video (el hook textual)",
    "hook_type": "transformacion|enemigo|negativo|promesa|curiosidad|desconocido",
    "development_summary": "Estructura narrativa: cómo abre, desarrolla y cierra. ¿Cuántos puntos tiene? ¿El valor se acumula o se concentra al inicio? Incluir patrón replicable. Ej: 'Abre con hook enemigo, desarrolla con 3 puntos acumulativos, cierra con CTA de recurso específico'.",
    "content_type": "reputacion|conexion",
    "cta_text": "CTA exacto textual o null si no hay",
    "has_cta": true,
    "cta_analysis": "¿Es específico? ¿Promete resultado rápido? ¿Expande sobre el mismo tema del video? Si no hay CTA, señalar que es un error.",
    "core_promise": "Propuesta de valor central del video en una oración",
    "topic_cluster": "Categoría temática en 2-4 palabras"
  },
  "visual": {
    "format_type": "Talking head|Tutorial|Screen recording|B-roll|Slideshow|Mixto",
    "scene_type": "Interior|Estudio|Exterior|Pantalla|Mixto",
    "editing_style": "Ritmo de edición: transiciones, textos en pantalla, cortes, efectos."
  },
  "audio": {
    "tone": "Educativo|Motivacional|Casual|Autoritario|Conversacional",
    "energy_level": "alto|medio|bajo",
    "music_style": "Música de fondo. Ej: 'Lo-fi suave', 'Sin música', 'Épica motivacional'"
  },
  "insights": {
    "winning_concept": "ESTE ES EL CAMPO MÁS IMPORTANTE. Identificá cuál es el CONCEPTO GANADOR de este reel: la idea central, la novedad, lo que lo hace diferente. Después evalualo contra los 4 filtros de Fran: (1) ¿Es interesante/novedoso para el nicho o es algo que ya se dijo mil veces? (2) ¿Invita a ver el video completo o entrega el valor al inicio y el resto es relleno? (3) ¿Es guardable o compartible? (4) ¿Tiene múltiples capas de valor? Si el concepto falla, decirlo claramente — no importa qué tan buena sea la ejecución.",
    "why_it_works": "Explicación concreta de POR QUÉ este video funciona o no. Conectar concepto + estructura + ejecución. ¿Habla al seguidor ideal del nicho o es demasiado genérico/nichado? ¿Es semi-viral (mainstream dentro del nicho) o viralidad vacía (atrae gente que nunca compraría)?",
    "strengths": ["Fortaleza específica 1", "Fortaleza específica 2"],
    "improvements": ["Mejora concreta y accionable 1", "Mejora concreta 2"],
    "viral_potential": "alto|medio|bajo",
    "viral_potential_reason": "¿Es semi-viral (mainstream dentro del nicho, atrae seguidores ideales) o viral vacío (atrae gente random)? ¿O es demasiado nichado y no sale de los seguidores actuales?",
    "replicable_elements": ["Elemento concreto que se puede copiar/adaptar 1", "Elemento 2"],
    "saveable_or_shareable": "guardable|compartible|ninguno — ¿Genera 'tengo que guardar esto para aplicarlo' o 'tengo que mandarle esto a alguien'? Explicar por qué."
  }
}`;

  const genRes = await fetch(
    `${BASE}/v1beta/models/gemini-2.5-flash:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ file_data: { mime_type: 'video/mp4', file_uri: fileUri } }, { text: COMPETITOR_PROMPT }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(60_000),
    }
  );

  if (!genRes.ok) throw new Error(`Gemini generate failed: ${genRes.status}`);

  const genData = await genRes.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { totalTokenCount?: number };
  };

  const rawText = genData.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  const totalTokens = genData.usageMetadata?.totalTokenCount ?? 0;

  // 5. Parse with relaxed parser
  const relaxed = parseGeminiResponseRelaxed(rawText);
  if (relaxed) {
    return { ...relaxed.mapped, model_used: 'gemini-2.5-flash', tokens_used: totalTokens, transcript: relaxed.transcript };
  }

  throw new Error('Failed to parse Gemini response');
}

// ─── Analyze a single reel by ID ────────────────────────────────────────────

export async function analyzeSingleCompetitorReel(
  supabase: SupabaseClient,
  reelId: string,
  workspaceId: string
): Promise<AnalysisResult> {
  // Get the reel
  const { data: reel, error } = await supabase
    .from('competitor_reels')
    .select('id, caption, video_url, likes_count, comments_count, views_count, shares_count, duration_seconds, hashtags, music_artist')
    .eq('id', reelId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error || !reel) {
    return { reelId, success: false, tokensUsed: 0, error: 'Reel not found' };
  }

  // Delete existing analysis if any (re-analyze)
  await supabase
    .from('competitor_reel_analysis')
    .delete()
    .eq('competitor_reel_id', reelId);

  const geminiAvailable = isGeminiEnabled();

  try {
    let analysisData: ReelAnalysisData;
    let extractedTranscript: string | null = null;

    if (geminiAvailable && (reel as CompetitorReel).video_url) {
      try {
        const geminiResult = await analyzeReelWithGemini(reel as CompetitorReel);
        extractedTranscript = geminiResult.transcript;
        analysisData = geminiResult;
      } catch {
        analysisData = await analyzeReelFallback(reel as CompetitorReel);
      }
    } else {
      analysisData = await analyzeReelFallback(reel as CompetitorReel);
    }

    // Save transcript to competitor_reels if Gemini extracted one
    if (extractedTranscript) {
      await supabase
        .from('competitor_reels')
        .update({ transcript: extractedTranscript })
        .eq('id', reel.id);
    }

    const { error: insertError } = await supabase
      .from('competitor_reel_analysis')
      .insert({
        competitor_reel_id: reel.id,
        workspace_id: workspaceId,
        hook_text: analysisData.hook_text,
        hook_type: analysisData.hook_type,
        narrative_structure: analysisData.narrative_structure,
        content_type: analysisData.content_type,
        cta_text: analysisData.cta_text,
        cta_type: analysisData.cta_type,
        topic_cluster: analysisData.topic_cluster,
        style_notes: analysisData.style_notes,
        strengths: analysisData.strengths,
        weaknesses: analysisData.weaknesses,
        ai_summary: analysisData.ai_summary,
        model_used: analysisData.model_used,
        tokens_used: analysisData.tokens_used,
      });

    return {
      reelId: reel.id,
      success: !insertError,
      tokensUsed: analysisData.tokens_used,
      error: insertError?.message,
    };
  } catch (err) {
    return {
      reelId: reel.id,
      success: false,
      tokensUsed: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ─── Analyze all unanalyzed reels for a competitor ──────────────────────────

export async function analyzeCompetitorReels(
  supabase: SupabaseClient,
  competitorId: string,
  workspaceId: string
): Promise<AnalysisResult[]> {
  // Get top 5 reels by views that don't have analysis yet
  const { data: reels, error } = await supabase
    .from('competitor_reels')
    .select(`
      id, caption, video_url, likes_count, comments_count,
      views_count, shares_count, duration_seconds, hashtags, music_artist,
      competitor_reel_analysis (id)
    `)
    .eq('competitor_id', competitorId)
    .eq('workspace_id', workspaceId)
    .is('competitor_reel_analysis.id', null)
    .order('views_count', { ascending: false, nullsFirst: false })
    .limit(3); // 3 reels max — Gemini takes ~35s per video, 3×35=105s fits in 120s timeout

  if (error || !reels || reels.length === 0) {
    return [];
  }

  const geminiAvailable = isGeminiEnabled();
  const results: AnalysisResult[] = [];

  for (const reel of reels) {
    try {
      let analysisData: ReelAnalysisData;
      let extractedTranscript: string | null = null;

      // Try Gemini video analysis first, fall back to Claude caption-only
      if (geminiAvailable && (reel as CompetitorReel).video_url) {
        try {
          const geminiResult = await analyzeReelWithGemini(reel as CompetitorReel);
          extractedTranscript = geminiResult.transcript;
          analysisData = geminiResult;
        } catch (geminiErr) {
          console.warn(`[competitor-analysis] Gemini failed for reel ${reel.id}, falling back to Claude:`, geminiErr);
          analysisData = await analyzeReelFallback(reel as CompetitorReel);
        }
      } else {
        analysisData = await analyzeReelFallback(reel as CompetitorReel);
      }

      // Save transcript to competitor_reels if Gemini extracted one
      if (extractedTranscript) {
        await supabase
          .from('competitor_reels')
          .update({ transcript: extractedTranscript })
          .eq('id', reel.id);
      }

      const { error: insertError } = await supabase
        .from('competitor_reel_analysis')
        .insert({
          competitor_reel_id: reel.id,
          workspace_id: workspaceId,
          hook_text: analysisData.hook_text,
          hook_type: analysisData.hook_type,
          narrative_structure: analysisData.narrative_structure,
          content_type: analysisData.content_type,
          cta_text: analysisData.cta_text,
          cta_type: analysisData.cta_type,
          topic_cluster: analysisData.topic_cluster,
          style_notes: analysisData.style_notes,
          strengths: analysisData.strengths,
          weaknesses: analysisData.weaknesses,
          ai_summary: analysisData.ai_summary,
          model_used: analysisData.model_used,
          tokens_used: analysisData.tokens_used,
        });

      results.push({
        reelId: reel.id,
        success: !insertError,
        tokensUsed: analysisData.tokens_used,
        error: insertError?.message,
      });
    } catch (err) {
      results.push({
        reelId: reel.id,
        success: false,
        tokensUsed: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return results;
}
