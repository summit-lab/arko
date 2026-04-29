/**
 * POST /api/v1/reels/[id]/gemini-analyze
 * Analiza un Reel con Gemini 1.5 Flash (visual + audio + transcripción).
 * Requiere video_url pública (Apify) en el body.
 */

// Aumentar timeout a 120s — el proceso de upload + análisis puede tardar ~60-90s
export const maxDuration = 120;

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api404, apiError, api500 } from '@/lib/api/response';
import { persistGeminiAnalysis } from '@/services/gemini-analysis-persistence.service';
import { analyzeVideoWithGemini, isGeminiEnabled } from '@/services/gemini-video.service';
import { logLLMUsage } from '@/services/llm-usage.service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isGeminiEnabled()) {
      return api400('ArkoAI no está configurado en el servidor. Falta la API key.');
    }

    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const supabase = await createClient();

    // Verificar que el reel pertenece al workspace
    const { data: reel, error: reelError } = await supabase
      .from('reels')
      .select('id, permalink, sync_status')
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId)
      .single();

    if (reelError || !reel) {
      return api404('Reel no encontrado');
    }

    // Obtener video_url del body o de la solicitud
    let videoUrl: string | null = null;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json() as { video_url?: string };
      videoUrl = body.video_url ?? null;
    }

    if (!videoUrl) {
      return api400('Se requiere video_url en el body. Asegúrate de tener la URL pública del MP4 del Reel (obtenida via Apify).');
    }

    // Ejecutar análisis con Gemini
    const t0 = Date.now();
    const { analysis, usage, model, complete, partialReason } = await analyzeVideoWithGemini(videoUrl);
    const latencyMs = Date.now() - t0;

    // If we got NOTHING usable (no transcript, not complete) the upstream provider
    // is fully down. Don't persist a fake skeleton — that would overwrite any
    // previous good analysis and mark the reel as "completed" with empty fields.
    // Surface a 503 so the client can keep showing "Reintentar" cleanly.
    if (!complete && analysis.transcript.trim().length === 0) {
      console.error(
        `[arkoai-analyze] reel=${id} all tiers failed without transcript: ${partialReason ?? 'unknown'}`,
      );
      return apiError(
        'Service Unavailable',
        'ArkoAI está saturado momentáneamente y no pudo analizar el video. Reintentá en unos minutos.',
        503,
        { reason: partialReason ?? 'unknown', model },
      );
    }

    if (!complete) {
      console.warn(
        `[arkoai-analyze] reel=${id} partial analysis from ${model}: ${partialReason ?? 'unknown'}`,
      );
    }

    await persistGeminiAnalysis({
      supabase,
      reelId: id,
      workspaceId: auth.workspaceId,
      analysis,
    });

    // Log LLM usage (non-blocking)
    logLLMUsage(supabase, {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      feature: 'arkoai-video-analysis',
      response: {
        text: '',
        toolCalls: [],
        provider: 'google',
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        stopReason: complete ? 'end' : 'error',
      },
      latencyMs,
    }).catch(() => {});

    return apiSuccess(
      complete
        ? { analysis }
        : { analysis, partial: true, partial_reason: partialReason ?? 'desconocido' },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[arkoai-analyze]', message);

    if (message.includes('API_KEY') || message.includes('ArkoAI no está configurado')) {
      return api400(message);
    }

    return api500(message);
  }
}
