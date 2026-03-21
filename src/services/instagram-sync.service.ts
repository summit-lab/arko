/**
 * Instagram Sync Service
 * PRD 5.1 + 5.3 — Fetches ALL IG media (Reels + Posts + Carousels) + Insights
 *
 * Flow:
 *   1. Decrypt access token from meta_connections
 *   2. Fetch all media from IG Business Account (paginated)
 *   3. For each media: fetch insights (Reel-specific or Post-specific)
 *   4. Upsert into reels + reel_metrics tables
 *   5. Classify reel_type via heuristic (PRD 2.3)
 *   6. Update sync_job progress
 */

import { createClient as createServerClient } from '@/lib/supabase/server';
import { fetchApifyReelPublicData } from '@/services/apify-reel.service';
import { env } from '@/lib/env';
const GRAPH_API_VERSION = 'v25.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ── Types ──────────────────────────────────────────────────────
interface IGMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type: string;
  permalink?: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp?: string;
  is_shared_to_feed?: boolean;
}

interface IGInsightValue {
  value: number;
}

interface IGInsight {
  name: string;
  values: IGInsightValue[];
}

interface SyncResult {
  reelsSynced: number;
  reelsSkipped: number;
  insightsFetched: number;
  durationsEnriched: number;
  errors: string[];
}

// ── Main sync function ─────────────────────────────────────────
export async function syncInstagramReels(
  workspaceId: string,
  syncJobId: string
): Promise<SyncResult> {
  const supabase = await createServerClient();
  const result: SyncResult = {
    reelsSynced: 0,
    reelsSkipped: 0,
    insightsFetched: 0,
    durationsEnriched: 0,
    errors: [],
  };

  try {
    // Update job status to running
    await supabase
      .from('sync_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', syncJobId);

    // 1. Get connection data + decrypt token
    const { data: connection } = await supabase
      .from('meta_connections')
      .select('ig_business_account_id, ig_username')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single();

    if (!connection?.ig_business_account_id) {
      throw new Error('No IG Business Account found');
    }

    const { data: tokenData } = await supabase.rpc('get_meta_access_token', {
      p_workspace_id: workspaceId,
      p_encryption_key: env.META_TOKENS_ENCRYPTION_KEY!,
    });

    const accessToken = tokenData as string;
    if (!accessToken) {
      throw new Error('Failed to decrypt access token');
    }

    const igAccountId = connection.ig_business_account_id;

    // 2. Fetch all media (Reels + Posts + Carousels, paginated)
    const allMedia = await fetchAllMedia(igAccountId, accessToken);

    // Update total items
    await supabase
      .from('sync_jobs')
      .update({ total_items: allMedia.length })
      .eq('id', syncJobId);

    // 3. Get existing reels with recent metrics to skip them
    const { data: existingReels } = await supabase
      .from('reels')
      .select('ig_media_id, reel_metrics(fetched_at)')
      .eq('workspace_id', workspaceId);

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const reelsWithRecentMetrics = new Set(
      (existingReels || [])
        .filter((r) => {
          const metricsArr = r.reel_metrics as unknown as { fetched_at: string }[] | null;
          const m = metricsArr?.[0];
          return m?.fetched_at && m.fetched_at > sixHoursAgo;
        })
        .map((r) => r.ig_media_id)
    );

    // 4. Process each Reel — limit insights fetches to avoid timeout
    const MAX_INSIGHTS_PER_SYNC = 30;
    let insightsFetchCount = 0;

    for (let i = 0; i < allMedia.length; i++) {
      const media = allMedia[i];

      try {
        // Upsert reel base data (always — fast, no API call)
        const reelType = classifyReelType(media);
        const { data: reel, error: reelError } = await supabase
          .from('reels')
          .upsert(
            {
              workspace_id: workspaceId,
              ig_media_id: media.id,
              caption: media.caption || null,
              media_type: media.media_type,
              media_product_type: media.media_product_type,
              permalink: media.permalink || null,
              media_url: media.media_url || null,
              thumbnail_url: media.thumbnail_url || null,
              is_shared_to_feed: media.is_shared_to_feed ?? null,
              published_at: media.timestamp || null,
              reel_type: reelType,
              sync_status: 'synced',
            },
            { onConflict: 'workspace_id,ig_media_id' }
          )
          .select('id')
          .single();

        if (reelError || !reel) {
          result.errors.push(`Reel ${media.id}: upsert failed — ${reelError?.message}`);
          result.reelsSkipped++;
          continue;
        }

        result.reelsSynced++;

        // Skip insights if already fetched recently or limit reached
        if (reelsWithRecentMetrics.has(media.id)) {
          result.reelsSkipped++;
          continue;
        }

        if (insightsFetchCount >= MAX_INSIGHTS_PER_SYNC) {
          continue;
        }

        // 5. Fetch insights for this media (Reel vs Post use different metrics)
        const isReel = media.media_product_type === 'REELS';
        const insights = isReel
          ? await fetchReelInsights(media.id, accessToken)
          : await fetchPostInsights(media.id, accessToken);
        insightsFetchCount++;

        if (insights) {
          const { error: metricsError } = await supabase
            .from('reel_metrics')
            .upsert(
              {
                reel_id: reel.id,
                workspace_id: workspaceId,
                views_org: insights.views ?? null,
                impressions_org: null,
                reach_org: insights.reach ?? null,
                likes_total: insights.likes ?? null,
                comments_total: insights.comments ?? null,
                shares_total: insights.shares ?? null,
                saves_total: insights.saved ?? null,
                total_interactions: insights.total_interactions ?? null,
                profile_visits: null,
                follows_generated: null,
                avg_watch_time_sec: insights.ig_reels_avg_watch_time
                  ? insights.ig_reels_avg_watch_time / 1000
                  : null,
                fetched_at: new Date().toISOString(),
              },
              { onConflict: 'reel_id' }
            );

          if (metricsError) {
            result.errors.push(`Reel ${media.id}: metrics upsert failed — ${metricsError.message}`);
          } else {
            result.insightsFetched++;
          }
        }

        // Update progress
        if (i % 5 === 0 || i === allMedia.length - 1) {
          await supabase
            .from('sync_jobs')
            .update({ processed_items: i + 1 })
            .eq('id', syncJobId);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Reel ${media.id}: ${msg}`);
        result.reelsSkipped++;
      }
    }

    // 5. Enrich durations for reels missing them (limited batch to avoid timeout)
    const MAX_DURATION_ENRICHMENTS = 5;
    const { data: reelsMissingDuration } = await supabase
      .from('reels')
      .select('id, permalink')
      .eq('workspace_id', workspaceId)
      .eq('media_product_type', 'REELS')
      .is('duration_seconds', null)
      .not('permalink', 'is', null)
      .limit(MAX_DURATION_ENRICHMENTS);

    if (reelsMissingDuration && reelsMissingDuration.length > 0) {
      for (const reel of reelsMissingDuration) {
        try {
          const apifyData = await fetchApifyReelPublicData(reel.permalink!);
          if (apifyData?.video_duration_seconds) {
            await supabase
              .from('reels')
              .update({ duration_seconds: apifyData.video_duration_seconds })
              .eq('id', reel.id);
            result.durationsEnriched++;
          }
        } catch {
          // Non-blocking: if Apify fails, continue
        }
      }
    }

    // 6. Mark job as completed
    await supabase
      .from('sync_jobs')
      .update({
        status: 'completed',
        processed_items: allMedia.length,
        completed_at: new Date().toISOString(),
        metadata: result as unknown as Record<string, unknown>,
      })
      .eq('id', syncJobId);

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);

    // Mark job as failed
    await supabase
      .from('sync_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: msg,
        metadata: result as unknown as Record<string, unknown>,
      })
      .eq('id', syncJobId);

    return result;
  }
}

// ── Fetch all media (paginated — Reels + Posts + Carousels) ─────
async function fetchAllMedia(
  igAccountId: string,
  accessToken: string
): Promise<IGMedia[]> {
  const fields = [
    'id',
    'caption',
    'media_type',
    'media_product_type',
    'permalink',
    'media_url',
    'thumbnail_url',
    'timestamp',
    'is_shared_to_feed',
  ].join(',');

  const allMedia: IGMedia[] = [];
  let url: string | null =
    `${GRAPH_BASE}/${igAccountId}/media?fields=${fields}&limit=50&access_token=${accessToken}`;

  while (url) {
    const res: Response = await fetch(url);
    const data: { data?: IGMedia[]; paging?: { next?: string }; error?: { message: string } } = await res.json();

    if (data.error) {
      console.error('[ig-sync] Media fetch error:', data.error);
      throw new Error(`IG API error: ${data.error.message}`);
    }

    // Include ALL media types (Reels, Images, Carousels)
    if (data.data) allMedia.push(...data.data);

    // Pagination
    url = data.paging?.next || null;
  }

  return allMedia;
}

// ── Fetch insights for a single Reel ───────────────────────────
async function fetchReelInsights(
  igMediaId: string,
  accessToken: string
): Promise<Record<string, number> | null> {
  const metrics = [
    'views',
    'reach',
    'likes',
    'comments',
    'shares',
    'saved',
    'total_interactions',
    'ig_reels_avg_watch_time',
    'ig_reels_video_view_total_time',
  ].join(',');

  try {
    const res: Response = await fetch(
      `${GRAPH_BASE}/${igMediaId}/insights?metric=${metrics}&access_token=${accessToken}`
    );
    const data: { data?: IGInsight[]; error?: { message: string; code: number } } = await res.json();

    if (data.error) {
      // Some metrics may not be available — try with reduced set
      if (data.error.code === 100 || data.error.code === 3001) {
        return await fetchReelInsightsFallback(igMediaId, accessToken);
      }
      console.error(`[ig-sync] Insights error for ${igMediaId}:`, data.error);
      return null;
    }

    const result: Record<string, number> = {};
    for (const insight of (data.data || []) as IGInsight[]) {
      result[insight.name] = insight.values?.[0]?.value ?? 0;
    }
    return result;
  } catch (err) {
    console.error(`[ig-sync] Insights fetch failed for ${igMediaId}:`, err);
    return null;
  }
}

// ── Fallback with reduced metrics set ──────────────────────────
async function fetchReelInsightsFallback(
  igMediaId: string,
  accessToken: string
): Promise<Record<string, number> | null> {
  const metrics = ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'ig_reels_avg_watch_time'].join(',');

  try {
    const res: Response = await fetch(
      `${GRAPH_BASE}/${igMediaId}/insights?metric=${metrics}&access_token=${accessToken}`
    );
    const data: { data?: IGInsight[]; error?: { message: string } } = await res.json();

    if (data.error) {
      console.error(`[ig-sync] Fallback insights error for ${igMediaId}:`, data.error);
      return null;
    }

    const result: Record<string, number> = {};
    for (const insight of (data.data || []) as IGInsight[]) {
      result[insight.name] = insight.values?.[0]?.value ?? 0;
    }
    return result;
  } catch {
    return null;
  }
}

// ── Fetch insights for a single Post/Carousel ──────────────────
async function fetchPostInsights(
  igMediaId: string,
  accessToken: string
): Promise<Record<string, number> | null> {
  const metrics = ['impressions', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions'].join(',');

  try {
    const res: Response = await fetch(
      `${GRAPH_BASE}/${igMediaId}/insights?metric=${metrics}&access_token=${accessToken}`
    );
    const data: { data?: IGInsight[]; error?: { message: string; code: number } } = await res.json();

    if (data.error) {
      // Carousel albums may not support all metrics
      if (data.error.code === 100 || data.error.code === 3001) {
        return await fetchPostInsightsFallback(igMediaId, accessToken);
      }
      console.error(`[ig-sync] Post insights error for ${igMediaId}:`, data.error);
      return null;
    }

    const result: Record<string, number> = {};
    for (const insight of (data.data || []) as IGInsight[]) {
      result[insight.name] = insight.values?.[0]?.value ?? 0;
    }
    // Map 'saved' to same key format as reels for consistency
    if (result.saved !== undefined && result.saves === undefined) {
      result.saves = result.saved;
    }
    return result;
  } catch (err) {
    console.error(`[ig-sync] Post insights fetch failed for ${igMediaId}:`, err);
    return null;
  }
}

async function fetchPostInsightsFallback(
  igMediaId: string,
  accessToken: string
): Promise<Record<string, number> | null> {
  const metrics = ['impressions', 'reach', 'likes', 'comments', 'saved'].join(',');
  try {
    const res: Response = await fetch(
      `${GRAPH_BASE}/${igMediaId}/insights?metric=${metrics}&access_token=${accessToken}`
    );
    const data: { data?: IGInsight[]; error?: { message: string } } = await res.json();
    if (data.error) return null;
    const result: Record<string, number> = {};
    for (const insight of (data.data || []) as IGInsight[]) {
      result[insight.name] = insight.values?.[0]?.value ?? 0;
    }
    if (result.saved !== undefined) result.saves = result.saved;
    return result;
  } catch {
    return null;
  }
}

// ── Reel type classification (PRD 2.3) ─────────────────────────
function classifyReelType(media: IGMedia): string {
  if (media.media_product_type !== 'REELS') return 'unknown';
  if (media.is_shared_to_feed === true) return 'normal';
  if (media.is_shared_to_feed === false) return 'trial_likely';
  return 'unknown';
}
