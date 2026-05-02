/**
 * POST /api/v1/competitors/[id]/scrape
 * Scrapes a competitor's Instagram profile and recent reels via Apify.
 * Stores profile data in workspace_competitors.scraped_data
 * and reels in competitor_reels table.
 * Logs Apify costs to integration_usage.
 */

export const maxDuration = 120;

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';
import { scrapeCompetitor, isCompetitorScrapingEnabled } from '@/services/competitor-scraper.service';
import { logIntegrationUsage } from '@/services/integration-usage.service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    if (!isCompetitorScrapingEnabled()) {
      return api400('Apify API token not configured. Cannot scrape competitors.');
    }

    const { id: competitorId } = await params;
    const supabase = await createClient();

    // Helper para resetear el estado — se llama SIEMPRE al final (success o error)
    // para que el status no quede pegado en "analyzing" si algo falla silencioso.
    // Ojo: NO limpiamos scrape_progress aquí. El endpoint /analyze (que corre
    // después en background) puede seguir escribiendo progress; dejarlo con el
    // último valor de "scrape done" es la UX correcta hasta que el analyze
    // termine y limpie su propia progress.
    const resetStatus = async () => {
      await supabase
        .from('workspace_competitors')
        .update({ analysis_status: 'idle', analysis_started_at: null })
        .eq('id', competitorId)
        .eq('workspace_id', auth.workspaceId);
    };

    // Mark as analyzing. analysis_started_at lo lee el watchdog de pg_cron
    // para distinguir scrapes legítimos en curso (<10min) de rows stuck.
    await supabase
      .from('workspace_competitors')
      .update({ analysis_status: 'analyzing', analysis_started_at: new Date().toISOString() })
      .eq('id', competitorId)
      .eq('workspace_id', auth.workspaceId);

    let result: Awaited<ReturnType<typeof scrapeCompetitor>>;
    const startMs = Date.now();
    try {
      result = await scrapeCompetitor(supabase, competitorId, auth.workspaceId);
    } catch (err) {
      // Scrape crasheó inesperado — resetear status y propagar error.
      await resetStatus();
      throw err;
    }
    const latencyMs = Date.now() - startMs;

    if (result.error) {
      await resetStatus();

      // Log failed scrape attempt
      await logIntegrationUsage(supabase, {
        workspaceId: auth.workspaceId,
        userId: auth.userId,
        feature: 'competitor-scraping',
        provider: 'apify',
        operation: 'competitor-profile-scrape',
        itemsCount: 0,
        latencyMs,
        status: 'error',
        metadata: { competitorId, error: result.error },
      });
      return api400(result.error);
    }

    // Happy path — resetear status ANTES del return (bug previo: se quedaba
    // pegado en "analyzing" para siempre porque el success path no reseteaba).
    await resetStatus();

    // Si no hay reels para analizar, también limpiamos scrape_progress acá
    // para que el overlay no quede colgado mostrando "Scrape terminado: 0 reels"
    // a 110% indefinidamente. Cuando hay reels, el analyze corre después y
    // se encarga de limpiar su propio scrape_progress al terminar.
    if (result.reelsInserted === 0) {
      await supabase
        .from('workspace_competitors')
        .update({ scrape_progress: null })
        .eq('id', competitorId)
        .eq('workspace_id', auth.workspaceId);
    }

    // Log profile scrape cost
    await logIntegrationUsage(supabase, {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      feature: 'competitor-scraping',
      provider: 'apify',
      operation: 'competitor-profile-scrape',
      itemsCount: result.profile ? 1 : 0,
      latencyMs,
      status: 'success',
      metadata: { competitorId },
    });

    // Log reels scrape cost (per reel)
    if (result.reelsInserted > 0) {
      await logIntegrationUsage(supabase, {
        workspaceId: auth.workspaceId,
        userId: auth.userId,
        feature: 'competitor-scraping',
        provider: 'apify',
        operation: 'competitor-reel-scrape',
        itemsCount: result.reels.length,
        latencyMs,
        status: 'success',
        metadata: { competitorId, reelsFound: result.reels.length, reelsInserted: result.reelsInserted },
      });
    }

    return apiSuccess({
      profile: result.profile,
      reels_found: result.reels.length,
      reels_inserted: result.reelsInserted,
    });
  } catch (error) {
    console.error('[competitors/scrape] Error:', error);
    return api500('Error scraping competitor');
  }
}
