/**
 * GET /api/v1/chat/sessions — List chat sessions for workspace
 * DELETE /api/v1/chat/sessions?id=xxx — Delete a session
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const supabase = await createClient();

    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, updated_at')
      .eq('workspace_id', auth.workspaceId)
      .eq('is_active', true)
      .neq('title', 'ADN de Comunicación')
      .order('updated_at', { ascending: false })
      .limit(50);

    return apiSuccess(sessions ?? []);
  } catch (err) {
    console.error('[chat/sessions] GET error:', err);
    return api500();
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const url = new URL(request.url);
    const sessionId = url.searchParams.get('id');

    if (!sessionId) {
      return api400('id is required');
    }

    const supabase = await createClient();

    // Soft-delete: mark as inactive
    const { error } = await supabase
      .from('chat_sessions')
      .update({ is_active: false })
      .eq('id', sessionId)
      .eq('workspace_id', auth.workspaceId);

    if (error) {
      console.error('[chat/sessions] DELETE error:', error);
      return api500();
    }

    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error('[chat/sessions] DELETE error:', err);
    return api500();
  }
}
