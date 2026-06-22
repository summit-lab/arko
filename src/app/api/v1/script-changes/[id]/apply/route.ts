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

    // CAS atómico: marcamos como applied solo si todavía está pending y no expiró.
    // Si dos clicks llegan en paralelo, solo uno gana — el otro recibe rowCount=0.
    const nowIso = new Date().toISOString();
    const { data: claimed, error: claimErr } = await supabase
      .from('content_plan_pending_changes')
      .update({ status: 'applied', resolved_at: nowIso })
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .select('id, content_plan_id, proposed_script, proposed_title')
      .maybeSingle();

    if (claimErr) return api500('Error reservando la propuesta');
    if (!claimed) {
      // Otra request lo agarró antes, o ya estaba applied/rejected/expired.
      return api400('Cannot apply: already resolved or expired');
    }

    // Aplicar al content_plan (el trigger guarda versión previa automáticamente)
    const updates: Record<string, unknown> = {};
    if (claimed.proposed_script !== null) updates.script = claimed.proposed_script;
    if (claimed.proposed_title  !== null) updates.title  = claimed.proposed_title;

    if (Object.keys(updates).length === 0) {
      // Revert el claim (raro: pending sin valores propuestos)
      await supabase
        .from('content_plan_pending_changes')
        .update({ status: 'rejected', resolved_at: nowIso })
        .eq('id', id);
      return api400('Pending change has no proposed values');
    }

    const { data: updated, error: updateErr } = await supabase
      .from('content_plan')
      .update(updates)
      .eq('id', claimed.content_plan_id)
      .eq('workspace_id', auth.workspaceId)
      .select('id, planned_date, title, platform, content_type, status, position, script, reference_url, raw_video_url, edited_video_url, source_type, source_ref, metrics, created_at, updated_at')
      .single();

    if (updateErr) {
      // Revert claim si el UPDATE final falla (consistency)
      await supabase
        .from('content_plan_pending_changes')
        .update({ status: 'pending', resolved_at: null })
        .eq('id', id);
      return api500('Error aplicando el cambio');
    }

    return apiSuccess({ item: updated, pendingId: id });
  } catch {
    return api500('Error aplicando el cambio');
  }
}
