/**
 * GET    /api/v1/scripts/[id]/comments  — Lista comentarios del guion
 * POST   /api/v1/scripts/[id]/comments  — Crea un comentario anclado a un rango del documento
 * PATCH  /api/v1/scripts/[id]/comments  — Resuelve/reabre un comentario
 * DELETE /api/v1/scripts/[id]/comments  — Elimina un comentario
 *
 * Cada comentario opcionalmente trae `comment_id` (un UUID que matchea la marca
 * TipTap `data-comment-id` en el HTML del editor) + `anchor_quoted` (snapshot del
 * texto comentado). Si el usuario borra el texto del editor, la marca desaparece,
 * el comentario queda "huérfano" (sigue visible en el panel sin ancla).
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';

const COMMENT_SELECT = 'id, author_name, user_id, text, resolved, comment_id, anchor_quoted, created_at';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('script_comments')
      .select(COMMENT_SELECT)
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
    const body = await request.json() as {
      text?: string;
      commentId?: string;       // UUID que va en la marca TipTap
      anchorQuoted?: string;    // texto citado al crear el comentario
    };

    const text = body.text?.trim();
    if (!text) return api400('El comentario no puede estar vacío');
    if (text.length > 2000) return api400('El comentario es demasiado largo');

    const supabase = await createClient();

    // Tenant isolation: validar que el content_plan_id pertenezca al workspace.
    // Sin esto, un atacante podría crear comentarios contra items de otros workspaces
    // (RLS de content_plan no aplica al INSERT sobre script_comments).
    const { data: parent } = await supabase
      .from('content_plan')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();
    if (!parent) return api400('Script not found');

    // Obtener nombre del usuario desde profiles (mejor que el email)
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', auth.userId)
      .maybeSingle();

    const authorName = (profile?.full_name as string | null)
      ?? (profile?.email as string | null)
      ?? 'Usuario';

    const insert: Record<string, unknown> = {
      content_plan_id: id,
      workspace_id: auth.workspaceId,
      user_id: auth.userId,
      author_name: authorName,
      text,
    };
    if (body.commentId && typeof body.commentId === 'string') insert.comment_id = body.commentId;
    if (body.anchorQuoted && typeof body.anchorQuoted === 'string') {
      // Truncamos para que no sea gigante (caso: usuario selecciona el documento entero)
      insert.anchor_quoted = body.anchorQuoted.slice(0, 500);
    }

    const { data, error } = await supabase
      .from('script_comments')
      .insert(insert)
      .select(COMMENT_SELECT)
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
      .select(COMMENT_SELECT)
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
