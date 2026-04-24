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

    // ─── Heavy sync fire-and-forget + step-chaining ─────────────────
    // Supabase Edge tiene timeout de 150s por invocación. Antes hacíamos
    // UNA sola invocación con steps=all → si un user tenía muchos reels,
    // el edge moría antes de terminar y pasos posteriores nunca corrían.
    //
    // Ahora cuando `steps=all`, encadenamos 3 invocaciones secuenciales,
    // cada una con SU propio budget de 150s:
    //   1. account (~15s)     — followers, impressions, reach (KPIs top)
    //   2. media   (0-300s)   — reels + ads + benchmarks (el pesado); si
    //                           muere, account ya actualizó el dashboard
    //   3. stories (~30s)     — stories sequences
    //
    // Si alguna falla, logueamos pero seguimos con la siguiente. Así un
    // fallo aislado no bloquea el sync del resto.
    const isHeavySync = steps === 'all' || steps === 'media' || steps === 'account';

    if (isHeavySync) {
      const stepsChain = steps === 'all'
        ? ['account', 'media', 'stories']
        : [steps];

      // `after()` difiere la ejecución hasta después que la response salió.
      // El cliente recibe 202 en ~200ms y el hook de polling muestra progreso.
      after(async () => {
        for (const step of stepsChain) {
          try {
            const { error } = await supabase.functions.invoke('sync-instagram', {
              body: { workspace_id: auth.workspaceId, steps: step },
              headers: syncHeaders,
            });
            if (error) {
              const r = await readEdgeError(error);
              const code = (r.body && typeof r.body === 'object')
                ? (r.body as Record<string, unknown>).code : undefined;
              console.error(`[sync/instagram] step=${step} failed:`, { status: r.status, code, body: r.body });
              // TOKEN_EXPIRED corta la cadena — las demás invocaciones van a
              // fallar igual. El user tiene que reconectar.
              if (code === 'TOKEN_EXPIRED') break;
              // Otros errores: seguir con el próximo step.
              continue;
            }
          } catch (err) {
            console.error(`[sync/instagram] step=${step} unhandled:`, err);
          }
        }
        // Enriquecer títulos al final (no crítico, solo afecta reels nuevos).
        await generateMissingTitles(auth.workspaceId).catch(() => { /* no crítico */ });
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
