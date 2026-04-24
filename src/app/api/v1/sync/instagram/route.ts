/**
 * POST /api/v1/sync/instagram
 * Thin proxy that authenticates the user and delegates heavy sync work
 * to a Supabase Edge Function (free, no Vercel function costs).
 *
 * Query: ?steps=quick|all|media|account|check
 *
 * steps=quick  → Syncs latest 12 media + insights (~3-5s), returns fast
 * steps=all    → Full sync (all media, ads, account insights, benchmarks)
 * steps=check  → Just checks if there are new media items (~1-2s)
 */

import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api500 } from '@/lib/api/response';
import { env } from '@/lib/env';
import { generateMissingTitles } from '@/services/reel-titles.service';

interface EdgeErrorContext {
  status?: number;
  body?: unknown;
}

/** Extract the structured error body from a FunctionsHttpError. The Supabase
 *  SDK stores the raw Response in `error.context`; we read its body so that
 *  distinct error codes (TOKEN_EXPIRED, rate_limit, etc.) can reach the UI. */
async function readEdgeError(err: unknown): Promise<EdgeErrorContext> {
  const ctx = (err as { context?: Response })?.context;
  if (!ctx || typeof ctx !== 'object') return {};
  const status = typeof (ctx as Response).status === 'number' ? (ctx as Response).status : undefined;
  try {
    const clone = (ctx as Response).clone ? (ctx as Response).clone() : (ctx as Response);
    const text = await clone.text();
    if (!text) return { status };
    try {
      return { status, body: JSON.parse(text) };
    } catch {
      return { status, body: text };
    }
  } catch {
    return { status };
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const url = new URL(request.url);
    const steps = url.searchParams.get('steps') || 'all';

    const supabase = await createClient();
    const syncHeaders = { 'x-sync-secret': env.SYNC_SECRET ?? '' };

    // Heavy syncs (full, media, account, ads) tardan 100-180s — superan el
    // timeout default del fetch del browser (60s Chrome, 120s Firefox) y la
    // UI veía "Sync falló (504)" aunque el server completara bien.
    //
    // Fix: para heavy syncs, fire-and-forget. El cliente ya tiene
    // `useSyncJobProgress` que pollea /api/v1/sync/status cada 4s y trackea
    // el progreso real del sync_job que insertó la edge function.
    const isHeavySync = steps === 'all' || steps === 'media' || steps === 'account' || steps === 'ads';

    if (isHeavySync) {
      // `after()` difiere la ejecución hasta después que la response salió al
      // cliente. Así el cliente recibe 202 en ~200ms, el edge function
      // corre libre hasta ~180s, y el hook de polling muestra el progreso.
      after(async () => {
        try {
          const { error } = await supabase.functions.invoke('sync-instagram', {
            body: { workspace_id: auth.workspaceId, steps },
            headers: syncHeaders,
          });
          if (error) {
            const { status, code, body } = await readEdgeError(error).then((r) => ({
              status: r.status,
              body: r.body,
              code: (r.body && typeof r.body === 'object')
                ? (r.body as Record<string, unknown>).code : undefined,
            }));
            console.error('[sync/instagram] background sync failed:', { status, code, body });
            return;
          }
          await generateMissingTitles(auth.workspaceId).catch(() => { /* no crítico */ });
        } catch (err) {
          console.error('[sync/instagram] background sync unhandled:', err);
        }
      });

      return NextResponse.json(
        {
          data: {
            status: 'queued',
            message: 'Sync iniciado. El progreso se muestra debajo.',
          },
        },
        { status: 202 },
      );
    }

    // Quick/check: sincronico, responde rapido (3-5s). El UX aca es esperar
    // la respuesta porque la gracia de estos modos es ser rapidos.
    const { data, error } = await supabase.functions.invoke('sync-instagram', {
      body: { workspace_id: auth.workspaceId, steps },
      headers: syncHeaders,
    });

    if (error) {
      const { status, body } = await readEdgeError(error);
      const bodyObj = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
      const code = typeof bodyObj.code === 'string' ? bodyObj.code : undefined;
      console.error('[sync/instagram] Edge Function error:', { status, code, body });

      if (status === 401 && code === 'TOKEN_EXPIRED') {
        return NextResponse.json(
          { error: 'TOKEN_EXPIRED', message: 'La conexión con Meta expiró. Reconectá tu cuenta.' },
          { status: 401 },
        );
      }

      if (typeof status === 'number' && status >= 400 && status < 600) {
        return NextResponse.json(
          { error: 'SYNC_FAILED', message: (bodyObj.error as string) || `Sync falló (${status})` },
          { status },
        );
      }

      return api500();
    }

    generateMissingTitles(auth.workspaceId).catch(() => { /* background, no crítico */ });

    return apiSuccess(data);
  } catch (err) {
    console.error('[sync/instagram] Unhandled error:', err);
    return api500();
  }
}
