/**
 * GET /api/v1/content-plan/[id]/versions — Lista las versiones anteriores de un script.
 *
 * Devuelve hasta 50 versiones ordenadas por fecha desc.
 * El versionado lo genera automáticamente el trigger snapshot_content_plan_version.
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id } = await context.params;
    if (!id) return api400('id is required');

    const supabase = await createClient();

    // Verificar ownership del item
    const { data: item } = await supabase
      .from('content_plan')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (!item) return api400('Item not found');

    const { data, error } = await supabase
      .from('content_plan_versions')
      .select('id, title, script, changed_by_kind, change_reason, source_session, created_at')
      .eq('content_plan_id', id)
      .eq('workspace_id', auth.workspaceId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return api500('Error cargando versiones');
    return apiSuccess({ versions: data ?? [] });
  } catch {
    return api500('Error cargando versiones');
  }
}
