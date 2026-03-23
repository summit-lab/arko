import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { api404, api500, apiSuccess } from '@/lib/api/response';

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const supabase = await createClient();

    const { data: existingConnection, error: existingConnectionError } = await supabase
      .from('meta_connections')
      .select('id')
      .eq('workspace_id', auth.workspaceId)
      .single();

    if (existingConnectionError || !existingConnection) {
      return api404('No hay una conexión de Meta para desconectar en este workspace.');
    }

    const { error } = await supabase
      .from('meta_connections')
      .update({
        access_token_encrypted: null,
        token_expires_at: null,
        fb_user_id: null,
        page_id: null,
        page_name: null,
        page_access_token_enc: null,
        ig_business_account_id: null,
        ig_username: null,
        ad_account_ids: [],
        permissions_granted: [],
        status: 'revoked',
        last_error: null,
        last_validated_at: null,
      })
      .eq('workspace_id', auth.workspaceId);

    if (error) {
      console.error('[auth/meta/disconnect] Error:', error);
      return api500('No pudimos desconectar la cuenta de Meta.');
    }

    return apiSuccess({
      status: 'disconnected',
    });
  } catch (error) {
    console.error('[auth/meta/disconnect] Unhandled error:', error);
    return api500('No pudimos desconectar la cuenta de Meta.');
  }
}
