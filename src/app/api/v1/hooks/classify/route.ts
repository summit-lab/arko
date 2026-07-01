/**
 * POST /api/v1/hooks/classify
 *
 * Classifies Instagram reel "hooks" (first lines of captions) via Gemini and
 * translates non-Spanish ones. Cached in `hook_classifications` table so
 * subsequent visits to the Biblioteca tab don't re-hit Gemini.
 *
 * Body: {
 *   workspace_id: string,
 *   reference_id: string,
 *   hooks: [{ reel_short_code: string, text: string }]
 * }
 *
 * Returns: { classifications: [{ reel_short_code, pattern, language, translation }] }
 */

export const maxDuration = 300; // trabajo pesado (LLM/Gemini/Apify): headroom anti-timeout

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGeminiKey } from '@/lib/env';
import { apiSuccess, api500, api401, api403 } from '@/lib/api/response';
import { resolveTier, hasFeature, TRAP } from '@/lib/tier/config';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const BATCH_SIZE = 20;

type HookPattern = 'pregunta' | 'lista' | 'contraste' | 'cta' | 'historia' | 'shock' | 'afirmacion';

interface HookInput {
  reel_short_code: string;
  text: string;
}

interface ClassificationResult {
  reel_short_code: string;
  pattern: HookPattern;
  language: string;
  translation: string | null;
}

const VALID_PATTERNS: HookPattern[] = [
  'pregunta', 'lista', 'contraste', 'cta', 'historia', 'shock', 'afirmacion',
];

function isValidPattern(value: unknown): value is HookPattern {
  return typeof value === 'string' && (VALID_PATTERNS as string[]).includes(value);
}

function buildPrompt(hooks: HookInput[]): string {
  const numbered = hooks.map((h, i) => `${i + 1}. "${h.text.replace(/"/g, '\\"')}"`).join('\n');
  return `Sos un experto en análisis de contenido para Instagram. Para cada hook (primera línea de un reel), clasificá el patrón, detectá el idioma y traducí al español si no lo está.

PATRONES (elegí exactamente UNO por hook):
- pregunta: formula una pregunta explícita o retórica (incluso si no tiene "?" o "¿")
- lista: enumera N cosas/pasos/errores/tips ("3 errores que...", "5 formas de...")
- contraste: opone dos ideas (X not Y, antes vs ahora, dejá de X empezá Y)
- cta: pide acción explícita del viewer (comentá, escribí, seguime, guardá, link en bio, mandame)
- historia: narra algo personal o un caso específico ("la vez que...", "ayer me pasó...")
- shock: afirmación provocadora o contraintuitiva que desafía sentido común
- afirmacion: afirmación genérica (default si no entra en las demás)

FORMATO DE RESPUESTA (sólo JSON, sin markdown, sin texto extra):
{ "classifications": [
  { "pattern": "pregunta", "language": "es", "translation": null },
  { "pattern": "cta", "language": "en", "translation": "Comentá 'lista' y te mando mi plan" },
  ...
] }

Reglas:
- Mismo orden que el input
- "language" es código ISO-639-1 (es, en, pt, fr, it, de, etc.)
- Si language="es", "translation" debe ser null
- Si language≠"es", "translation" es la traducción al español manteniendo el tono y las comillas/estilo del original
- EXACTAMENTE ${hooks.length} items en el array de salida

HOOKS:
${numbered}`;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

async function classifyBatch(hooks: HookInput[], apiKey: string): Promise<ClassificationResult[]> {
  const prompt = buildPrompt(hooks);

  // Retry on transient errors (503 UNAVAILABLE is common under high demand,
  // 429 quota can clear in seconds). Up to 3 attempts with jittered exp backoff.
  let res: Response | null = null;
  let lastErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = 800 * Math.pow(2, attempt - 1) + Math.random() * 400;
      await new Promise((r) => setTimeout(r, delay));
    }
    res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (res.ok) break;
    lastErr = `HTTP ${res.status}`;
    // Retry only on transient
    if (res.status !== 503 && res.status !== 429 && res.status < 500) break;
  }

  if (!res || !res.ok) {
    const body = res ? await res.text() : '';
    throw new Error(`Gemini ${lastErr}: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as GeminiResponse;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
  }

  const wrapper = parsed as { classifications?: unknown };
  const arr = wrapper.classifications;
  if (!Array.isArray(arr) || arr.length !== hooks.length) {
    throw new Error(`Gemini returned ${Array.isArray(arr) ? arr.length : 'non-array'} items, expected ${hooks.length}`);
  }

  return hooks.map((hook, i) => {
    const item = arr[i] as Record<string, unknown> | undefined;
    const pattern = isValidPattern(item?.pattern) ? item.pattern : 'afirmacion';
    const language = typeof item?.language === 'string' && item.language.length >= 2
      ? item.language.slice(0, 5).toLowerCase()
      : 'es';
    const rawTranslation = typeof item?.translation === 'string' ? item.translation.trim() : null;
    const translation = language === 'es' ? null : rawTranslation;
    return {
      reel_short_code: hook.reel_short_code,
      pattern,
      language,
      translation,
    };
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      workspace_id?: string;
      reference_id?: string;
      hooks?: HookInput[];
    };

    const workspaceId = body.workspace_id;
    const referenceId = body.reference_id;
    const hooks = Array.isArray(body.hooks) ? body.hooks : [];

    if (!workspaceId || !referenceId || hooks.length === 0) {
      return NextResponse.json(
        { error: 'workspace_id, reference_id and non-empty hooks are required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Auth: el user debe ser DUEÑO del workspace + el tier debe permitir la feature.
    // (Antes tomaba workspace_id del body sin verificar pertenencia y gastaba Gemini
    // sin chequear tier — un Demo, o cualquier user, disparaba clasificación paga.)
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return api401();
    const { data: ws } = await supabase
      .from('workspaces')
      .select('plan, trial_ends_at')
      .eq('id', workspaceId)
      .eq('owner_id', user.id)
      .single();
    if (!ws) return api403('No tenés acceso a este workspace');
    if (!hasFeature(resolveTier(ws.plan, ws.trial_ends_at), 'competitors')) {
      return api403(TRAP.description);
    }

    const apiKey = getGeminiKey()?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini not configured on server' },
        { status: 503 },
      );
    }

    // 1) Fetch cached classifications for these shortcodes
    const shortCodes = hooks.map((h) => h.reel_short_code).filter((s): s is string => !!s);
    const { data: cachedRows } = await supabase
      .from('hook_classifications')
      .select('reel_short_code, pattern, detected_language, translated_text')
      .eq('workspace_id', workspaceId)
      .in('reel_short_code', shortCodes);

    const cachedMap = new Map<string, ClassificationResult>();
    for (const row of (cachedRows ?? []) as Array<{
      reel_short_code: string;
      pattern: HookPattern;
      detected_language: string;
      translated_text: string | null;
    }>) {
      cachedMap.set(row.reel_short_code, {
        reel_short_code: row.reel_short_code,
        pattern: row.pattern,
        language: row.detected_language,
        translation: row.translated_text,
      });
    }

    // 2) Determine which hooks need classification
    const toClassify = hooks.filter((h) => !cachedMap.has(h.reel_short_code));

    // 3) Batch-classify uncached hooks
    const fresh: ClassificationResult[] = [];
    for (let i = 0; i < toClassify.length; i += BATCH_SIZE) {
      const batch = toClassify.slice(i, i + BATCH_SIZE);
      try {
        const results = await classifyBatch(batch, apiKey);
        fresh.push(...results);
      } catch (err) {
        console.error('[hooks/classify] batch failed', {
          batchSize: batch.length,
          error: err instanceof Error ? err.message : String(err),
        });
        // Fall back to "afirmacion" with original language unknown
        for (const h of batch) {
          fresh.push({
            reel_short_code: h.reel_short_code,
            pattern: 'afirmacion',
            language: 'es',
            translation: null,
          });
        }
      }
    }

    // 4) Upsert fresh classifications into DB
    if (fresh.length > 0) {
      const rows = fresh.map((r) => {
        const hook = hooks.find((h) => h.reel_short_code === r.reel_short_code);
        return {
          workspace_id: workspaceId,
          reference_id: referenceId,
          reel_short_code: r.reel_short_code,
          original_text: hook?.text ?? '',
          translated_text: r.translation,
          pattern: r.pattern,
          detected_language: r.language,
        };
      });

      const { error: upsertErr } = await supabase
        .from('hook_classifications')
        .upsert(rows, { onConflict: 'workspace_id,reel_short_code' });

      if (upsertErr) {
        console.error('[hooks/classify] upsert failed', upsertErr);
      }
    }

    // 5) Return merged cached + fresh, keyed by shortcode
    const merged = new Map<string, ClassificationResult>();
    for (const r of cachedMap.values()) merged.set(r.reel_short_code, r);
    for (const r of fresh) merged.set(r.reel_short_code, r);

    return apiSuccess({
      classifications: hooks.map((h) => merged.get(h.reel_short_code) ?? {
        reel_short_code: h.reel_short_code,
        pattern: 'afirmacion' as HookPattern,
        language: 'es',
        translation: null,
      }),
      from_cache: cachedMap.size,
      fresh: fresh.length,
    });
  } catch (err) {
    console.error('[POST /api/v1/hooks/classify]', err);
    return api500();
  }
}
