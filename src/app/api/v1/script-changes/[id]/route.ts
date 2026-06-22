/**
 * POST /api/v1/script-changes/[id]/apply  — Aplica una propuesta de cambio de script
 * POST /api/v1/script-changes/[id]/reject — Descarta una propuesta de cambio
 *
 * Las propuestas las crea Moka via la tool `propose_script_change`. Mientras
 * están en estado `pending`, el usuario las ve en un modal con diff. Al aplicar
 * o rechazar, se marca el estado y se actualiza el content_plan si aplica.
 *
 * GET /api/v1/script-changes/[id] — Obtiene los detalles de una propuesta.
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
    const { data, error } = await supabase
      .from('content_plan_pending_changes')
      .select('id, content_plan_id, base_script, base_title, proposed_script, proposed_title, rationale, status, created_at, expires_at')
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (error) return api500('Error cargando propuesta');
    if (!data) return api400('Pending change not found');
    return apiSuccess({ pending: data });
  } catch {
    return api500('Error cargando propuesta');
  }
}
