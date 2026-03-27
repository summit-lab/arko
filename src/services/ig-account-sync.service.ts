/**
 * IG Account Sync Service
 * Fetches account-level insights + demographics from IG User Insights API
 *
 * Endpoints used:
 *   GET /{ig-user-id}?fields=followers_count,follows_count,media_count
 *   GET /{ig-user-id}/insights?metric=impressions,reach,profile_views,follower_count&period=day&since=...&until=...
 *   GET /{ig-user-id}/insights?metric=audience_gender_age,audience_city,audience_country,audience_locale&period=lifetime
 *
 * Required scopes: instagram_basic, instagram_manage_insights
 */

import { createClient as createServerClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
const GRAPH_API_VERSION = 'v25.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ── Types ──────────────────────────────────────────────────────

interface IGInsightValue {
  end_time: string;
  value: number | Record<string, number>;
}

interface IGInsightBreakdownResult {
  dimension_values?: string[];
  value?: number;
}

interface IGInsightBreakdown {
  dimension_keys?: string[];
  results?: IGInsightBreakdownResult[];
}

interface IGInsight {
  name: string;
  period: string;
  values?: IGInsightValue[];
  total_value?: {
    value?: number | Record<string, number>;
    breakdowns?: IGInsightBreakdown[];
  };
}

interface AccountSyncResult {
  daysUpserted: number;
  demographicsUpserted: boolean;
  errors: string[];
}

interface DailyInsightsFetchResult {
  insights: IGInsight[];
  errors: string[];
}

interface DemographicsFetchResult {
  demographics: {
    audience_gender_age: Record<string, number>;
    audience_city: Record<string, number>;
    audience_country: Record<string, number>;
    audience_locale: Record<string, number>;
  } | null;
  errors: string[];
}

// ── Main sync function ─────────────────────────────────────────

export async function syncAccountInsights(
  workspaceId: string,
  syncJobId: string
): Promise<AccountSyncResult> {
  const supabase = await createServerClient();
  const result: AccountSyncResult = {
    daysUpserted: 0,
    demographicsUpserted: false,
    errors: [],
  };

  try {
    const { error: jobStartError } = await supabase
      .from('sync_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', syncJobId);
    if (jobStartError) console.error('[ig-account-sync] Failed to update job start:', jobStartError);

    // 1. Get connection + decrypt token
    const { data: connection } = await supabase
      .from('meta_connections')
      .select('ig_business_account_id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single();

    if (!connection?.ig_business_account_id) {
      throw new Error('No IG Business Account found — ensure instagram_basic scope is granted');
    }

    const { data: tokenData } = await supabase.rpc('get_meta_access_token', {
      p_workspace_id: workspaceId,
      p_encryption_key: env.META_TOKENS_ENCRYPTION_KEY!,
    });

    const accessToken = tokenData as string;
    if (!accessToken) throw new Error('Failed to decrypt access token');

    const igAccountId = connection.ig_business_account_id;

    // 2. Fetch basic profile fields
    const profileData = await fetchProfileFields(igAccountId, accessToken);

    // 3. Fetch daily insights (last 30 days)
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const until = Math.floor(todayUtc.getTime() / 1000);
    const since = until - (30 * 24 * 60 * 60);

    const dailyInsightsResult = await fetchDailyInsights(igAccountId, accessToken, since, until);
    const followerCountResult = await fetchFollowerCountInsights(igAccountId, accessToken, since, until);
    const dailyInsights = [...dailyInsightsResult.insights, ...followerCountResult.insights];
    result.errors.push(...dailyInsightsResult.errors);
    result.errors.push(...followerCountResult.errors);

    // 4. Group daily values by date and upsert
    const dayMap = new Map<string, Record<string, number>>();

    for (const insight of dailyInsights) {
      const normalizedValues = normalizeInsightValues(insight);
      for (const val of normalizedValues) {
        if (typeof val.value !== 'number') continue;
        const date = val.end_time.split('T')[0];
        const existing = dayMap.get(date) || {};
        existing[insight.name] = val.value;
        dayMap.set(date, existing);
      }
    }

    // ── followers_total reconstruction ─────────────────────────────
    // 1. Today = real profile snapshot
    // 2. Days with Meta delta: walk backwards to reconstruct cumulative total
    // 3. Gap days (last delta → today): interpolate linearly
    // 4. Only write followers_total for days that don't already have one
    const currentFollowersTotal = profileData?.followers_count ?? 0;
    const syncDate = new Date().toISOString().split('T')[0];
    const sortedDates = [...dayMap.keys()].sort();

    const { data: existingFt } = await supabase
      .from('ig_account_insights')
      .select('metric_date, followers_total')
      .eq('workspace_id', workspaceId)
      .in('metric_date', sortedDates)
      .gt('followers_total', 0);
    const existingFtSet = new Set((existingFt ?? []).map((r: { metric_date: string }) => r.metric_date));

    const followersTotalByDate = new Map<string, number>();

    if (currentFollowersTotal > 0 && sortedDates.length > 0) {
      let lastDeltaIdx = -1;
      for (let i = sortedDates.length - 1; i >= 0; i--) {
        if ((dayMap.get(sortedDates[i])?.follower_count ?? 0) > 0) {
          lastDeltaIdx = i;
          break;
        }
      }

      let runningTotal = currentFollowersTotal;
      followersTotalByDate.set(syncDate, currentFollowersTotal);

      for (let i = lastDeltaIdx; i >= 0; i--) {
        followersTotalByDate.set(sortedDates[i], runningTotal);
        runningTotal -= (dayMap.get(sortedDates[i])?.follower_count ?? 0);
      }

      if (lastDeltaIdx >= 0 && lastDeltaIdx < sortedDates.length - 1) {
        const gapStartTotal = followersTotalByDate.get(sortedDates[lastDeltaIdx]) ?? currentFollowersTotal;
        const gapDays = sortedDates.length - 1 - lastDeltaIdx;
        if (gapDays > 0) {
          const dailyIncrement = (currentFollowersTotal - gapStartTotal) / gapDays;
          for (let i = lastDeltaIdx + 1; i < sortedDates.length; i++) {
            followersTotalByDate.set(sortedDates[i], Math.round(gapStartTotal + dailyIncrement * (i - lastDeltaIdx)));
          }
        }
      }
    }

    for (const [date, metrics] of dayMap) {
      const computedFt = followersTotalByDate.get(date);
      const alreadyHasFt = existingFtSet.has(date);
      const ftPayload = (!alreadyHasFt && computedFt != null && computedFt > 0)
        ? { followers_total: computedFt }
        : {};

      const { error } = await supabase
        .from('ig_account_insights')
        .upsert(
          {
            workspace_id: workspaceId,
            metric_date: date,
            impressions: metrics.views ?? metrics.content_views ?? 0,
            reach: metrics.reach ?? 0,
            profile_views: metrics.profile_views ?? 0,
            follower_count: metrics.follower_count ?? 0,
            ...ftPayload,
            follows_count: profileData?.follows_count ?? 0,
            media_count: profileData?.media_count ?? 0,
            accounts_engaged: metrics.accounts_engaged ?? 0,
            total_interactions: (metrics.likes ?? 0) + (metrics.comments ?? 0) + (metrics.shares ?? 0) + (metrics.saves ?? 0),
            likes: metrics.likes ?? 0,
            comments: metrics.comments ?? 0,
            shares: metrics.shares ?? 0,
            saves: metrics.saves ?? 0,
            replies: metrics.replies ?? 0,
            website_clicks: metrics.website_clicks ?? metrics.profile_links_taps ?? 0,
            email_contacts: metrics.email_contacts ?? 0,
            phone_call_clicks: metrics.phone_call_clicks ?? 0,
            get_directions_clicks: metrics.get_directions_clicks ?? 0,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id,metric_date' }
        );

      if (error) {
        result.errors.push(`Day ${date}: ${error.message}`);
      } else {
        result.daysUpserted++;
      }
    }

    // Always upsert today's snapshot with the real followers_total
    if (currentFollowersTotal > 0) {
      const { error: todayError } = await supabase
        .from('ig_account_insights')
        .upsert(
          { workspace_id: workspaceId, metric_date: syncDate, followers_total: currentFollowersTotal, fetched_at: new Date().toISOString() },
          { onConflict: 'workspace_id,metric_date' }
        );
      if (todayError) result.errors.push(`Today snapshot: ${todayError.message}`);
    }

    if (dayMap.size === 0 && dailyInsights.length === 0) {
      result.errors.push('Daily insights returned no rows');
    }

    // 5. Fetch lifetime demographics
    try {
      const demographicsResult = await fetchDemographics(igAccountId, accessToken);
      result.errors.push(...demographicsResult.errors);
      const demographics = demographicsResult.demographics;
      if (demographics) {
        const today = new Date().toISOString().split('T')[0];
        const { error: demoError } = await supabase
          .from('ig_account_demographics')
          .upsert(
            {
              workspace_id: workspaceId,
              snapshot_date: today,
              audience_gender_age: demographics.audience_gender_age ?? {},
              audience_city: demographics.audience_city ?? {},
              audience_country: demographics.audience_country ?? {},
              audience_locale: demographics.audience_locale ?? {},
              fetched_at: new Date().toISOString(),
            },
            { onConflict: 'workspace_id,snapshot_date' }
          );

        if (demoError) {
          result.errors.push(`Demographics: ${demoError.message}`);
        } else {
          result.demographicsUpserted = true;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Demographics fetch: ${msg}`);
    }

    // 6. Complete job
    const { error: jobCompleteError } = await supabase.from('sync_jobs').update({
      status: 'completed',
      processed_items: result.daysUpserted,
      completed_at: new Date().toISOString(),
      metadata: result as unknown as Record<string, unknown>,
    }).eq('id', syncJobId);
    if (jobCompleteError) console.error('[ig-account-sync] Failed to update job completion:', jobCompleteError);

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    const { error: jobFailError } = await supabase.from('sync_jobs').update({
      status: 'failed',
      error_message: msg,
      completed_at: new Date().toISOString(),
    }).eq('id', syncJobId);
    if (jobFailError) console.error('[ig-account-sync] Failed to update job failure:', jobFailError);
    return result;
  }
}

// ── Fetch basic profile fields ─────────────────────────────────

async function fetchProfileFields(
  igAccountId: string,
  accessToken: string
): Promise<{ followers_count: number; follows_count: number; media_count: number } | null> {
  try {
    const res = await fetch(
      `${GRAPH_BASE}/${igAccountId}?fields=followers_count,follows_count,media_count&access_token=${accessToken}`
    );
    const data = await res.json() as {
      followers_count?: number;
      follows_count?: number;
      media_count?: number;
      error?: { message: string };
    };

    if (data.error) {
      console.error('[ig-account-sync] Profile fetch error:', data.error.message);
      return null;
    }

    return {
      followers_count: data.followers_count ?? 0,
      follows_count: data.follows_count ?? 0,
      media_count: data.media_count ?? 0,
    };
  } catch (err) {
    console.error('[ig-account-sync] Profile fetch failed:', err);
    return null;
  }
}

// ── Fetch daily insights (period=day) ──────────────────────────

async function fetchDailyInsights(
  igAccountId: string,
  accessToken: string,
  since: number,
  until: number
): Promise<DailyInsightsFetchResult> {
  const metrics = [
    'views',
    'reach',
    'profile_views',
    'accounts_engaged',
    'total_interactions',
    'likes',
    'comments',
    'shares',
    'saves',
    'replies',
    'website_clicks',
    'profile_links_taps',
  ].join(',');

  const allInsights: IGInsight[] = [];
  const errors: string[] = [];

  const dayRanges = buildDayRanges(since, until);

  for (const day of dayRanges) {
    try {
      const url = `${GRAPH_BASE}/${igAccountId}/insights?metric=${metrics}&metric_type=total_value&period=day&since=${day.since}&until=${day.until}&access_token=${accessToken}`;
      const res = await fetch(url);
      const data = await res.json() as {
        data?: IGInsight[];
        error?: { message: string; code: number };
      };

      if (data.error) {
        console.error('[ig-account-sync] Daily insights error:', data.error);
        errors.push(`Daily insights ${day.date}: ${data.error.message}`);
        continue;
      }

      for (const insight of data.data || []) {
        const normalized = normalizeInsightValues(insight, day.date);
        allInsights.push({
          name: insight.name,
          period: insight.period,
          values: normalized,
        });
      }
    } catch (err) {
      console.error('[ig-account-sync] Daily insights fetch failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Daily insights ${day.date} fetch failed: ${msg}`);
    }
  }

  return { insights: allInsights, errors };
}

async function fetchFollowerCountInsights(
  igAccountId: string,
  accessToken: string,
  since: number,
  until: number
): Promise<DailyInsightsFetchResult> {
  const errors: string[] = [];

  try {
    const url = `${GRAPH_BASE}/${igAccountId}/insights?metric=follower_count&period=day&since=${since}&until=${until}&access_token=${accessToken}`;
    const res = await fetch(url);
    const data = await res.json() as { data?: IGInsight[]; error?: { message: string } };

    if (data.error) {
      console.error('[ig-account-sync] follower_count error:', data.error);
      errors.push(`Follower count: ${data.error.message}`);
      return { insights: [], errors };
    }

    return {
      insights: (data.data || []).map((insight) => ({
        name: insight.name,
        period: insight.period,
        values: normalizeInsightValues(insight),
      })),
      errors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Follower count fetch failed: ${msg}`);
    return { insights: [], errors };
  }
}

async function fetchDailyInsightsFallback(
  igAccountId: string,
  accessToken: string,
  since: number,
  until: number
): Promise<DailyInsightsFetchResult> {
  const metrics = ['views', 'reach', 'profile_views'].join(',');
  const errors: string[] = [];

  const dayRanges = buildDayRanges(since, until);

  try {
    const insights: IGInsight[] = [];
    for (const day of dayRanges) {
      const url = `${GRAPH_BASE}/${igAccountId}/insights?metric=${metrics}&metric_type=total_value&period=day&since=${day.since}&until=${day.until}&access_token=${accessToken}`;
      const res = await fetch(url);
      const data = await res.json() as { data?: IGInsight[]; error?: { message: string } };
      if (data.error) {
        console.error('[ig-account-sync] Fallback daily insights error:', data.error);
        errors.push(`Fallback daily insights ${day.date}: ${data.error.message}`);
        continue;
      }
      for (const insight of data.data || []) {
        insights.push({
          name: insight.name,
          period: insight.period,
          values: normalizeInsightValues(insight, day.date),
        });
      }
    }
    return { insights, errors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Fallback daily insights fetch failed: ${msg}`);
    return { insights: [], errors };
  }
}

// ── Fetch lifetime demographics ────────────────────────────────

async function fetchDemographics(
  igAccountId: string,
  accessToken: string
): Promise<DemographicsFetchResult> {
  const errors: string[] = [];

  try {
    const gender = await fetchDemographicBreakdown(igAccountId, accessToken, 'gender');
    const age = await fetchDemographicBreakdown(igAccountId, accessToken, 'age');
    const city = await fetchDemographicBreakdown(igAccountId, accessToken, 'city');
    const country = await fetchDemographicBreakdown(igAccountId, accessToken, 'country');

    errors.push(...gender.errors, ...age.errors, ...city.errors, ...country.errors);

    const audienceGenderAge: Record<string, number> = {};
    for (const [key, value] of Object.entries(gender.data)) {
      audienceGenderAge[`gender:${key}`] = value;
    }
    for (const [key, value] of Object.entries(age.data)) {
      audienceGenderAge[`age:${key}`] = value;
    }

    return {
      demographics: {
        audience_gender_age: audienceGenderAge,
        audience_city: city.data,
        audience_country: country.data,
        audience_locale: {},
      },
      errors,
    };
  } catch (err) {
    console.error('[ig-account-sync] Demographics fetch failed:', err);
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Demographics fetch failed: ${msg}`);
    return { demographics: null, errors };
  }
}

async function fetchDemographicBreakdown(
  igAccountId: string,
  accessToken: string,
  breakdown: 'age' | 'city' | 'country' | 'gender'
): Promise<{ data: Record<string, number>; errors: string[] }> {
  const errors: string[] = [];

  try {
    const url = `${GRAPH_BASE}/${igAccountId}/insights?metric=follower_demographics&breakdown=${breakdown}&metric_type=total_value&period=lifetime&access_token=${accessToken}`;
    const res = await fetch(url);
    const data = await res.json() as { data?: IGInsight[]; error?: { message: string } };

    if (data.error) {
      console.error(`[ig-account-sync] Demographics ${breakdown} error:`, data.error);
      errors.push(`Demographics ${breakdown}: ${data.error.message}`);
      return { data: {}, errors };
    }

    const result: Record<string, number> = {};
    for (const insight of data.data || []) {
      for (const item of extractBreakdownResults(insight)) {
        if (!item.key) continue;
        result[item.key] = item.value;
      }
    }

    return { data: result, errors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Demographics ${breakdown} fetch failed: ${msg}`);
    return { data: {}, errors };
  }
}

function buildDayRanges(since: number, until: number): Array<{ date: string; since: number; until: number }> {
  const ranges: Array<{ date: string; since: number; until: number }> = [];
  const start = new Date(since * 1000);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(until * 1000);
  end.setUTCHours(0, 0, 0, 0);

  for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dayStart = new Date(cursor);
    const dayEnd = new Date(cursor);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    ranges.push({
      date: dayStart.toISOString().split('T')[0],
      since: Math.floor(dayStart.getTime() / 1000),
      until: Math.floor(dayEnd.getTime() / 1000),
    });
  }

  return ranges;
}

function normalizeInsightValues(insight: IGInsight, fallbackDate?: string): IGInsightValue[] {
  if (Array.isArray(insight.values)) {
    return insight.values;
  }

  const totalValue = insight.total_value?.value;
  if (typeof totalValue === 'number') {
    const date = fallbackDate || new Date().toISOString().split('T')[0];
    return [{
      end_time: `${date}T00:00:00+0000`,
      value: totalValue,
    }];
  }

  return [];
}

function extractBreakdownResults(insight: IGInsight): Array<{ key: string; value: number }> {
  const breakdowns = insight.total_value?.breakdowns || [];
  const results: Array<{ key: string; value: number }> = [];

  for (const breakdown of breakdowns) {
    for (const item of breakdown.results || []) {
      const key = item.dimension_values?.join('.') || '';
      const value = item.value ?? 0;
      results.push({ key, value });
    }
  }

  return results;
}
