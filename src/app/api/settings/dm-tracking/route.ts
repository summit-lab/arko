/**
 * POST /api/settings/dm-tracking
 *
 * Enables or disables Instagram DM-event webhook tracking for a single
 * meta_connection. Called from the /settings/integrations page toggle.
 *
 * Body: { action: 'enable' | 'disable', meta_connection_id: string }
 *
 * Enable flow:
 *   1. Verify the caller owns the workspace that owns the connection.
 *   2. Decrypt the stored Meta access token via RPC.
 *   3. POST /{ig_user_id}/subscribed_apps to subscribe the app.
 *   4. Flag `webhook_subscribed=true` (handled by the service).
 *
 * Disable flow:
 *   1. Verify access.
 *   2. DELETE /{ig_user_id}/subscribed_apps to unsubscribe.
 *   3. Flag `webhook_subscribed=false`, clear `webhook_subscribed_at`.
 */

import { createClient } from '@/lib/supabase/server';
import { apiSuccess, api400, api401, api403, api500 } from '@/lib/api/response';
import { env } from '@/lib/env';
import { subscribeIgAccountToWebhook } from '@/services/ig-webhook-subscription.service';

const GRAPH_API_VERSION = 'v25.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface RequestBody {
  action?: unknown;
  meta_connection_id?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return api401();
    }

    const body = (await request.json()) as RequestBody;
    const action = typeof body.action === 'string' ? body.action : null;
    const metaConnectionId =
      typeof body.meta_connection_id === 'string' ? body.meta_connection_id : null;

    if (!metaConnectionId) {
      return api400('Falta meta_connection_id');
    }
    if (action !== 'enable' && action !== 'disable') {
      return api400('action debe ser "enable" o "disable"');
    }

    // Fetch connection and verify workspace ownership in one go.
    const { data: connection, error: connError } = await supabase
      .from('meta_connections')
      .select('id, workspace_id, ig_business_account_id, status')
      .eq('id', metaConnectionId)
      .single();

    if (connError || !connection) {
      return api403('No tenés acceso a esta conexión');
    }

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', connection.workspace_id)
      .eq('owner_id', user.id)
      .single();

    if (wsError || !workspace) {
      return api403('No tenés acceso a esta conexión');
    }

    if (!connection.ig_business_account_id) {
      return api400('La conexión no tiene una cuenta de IG Business asociada');
    }

    if (!env.META_TOKENS_ENCRYPTION_KEY) {
      console.error('[settings/dm-tracking] META_TOKENS_ENCRYPTION_KEY missing');
      return api500('Servidor no configurado');
    }

    // Decrypt the access token (RPC already scopes by workspace_id).
    const { data: tokenData, error: tokenError } = await supabase.rpc(
      'get_meta_access_token',
      {
        p_workspace_id: connection.workspace_id,
        p_encryption_key: env.META_TOKENS_ENCRYPTION_KEY,
      }
    );

    if (tokenError) {
      console.error('[settings/dm-tracking] token decrypt failed', tokenError);
      return api500('No se pudo leer el token de Meta');
    }

    const accessToken = typeof tokenData === 'string' ? tokenData : null;
    if (!accessToken) {
      return api400('La conexión no tiene un token válido. Reconectá la cuenta.');
    }

    if (action === 'enable') {
      const result = await subscribeIgAccountToWebhook({
        id: connection.id,
        ig_user_id: connection.ig_business_account_id,
        access_token: accessToken,
      });

      if (!result.ok) {
        return api400(
          result.error ?? 'No pudimos activar el seguimiento de DMs. Reintentalo más tarde.'
        );
      }

      return apiSuccess({ webhook_subscribed: true });
    }

    // action === 'disable'
    const unsubUrl = new URL(
      `${GRAPH_BASE}/${connection.ig_business_account_id}/subscribed_apps`
    );
    unsubUrl.searchParams.set('access_token', accessToken);

    let metaResponse: Response;
    try {
      metaResponse = await fetch(unsubUrl.toString(), { method: 'DELETE' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[settings/dm-tracking] unsubscribe fetch failed', {
        id: connection.id,
        error: message,
      });
      return api500('No pudimos contactar a Meta');
    }

    if (!metaResponse.ok) {
      const errBody = await metaResponse.text();
      console.error('[settings/dm-tracking] unsubscribe returned error', {
        id: connection.id,
        status: metaResponse.status,
        body: errBody,
      });
      return api400(errBody || `Meta respondió ${metaResponse.status}`);
    }

    const { error: updateError } = await supabase
      .from('meta_connections')
      .update({
        webhook_subscribed: false,
        webhook_subscribed_at: null,
      })
      .eq('id', connection.id);

    if (updateError) {
      console.error('[settings/dm-tracking] flag update failed', updateError);
      return api500('No pudimos guardar el estado de la suscripción');
    }

    return apiSuccess({ webhook_subscribed: false });
  } catch (err) {
    console.error('[settings/dm-tracking] unhandled error', err);
    return api500();
  }
}
