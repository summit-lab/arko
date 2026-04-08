/**
 * DELETE /api/v1/references/[id] — Elimina una referencia
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from('workspace_references')
      .delete()
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId);

    if (error) return api500('Error eliminando referencia');

    return apiSuccess({ deleted: id });
  } catch {
    return api400('Error eliminando referencia');
  }
}
