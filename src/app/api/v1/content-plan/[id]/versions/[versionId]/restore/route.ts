/**
 * POST /api/v1/content-plan/[id]/versions/[versionId]/restore
 * Restaura el script (y opcionalmente el title) del item al estado de esa versión.
 * El UPDATE genera automáticamente una nueva versión via trigger, así no se pierde
 * el estado actual al restaurar.
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';

interface RouteContext {
  params: Promise<{ id: string; versionId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id, versionId } = await context.params;
    if (!id || !versionId) return api400('id and versionId are required');

    const body = await request.json().catch(() => ({}));
    const restoreTitle = body?.restoreTitle === true;

    const supabase = await createClient();

    const { data: version } = await supabase
      .from('content_plan_versions')
      .select('title, script')
      .eq('id', versionId)
      .eq('content_plan_id', id)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (!version) return api400('Version not found');

    const updates: Record<string, unknown> = { script: version.script ?? '' };
    if (restoreTitle && version.title) updates.title = version.title;

    const { data, error } = await supabase
      .from('content_plan')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId)
      .select('id, planned_date, title, platform, content_type, status, position, script, reference_url, raw_video_url, edited_video_url, source_type, source_ref, metrics, created_at, updated_at')
      .single();

    if (error) return api500('Error restaurando versión');
    return apiSuccess({ item: data });
  } catch {
    return api500('Error restaurando versión');
  }
}
