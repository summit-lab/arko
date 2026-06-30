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
import { hasFeature } from '@/lib/tier/config';

// Vercel Pro plan permite hasta 300s. `after()` corre post-response pero
// DENTRO de la misma invocación serverless — si el route termina antes que
// el for loop de 3 steps (account + media + stories, hasta 300s total),
// Vercel mata la función y los steps posteriores nunca corren.
// Con Pro + maxDuration=300 la cadena completa se puede ejecutar.
export const maxDuration = 300;

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
    // Orden de prioridad del sync según la vista (pestaña): 'reels' o 'account'.
    // El primero se sincroniza primero → se ve llegar antes en esa vista.
    const first = url.searchParams.get('first');

    const supabase = await createClient();
    const syncHeaders = { 'x-sync-secret': env.SYNC_SECRET ?? '' };

    // ─── Heavy sync fire-and-forget + step-chaining ─────────────────
    // Supabase Edge tiene timeout de ~150s por invocación. Encadenamos pasos
    // GRANULARES (reels y ads separados, cada uno con su budget), igual que el
    // cron particionado, para que reels + ads no compitan por el límite.
    //
    // El ORDEN depende de la vista (param `first`):
    //   - reels-first (pestaña de reels): reels → account → ads → stories.
    //     El edge streamea los reels por página → los más nuevos aparecen primero.
    //   - account-first (métricas / default): account → reels → ads → stories.
    //
    // Si un paso falla, seguimos con el siguiente (un fallo aislado no bloquea el resto).
    const isHeavySync = steps === 'all' || steps === 'media' || steps === 'reels' || steps === 'account';

    if (isHeavySync) {
      // ads SIEMPRE último: no se usa en ninguna vista en tiempo real, así que
      // se sincroniza al final, de fondo, sin demorar lo que el usuario mira.
      const stepsChain = steps === 'all'
        ? (first === 'reels'
            ? ['reels', 'account', 'stories', 'ads']
            : ['account', 'reels', 'stories', 'ads'])
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
        // Enriquecer títulos cuesta LLM → solo tiers con análisis IA (no Demo).
        if (hasFeature(auth.tier, 'reelAiAnalysis')) {
          await generateMissingTitles(auth.workspaceId).catch(() => { /* no crítico */ });
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

    // Títulos con LLM: solo tiers con análisis IA (no Demo).
    if (hasFeature(auth.tier, 'reelAiAnalysis')) {
      generateMissingTitles(auth.workspaceId).catch(() => { /* background, no crítico */ });
    }

    return apiSuccess(data);
  } catch (err) {
    console.error('[sync/instagram] Unhandled error:', err);
    return api500();
  }
}
