/**
 * POST /api/settings/dm-tracking/delete
 *
 * User-initiated wipe of DM conversation data for a single meta_connection.
 * Removes every row in `ig_conversation_events` and `ig_daily_conversations`
 * for that connection. The connection itself stays intact — only the
 * conversation history is cleared.
 *
 * Body: { meta_connection_id: string }
 */

import { createClient } from '@/lib/supabase/server';
import { apiSuccess, api400, api401, api403, api500 } from '@/lib/api/response';

interface RequestBody {
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
    const metaConnectionId =
      typeof body.meta_connection_id === 'string' ? body.meta_connection_id : null;

    if (!metaConnectionId) {
      return api400('Falta meta_connection_id');
    }

    const { data: connection, error: connError } = await supabase
      .from('meta_connections')
      .select('id, workspace_id')
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

    // DELETE children first so row-counts stay meaningful in logs.
    const { data: deletedEvents, error: eventsError } = await supabase
      .from('ig_conversation_events')
      .delete()
      .eq('meta_connection_id', connection.id)
      .eq('workspace_id', connection.workspace_id)
      .select('id');

    if (eventsError) {
      console.error('[settings/dm-tracking/delete] events delete failed', eventsError);
      return api500('No pudimos eliminar los eventos de DMs');
    }

    const { data: deletedDaily, error: dailyError } = await supabase
      .from('ig_daily_conversations')
      .delete()
      .eq('meta_connection_id', connection.id)
      .eq('workspace_id', connection.workspace_id)
      .select('date');

    if (dailyError) {
      console.error('[settings/dm-tracking/delete] daily delete failed', dailyError);
      return api500('No pudimos eliminar el agregado diario de DMs');
    }

    return apiSuccess({
      events_deleted: deletedEvents?.length ?? 0,
      daily_rows_deleted: deletedDaily?.length ?? 0,
    });
  } catch (err) {
    console.error('[settings/dm-tracking/delete] unhandled error', err);
    return api500();
  }
}
