/**
 * Ads Sync Service
 * PRD 5.2 — Fetches Ad insights from Marketing API + maps Ads → Reels
 *
 * 2-step approach:
 *   Step A: Fetch ads with creative info (for mapping via object_story_id)
 *   Step B: Fetch ad-level insights (for metrics — impressions, reach, spend, etc.)
 *   Then: Map ad → reel, aggregate metrics, upsert into DB
 */

import { createClient as createServerClient } from '@/lib/supabase/server';

const META_TOKENS_ENCRYPTION_KEY = process.env.META_TOKENS_ENCRYPTION_KEY!;
const GRAPH_API_VERSION = 'v25.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function normalizeInstagramUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
}

function extractInstagramShortcode(url: string | null | undefined): string | null {
  const normalized = normalizeInstagramUrl(url);
  if (!normalized) return null;
  const match = normalized.match(/instagram\.com\/(?:reel|p)\/([^/]+)/i);
  return match?.[1] ?? null;
}

function getActionMetricValue(
  items: { action_type: string; value: string }[] | null | undefined,
  actionType: string
): number {
  return parseInt(items?.find((item) => item.action_type === actionType)?.value || '0') || 0;
}

// ── Types ──────────────────────────────────────────────────────
interface AdRecord {
  id: string;
  name: string;
  campaign_id: string;
  adset_id: string;
  creative?: {
    id: string;
    object_story_id?: string;
    effective_instagram_media_id?: string;
    source_instagram_media_id?: string;
    effective_object_story_id?: string;
    instagram_permalink_url?: string;
  };
}

interface InsightRow {
  ad_id: string;
  impressions: string;
  reach: string;
  clicks: string;
  spend: string;
  ctr?: string;
  cpc?: string;
  cpp?: string;
  frequency?: string;
  inline_link_clicks?: string;
  outbound_clicks?: { action_type: string; value: string }[];
  video_play_actions?: { action_type: string; value: string }[];
  video_p25_watched_actions?: { action_type: string; value: string }[];
  video_p50_watched_actions?: { action_type: string; value: string }[];
  video_p75_watched_actions?: { action_type: string; value: string }[];
  video_p95_watched_actions?: { action_type: string; value: string }[];
  video_p100_watched_actions?: { action_type: string; value: string }[];
}

interface AdsSyncResult {
  adsProcessed: number;
  adsMapped: number;
  adsUnmapped: number;
  reelsUpdated: number;
  errors: string[];
}

type MatchMethod = 'source_instagram_media_id' | 'effective_instagram_media_id' | 'object_story_id' | 'creative_permalink' | 'shortcode';

interface MatchResult {
  reelId: string;
  matchMethod: MatchMethod;
}

// ── Main entry point ───────────────────────────────────────────
export async function syncAdsMetrics(
  workspaceId: string,
  syncJobId: string
): Promise<AdsSyncResult> {
  const supabase = await createServerClient();

  const result: AdsSyncResult = {
    adsProcessed: 0,
    adsMapped: 0,
    adsUnmapped: 0,
    reelsUpdated: 0,
    errors: [],
  };

  try {
    await supabase
      .from('sync_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', syncJobId);

    // 1. Get connection + decrypt token
    const { data: connection } = await supabase
      .from('meta_connections')
      .select('ad_account_ids')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single();

    if (!connection?.ad_account_ids?.length) {
      throw new Error('No ad accounts found in connection');
    }

    const { data: tokenData } = await supabase.rpc('get_meta_access_token', {
      p_workspace_id: workspaceId,
      p_encryption_key: META_TOKENS_ENCRYPTION_KEY,
    });

    const accessToken = tokenData as string;
    if (!accessToken) throw new Error('Failed to decrypt access token');

    // 2. Build reel lookup maps
    const { data: existingReels } = await supabase
      .from('reels')
      .select('id, ig_media_id, permalink')
      .eq('workspace_id', workspaceId);

    const reelsByIgMediaId = new Map<string, string>();
    const reelsByPermalink = new Map<string, string>();
    const reelsByShortcode = new Map<string, string>();
    for (const r of existingReels || []) {
      reelsByIgMediaId.set(r.ig_media_id, r.id);
      const normalizedPermalink = normalizeInstagramUrl(r.permalink);
      const shortcode = extractInstagramShortcode(r.permalink);
      if (normalizedPermalink) reelsByPermalink.set(normalizedPermalink, r.id);
      if (shortcode) reelsByShortcode.set(shortcode, r.id);
    }

    console.log(`[ads-sync] Reel lookup: ${reelsByIgMediaId.size} by ig_media_id, ${reelsByPermalink.size} by permalink, ${reelsByShortcode.size} by shortcode`);

    // Aggregate paid metrics per reel_id
    const paidByReel = new Map<string, {
      views_paid: number; impressions_paid: number; reach_paid: number;
      clicks: number; spend_cents: number; video_plays: number;
    }>();
    const matchCounts: Record<MatchMethod, number> = {
      source_instagram_media_id: 0,
      effective_instagram_media_id: 0,
      object_story_id: 0,
      creative_permalink: 0,
      shortcode: 0,
    };
    const unmatchedSamples: Array<{
      ad_id: string;
      source_instagram_media_id: string | null;
      effective_instagram_media_id: string | null;
      object_story_id: string | null;
      effective_object_story_id: string | null;
      instagram_permalink_url: string | null;
      shortcode: string | null;
    }> = [];

    // 3. Process each ad account
    const adAccountIds: string[] = connection.ad_account_ids;

    for (const acctId of adAccountIds) {
      try {
        // Step A: Fetch ads with creative info
        const ads = await fetchAdsWithCreative(acctId, accessToken);
        console.log(`[ads-sync] ${acctId}: ${ads.length} ads found`);

        if (ads.length === 0) continue;

        // Step B: Fetch insights for this account
        const insightsMap = await fetchInsightsByAd(acctId, accessToken);
        console.log(`[ads-sync] ${acctId}: ${insightsMap.size} insight rows`);

        const adsById = new Map<string, AdRecord>(ads.map((ad) => [ad.id, ad]));
        const missingAdIds = [...insightsMap.keys()].filter((adId) => !adsById.has(adId));
        if (missingAdIds.length > 0) {
          console.log(`[ads-sync] ${acctId}: recovering ${missingAdIds.length} ads missing from listing via direct ad lookup`);
          for (const missingAdId of missingAdIds) {
            const recoveredAd = await fetchAdByIdWithCreative(missingAdId, accessToken);
            if (recoveredAd) {
              adsById.set(recoveredAd.id, recoveredAd);
            }
          }
        }
        const adsToProcess = [...adsById.values()];
        console.log(`[ads-sync] ${acctId}: ${adsToProcess.length} ads available after recovery`);

        // Step C: Map + aggregate
        for (const ad of adsToProcess) {
          result.adsProcessed++;

          // Debug: log first 3 ads' creative data
          if (result.adsProcessed <= 3) {
            console.log(`[ads-sync] Ad ${ad.id} creative:`, JSON.stringify(ad.creative || 'none'));
          }

          const match = resolveAdToReel(ad, reelsByIgMediaId, reelsByPermalink, reelsByShortcode);
          if (!match) {
            result.adsUnmapped++;
            if (unmatchedSamples.length < 10) {
              unmatchedSamples.push({
                ad_id: ad.id,
                source_instagram_media_id: ad.creative?.source_instagram_media_id || null,
                effective_instagram_media_id: ad.creative?.effective_instagram_media_id || null,
                object_story_id: ad.creative?.object_story_id || null,
                effective_object_story_id: ad.creative?.effective_object_story_id || null,
                instagram_permalink_url: ad.creative?.instagram_permalink_url || null,
                shortcode: extractInstagramShortcode(ad.creative?.instagram_permalink_url),
              });
            }
            continue;
          }
          result.adsMapped++;
          matchCounts[match.matchMethod]++;
          const reelId = match.reelId;

          const insight = insightsMap.get(ad.id);
          const videoPlays = getActionMetricValue(insight?.video_play_actions, 'video_view');
          const impressions = parseInt(insight?.impressions || '0') || 0;
          const reach = parseInt(insight?.reach || '0') || 0;
          const outboundClicks = getActionMetricValue(insight?.outbound_clicks, 'outbound_click');
          const inlineLinkClicks = parseInt(insight?.inline_link_clicks || '0') || 0;
          const clicks = outboundClicks || inlineLinkClicks || (parseInt(insight?.clicks || '0') || 0);
          const spendCents = Math.round(parseFloat(insight?.spend || '0') * 100) || 0;

          // Determine match method
          // Upsert ad_mapping
          const { error: mappingError } = await supabase
            .from('ad_mappings')
            .upsert(
              {
                reel_id: reelId,
                workspace_id: workspaceId,
                ad_id: ad.id,
                ad_name: ad.name,
                campaign_id: ad.campaign_id,
                adset_id: ad.adset_id,
                ad_account_id: acctId,
                match_method: match.matchMethod === 'creative_permalink' || match.matchMethod === 'shortcode'
                  ? 'creative_permalink'
                  : 'object_story_id',
                match_confidence: match.matchMethod === 'source_instagram_media_id' || match.matchMethod === 'effective_instagram_media_id' || match.matchMethod === 'object_story_id'
                  ? 'high'
                  : 'medium',
                impressions,
                reach,
                clicks,
                spend_cents: spendCents,
                video_plays: videoPlays,
                object_story_id: ad.creative?.object_story_id || null,
                creative_id: ad.creative?.id || null,
              },
              { onConflict: 'reel_id,ad_id' }
            );

          if (mappingError) {
            result.errors.push(`Ad ${ad.id}: ${mappingError.message}`);
            continue;
          }

          // Aggregate per-reel
          const prev = paidByReel.get(reelId) || {
            views_paid: 0, impressions_paid: 0, reach_paid: 0,
            clicks: 0, spend_cents: 0, video_plays: 0,
          };
          prev.views_paid += videoPlays;
          prev.impressions_paid += impressions;
          prev.reach_paid += reach;
          prev.clicks += clicks;
          prev.spend_cents += spendCents;
          prev.video_plays += videoPlays;
          paidByReel.set(reelId, prev);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${acctId}: ${msg}`);
      }
    }

    console.log(`[ads-sync] Match summary: ${JSON.stringify(matchCounts)}`);
    console.log(`[ads-sync] Unmatched sample ads: ${JSON.stringify(unmatchedSamples)}`);

    // 4. Upsert aggregated paid metrics per reel
    for (const [reelId, metrics] of paidByReel) {
      const { error } = await supabase
        .from('reel_metrics_paid')
        .upsert(
          { reel_id: reelId, workspace_id: workspaceId, ...metrics, fetched_at: new Date().toISOString() },
          { onConflict: 'reel_id' }
        );

      if (error) {
        result.errors.push(`Paid upsert ${reelId}: ${error.message}`);
      } else {
        result.reelsUpdated++;
        await supabase
          .from('reels')
          .update({ has_ads: true, attribution_confidence: 'high' })
          .eq('id', reelId);
      }
    }

    // 5. Complete job
    await supabase.from('sync_jobs').update({
      status: 'completed',
      processed_items: result.adsProcessed,
      completed_at: new Date().toISOString(),
      metadata: result as unknown as Record<string, unknown>,
    }).eq('id', syncJobId);

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    await supabase.from('sync_jobs').update({
      status: 'failed', error_message: msg, completed_at: new Date().toISOString(),
    }).eq('id', syncJobId);
    return result;
  }
}

// ── Step A: Fetch ads with creative fields ─────────────────────
async function fetchAdsWithCreative(
  adAccountId: string,
  accessToken: string
): Promise<AdRecord[]> {
  const fields = 'id,name,campaign_id,adset_id,creative{id,object_story_id,effective_instagram_media_id,source_instagram_media_id,effective_object_story_id,instagram_permalink_url}';
  const effectiveStatuses = JSON.stringify([
    'ACTIVE',
    'PAUSED',
    'PENDING_REVIEW',
    'DISAPPROVED',
    'PREAPPROVED',
    'PENDING_BILLING_INFO',
    'CAMPAIGN_PAUSED',
    'ADSET_PAUSED',
    'ARCHIVED',
    'IN_PROCESS',
    'WITH_ISSUES',
  ]);
  const allAds: AdRecord[] = [];
  let url: string | null =
    `${GRAPH_BASE}/${adAccountId}/ads?fields=${encodeURIComponent(fields)}&effective_status=${encodeURIComponent(effectiveStatuses)}&limit=100&access_token=${accessToken}`;

  while (url) {
    const res: Response = await fetch(url);
    const json = await res.json() as {
      data?: AdRecord[];
      paging?: { next?: string };
      error?: { message: string; code: number };
    };

    if (json.error) {
      console.error(`[ads-sync] Ads fetch error ${adAccountId}:`, json.error.message);
      break;
    }
    if (json.data) allAds.push(...json.data);
    url = json.paging?.next || null;
  }

  return allAds;
}

async function fetchAdByIdWithCreative(
  adId: string,
  accessToken: string
): Promise<AdRecord | null> {
  const fields = 'id,name,campaign_id,adset_id,creative{id,object_story_id,effective_instagram_media_id,source_instagram_media_id,effective_object_story_id,instagram_permalink_url}';
  const url = `${GRAPH_BASE}/${adId}?fields=${encodeURIComponent(fields)}&access_token=${accessToken}`;
  const res: Response = await fetch(url);
  const json = await res.json() as AdRecord & { error?: { message: string } };

  if (json.error) {
    console.error(`[ads-sync] Ad fetch error ${adId}:`, json.error.message);
    return null;
  }

  if (!json.id) return null;

  return {
    id: json.id,
    name: json.name,
    campaign_id: json.campaign_id,
    adset_id: json.adset_id,
    creative: json.creative,
  };
}

// ── Step B: Fetch insights keyed by ad_id ──────────────────────
async function fetchInsightsByAd(
  adAccountId: string,
  accessToken: string
): Promise<Map<string, InsightRow>> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const until = new Date().toISOString().split('T')[0];
  const fields = [
    'ad_id',
    'impressions',
    'reach',
    'clicks',
    'spend',
    'ctr',
    'cpc',
    'cpp',
    'frequency',
    'inline_link_clicks',
    'outbound_clicks',
    'video_play_actions',
    'video_p25_watched_actions',
    'video_p50_watched_actions',
    'video_p75_watched_actions',
    'video_p95_watched_actions',
    'video_p100_watched_actions',
  ].join(',');

  const map = new Map<string, InsightRow>();
  let url: string | null =
    `${GRAPH_BASE}/${adAccountId}/insights?level=ad&time_range={"since":"${since}","until":"${until}"}&fields=${fields}&limit=200&access_token=${accessToken}`;

  while (url) {
    const res: Response = await fetch(url);
    const json = await res.json() as {
      data?: InsightRow[];
      paging?: { next?: string };
      error?: { message: string };
    };

    if (json.error) {
      console.error(`[ads-sync] Insights error ${adAccountId}:`, json.error.message);
      break;
    }
    if (json.data) {
      for (const row of json.data) {
        map.set(row.ad_id, row);
      }
    }
    url = json.paging?.next || null;
  }

  return map;
}

// ── Map ad → reel (PRD 5.2 priority order) ─────────────────────
function resolveAdToReel(
  ad: AdRecord,
  reelsByIgMediaId: Map<string, string>,
  reelsByPermalink: Map<string, string>,
  reelsByShortcode: Map<string, string>
): MatchResult | null {
  const c = ad.creative;
  if (!c) return null;

  if (c.source_instagram_media_id) {
    const id = reelsByIgMediaId.get(c.source_instagram_media_id);
    if (id) return { reelId: id, matchMethod: 'source_instagram_media_id' };
  }

  if (c.effective_instagram_media_id) {
    const id = reelsByIgMediaId.get(c.effective_instagram_media_id);
    if (id) return { reelId: id, matchMethod: 'effective_instagram_media_id' };
  }

  if (c.object_story_id) {
    const parts = c.object_story_id.split('_');
    if (parts.length >= 2) {
      const igMediaId = parts.slice(1).join('_');
      const id = reelsByIgMediaId.get(igMediaId);
      if (id) return { reelId: id, matchMethod: 'object_story_id' };
    }
    const id = reelsByIgMediaId.get(c.object_story_id);
    if (id) return { reelId: id, matchMethod: 'object_story_id' };
    if (c.effective_object_story_id) {
      const effectiveParts = c.effective_object_story_id.split('_');
      if (effectiveParts.length >= 2) {
        const effectiveIgMediaId = effectiveParts.slice(1).join('_');
        const effectiveId = reelsByIgMediaId.get(effectiveIgMediaId);
        if (effectiveId) return { reelId: effectiveId, matchMethod: 'object_story_id' };
      }
    }
  }

  if (c.instagram_permalink_url) {
    const normalizedPermalink = normalizeInstagramUrl(c.instagram_permalink_url);
    const shortcode = extractInstagramShortcode(c.instagram_permalink_url);
    const id = normalizedPermalink ? reelsByPermalink.get(normalizedPermalink) : null;
    if (id) return { reelId: id, matchMethod: 'creative_permalink' };
    if (shortcode) {
      const shortcodeId = reelsByShortcode.get(shortcode);
      if (shortcodeId) return { reelId: shortcodeId, matchMethod: 'shortcode' };
    }
  }

  return null;
}
