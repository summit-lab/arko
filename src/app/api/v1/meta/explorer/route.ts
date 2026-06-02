/**
 * POST /api/v1/meta/explorer
 * Meta Graph API Explorer — proxy authenticated requests to Meta Graph API
 * Returns raw JSON response for debugging and discovery.
 *
 * Body: { path: string, params?: Record<string, string> }
 * Example: { path: "/{ig_account_id}/media", params: { fields: "id,caption,video_duration", limit: "5" } }
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';
import { env } from '@/lib/env';
import { GRAPH_BASE } from '@/lib/meta/constants';

// NOTA: este endpoint es un proxy de DEBUG: su propósito es devolver el JSON
// CRUDO de Meta tal cual (incluido cuando Meta responde un error) + meta_status,
// elapsed_ms y resolved_url. Por eso NO usa metaFetch() del cliente Meta (que
// lanza MetaApiError ante errores de Graph): acá queremos exponer el error, no
// tirarlo. Sí usamos GRAPH_BASE centralizado para no duplicar la versión.

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json() as {
      path?: string;
      params?: Record<string, string>;
    };

    if (!body.path || typeof body.path !== 'string') {
      return api400('Se requiere "path" (ej: "/{ig_account_id}/media")');
    }

    const supabase = await createClient();

    // Get Meta connection
    const { data: connection } = await supabase
      .from('meta_connections')
      .select('ig_business_account_id, ig_username, fb_user_id, page_id, page_name')
      .eq('workspace_id', auth.workspaceId)
      .eq('status', 'active')
      .single();

    if (!connection) {
      return api400('No hay conexión de Meta activa para este workspace.');
    }

    // Decrypt token
    const { data: tokenData } = await supabase.rpc('get_meta_access_token', {
      p_workspace_id: auth.workspaceId,
      p_encryption_key: env.META_TOKENS_ENCRYPTION_KEY!,
    });

    const accessToken = tokenData as string;
    if (!accessToken) {
      return api400('No se pudo desencriptar el access token.');
    }

    // Replace placeholders in path
    let resolvedPath = body.path
      .replace(/\{ig_account_id\}/g, connection.ig_business_account_id || '')
      .replace(/\{fb_user_id\}/g, connection.fb_user_id || '')
      .replace(/\{fb_page_id\}/g, connection.page_id || '')
      .replace(/\{page_id\}/g, connection.page_id || '');

    // Ensure path starts with /
    if (!resolvedPath.startsWith('/')) {
      resolvedPath = `/${resolvedPath}`;
    }

    // Build URL with params
    const url = new URL(`${GRAPH_BASE}${resolvedPath}`);
    url.searchParams.set('access_token', accessToken);

    if (body.params) {
      for (const [key, value] of Object.entries(body.params)) {
        url.searchParams.set(key, value);
      }
    }

    // Execute request to Meta
    const t0 = Date.now();
    const metaRes = await fetch(url.toString(), { cache: 'no-store' });
    const elapsed = Date.now() - t0;
    const metaJson = await metaRes.json() as unknown;

    return apiSuccess({
      meta_status: metaRes.status,
      elapsed_ms: elapsed,
      resolved_url: url.toString().replace(accessToken, '***TOKEN***'),
      connection_context: {
        ig_business_account_id: connection.ig_business_account_id,
        ig_username: connection.ig_username,
        fb_user_id: connection.fb_user_id,
        page_id: connection.page_id,
        page_name: connection.page_name,
      },
      response: metaJson,
    });
  } catch (err) {
    console.error('[meta/explorer] Error:', err);
    return api500();
  }
}
