/**
 * GET /api/v1/competitors/[id]
 * Lightweight endpoint used by the UI to poll live scrape/analyze progress.
 * Returns only {analysis_status, scrape_progress, last_scraped_at} so we
 * can refetch every 2s without the cost of the full /competitors payload.
 *
 * DELETE /api/v1/competitors/[id]
 * Deja de seguir al competidor (botón "Eliminar" de la tab Competencia).
 * El ON DELETE CASCADE limpia sus reels, análisis y snapshots.
 */

import { createClient } from '@/lib/supabase/server';
import { isAuthError } from '@/lib/api/auth';
import { requireFeature } from '@/lib/api/guard';
import { apiSuccess, api400, api500 } from '@/lib/api/response';
import { invalidateWorkspaceCache } from '@/services/arko-ai-context';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireFeature(request, 'competitors');
    if (isAuthError(auth)) return auth;

    const { id: competitorId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('workspace_competitors')
      .select('id, analysis_status, scrape_progress, last_scraped_at')
      .eq('id', competitorId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (error) {
      console.error('[competitors/[id]] Supabase error:', error.message, error.code, error.details);
      return api500(`DB error: ${error.message}`);
    }
    if (!data) return api400('Competitor not found');

    return apiSuccess(data);
  } catch (error) {
    console.error('[competitors/[id]] GET Error:', error instanceof Error ? error.stack : error);
    return api500(error instanceof Error ? error.message : 'Error loading competitor status');
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireFeature(request, 'competitors');
    if (isAuthError(auth)) return auth;

    const { id: competitorId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('workspace_competitors')
      .delete()
      .eq('id', competitorId)
      .eq('workspace_id', auth.workspaceId)
      .select('id');

    if (error) {
      console.error('[competitors/[id]] DELETE error:', error.message, error.code);
      return api500('Error eliminando competidor');
    }
    if (!data || data.length === 0) return api400('Competitor not found');

    // El ADN (contexto de Moka) incluye a los competidores.
    invalidateWorkspaceCache(auth.workspaceId);

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error('[competitors/[id]] DELETE Error:', error instanceof Error ? error.stack : error);
    return api500('Error eliminando competidor');
  }
}
