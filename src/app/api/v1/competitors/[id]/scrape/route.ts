/**
 * POST /api/v1/competitors/[id]/scrape
 * Dispara el scrape (Apify) + análisis (Gemini) de un competidor y responde AL
 * INSTANTE (fire-and-forget). El trabajo pesado corre en after().
 *
 * Antes corría TODO sincrónico (~120s): el gateway de Vercel cortaba la respuesta
 * con un 504 en texto plano ("An error occurred...") y el cliente crasheaba al
 * hacer res.json() → "Unexpected token 'A'... is not valid JSON" — aunque el
 * scrape sí hubiera arrancado. Ahora el cliente solo dispara y pollea el
 * progreso (scrape_progress / analysis_status); cuando termina, refresca.
 */

export const maxDuration = 300; // cubre scrape (~120s) + analyze (~90s) en after()

import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAuthError } from '@/lib/api/auth';
import { requireFeature } from '@/lib/api/guard';
import { assertCredits } from '@/lib/api/credit-guard';
import { apiSuccess, api400, api500 } from '@/lib/api/response';
import { scrapeCompetitor, isCompetitorScrapingEnabled } from '@/services/competitor-scraper.service';
import { analyzeCompetitorReels } from '@/services/competitor-analysis.service';
import { logIntegrationUsage } from '@/services/integration-usage.service';
import { calculateCost } from '@/services/llm-usage.service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireFeature(request, 'competitors');
    if (isAuthError(auth)) return auth;

    if (!isCompetitorScrapingEnabled()) {
      return api400('Apify API token not configured. Cannot scrape competitors.');
    }

    const { id: competitorId } = await params;
    const supabase = await createClient();

    const over = await assertCredits(supabase, auth);
    if (over) return over;

    // Marcar 'analyzing' YA (rápido). analysis_started_at lo lee el watchdog
    // pg_cron para distinguir runs legítimas en curso de rows stuck.
    await supabase
      .from('workspace_competitors')
      .update({ analysis_status: 'analyzing', analysis_started_at: new Date().toISOString() })
      .eq('id', competitorId)
      .eq('workspace_id', auth.workspaceId);

    // ── Background: scrape + analyze, sin bloquear la respuesta ──
    after(async () => {
      const resetStatus = async () => {
        await supabase
          .from('workspace_competitors')
          .update({ analysis_status: 'idle', analysis_started_at: null })
          .eq('id', competitorId)
          .eq('workspace_id', auth.workspaceId);
      };

      const startMs = Date.now();
      try {
        const result = await scrapeCompetitor(supabase, competitorId, auth.workspaceId);
        const latencyMs = Date.now() - startMs;

        if (result.error) {
          // Estado de error VISIBLE para el cliente: idle + scrape_progress
          // phase 'error' con copy amigable (el detalle técnico va SOLO al log).
          // Antes esto quedaba como "éxito con 0 reels" y el cliente veía
          // "Analizando..." colgado sin explicación. La UI muestra el banner
          // y ack-ea con DELETE para que no re-aparezca.
          await supabase
            .from('workspace_competitors')
            .update({
              analysis_status: 'idle',
              analysis_started_at: null,
              scrape_progress: {
                phase: 'error',
                message: 'No pudimos actualizar este competidor. Reintentá en unos minutos.',
              },
            })
            .eq('id', competitorId)
            .eq('workspace_id', auth.workspaceId);
          await logIntegrationUsage(supabase, {
            workspaceId: auth.workspaceId, userId: auth.userId,
            feature: 'competitor-scraping', provider: 'apify', operation: 'competitor-profile-scrape',
            itemsCount: 0, latencyMs, status: 'error',
            metadata: { competitorId, error: result.error },
          });
          return;
        }

        // Log profile scrape
        await logIntegrationUsage(supabase, {
          workspaceId: auth.workspaceId, userId: auth.userId,
          feature: 'competitor-scraping', provider: 'apify', operation: 'competitor-profile-scrape',
          itemsCount: result.profile ? 1 : 0, latencyMs, status: 'success',
          metadata: { competitorId },
        });

        if (result.reelsInserted > 0) {
          // Log reels scrape
          await logIntegrationUsage(supabase, {
            workspaceId: auth.workspaceId, userId: auth.userId,
            feature: 'competitor-scraping', provider: 'apify', operation: 'competitor-reel-scrape',
            itemsCount: result.reels.length, latencyMs, status: 'success',
            metadata: { competitorId, reelsFound: result.reels.length, reelsInserted: result.reelsInserted },
          });

          // Encadenar el análisis (antes lo disparaba el cliente con un 2º fetch;
          // ahora va server-side para que sea robusto aun si el cliente cerró).
          try {
            const aStart = Date.now();
            const results = await analyzeCompetitorReels(supabase, competitorId, auth.workspaceId);
            const aLatency = Date.now() - aStart;
            for (const r of results.filter((x) => x.success && x.tokensUsed > 0)) {
              const estIn = Math.round(r.tokensUsed * 0.85);
              const estOut = r.tokensUsed - estIn;
              await supabase.from('llm_usage').insert({
                workspace_id: auth.workspaceId, user_id: auth.userId,
                feature: 'competitor-analysis', provider: 'google', model: 'gemini-2.5-flash',
                input_tokens: estIn, output_tokens: estOut, total_tokens: r.tokensUsed,
                cost_usd: calculateCost('gemini-2.5-flash', estIn, estOut),
                latency_ms: Math.round(aLatency / Math.max(results.length, 1)),
              });
            }
          } catch (e) {
            console.error('[competitors/scrape] background analyze failed:', e);
          }
          await resetStatus();
        } else {
          // 0 reels → limpiar el overlay de progress + reset
          await supabase
            .from('workspace_competitors')
            .update({ scrape_progress: null })
            .eq('id', competitorId)
            .eq('workspace_id', auth.workspaceId);
          await resetStatus();
        }
      } catch (err) {
        console.error('[competitors/scrape] background error:', err);
        await resetStatus();
      }
    });

    // Respuesta inmediata: el cliente pollea scrape_progress / analysis_status.
    return apiSuccess({ status: 'started' });
  } catch (error) {
    console.error('[competitors/scrape] Error:', error);
    return api500('Error scraping competitor');
  }
}

/**
 * DELETE /api/v1/competitors/[id]/scrape
 * Ack del estado de error: la UI ya mostró el banner y limpia el
 * scrape_progress persistido para que el error no re-aparezca en el próximo
 * load/poll. Solo limpia si NO hay un run activo (analysis_status='idle').
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireFeature(request, 'competitors');
    if (isAuthError(auth)) return auth;

    const { id: competitorId } = await params;
    const supabase = await createClient();

    await supabase
      .from('workspace_competitors')
      .update({ scrape_progress: null })
      .eq('id', competitorId)
      .eq('workspace_id', auth.workspaceId)
      .eq('analysis_status', 'idle');

    return apiSuccess({ cleared: true });
  } catch (error) {
    console.error('[competitors/scrape] DELETE Error:', error);
    return api500('Error clearing scrape state');
  }
}
