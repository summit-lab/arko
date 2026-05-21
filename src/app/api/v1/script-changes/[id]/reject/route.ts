/**
 * POST /api/v1/script-changes/[id]/reject
 * Marca la propuesta como `rejected`. No toca el content_plan.
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id } = await context.params;
    if (!id) return api400('id is required');

    const supabase = await createClient();

    const { data: pending } = await supabase
      .from('content_plan_pending_changes')
      .select('id, status')
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (!pending) return api400('Pending change not found');
    if (pending.status !== 'pending') return api400(`Cannot reject: status=${pending.status}`);

    const { error } = await supabase
      .from('content_plan_pending_changes')
      .update({ status: 'rejected', resolved_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId);

    if (error) return api500('Error descartando el cambio');

    return apiSuccess({ pendingId: id });
  } catch {
    return api500('Error descartando el cambio');
  }
}
