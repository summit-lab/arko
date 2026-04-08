/**
 * GET /api/v1/ads?workspace_id=...
 * Returns aggregated Meta Ads data from ad_mappings table.
 *
 * Aggregates by campaign_id → returns campaigns with their ads.
 * Also returns connection status and last sync info.
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api500 } from '@/lib/api/response';

interface AdRow {
  campaign_id: string;
  adset_id: string;
  ad_id: string;
  ad_name: string;
  spend_cents: number;
  impressions: number;
  reach: number;
  clicks: number;
  video_plays: number;
}

interface CampaignAgg {
  campaign_id: string;
  adset_ids: string[];
  ad_count: number;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  video_plays: number;
  ctr: number;
  cpm: number;
  ads: { ad_id: string; ad_name: string; adset_id: string; spend: number; impressions: number; clicks: number; video_plays: number; ctr: number }[];
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const supabase = await createClient();

    // Parallel fetch: ad_mappings, meta_connection, last sync job
    const [adsResult, connResult, syncResult] = await Promise.all([
      supabase
        .from('ad_mappings')
        .select('campaign_id, adset_id, ad_id, ad_name, spend_cents, impressions, reach, clicks, video_plays')
        .eq('workspace_id', auth.workspaceId)
        .order('spend_cents', { ascending: false }),

      supabase
        .from('meta_connections')
        .select('ad_account_ids, status, last_validated_at')
        .eq('workspace_id', auth.workspaceId)
        .maybeSingle(),

      supabase
        .from('sync_jobs')
        .select('completed_at, status, metadata, started_at')
        .eq('workspace_id', auth.workspaceId)
        .eq('job_type', 'ads_insights')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const ads: AdRow[] = (adsResult.data ?? []) as AdRow[];
    const connection = connResult.data;
    const lastSync = syncResult.data;

    // ── Aggregate by campaign_id ──────────────────────────────────────────────
    const campaignMap = new Map<string, CampaignAgg>();

    for (const ad of ads) {
      if (!campaignMap.has(ad.campaign_id)) {
        campaignMap.set(ad.campaign_id, {
          campaign_id: ad.campaign_id,
          adset_ids: [],
          ad_count: 0,
          spend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          video_plays: 0,
          ctr: 0,
          cpm: 0,
          ads: [],
        });
      }
      const c = campaignMap.get(ad.campaign_id)!;
      const spend = (ad.spend_cents ?? 0) / 100;
      const imp = ad.impressions ?? 0;
      const clk = ad.clicks ?? 0;
      const vp = ad.video_plays ?? 0;

      c.spend += spend;
      c.impressions += imp;
      c.reach += ad.reach ?? 0;
      c.clicks += clk;
      c.video_plays += vp;
      c.ad_count += 1;
      if (!c.adset_ids.includes(ad.adset_id)) c.adset_ids.push(ad.adset_id);

      c.ads.push({
        ad_id: ad.ad_id,
        ad_name: ad.ad_name ?? `Ad ${ad.ad_id.slice(-6)}`,
        adset_id: ad.adset_id,
        spend,
        impressions: imp,
        clicks: clk,
        video_plays: vp,
        ctr: imp > 0 ? (clk / imp) * 100 : 0,
      });
    }

    // Compute derived metrics per campaign
    const campaigns = Array.from(campaignMap.values()).map((c) => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
      spend: Math.round(c.spend * 100) / 100,
    }));

    // ── Overview totals ───────────────────────────────────────────────────────
    const overview = campaigns.reduce(
      (acc, c) => ({
        totalSpend:       acc.totalSpend + c.spend,
        totalImpressions: acc.totalImpressions + c.impressions,
        totalClicks:      acc.totalClicks + c.clicks,
        totalVideoPlays:  acc.totalVideoPlays + c.video_plays,
        totalReach:       acc.totalReach + c.reach,
      }),
      { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalVideoPlays: 0, totalReach: 0 }
    );

    const avgCtr = overview.totalImpressions > 0
      ? (overview.totalClicks / overview.totalImpressions) * 100
      : 0;
    const avgCpm = overview.totalImpressions > 0
      ? (overview.totalSpend / overview.totalImpressions) * 1000
      : 0;

    return apiSuccess({
      connected: !!(connection?.status === 'active'),
      adAccountCount: connection?.ad_account_ids?.length ?? 0,
      lastValidatedAt: connection?.last_validated_at ?? null,
      lastSync: lastSync
        ? { completedAt: lastSync.completed_at, status: lastSync.status, metadata: lastSync.metadata }
        : null,
      overview: { ...overview, avgCtr, avgCpm },
      campaigns,
      isEmpty: campaigns.length === 0,
    });
  } catch (err) {
    console.error('[GET /api/v1/ads]', err);
    return api500();
  }
}
