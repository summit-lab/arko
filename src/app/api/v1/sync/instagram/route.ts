/**
 * POST /api/v1/sync/instagram
 * Trigger Instagram sync: fetches Reels + Insights from IG Graph API
 * PRD 5.1 + 5.3 Steps 3-4
 *
 * Body: { workspace_id: string }
 *
 * Performance optimizations (v2):
 *   - Media insights fetched with concurrency=5 (not sequential)
 *   - Apify duration enrichment with concurrency=3 (not sequential)
 *   - Ads sync + Account insights run in parallel after media phase
 *   - Benchmark refresh runs after both ads+media are done
 *   - Background auto-sync via /api/v1/sync/cron for production pg_cron
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';
import { syncInstagramReels } from '@/services/instagram-sync.service';
import { syncAdsMetrics } from '@/services/ads-sync.service';
import { syncAccountInsights } from '@/services/ig-account-sync.service';
import { refreshReelBenchmarks } from '@/services/reel-benchmarks.service';

interface AdsSyncResult {
  adsProcessed: number;
  adsMapped: number;
  adsUnmapped: number;
  reelsUpdated: number;
  errors: string[];
}

interface AccountSyncResult {
  daysUpserted: number;
  demographicsUpserted: boolean;
  errors: string[];
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const url = new URL(request.url);
    const steps = url.searchParams.get('steps') || 'all'; // 'all' | 'media' | 'account'
    console.log(`[sync/instagram] Starting sync — steps=${steps}`);
    const t0 = Date.now();

    const supabase = await createClient();

    // Check Meta connection exists and is active
    const { data: connection, error: connError } = await supabase
      .from('meta_connections')
      .select('id, status, ig_business_account_id, ad_account_ids')
      .eq('workspace_id', auth.workspaceId)
      .single();

    if (connError || !connection) {
      return api400('No hay conexión de Meta configurada. Conecta tu cuenta primero.');
    }

    if (connection.status !== 'active') {
      return api400(`La conexión de Meta está en estado "${connection.status}". Reconecta tu cuenta.`);
    }

    if (!connection.ig_business_account_id) {
      return api400('No se encontró cuenta de Instagram Business. Verifica que tu cuenta esté conectada a una Página de Facebook.');
    }

    // Create sync job for reels
    const { data: reelsJob, error: reelsJobError } = await supabase
      .from('sync_jobs')
      .insert({
        workspace_id: auth.workspaceId,
        job_type: 'full_sync',
        status: 'queued',
      })
      .select()
      .single();

    if (reelsJobError) {
      console.error('[sync/instagram] Create reels job error:', reelsJobError);
      return api500();
    }

    // ── Step 1: Media sync (must complete before ads can map) ────
    let reelsResult = { reelsSynced: 0, reelsSkipped: 0, insightsFetched: 0, errors: [] as string[] };
    const parallelResults: {
      ads: AdsSyncResult | null;
      account: AccountSyncResult | null;
    } = { ads: null, account: null };
    let benchmarkResult: {
      snapshot_id: string;
      reels_in_window: number;
      window_start: string;
      window_end: string;
    } | null = null;

    if (steps === 'all' || steps === 'media') {
      console.log('[sync/instagram] Step 1: Starting reels sync (parallel insights + Apify)...');
      const t1 = Date.now();
      reelsResult = await syncInstagramReels(auth.workspaceId, reelsJob.id);
      console.log(`[sync/instagram] Step 1 done in ${Date.now() - t1}ms:`, JSON.stringify({ synced: reelsResult.reelsSynced, skipped: reelsResult.reelsSkipped, insights: reelsResult.insightsFetched, errors: reelsResult.errors.length }));

      // ── Step 2: Ads + Account run in PARALLEL ──────────────────
      console.log('[sync/instagram] Step 2: Starting ads + account sync in parallel...');
      const t2 = Date.now();

      const parallelTasks: Promise<void>[] = [];

      // Ads sync (only if ad accounts exist)
      if (connection.ad_account_ids?.length) {
        parallelTasks.push(
          (async () => {
            const { data: adsJob } = await supabase
              .from('sync_jobs')
              .insert({ workspace_id: auth.workspaceId, job_type: 'ads_insights', status: 'queued' })
              .select().single();
            if (adsJob) {
              parallelResults.ads = await syncAdsMetrics(auth.workspaceId, adsJob.id);
              console.log(`[sync/instagram] Ads sync done in ${Date.now() - t2}ms:`, JSON.stringify({ processed: parallelResults.ads.adsProcessed, mapped: parallelResults.ads.adsMapped, errors: parallelResults.ads.errors.length }));
            }
          })()
        );
      }

      // Account insights (always run when steps=all)
      if (connection.ig_business_account_id) {
        parallelTasks.push(
          (async () => {
            try {
              const { data: accountJob, error: accountJobError } = await supabase
                .from('sync_jobs')
                .insert({ workspace_id: auth.workspaceId, job_type: 'account_insights', status: 'queued' })
                .select().single();

              if (accountJobError) {
                console.error('[sync/instagram] Account job creation failed:', accountJobError);
              } else if (accountJob) {
                parallelResults.account = await syncAccountInsights(auth.workspaceId, accountJob.id);
                console.log(`[sync/instagram] Account sync done in ${Date.now() - t2}ms:`, JSON.stringify(parallelResults.account));
              }
            } catch (err) {
              console.error('[sync/instagram] Account sync CRASHED:', err);
            }
          })()
        );
      }

      await Promise.all(parallelTasks);
      console.log(`[sync/instagram] Parallel phase (ads+account) done in ${Date.now() - t2}ms`);

      // ── Step 3: Benchmark refresh (after ads are done) ─────────
      console.log('[sync/instagram] Step 3: Refreshing reel benchmarks...');
      const tBench = Date.now();
      try {
        const snapshot = await refreshReelBenchmarks(auth.workspaceId);
        benchmarkResult = {
          snapshot_id: snapshot.snapshotId,
          reels_in_window: snapshot.reelsInWindow,
          window_start: snapshot.windowStart,
          window_end: snapshot.windowEnd,
        };
        console.log(`[sync/instagram] Step 3 done in ${Date.now() - tBench}ms:`, JSON.stringify(benchmarkResult));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        reelsResult.errors.push(`Benchmark refresh: ${message}`);
        console.error('[sync/instagram] Step 3 failed:', message);
      }
    } else if (steps === 'account') {
      // Mark the reels job as skipped
      await supabase.from('sync_jobs').update({ status: 'completed', completed_at: new Date().toISOString(), metadata: { skipped: 'steps=account' } as Record<string, unknown> }).eq('id', reelsJob.id);

      // Account-only sync
      console.log('[sync/instagram] Account-only sync...');
      const t3 = Date.now();
      try {
        if (connection.ig_business_account_id) {
          const { data: accountJob, error: accountJobError } = await supabase
            .from('sync_jobs')
            .insert({ workspace_id: auth.workspaceId, job_type: 'account_insights', status: 'queued' })
            .select().single();

          if (accountJobError) {
            console.error('[sync/instagram] Account job creation failed:', accountJobError);
          } else if (accountJob) {
            parallelResults.account = await syncAccountInsights(auth.workspaceId, accountJob.id);
            console.log(`[sync/instagram] Account sync done in ${Date.now() - t3}ms:`, JSON.stringify(parallelResults.account));
          }
        }
      } catch (err) {
        console.error('[sync/instagram] Account sync CRASHED:', err);
      }
    } else if (steps === 'media') {
      // Media-only already ran above, mark reels job as done
      await supabase.from('sync_jobs').update({ status: 'completed', completed_at: new Date().toISOString(), metadata: { skipped: 'steps=media, no account sync' } as Record<string, unknown> }).eq('id', reelsJob.id);
    }

    console.log(`[sync/instagram] Total sync time: ${Date.now() - t0}ms`);

    const { ads: adsResult, account: accountResult } = parallelResults;

    const combinedErrors = [
      ...reelsResult.errors,
      ...(adsResult?.errors ?? []),
      ...(accountResult?.errors ?? []),
    ];
    const accountFailed = steps === 'account'
      && !!accountResult
      && accountResult.daysUpserted === 0
      && accountResult.errors.length > 0;

    return apiSuccess({
      status: accountFailed || (reelsResult.errors.length > 0 && reelsResult.reelsSynced === 0) ? 'failed' : 'completed',
      errors: combinedErrors.slice(0, 3),
      reels: {
        synced: reelsResult.reelsSynced,
        skipped: reelsResult.reelsSkipped,
        insights_fetched: reelsResult.insightsFetched,
        errors: reelsResult.errors.slice(0, 3),
      },
      ads: adsResult ? {
        ads_processed: adsResult.adsProcessed,
        ads_mapped: adsResult.adsMapped,
        ads_unmapped: adsResult.adsUnmapped,
        reels_updated: adsResult.reelsUpdated,
        errors: adsResult.errors.slice(0, 3),
      } : null,
      benchmark: benchmarkResult,
      account: accountResult ? {
        days_upserted: accountResult.daysUpserted,
        demographics_upserted: accountResult.demographicsUpserted,
        errors: accountResult.errors.slice(0, 3),
      } : null,
    });
  } catch (err) {
    console.error('[sync/instagram] Unhandled error:', err);
    return api500();
  }
}
