/**
 * POST /api/v1/reels/[id]/gemini-analyze
 * Analiza un Reel con Gemini 1.5 Flash (visual + audio + transcripción).
 * Requiere video_url pública (Apify) en el body.
 */

// Vercel Pro hard cap is 300s. Tier 1 (2.5-flash) usually finishes under 90s,
// but if we fall through retries + tier 2 (2.5-pro, slower) + transcript rescue
// the worst case approaches 4 min. Keep the full headroom.
export const maxDuration = 300;

import { createClient } from '@/lib/supabase/server';
import { isAuthError } from '@/lib/api/auth';
import { requireFeature } from '@/lib/api/guard';
import { apiSuccess, api400, api404, apiError, api500 } from '@/lib/api/response';
import { persistGeminiAnalysis } from '@/services/gemini-analysis-persistence.service';
import { analyzeVideoWithGemini, isGeminiEnabled } from '@/services/gemini-video.service';
import { fetchApifyReelPublicData, isApifyReelEnrichmentEnabled } from '@/services/apify-reel.service';
import { logLLMUsage } from '@/services/llm-usage.service';

/**
 * La media_url de Meta (la que manda el front) es una URL firmada de scontent que
 * EXPIRA en horas/días. Si el reel se analiza después de que caducó, la descarga
 * del video falla con "descarga de video: 403 URL signature expired". Detectamos
 * ese caso para re-scrapear el reel por permalink y reintentar con una URL fresca.
 */
function isExpiredVideoUrlError(message: string): boolean {
  return (
    message.includes('descarga de video') &&
    (message.includes('403') || message.includes('410') || /expired|signature/i.test(message))
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isGeminiEnabled()) {
      return api400('ArkoAI no está configurado en el servidor. Falta la API key.');
    }

    const auth = await requireFeature(request, 'reelAiAnalysis');
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

    // Ejecutar análisis con Gemini. Si la media_url de Meta caducó (403 al
    // descargar el video), re-scrapeamos el reel por permalink (Apify devuelve una
    // URL fresca) y reintentamos UNA vez. Así el análisis no depende de cuán vieja
    // sea la media_url que viajó al cliente.
    const t0 = Date.now();
    let result: Awaited<ReturnType<typeof analyzeVideoWithGemini>>;
    try {
      result = await analyzeVideoWithGemini(videoUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (isExpiredVideoUrlError(message) && reel.permalink && isApifyReelEnrichmentEnabled()) {
        console.warn(`[arkoai-analyze] reel=${id} media_url caducada (${message.slice(0, 80)}) → re-scrape Apify`);
        const fresh = await fetchApifyReelPublicData(reel.permalink);
        if (!fresh?.video_url) {
          throw new Error('La URL del video caducó y no se pudo obtener una fresca (re-scrape sin video_url). Re-sincronizá el reel e intentá de nuevo.');
        }
        result = await analyzeVideoWithGemini(fresh.video_url);
      } else {
        throw err;
      }
    }
    const { analysis, usage, model, complete, partialReason } = result;
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

    console.log(
      `[arkoai-analyze] reel=${id} ${complete ? 'OK' : 'PARTIAL'} via ${model} in ${latencyMs}ms${complete ? '' : ` (${partialReason ?? 'unknown'})`}`,
    );

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
      {
        analysis,
        meta: {
          model,
          complete,
          latency_ms: latencyMs,
          ...(complete ? {} : { partial_reason: partialReason ?? 'desconocido' }),
        },
        // Kept for backwards-compat with any client that already reads these:
        ...(complete ? {} : { partial: true, partial_reason: partialReason ?? 'desconocido' }),
      },
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
