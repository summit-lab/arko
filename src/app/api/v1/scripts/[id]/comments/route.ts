/**
 * GET    /api/v1/scripts/[id]/comments  — Lista comentarios del guion
 * POST   /api/v1/scripts/[id]/comments  — Crea un comentario
 * PATCH  /api/v1/scripts/[id]/comments  — Resuelve/reabre un comentario (commentId en body)
 * DELETE /api/v1/scripts/[id]/comments  — Elimina un comentario (?commentId= en query)
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('script_comments')
      .select('id, author_name, text, resolved, created_at')
      .eq('content_plan_id', id)
      .eq('workspace_id', auth.workspaceId)
      .order('created_at', { ascending: true });

    if (error) return api500('Error cargando comentarios');
    return apiSuccess({ comments: data ?? [] });
  } catch {
    return api500('Error cargando comentarios');
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const body = await request.json() as { text?: string };

    if (!body.text?.trim()) return api400('El comentario no puede estar vacío');
    if (body.text.trim().length > 2000) return api400('El comentario es demasiado largo');

    const supabase = await createClient();

    // Obtener email del usuario para usarlo como nombre
    const { data: { user } } = await supabase.auth.getUser();
    const authorName = user?.email ?? 'Usuario';

    const { data, error } = await supabase
      .from('script_comments')
      .insert({
        content_plan_id: id,
        workspace_id: auth.workspaceId,
        user_id: auth.userId,
        author_name: authorName,
        text: body.text.trim(),
      })
      .select('id, author_name, text, resolved, created_at')
      .single();

    if (error) return api500('Error creando comentario');
    return apiSuccess({ comment: data });
  } catch {
    return api500('Error creando comentario');
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const body = await request.json() as { commentId?: string; resolved?: boolean };

    if (!body.commentId) return api400('Falta commentId');

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('script_comments')
      .update({ resolved: body.resolved ?? false })
      .eq('id', body.commentId)
      .eq('content_plan_id', id)
      .eq('workspace_id', auth.workspaceId)
      .select('id, author_name, text, resolved, created_at')
      .single();

    if (error) return api500('Error actualizando comentario');
    return apiSuccess({ comment: data });
  } catch {
    return api500('Error actualizando comentario');
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const url = new URL(request.url);
    const commentId = url.searchParams.get('commentId');

    if (!commentId) return api400('Falta commentId');

    const supabase = await createClient();

    const { error } = await supabase
      .from('script_comments')
      .delete()
      .eq('id', commentId)
      .eq('content_plan_id', id)
      .eq('workspace_id', auth.workspaceId);

    if (error) return api500('Error eliminando comentario');
    return apiSuccess({ deleted: true });
  } catch {
    return api500('Error eliminando comentario');
  }
}
