/**
 * POST /api/v1/script-changes/[id]/apply
 * Aplica el cambio propuesto: actualiza el content_plan con proposed_script/title
 * (lo que dispara el trigger de versionado automático), y marca la propuesta como `applied`.
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
      .select('id, content_plan_id, proposed_script, proposed_title, status')
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (!pending) return api400('Pending change not found');
    if (pending.status !== 'pending') return api400(`Cannot apply: status=${pending.status}`);

    // Aplicar al content_plan (el trigger guarda versión previa automáticamente)
    const updates: Record<string, unknown> = {};
    if (pending.proposed_script !== null) updates.script = pending.proposed_script;
    if (pending.proposed_title  !== null) updates.title  = pending.proposed_title;

    if (Object.keys(updates).length === 0) {
      return api400('Pending change has no proposed values');
    }

    const { data: updated, error: updateErr } = await supabase
      .from('content_plan')
      .update(updates)
      .eq('id', pending.content_plan_id)
      .eq('workspace_id', auth.workspaceId)
      .select('id, planned_date, title, platform, content_type, status, position, script, reference_url, raw_video_url, edited_video_url, source_type, source_ref, metrics, created_at, updated_at')
      .single();

    if (updateErr) return api500('Error aplicando el cambio');

    // Marcar pending como applied
    await supabase
      .from('content_plan_pending_changes')
      .update({ status: 'applied', resolved_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId);

    return apiSuccess({ item: updated, pendingId: id });
  } catch {
    return api500('Error aplicando el cambio');
  }
}
