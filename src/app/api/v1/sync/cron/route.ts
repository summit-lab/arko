/**
 * GET /api/v1/sync/cron
 * Background auto-sync endpoint for production.
 *
 * Triggered by Vercel Cron (vercel.json) or external scheduler.
 * Iterates all workspaces with active Meta connections and runs a full sync
 * for each one, keeping metrics fresh without user intervention.
 *
 * Security: Protected by CRON_SECRET header to prevent unauthorized access.
 * Only runs in production/staging — returns 200 noop in local.
 *
 * Frequency recommendation (configured in vercel.json):
 *   - Every 6 hours (4x/day) for media + ads + account + benchmark
 *   - Enough to keep dashboards fresh without burning API quotas
 */

import { createClient } from '@/lib/supabase/server';
import { apiSuccess, api401, api500 } from '@/lib/api/response';
import { syncInstagramReels } from '@/services/instagram-sync.service';
import { syncAdsMetrics } from '@/services/ads-sync.service';
import { syncAccountInsights } from '@/services/ig-account-sync.service';
import { refreshReelBenchmarks } from '@/services/reel-benchmarks.service';
import { env } from '@/lib/env';

export const maxDuration = 300; // 5 min max for Vercel Pro

interface WorkspaceSyncSummary {
  workspace_id: string;
  reels_synced: number;
  ads_mapped: number;
  account_days: number;
  benchmark_reels: number;
  errors: string[];
  duration_ms: number;
}

export async function GET(request: Request) {
  try {
    // Security: verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = env.CRON_SECRET;

    if (!cronSecret) {
      // No CRON_SECRET configured — noop in local/dev
      console.log('[sync/cron] CRON_SECRET not configured, skipping background sync.');
      return apiSuccess({ status: 'noop', message: 'CRON_SECRET not configured. Background sync disabled.' });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return api401('Invalid cron secret');
    }

    console.log('[sync/cron] Starting background sync for all active workspaces...');
    const t0 = Date.now();

    const supabase = await createClient();

    // Find all workspaces with active Meta connections
    const { data: connections, error: connError } = await supabase
      .from('meta_connections')
      .select('workspace_id, ig_business_account_id, ad_account_ids')
      .eq('status', 'active');

    if (connError || !connections?.length) {
      console.log('[sync/cron] No active connections found.');
      return apiSuccess({ status: 'completed', workspaces_synced: 0 });
    }

    console.log(`[sync/cron] Found ${connections.length} active workspace(s) to sync.`);

    const summaries: WorkspaceSyncSummary[] = [];

    // Process workspaces sequentially to avoid overwhelming external APIs
    for (const conn of connections) {
      const ws = conn.workspace_id;
      const tWs = Date.now();
      const summary: WorkspaceSyncSummary = {
        workspace_id: ws,
        reels_synced: 0,
        ads_mapped: 0,
        account_days: 0,
        benchmark_reels: 0,
        errors: [],
        duration_ms: 0,
      };

      try {
        // Create sync job
        const { data: job } = await supabase
          .from('sync_jobs')
          .insert({ workspace_id: ws, job_type: 'full_sync', status: 'queued' })
          .select('id')
          .single();

        if (!job) {
          summary.errors.push('Failed to create sync job');
          summaries.push(summary);
          continue;
        }

        // Step 1: Media sync (with parallel insights + Apify)
        const reelsResult = await syncInstagramReels(ws, job.id);
        summary.reels_synced = reelsResult.reelsSynced;
        summary.errors.push(...reelsResult.errors.slice(0, 3));

        // Step 2: Ads + Account in parallel
        const parallelTasks: Promise<void>[] = [];

        if (conn.ad_account_ids?.length) {
          parallelTasks.push(
            (async () => {
              const { data: adsJob } = await supabase
                .from('sync_jobs')
                .insert({ workspace_id: ws, job_type: 'ads_insights', status: 'queued' })
                .select('id').single();
              if (adsJob) {
                const adsResult = await syncAdsMetrics(ws, adsJob.id);
                summary.ads_mapped = adsResult.adsMapped;
                summary.errors.push(...adsResult.errors.slice(0, 2));
              }
            })()
          );
        }

        if (conn.ig_business_account_id) {
          parallelTasks.push(
            (async () => {
              try {
                const { data: accountJob } = await supabase
                  .from('sync_jobs')
                  .insert({ workspace_id: ws, job_type: 'account_insights', status: 'queued' })
                  .select('id').single();
                if (accountJob) {
                  const accountResult = await syncAccountInsights(ws, accountJob.id);
                  summary.account_days = accountResult.daysUpserted;
                  summary.errors.push(...accountResult.errors.slice(0, 2));
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                summary.errors.push(`Account sync: ${msg}`);
              }
            })()
          );
        }

        await Promise.all(parallelTasks);

        // Step 3: Benchmark refresh
        try {
          const snapshot = await refreshReelBenchmarks(ws);
          summary.benchmark_reels = snapshot.reelsInWindow;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          summary.errors.push(`Benchmark: ${msg}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        summary.errors.push(`Workspace sync failed: ${msg}`);
      }

      summary.duration_ms = Date.now() - tWs;
      summaries.push(summary);
      console.log(`[sync/cron] Workspace ${ws} done in ${summary.duration_ms}ms — reels: ${summary.reels_synced}, ads: ${summary.ads_mapped}, account: ${summary.account_days}`);
    }

    const totalMs = Date.now() - t0;
    console.log(`[sync/cron] Background sync completed for ${summaries.length} workspace(s) in ${totalMs}ms`);

    return apiSuccess({
      status: 'completed',
      workspaces_synced: summaries.length,
      total_duration_ms: totalMs,
      summaries,
    });
  } catch (err) {
    console.error('[sync/cron] Unhandled error:', err);
    return api500();
  }
}
