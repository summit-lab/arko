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

    // CAS atómico igual que apply
    const { data: rejected, error } = await supabase
      .from('content_plan_pending_changes')
      .update({ status: 'rejected', resolved_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (error) return api500('Error descartando el cambio');
    if (!rejected) return api400('Cannot reject: already resolved');

    return apiSuccess({ pendingId: id });
  } catch {
    return api500('Error descartando el cambio');
  }
}
