/**
 * reference-analysis.service.ts
 *
 * AI analysis of reference reels (scraped from inspiring brands/creators).
 *
 * Unlike competitor reels, references don't have video_url stored
 * (scraped_reels is a jsonb array in workspace_references without the video
 * download). So this service uses the TEXT-ONLY Gemini path — same Fran
 * framework prompt as competitor-analysis.service, just limited to caption
 * + metrics instead of full video transcript.
 *
 * Usage:
 *   - Single reel: analyzeSingleReferenceReel(supabase, referenceId, shortCode, workspaceId)
 *   - Bulk top-N:  analyzeReferenceReels(supabase, referenceId, workspaceId)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getGeminiKey } from '@/lib/env';
import { isGeminiEnabled } from './gemini-video.service';
import { callLLM, type LLMMessage } from './llm.service';
import { getLLMConfig } from './llm-config';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReferenceReel {
  short_code: string | null;
  caption: string | null;
  likes_count: number | null;
  comments_count: number | null;
  views_count: number | null;
  duration_seconds: number | null;
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
  shortCode: string;
  success: boolean;
  tokensUsed: number;
  error?: string;
}

// ─── Prompt (shared between Gemini-text and LLM fallback) ───────────────────

const ANALYSIS_PROMPT = `Sos Moka, consultor experto en marketing de contenido en Instagram. Usás el Framework de Fran (Francisco Doglio).

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
  "ai_summary": "Análisis de Moka: por qué funciona o no este contenido según el framework. Concepto + estructura + acción (guardable/compartible). 3-4 oraciones."
}`;

function buildUserContent(reel: ReferenceReel): string {
  return `Analizá este reel de una referencia que el usuario considera inspiradora (solo caption disponible, sin video):

CAPTION: ${reel.caption || '(sin caption)'}

MÉTRICAS:
- Views: ${reel.views_count ?? 'N/A'}
- Likes: ${reel.likes_count ?? 'N/A'}
- Comments: ${reel.comments_count ?? 'N/A'}
- Duración: ${reel.duration_seconds ? `${reel.duration_seconds}s` : 'N/A'}`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseAnalysisJson(rawText: string): Record<string, string | null> {
  try {
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      hook_text: null, hook_type: 'desconocido', narrative_structure: null,
      content_type: null, cta_text: null, cta_type: 'ninguno',
      topic_cluster: null, style_notes: null, strengths: null,
      weaknesses: null, ai_summary: rawText.substring(0, 500),
    };
  }
}

function toAnalysisData(parsed: Record<string, string | null>, model: string, tokens: number): ReelAnalysisData {
  return {
    hook_text: parsed.hook_text ?? null,
    hook_type: parsed.hook_type ?? null,
    narrative_structure: parsed.narrative_structure ?? null,
    content_type: parsed.content_type ?? null,
    cta_text: parsed.cta_text ?? null,
    cta_type: parsed.cta_type ?? null,
    topic_cluster: parsed.topic_cluster ?? null,
    style_notes: parsed.style_notes ?? null,
    strengths: parsed.strengths ?? null,
    weaknesses: parsed.weaknesses ?? null,
    ai_summary: parsed.ai_summary ?? null,
    model_used: model,
    tokens_used: tokens,
  };
}

// ─── Gemini text-only analysis ──────────────────────────────────────────────

async function analyzeWithGeminiText(reel: ReferenceReel): Promise<ReelAnalysisData> {
  const apiKey = getGeminiKey()?.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const BASE = 'https://generativelanguage.googleapis.com';
  const res = await fetch(
    `${BASE}/v1beta/models/gemini-2.5-flash:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: ANALYSIS_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: buildUserContent(reel) }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini failed: ${res.status} — ${body.slice(0, 200)}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { totalTokenCount?: number };
  };

  const rawText = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  const totalTokens = data.usageMetadata?.totalTokenCount ?? 0;

  return toAnalysisData(parseAnalysisJson(rawText), 'gemini-2.5-flash', totalTokens);
}

// ─── LLM fallback (Anthropic/OpenAI) ────────────────────────────────────────

async function analyzeWithFallback(reel: ReferenceReel): Promise<ReelAnalysisData> {
  const messages: LLMMessage[] = [{ role: 'user', content: buildUserContent(reel) }];
  const config = getLLMConfig('ai-agents');
  const response = await callLLM({
    provider: config.provider,
    model: config.model,
    messages,
    system: ANALYSIS_PROMPT,
    maxTokens: 1024,
  });
  return toAnalysisData(parseAnalysisJson(response.text), config.model, response.totalTokens);
}

// ─── Load a reel from workspace_references.scraped_reels by short_code ─────

async function loadReel(
  supabase: SupabaseClient,
  referenceId: string,
  shortCode: string,
  workspaceId: string,
): Promise<ReferenceReel | null> {
  const { data, error } = await supabase
    .from('workspace_references')
    .select('scraped_reels')
    .eq('id', referenceId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error || !data) return null;
  const reels = (data.scraped_reels as ReferenceReel[] | null) ?? [];
  return reels.find((r) => r.short_code === shortCode) ?? null;
}

// ─── Persist analysis (insert or upsert on conflict) ───────────────────────

async function persistAnalysis(
  supabase: SupabaseClient,
  referenceId: string,
  shortCode: string,
  workspaceId: string,
  data: ReelAnalysisData,
): Promise<string | null> {
  // Delete existing (so re-analyze replaces rather than duplicates).
  await supabase
    .from('reference_reel_analysis')
    .delete()
    .eq('reference_id', referenceId)
    .eq('reel_short_code', shortCode);

  const { error } = await supabase
    .from('reference_reel_analysis')
    .insert({
      reference_id: referenceId,
      reel_short_code: shortCode,
      workspace_id: workspaceId,
      hook_text: data.hook_text,
      hook_type: data.hook_type,
      narrative_structure: data.narrative_structure,
      content_type: data.content_type,
      cta_text: data.cta_text,
      cta_type: data.cta_type,
      topic_cluster: data.topic_cluster,
      style_notes: data.style_notes,
      strengths: data.strengths,
      weaknesses: data.weaknesses,
      ai_summary: data.ai_summary,
      model_used: data.model_used,
      tokens_used: data.tokens_used,
    });

  return error?.message ?? null;
}

// ─── Public: analyze a single reel ─────────────────────────────────────────

export async function analyzeSingleReferenceReel(
  supabase: SupabaseClient,
  referenceId: string,
  shortCode: string,
  workspaceId: string,
): Promise<AnalysisResult> {
  const reel = await loadReel(supabase, referenceId, shortCode, workspaceId);
  if (!reel) return { shortCode, success: false, tokensUsed: 0, error: 'Reel not found' };
  if (!reel.caption) return { shortCode, success: false, tokensUsed: 0, error: 'Reel has no caption to analyze' };

  try {
    const data = isGeminiEnabled()
      ? await analyzeWithGeminiText(reel)
      : await analyzeWithFallback(reel);

    const insertErr = await persistAnalysis(supabase, referenceId, shortCode, workspaceId, data);
    return {
      shortCode,
      success: !insertErr,
      tokensUsed: data.tokens_used,
      error: insertErr ?? undefined,
    };
  } catch (err) {
    return {
      shortCode,
      success: false,
      tokensUsed: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ─── Public: bulk analyze top-N unanalyzed reels ───────────────────────────

export async function analyzeReferenceReels(
  supabase: SupabaseClient,
  referenceId: string,
  workspaceId: string,
  maxCount = 5,
): Promise<AnalysisResult[]> {
  // Load all scraped reels + existing analyzed short_codes.
  const [refRes, anaRes] = await Promise.all([
    supabase
      .from('workspace_references')
      .select('scraped_reels')
      .eq('id', referenceId)
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
    supabase
      .from('reference_reel_analysis')
      .select('reel_short_code')
      .eq('reference_id', referenceId)
      .eq('workspace_id', workspaceId),
  ]);

  const reels = (refRes.data?.scraped_reels as ReferenceReel[] | null) ?? [];
  const analyzed = new Set((anaRes.data ?? []).map((r) => r.reel_short_code));

  // Skip already-analyzed; pick top N by views; must have caption.
  const candidates = reels
    .filter((r) => r.short_code && !analyzed.has(r.short_code) && r.caption)
    .sort((a, b) => (b.views_count ?? 0) - (a.views_count ?? 0))
    .slice(0, maxCount);

  if (candidates.length === 0) return [];

  const results: AnalysisResult[] = [];
  for (const reel of candidates) {
    try {
      const data = isGeminiEnabled()
        ? await analyzeWithGeminiText(reel)
        : await analyzeWithFallback(reel);
      const insertErr = await persistAnalysis(supabase, referenceId, reel.short_code!, workspaceId, data);
      results.push({
        shortCode: reel.short_code!,
        success: !insertErr,
        tokensUsed: data.tokens_used,
        error: insertErr ?? undefined,
      });
    } catch (err) {
      results.push({
        shortCode: reel.short_code!,
        success: false,
        tokensUsed: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return results;
}
