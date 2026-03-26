/**
 * GET /api/v1/chat/messages?session_id=xxx
 * Load messages for a chat session.
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id');

    if (!sessionId) {
      return api400('session_id is required');
    }

    const supabase = await createClient();

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('session_id', sessionId)
      .eq('workspace_id', auth.workspaceId)
      .order('created_at', { ascending: true });

    return apiSuccess(messages ?? []);
  } catch (err) {
    console.error('[chat/messages] GET error:', err);
    return api500();
  }
}
