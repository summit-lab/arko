/**
 * GET /api/v1/ads?workspace_id=...&from=YYYY-MM-DD&to=YYYY-MM-DD&preset=30d
 * Returns aggregated Meta Ads data from ad_metrics_daily (date-filtered)
 * with fallback to ad_mappings when daily data is not yet available.
 *
 * Response includes: overview, campaigns, daily series, trends vs previous period.
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api500 } from '@/lib/api/response';
import { parseDateParams, previousPeriod, nextDay } from '@/lib/date-utils';

// ── Types ──

interface DailyRow {
  ad_id: string;
  ad_name: string | null;
  campaign_id: string;
  adset_id: string;
  metric_date: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend_cents: number;
  video_plays: number;
}

interface AdMappingRow {
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

function aggregateDailyRows(rows: DailyRow[], adNamesFallback: Map<string, string>) {
  const campaignMap = new Map<string, CampaignAgg>();
  // First aggregate per-ad totals
  const adTotals = new Map<string, { ad_id: string; ad_name: string; campaign_id: string; adset_id: string; spend: number; impressions: number; reach: number; clicks: number; video_plays: number }>();

  for (const row of rows) {
    const key = row.ad_id;
    const prev = adTotals.get(key);
    const spend = (row.spend_cents ?? 0) / 100;
    if (prev) {
      prev.spend += spend;
      prev.impressions += row.impressions ?? 0;
      prev.reach += row.reach ?? 0;
      prev.clicks += row.clicks ?? 0;
      prev.video_plays += row.video_plays ?? 0;
      if (!prev.ad_name && row.ad_name) prev.ad_name = row.ad_name;
    } else {
      adTotals.set(key, {
        ad_id: row.ad_id,
        ad_name: row.ad_name || adNamesFallback.get(row.ad_id) || `Ad ${row.ad_id.slice(-6)}`,
        campaign_id: row.campaign_id,
        adset_id: row.adset_id,
        spend,
        impressions: row.impressions ?? 0,
        reach: row.reach ?? 0,
        clicks: row.clicks ?? 0,
        video_plays: row.video_plays ?? 0,
      });
    }
  }

  // Aggregate by campaign
  for (const ad of adTotals.values()) {
    if (!campaignMap.has(ad.campaign_id)) {
      campaignMap.set(ad.campaign_id, {
        campaign_id: ad.campaign_id, adset_ids: [], ad_count: 0,
        spend: 0, impressions: 0, reach: 0, clicks: 0, video_plays: 0,
        ctr: 0, cpm: 0, ads: [],
      });
    }
    const c = campaignMap.get(ad.campaign_id)!;
    c.spend += ad.spend;
    c.impressions += ad.impressions;
    c.reach += ad.reach;
    c.clicks += ad.clicks;
    c.video_plays += ad.video_plays;
    c.ad_count += 1;
    if (!c.adset_ids.includes(ad.adset_id)) c.adset_ids.push(ad.adset_id);

    c.ads.push({
      ad_id: ad.ad_id,
      ad_name: ad.ad_name,
      adset_id: ad.adset_id,
      spend: ad.spend,
      impressions: ad.impressions,
      clicks: ad.clicks,
      video_plays: ad.video_plays,
      ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0,
    });
  }

  const campaigns = Array.from(campaignMap.values()).map((c) => ({
    ...c,
    ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
    cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
    spend: Math.round(c.spend * 100) / 100,
  }));

  const overview = campaigns.reduce(
    (acc, c) => ({
      totalSpend: acc.totalSpend + c.spend,
      totalImpressions: acc.totalImpressions + c.impressions,
      totalClicks: acc.totalClicks + c.clicks,
      totalVideoPlays: acc.totalVideoPlays + c.video_plays,
      totalReach: acc.totalReach + c.reach,
    }),
    { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalVideoPlays: 0, totalReach: 0 }
  );

  const avgCtr = overview.totalImpressions > 0 ? (overview.totalClicks / overview.totalImpressions) * 100 : 0;
  const avgCpm = overview.totalImpressions > 0 ? (overview.totalSpend / overview.totalImpressions) * 1000 : 0;

  return { overview: { ...overview, avgCtr, avgCpm }, campaigns };
}

function computeTrends(
  current: { totalSpend: number; totalImpressions: number; totalClicks: number; totalVideoPlays: number; totalReach: number; avgCtr: number; avgCpm: number },
  previous: { totalSpend: number; totalImpressions: number; totalClicks: number; totalVideoPlays: number; totalReach: number; avgCtr: number; avgCpm: number }
) {
  const pct = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;
  return {
    spend: Math.round(pct(current.totalSpend, previous.totalSpend) * 10) / 10,
    impressions: Math.round(pct(current.totalImpressions, previous.totalImpressions) * 10) / 10,
    clicks: Math.round(pct(current.totalClicks, previous.totalClicks) * 10) / 10,
    ctr: Math.round(pct(current.avgCtr, previous.avgCtr) * 10) / 10,
    cpm: Math.round(pct(current.avgCpm, previous.avgCpm) * 10) / 10,
    videoPlays: Math.round(pct(current.totalVideoPlays, previous.totalVideoPlays) * 10) / 10,
  };
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const supabase = await createClient();
    const url = new URL(request.url);
    const dateRange = parseDateParams({
      days: url.searchParams.get('days') ?? undefined,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      preset: url.searchParams.get('preset') ?? undefined,
    });
    const prev = previousPeriod(dateRange);

    // Parallel fetch: daily metrics (current + previous), ad names fallback, connection, sync job
    const [currentResult, prevResult, namesResult, connResult, syncResult] = await Promise.all([
      supabase
        .from('ad_metrics_daily')
        .select('ad_id, ad_name, campaign_id, adset_id, metric_date, impressions, reach, clicks, spend_cents, video_plays')
        .eq('workspace_id', auth.workspaceId)
        .gte('metric_date', dateRange.from)
        .lt('metric_date', nextDay(dateRange.to)),

      supabase
        .from('ad_metrics_daily')
        .select('ad_id, ad_name, campaign_id, adset_id, metric_date, impressions, reach, clicks, spend_cents, video_plays')
        .eq('workspace_id', auth.workspaceId)
        .gte('metric_date', prev.from)
        .lt('metric_date', nextDay(prev.to)),

      // Fallback for ad names when ad_metrics_daily.ad_name is null
      supabase
        .from('ad_mappings')
        .select('ad_id, ad_name')
        .eq('workspace_id', auth.workspaceId),

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

    const currentDaily = (currentResult.data ?? []) as DailyRow[];
    const prevDaily = (prevResult.data ?? []) as DailyRow[];
    const connection = connResult.data;
    const lastSync = syncResult.data;

    // Build ad name lookup
    const adNames = new Map<string, string>();
    for (const row of (namesResult.data ?? []) as { ad_id: string; ad_name: string }[]) {
      adNames.set(row.ad_id, row.ad_name);
    }

    const hasDailyData = currentDaily.length > 0;

    let overview: ReturnType<typeof aggregateDailyRows>['overview'];
    let campaigns: ReturnType<typeof aggregateDailyRows>['campaigns'];
    let trends: ReturnType<typeof computeTrends>;
    let dailySeries: { date: string; spend: number; impressions: number; clicks: number; video_plays: number; cpm: number }[] = [];

    if (hasDailyData) {
      // Use daily data
      const current = aggregateDailyRows(currentDaily, adNames);
      const previous = aggregateDailyRows(prevDaily, adNames);
      overview = current.overview;
      campaigns = current.campaigns;
      trends = computeTrends(current.overview, previous.overview);

      // Build daily series for chart
      const byDate = new Map<string, { spend: number; impressions: number; clicks: number; video_plays: number }>();
      for (const row of currentDaily) {
        const d = row.metric_date;
        const prev = byDate.get(d) ?? { spend: 0, impressions: 0, clicks: 0, video_plays: 0 };
        prev.spend += (row.spend_cents ?? 0) / 100;
        prev.impressions += row.impressions ?? 0;
        prev.clicks += row.clicks ?? 0;
        prev.video_plays += row.video_plays ?? 0;
        byDate.set(d, prev);
      }
      dailySeries = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, m]) => ({
          date,
          spend: Math.round(m.spend * 100) / 100,
          impressions: m.impressions,
          clicks: m.clicks,
          video_plays: m.video_plays,
          cpm: m.impressions > 0 ? Math.round((m.spend / m.impressions) * 1000 * 100) / 100 : 0,
        }));
    } else {
      // Fallback to ad_mappings (all-time snapshot, no date filter)
      const { data: adsData } = await supabase
        .from('ad_mappings')
        .select('campaign_id, adset_id, ad_id, ad_name, spend_cents, impressions, reach, clicks, video_plays')
        .eq('workspace_id', auth.workspaceId)
        .order('spend_cents', { ascending: false });

      const ads = (adsData ?? []) as AdMappingRow[];
      const campaignMap = new Map<string, CampaignAgg>();

      for (const ad of ads) {
        if (!campaignMap.has(ad.campaign_id)) {
          campaignMap.set(ad.campaign_id, {
            campaign_id: ad.campaign_id, adset_ids: [], ad_count: 0,
            spend: 0, impressions: 0, reach: 0, clicks: 0, video_plays: 0,
            ctr: 0, cpm: 0, ads: [],
          });
        }
        const c = campaignMap.get(ad.campaign_id)!;
        const spend = (ad.spend_cents ?? 0) / 100;
        c.spend += spend;
        c.impressions += ad.impressions ?? 0;
        c.reach += ad.reach ?? 0;
        c.clicks += ad.clicks ?? 0;
        c.video_plays += ad.video_plays ?? 0;
        c.ad_count += 1;
        if (!c.adset_ids.includes(ad.adset_id)) c.adset_ids.push(ad.adset_id);
        c.ads.push({
          ad_id: ad.ad_id,
          ad_name: ad.ad_name ?? `Ad ${ad.ad_id.slice(-6)}`,
          adset_id: ad.adset_id,
          spend,
          impressions: ad.impressions ?? 0,
          clicks: ad.clicks ?? 0,
          video_plays: ad.video_plays ?? 0,
          ctr: (ad.impressions ?? 0) > 0 ? ((ad.clicks ?? 0) / (ad.impressions ?? 0)) * 100 : 0,
        });
      }

      campaigns = Array.from(campaignMap.values()).map((c) => ({
        ...c,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
        spend: Math.round(c.spend * 100) / 100,
      }));

      const ov = campaigns.reduce(
        (acc, c) => ({
          totalSpend: acc.totalSpend + c.spend,
          totalImpressions: acc.totalImpressions + c.impressions,
          totalClicks: acc.totalClicks + c.clicks,
          totalVideoPlays: acc.totalVideoPlays + c.video_plays,
          totalReach: acc.totalReach + c.reach,
        }),
        { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalVideoPlays: 0, totalReach: 0 }
      );
      overview = {
        ...ov,
        avgCtr: ov.totalImpressions > 0 ? (ov.totalClicks / ov.totalImpressions) * 100 : 0,
        avgCpm: ov.totalImpressions > 0 ? (ov.totalSpend / ov.totalImpressions) * 1000 : 0,
      };
      trends = { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpm: 0, videoPlays: 0 };
    }

    return apiSuccess({
      connected: !!(connection?.status === 'active'),
      adAccountCount: connection?.ad_account_ids?.length ?? 0,
      lastValidatedAt: connection?.last_validated_at ?? null,
      lastSync: lastSync
        ? { completedAt: lastSync.completed_at, status: lastSync.status, metadata: lastSync.metadata }
        : null,
      overview,
      campaigns,
      trends,
      dailySeries,
      hasDailyData,
      isEmpty: campaigns.length === 0,
    });
  } catch (err) {
    console.error('[GET /api/v1/ads]', err);
    return api500();
  }
}
