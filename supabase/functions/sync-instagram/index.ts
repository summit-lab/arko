/**
 * Supabase Edge Function: sync-instagram
 *
 * Replaces the heavy Vercel Function with a free Supabase Edge Function.
 * Handles: media sync, ads sync, account insights, benchmark refresh.
 *
 * Invoked by the Next.js thin proxy at POST /api/v1/sync/instagram.
 * Protected by SYNC_SECRET header.
 */

import { createServiceClient } from "../_shared/supabase-client.ts";
import type {
  IGMedia,
  IGInsight,
  IGInsightValue,
  AdRecord,
  InsightRow,
  MatchResult,
  SyncResult,
  AdsSyncResult,
  AccountSyncResult,
  ApifyReelItem,
} from "../_shared/types.ts";

// deno-lint-ignore-file no-explicit-any

const GRAPH_API_VERSION = "v25.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ═══════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req: Request) => {
  // Only POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  // Validate SYNC_SECRET
  const syncSecret = Deno.env.get("SYNC_SECRET");
  const authHeader = req.headers.get("x-sync-secret");
  if (!syncSecret || authHeader !== syncSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const body = await req.json();
    const { workspace_id, steps = "all" } = body as { workspace_id: string; steps?: string };

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "workspace_id is required" }), { status: 400 });
    }

    const supabase = createServiceClient();
    const encryptionKey = Deno.env.get("META_TOKENS_ENCRYPTION_KEY");

    // Validate connection
    const { data: connection, error: connError } = await supabase
      .from("meta_connections")
      .select("id, status, ig_business_account_id, ig_username, ad_account_ids")
      .eq("workspace_id", workspace_id)
      .eq("status", "active")
      .single();

    if (connError || !connection) {
      return jsonResponse({ status: "error", error: "No active Meta connection found" }, 400);
    }

    if (!connection.ig_business_account_id) {
      return jsonResponse({ status: "error", error: "No IG Business Account found" }, 400);
    }

    // Decrypt token
    const { data: tokenData } = await supabase.rpc("get_meta_access_token", {
      p_workspace_id: workspace_id,
      p_encryption_key: encryptionKey!,
    });
    const accessToken = tokenData as string;
    if (!accessToken) {
      return jsonResponse({ status: "error", error: "Failed to decrypt access token" }, 500);
    }

    // ── QUICK SYNC: Only latest media + insights, return fast ──
    if (steps === "quick") {
      return await handleQuickSync(supabase, workspace_id, connection.ig_business_account_id, accessToken);
    }

    // ── CHECK: Just check if there are new media items (for polling) ──
    if (steps === "check") {
      return await handleCheckNewMedia(supabase, workspace_id, connection.ig_business_account_id, accessToken);
    }

    // Create sync job
    const { data: reelsJob } = await supabase
      .from("sync_jobs")
      .insert({ workspace_id, job_type: "full_sync", status: "queued" })
      .select("id")
      .single();

    if (!reelsJob) {
      return jsonResponse({ status: "error", error: "Failed to create sync job" }, 500);
    }

    const t0 = Date.now();
    let reelsResult: SyncResult = { reelsSynced: 0, reelsSkipped: 0, insightsFetched: 0, durationsEnriched: 0, errors: [] };
    let adsResult: AdsSyncResult | null = null;
    let benchmarkResult: { snapshot_id: string; reels_in_window: number; window_start: string; window_end: string } | null = null;
    let accountResult: AccountSyncResult | null = null;

    // ── Step 1+2: Media + Ads ──
    if (steps === "all" || steps === "media") {
      reelsResult = await syncInstagramReels(supabase, workspace_id, reelsJob.id, connection.ig_business_account_id, accessToken);

      if (connection.ad_account_ids?.length) {
        const { data: adsJob } = await supabase
          .from("sync_jobs")
          .insert({ workspace_id, job_type: "ads_insights", status: "queued" })
          .select("id")
          .single();
        if (adsJob) {
          adsResult = await syncAdsMetrics(supabase, workspace_id, adsJob.id, connection.ad_account_ids, accessToken);
        }
      }

      // Benchmark refresh
      try {
        const snapshot = await refreshReelBenchmarks(supabase, workspace_id);
        benchmarkResult = {
          snapshot_id: snapshot.snapshotId,
          reels_in_window: snapshot.reelsInWindow,
          window_start: snapshot.windowStart,
          window_end: snapshot.windowEnd,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        reelsResult.errors.push(`Benchmark refresh: ${message}`);
      }
    }

    // ── Step 3: Account Insights ──
    if (steps === "all" || steps === "account") {
      const { data: accountJob } = await supabase
        .from("sync_jobs")
        .insert({ workspace_id, job_type: "account_insights", status: "queued" })
        .select("id")
        .single();
      if (accountJob) {
        accountResult = await syncAccountInsights(supabase, workspace_id, accountJob.id, connection.ig_business_account_id, accessToken);
      }
    }

    const combinedErrors = [
      ...reelsResult.errors,
      ...(adsResult?.errors ?? []),
      ...(accountResult?.errors ?? []),
    ];

    return jsonResponse({
      status: combinedErrors.length > 0 && reelsResult.reelsSynced === 0 ? "failed" : "completed",
      duration_ms: Date.now() - t0,
      errors: combinedErrors.slice(0, 5),
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
    console.error("[sync-instagram] Unhandled error:", err);
    return jsonResponse({ status: "error", error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ═══════════════════════════════════════════════════════════════
// DATA DECAY — Tiered staleness based on reel age
// ═══════════════════════════════════════════════════════════════

/**
 * Returns how long insights stay "fresh" based on reel age.
 * Hot reels (< 7d) change fast → refresh every 1h.
 * Warm reels (7-30d) slow down → refresh every 24h.
 * Cold reels (> 30d) are stable → refresh every 7 days.
 */
function getInsightStalenessMs(publishedAt: string | null): number {
  if (!publishedAt) return 6 * 60 * 60 * 1000; // 6h fallback for unknown age
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  if (ageMs < SEVEN_DAYS) return 60 * 60 * 1000;         // Hot:  1 hour
  if (ageMs < THIRTY_DAYS) return 24 * 60 * 60 * 1000;   // Warm: 24 hours
  return 7 * 24 * 60 * 60 * 1000;                         // Cold: 7 days
}

/** Check if a reel's insights are stale based on its age tier */
function isInsightStale(publishedAt: string | null, fetchedAt: string | null): boolean {
  if (!fetchedAt) return true; // never fetched
  const threshold = getInsightStalenessMs(publishedAt);
  const fetchedMs = new Date(fetchedAt).getTime();
  return Date.now() - fetchedMs > threshold;
}

// ═══════════════════════════════════════════════════════════════
// QUICK SYNC — Latest media + smart insight refresh (~3-6s)
// ═══════════════════════════════════════════════════════════════

// deno-lint-ignore no-explicit-any
async function handleQuickSync(supabase: any, workspaceId: string, igAccountId: string, accessToken: string): Promise<Response> {
  const t0 = Date.now();
  const QUICK_LIMIT = 12;

  try {
    // 1) Fetch latest 12 media from IG + existing metrics timestamps in parallel
    const fields = "id,caption,media_type,media_product_type,permalink,media_url,thumbnail_url,timestamp,is_shared_to_feed";
    const [igRes, existingRes] = await Promise.all([
      fetch(`${GRAPH_BASE}/${igAccountId}/media?fields=${fields}&limit=${QUICK_LIMIT}&access_token=${accessToken}`),
      supabase
        .from("reels")
        .select("ig_media_id, reel_metrics(fetched_at)")
        .eq("workspace_id", workspaceId)
        .order("published_at", { ascending: false })
        .limit(QUICK_LIMIT),
    ]);

    const igData = await igRes.json();
    if (igData.error) throw new Error(`IG API: ${igData.error.message}`);
    const media: IGMedia[] = igData.data || [];

    // 2) Batch upsert all reels (1 query)
    const rows = media.map((m) => ({
      workspace_id: workspaceId,
      ig_media_id: m.id,
      caption: m.caption || null,
      media_type: m.media_type,
      media_product_type: m.media_product_type,
      permalink: m.permalink || null,
      media_url: m.media_url || null,
      thumbnail_url: m.thumbnail_url || null,
      is_shared_to_feed: m.is_shared_to_feed ?? null,
      published_at: m.timestamp || null,
      reel_type: classifyReelType(m),
      sync_status: "synced",
    }));

    const { data: upserted } = await supabase
      .from("reels")
      .upsert(rows, { onConflict: "workspace_id,ig_media_id" })
      .select("id, ig_media_id");

    const reelIdMap = new Map<string, string>();
    for (const r of upserted || []) reelIdMap.set(r.ig_media_id, r.id);

    // 3) Determine which reels need fresh insights (data decay tiers)
    //    Hot (<7d) → 1h, Warm (7-30d) → 24h, Cold (>30d) → 7d
    const existingMetricsMap = new Map<string, { fetched_at: string | null; published_at: string | null }>();
    for (const r of existingRes.data || []) {
      const metricsArr = r.reel_metrics as Array<{ fetched_at: string }> | null;
      const fetchedAt = Array.isArray(metricsArr) ? metricsArr[0]?.fetched_at : null;
      existingMetricsMap.set(r.ig_media_id, { fetched_at: fetchedAt, published_at: null });
    }

    const mediaNeedingInsights = media.filter((m) => {
      const existing = existingMetricsMap.get(m.id);
      return isInsightStale(m.timestamp || null, existing?.fetched_at ?? null);
    });
    const insightsSkipped = media.length - mediaNeedingInsights.length;

    // 4) Fetch insights only for stale/new reels — all in parallel (max ~6)
    let insightsFetched = 0;
    if (mediaNeedingInsights.length > 0) {
      await Promise.all(mediaNeedingInsights.map(async (m) => {
        const reelId = reelIdMap.get(m.id);
        if (!reelId) return;
        try {
          const isReel = m.media_product_type === "REELS";
          const insights = isReel
            ? await fetchReelInsights(m.id, accessToken)
            : await fetchPostInsights(m.id, accessToken);
          if (insights) {
            await supabase.from("reel_metrics").upsert({
              reel_id: reelId,
              workspace_id: workspaceId,
              views_org: insights.views ?? null,
              impressions_org: null,
              reach_org: insights.reach ?? null,
              likes_total: insights.likes ?? null,
              comments_total: insights.comments ?? null,
              shares_total: insights.shares ?? null,
              saves_total: insights.saved ?? null,
              total_interactions: insights.total_interactions ?? null,
              avg_watch_time_sec: insights.ig_reels_avg_watch_time ? insights.ig_reels_avg_watch_time / 1000 : null,
              fetched_at: new Date().toISOString(),
            }, { onConflict: "reel_id" });
            insightsFetched++;
          }
        } catch { /* non-blocking */ }
      }));
    }

    return jsonResponse({
      status: "completed",
      mode: "quick",
      duration_ms: Date.now() - t0,
      reels_synced: upserted?.length ?? 0,
      insights_fetched: insightsFetched,
      insights_skipped: insightsSkipped,
    });
  } catch (err) {
    return jsonResponse({
      status: "error",
      mode: "quick",
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════
// CHECK NEW MEDIA — Compare latest IG media IDs vs DB (~1-2s)
// ═══════════════════════════════════════════════════════════════

// deno-lint-ignore no-explicit-any
async function handleCheckNewMedia(supabase: any, workspaceId: string, igAccountId: string, accessToken: string): Promise<Response> {
  try {
    // Fetch only latest 5 media IDs from IG (minimal fields, fast)
    const res = await fetch(`${GRAPH_BASE}/${igAccountId}/media?fields=id,timestamp&limit=5&access_token=${accessToken}`);
    const data = await res.json();
    if (data.error) throw new Error(`IG API: ${data.error.message}`);
    const latestIds: string[] = (data.data || []).map((m: { id: string }) => m.id);

    // Check which ones we already have
    const { data: existing } = await supabase
      .from("reels")
      .select("ig_media_id")
      .eq("workspace_id", workspaceId)
      .in("ig_media_id", latestIds);

    const existingIds = new Set((existing || []).map((r: { ig_media_id: string }) => r.ig_media_id));
    const newIds = latestIds.filter((id) => !existingIds.has(id));

    return jsonResponse({
      status: "ok",
      has_new_content: newIds.length > 0,
      new_count: newIds.length,
      latest_timestamp: data.data?.[0]?.timestamp || null,
    });
  } catch (err) {
    return jsonResponse({
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════
// INSTAGRAM REELS SYNC (FULL)
// ═══════════════════════════════════════════════════════════════

// deno-lint-ignore no-explicit-any
async function syncInstagramReels(supabase: any, workspaceId: string, syncJobId: string, igAccountId: string, accessToken: string): Promise<SyncResult> {
  const result: SyncResult = { reelsSynced: 0, reelsSkipped: 0, insightsFetched: 0, durationsEnriched: 0, errors: [] };

  try {
    await supabase.from("sync_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", syncJobId);

    const allMedia = await fetchAllMedia(igAccountId, accessToken);
    await supabase.from("sync_jobs").update({ total_items: allMedia.length }).eq("id", syncJobId);

    // Get existing reels with metrics timestamps + published_at for decay tiers
    const { data: existingReels } = await supabase
      .from("reels")
      .select("ig_media_id, published_at, reel_metrics(fetched_at)")
      .eq("workspace_id", workspaceId);

    // Build lookup: ig_media_id → { fetched_at, published_at }
    const existingMetricsLookup = new Map<string, { fetched_at: string | null; published_at: string | null }>();
    for (const r of existingReels || []) {
      const metricsArr = r.reel_metrics as Array<{ fetched_at: string }> | null;
      const fetchedAt = Array.isArray(metricsArr) ? metricsArr[0]?.fetched_at : null;
      existingMetricsLookup.set(r.ig_media_id, { fetched_at: fetchedAt, published_at: r.published_at });
    }

    const MAX_INSIGHTS_PER_SYNC = 30;
    let insightsFetchCount = 0;

    // ── Phase 1: Batch upsert all reels (fast, no API calls) ──
    const UPSERT_BATCH = 20;
    const reelIdMap = new Map<string, string>(); // ig_media_id → reel uuid
    for (let i = 0; i < allMedia.length; i += UPSERT_BATCH) {
      const batch = allMedia.slice(i, i + UPSERT_BATCH);
      const rows = batch.map((media) => ({
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
        reel_type: classifyReelType(media),
        sync_status: "synced",
      }));

      const { data: upserted, error: batchError } = await supabase
        .from("reels")
        .upsert(rows, { onConflict: "workspace_id,ig_media_id" })
        .select("id, ig_media_id");

      if (batchError) {
        result.errors.push(`Batch upsert [${i}..${i + batch.length}]: ${batchError.message}`);
        result.reelsSkipped += batch.length;
      } else {
        result.reelsSynced += (upserted?.length ?? 0);
        for (const r of upserted || []) {
          reelIdMap.set(r.ig_media_id, r.id);
        }
      }
    }

    // ── Phase 2: Fetch insights using data decay tiers ──
    // Hot (<7d) → stale after 1h, Warm (7-30d) → 24h, Cold (>30d) → 7d
    const mediaNeedingInsights = allMedia.filter((m) => {
      if (!reelIdMap.has(m.id)) return false;
      const existing = existingMetricsLookup.get(m.id);
      const publishedAt = m.timestamp || existing?.published_at || null;
      return isInsightStale(publishedAt, existing?.fetched_at ?? null);
    });

    // Sort by priority: hot first, then warm, then cold
    mediaNeedingInsights.sort((a, b) => {
      const ageA = a.timestamp ? Date.now() - new Date(a.timestamp).getTime() : Infinity;
      const ageB = b.timestamp ? Date.now() - new Date(b.timestamp).getTime() : Infinity;
      return ageA - ageB; // newest first
    });

    const insightsToFetch = mediaNeedingInsights.slice(0, MAX_INSIGHTS_PER_SYNC);

    // Update progress: total = media upserted + insights to fetch
    const totalWork = allMedia.length + insightsToFetch.length;
    let processedWork = allMedia.length; // media upsert done
    await supabase.from("sync_jobs").update({
      total_items: totalWork,
      processed_items: processedWork,
    }).eq("id", syncJobId);

    const CONCURRENCY = 5;
    for (let i = 0; i < insightsToFetch.length; i += CONCURRENCY) {
      const batch = insightsToFetch.slice(i, i + CONCURRENCY);
      const promises = batch.map(async (media) => {
        try {
          const isReel = media.media_product_type === "REELS";
          const insights = isReel
            ? await fetchReelInsights(media.id, accessToken)
            : await fetchPostInsights(media.id, accessToken);

          if (insights) {
            const reelId = reelIdMap.get(media.id)!;
            const { error: metricsError } = await supabase.from("reel_metrics").upsert({
              reel_id: reelId,
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
              avg_watch_time_sec: insights.ig_reels_avg_watch_time ? insights.ig_reels_avg_watch_time / 1000 : null,
              fetched_at: new Date().toISOString(),
            }, { onConflict: "reel_id" });

            if (metricsError) result.errors.push(`Reel ${media.id}: metrics upsert — ${metricsError.message}`);
            else result.insightsFetched++;
          }
        } catch (err) {
          result.errors.push(`Reel ${media.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
      await Promise.all(promises);
      insightsFetchCount += batch.length;

      // Incremental progress update after each batch
      processedWork += batch.length;
      await supabase.from("sync_jobs").update({ processed_items: processedWork }).eq("id", syncJobId);
    }

    // Enrich durations via Apify
    const apifyToken = getApifyToken();
    if (apifyToken) {
      const { data: reelsMissingDuration } = await supabase
        .from("reels")
        .select("id, permalink")
        .eq("workspace_id", workspaceId)
        .eq("media_product_type", "REELS")
        .is("duration_seconds", null)
        .not("permalink", "is", null)
        .limit(5);

      // Get workspace owner for usage logging
      const { data: wsOwner } = await supabase
        .from("workspaces")
        .select("owner_id")
        .eq("id", workspaceId)
        .single();
      const ownerId = wsOwner?.owner_id;

      for (const reel of reelsMissingDuration || []) {
        try {
          const t0 = Date.now();
          const duration = await fetchApifyReelDuration(reel.permalink!, apifyToken);
          const latencyMs = Date.now() - t0;

          // Log integration usage
          if (ownerId) {
            supabase.from("integration_usage").insert({
              workspace_id: workspaceId,
              user_id: ownerId,
              feature: "ig-sync-enrichment",
              provider: "scraper",
              operation: "reel-scrape",
              items_count: 1,
              cost_usd: 0.0033,
              latency_ms: latencyMs,
              status: duration ? "success" : "error",
            }).then(() => {});
          }

          if (duration) {
            await supabase.from("reels").update({ duration_seconds: duration }).eq("id", reel.id);
            result.durationsEnriched++;
          }
        } catch { /* non-blocking */ }
      }
    }

    // ── Snapshot daily metrics for time-series charts ──
    try {
      await snapshotDailyMetrics(supabase, workspaceId);
    } catch (err) {
      result.errors.push(`Daily snapshot: ${err instanceof Error ? err.message : String(err)}`);
    }

    await supabase.from("sync_jobs").update({
      status: "completed",
      processed_items: totalWork,
      completed_at: new Date().toISOString(),
      metadata: result as unknown as Record<string, unknown>,
    }).eq("id", syncJobId);

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    await supabase.from("sync_jobs").update({
      status: "failed", completed_at: new Date().toISOString(), error_message: msg,
      metadata: result as unknown as Record<string, unknown>,
    }).eq("id", syncJobId);
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════
// ADS SYNC
// ═══════════════════════════════════════════════════════════════

// deno-lint-ignore no-explicit-any
async function syncAdsMetrics(supabase: any, workspaceId: string, syncJobId: string, adAccountIds: string[], accessToken: string): Promise<AdsSyncResult> {
  const result: AdsSyncResult = { adsProcessed: 0, adsMapped: 0, adsUnmapped: 0, reelsUpdated: 0, errors: [] };

  try {
    await supabase.from("sync_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", syncJobId);

    // Build reel lookup maps
    const { data: existingReels } = await supabase.from("reels").select("id, ig_media_id, permalink").eq("workspace_id", workspaceId);

    const reelsByIgMediaId = new Map<string, string>();
    const reelsByPermalink = new Map<string, string>();
    const reelsByShortcode = new Map<string, string>();
    for (const r of existingReels || []) {
      reelsByIgMediaId.set(r.ig_media_id, r.id);
      const np = normalizeInstagramUrl(r.permalink);
      const sc = extractInstagramShortcode(r.permalink);
      if (np) reelsByPermalink.set(np, r.id);
      if (sc) reelsByShortcode.set(sc, r.id);
    }

    const paidByReel = new Map<string, { views_paid: number; impressions_paid: number; reach_paid: number; clicks: number; spend_cents: number; video_plays: number }>();

    for (const acctId of adAccountIds) {
      try {
        const ads = await fetchAdsWithCreative(acctId, accessToken);
        if (ads.length === 0) continue;

        const insightsMap = await fetchInsightsByAd(acctId, accessToken);
        const adsById = new Map<string, AdRecord>(ads.map((ad) => [ad.id, ad]));

        // Recover missing ads
        const missingAdIds = [...insightsMap.keys()].filter((adId) => !adsById.has(adId));
        for (const missingAdId of missingAdIds) {
          const recovered = await fetchAdByIdWithCreative(missingAdId, accessToken);
          if (recovered) adsById.set(recovered.id, recovered);
        }

        for (const ad of adsById.values()) {
          result.adsProcessed++;
          const match = resolveAdToReel(ad, reelsByIgMediaId, reelsByPermalink, reelsByShortcode);
          if (!match) { result.adsUnmapped++; continue; }
          result.adsMapped++;

          const insight = insightsMap.get(ad.id);
          const videoPlays = getActionMetricValue(insight?.video_play_actions, "video_view");
          const impressions = parseInt(insight?.impressions || "0") || 0;
          const reach = parseInt(insight?.reach || "0") || 0;
          const outboundClicks = getActionMetricValue(insight?.outbound_clicks, "outbound_click");
          const inlineLinkClicks = parseInt(insight?.inline_link_clicks || "0") || 0;
          const clicks = outboundClicks || inlineLinkClicks || (parseInt(insight?.clicks || "0") || 0);
          const spendCents = Math.round(parseFloat(insight?.spend || "0") * 100) || 0;

          await supabase.from("ad_mappings").upsert({
            reel_id: match.reelId, workspace_id: workspaceId, ad_id: ad.id, ad_name: ad.name,
            campaign_id: ad.campaign_id, adset_id: ad.adset_id, ad_account_id: acctId,
            match_method: match.matchMethod === "creative_permalink" || match.matchMethod === "shortcode" ? "creative_permalink" : "object_story_id",
            match_confidence: match.matchMethod === "source_instagram_media_id" || match.matchMethod === "effective_instagram_media_id" || match.matchMethod === "object_story_id" ? "high" : "medium",
            impressions, reach, clicks, spend_cents: spendCents, video_plays: videoPlays,
            object_story_id: ad.creative?.object_story_id || null,
            creative_id: ad.creative?.id || null,
          }, { onConflict: "reel_id,ad_id" });

          const prev = paidByReel.get(match.reelId) || { views_paid: 0, impressions_paid: 0, reach_paid: 0, clicks: 0, spend_cents: 0, video_plays: 0 };
          prev.views_paid += videoPlays;
          prev.impressions_paid += impressions;
          prev.reach_paid += reach;
          prev.clicks += clicks;
          prev.spend_cents += spendCents;
          prev.video_plays += videoPlays;
          paidByReel.set(match.reelId, prev);
        }
      } catch (err) {
        result.errors.push(`${acctId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    for (const [reelId, metrics] of paidByReel) {
      const { error } = await supabase.from("reel_metrics_paid").upsert(
        { reel_id: reelId, workspace_id: workspaceId, ...metrics, fetched_at: new Date().toISOString() },
        { onConflict: "reel_id" }
      );
      if (!error) {
        result.reelsUpdated++;
        await supabase.from("reels").update({ has_ads: true, attribution_confidence: "high" }).eq("id", reelId);
      }
    }

    await supabase.from("sync_jobs").update({
      status: "completed", processed_items: result.adsProcessed, completed_at: new Date().toISOString(),
      metadata: result as unknown as Record<string, unknown>,
    }).eq("id", syncJobId);

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    await supabase.from("sync_jobs").update({ status: "failed", error_message: msg, completed_at: new Date().toISOString() }).eq("id", syncJobId);
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════
// ACCOUNT INSIGHTS SYNC
// ═══════════════════════════════════════════════════════════════

// deno-lint-ignore no-explicit-any
async function syncAccountInsights(supabase: any, workspaceId: string, syncJobId: string, igAccountId: string, accessToken: string): Promise<AccountSyncResult> {
  const result: AccountSyncResult = { daysUpserted: 0, demographicsUpserted: false, errors: [] };

  try {
    await supabase.from("sync_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", syncJobId);

    // Profile fields
    const profileData = await fetchProfileFields(igAccountId, accessToken);

    // Daily insights (last 30 days)
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const until = Math.floor(todayUtc.getTime() / 1000);
    const since = until - (30 * 24 * 60 * 60);

    const dailyInsightsResult = await fetchDailyInsights(igAccountId, accessToken, since, until);
    const followerCountResult = await fetchFollowerCountInsights(igAccountId, accessToken, since, until);
    const dailyInsights = [...dailyInsightsResult.insights, ...followerCountResult.insights];
    result.errors.push(...dailyInsightsResult.errors, ...followerCountResult.errors);

    // Group by date and upsert
    const dayMap = new Map<string, Record<string, number>>();
    for (const insight of dailyInsights) {
      const normalizedValues = normalizeInsightValues(insight);
      for (const val of normalizedValues) {
        if (typeof val.value !== "number") continue;
        const date = val.end_time.split("T")[0];
        const existing = dayMap.get(date) || {};
        existing[insight.name] = val.value as number;
        dayMap.set(date, existing);
      }
    }

    // Debug: log follower_count values from dayMap
    const fcSample = [...dayMap.entries()].slice(-5).map(([d, m]) => `${d}:${m.follower_count ?? 'undefined'}`);
    console.log(`[follower_count] dayMap sample (last 5):`, fcSample.join(', '));

    for (const [date, metrics] of dayMap) {
      // follower_count from Meta period=day is a daily net change (delta), not total.
      // When Meta doesn't return it, store 0 — never fall back to the profile total.
      const followerValue = metrics.follower_count ?? 0;

      const { error } = await supabase.from("ig_account_insights").upsert({
        workspace_id: workspaceId, metric_date: date,
        impressions: metrics.views ?? metrics.content_views ?? 0,
        reach: metrics.reach ?? 0, profile_views: metrics.profile_views ?? 0,
        follower_count: followerValue,
        followers_total: profileData?.followers_count ?? 0,
        follows_count: profileData?.follows_count ?? 0, media_count: profileData?.media_count ?? 0,
        accounts_engaged: metrics.accounts_engaged ?? 0,
        total_interactions: (metrics.likes ?? 0) + (metrics.comments ?? 0) + (metrics.shares ?? 0) + (metrics.saves ?? 0),
        likes: metrics.likes ?? 0, comments: metrics.comments ?? 0, shares: metrics.shares ?? 0,
        saves: metrics.saves ?? 0, replies: metrics.replies ?? 0,
        website_clicks: metrics.website_clicks ?? metrics.profile_links_taps ?? 0,
        email_contacts: metrics.email_contacts ?? 0, phone_call_clicks: metrics.phone_call_clicks ?? 0,
        get_directions_clicks: metrics.get_directions_clicks ?? 0,
        fetched_at: new Date().toISOString(),
      }, { onConflict: "workspace_id,metric_date" });
      if (error) result.errors.push(`Day ${date}: ${error.message}`);
      else result.daysUpserted++;
    }

    // Upsert today's row with followers_total snapshot.
    // Meta doesn't provide today's metrics yet, but we need this snapshot
    // so tomorrow's diff (followers_total[today] - followers_total[yesterday]) works correctly.
    if (followersTotal > 0) {
      const syncDate = new Date().toISOString().split("T")[0];
      await supabase
        .from("ig_account_insights")
        .upsert(
          { workspace_id: workspaceId, metric_date: syncDate, followers_total: followersTotal },
          { onConflict: "workspace_id,metric_date" }
        );
    }

    // Demographics
    try {
      const demographics = await fetchDemographics(igAccountId, accessToken);
      if (demographics) {
        const today = new Date().toISOString().split("T")[0];
        const { error: demoError } = await supabase.from("ig_account_demographics").upsert({
          workspace_id: workspaceId, snapshot_date: today,
          audience_gender_age: demographics.audience_gender_age ?? {},
          audience_city: demographics.audience_city ?? {},
          audience_country: demographics.audience_country ?? {},
          audience_locale: demographics.audience_locale ?? {},
          fetched_at: new Date().toISOString(),
        }, { onConflict: "workspace_id,snapshot_date" });
        if (demoError) result.errors.push(`Demographics: ${demoError.message}`);
        else result.demographicsUpserted = true;
      }
    } catch (err) {
      result.errors.push(`Demographics: ${err instanceof Error ? err.message : String(err)}`);
    }

    await supabase.from("sync_jobs").update({
      status: "completed", processed_items: result.daysUpserted, completed_at: new Date().toISOString(),
      metadata: result as unknown as Record<string, unknown>,
    }).eq("id", syncJobId);

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    await supabase.from("sync_jobs").update({ status: "failed", error_message: msg, completed_at: new Date().toISOString() }).eq("id", syncJobId);
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════
// BENCHMARK REFRESH
// ═══════════════════════════════════════════════════════════════

// deno-lint-ignore no-explicit-any
async function refreshReelBenchmarks(supabase: any, workspaceId: string) {
  const BENCHMARK_WINDOW_DAYS = 90;
  const end = new Date(); end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - (BENCHMARK_WINDOW_DAYS - 1));
  const windowStart = start.toISOString().split("T")[0];
  const windowEnd = end.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("reels")
    .select("id, reel_type, published_at, reel_metrics(views_org, likes_total, comments_total, shares_total, saves_total, follows_generated, reach_org, avg_watch_time_sec), reel_metrics_paid(views_paid, reach_paid)")
    .eq("workspace_id", workspaceId)
    .eq("media_product_type", "REELS")
    .not("published_at", "is", null)
    .gte("published_at", `${windowStart}T00:00:00.000Z`)
    .lte("published_at", `${windowEnd}T23:59:59.999Z`);

  if (error) throw new Error(`Benchmark query failed: ${error.message}`);

  // deno-lint-ignore no-explicit-any
  const eligible = ((data ?? []) as any[])
    .map((reel) => {
      const organic = Array.isArray(reel.reel_metrics) ? reel.reel_metrics[0] : reel.reel_metrics;
      const paid = Array.isArray(reel.reel_metrics_paid) ? reel.reel_metrics_paid[0] : reel.reel_metrics_paid;
      const viewsTotal = organic?.views_org ?? 0;
      return {
        reelType: reel.reel_type,
        hasMetrics: organic != null || paid != null,
        viewsTotal,
        reachTotal: organic?.reach_org ?? 0,
        likes: organic?.likes_total ?? 0,
        comments: organic?.comments_total ?? 0,
        shares: organic?.shares_total ?? 0,
        saves: organic?.saves_total ?? 0,
        follows: organic?.follows_generated ?? 0,
        avgWatchTime: organic?.avg_watch_time_sec ?? null,
      };
    })
    .filter((r) => r.hasMetrics && r.reelType !== "trial_likely");

  const avg = (vals: number[]) => vals.length === 0 ? 0 : vals.reduce((s, v) => s + v, 0) / vals.length;
  const withViews = eligible.filter((r) => r.viewsTotal > 0);
  const withWatchTime = eligible.filter((r) => r.avgWatchTime != null);

  const { data: inserted, error: insertError } = await supabase
    .from("reel_benchmarks")
    .insert({
      workspace_id: workspaceId,
      calculated_at: new Date().toISOString(),
      window_start: windowStart, window_end: windowEnd,
      reels_in_window: eligible.length,
      avg_views_90d: avg(eligible.map((r) => r.viewsTotal)),
      avg_comments_90d: avg(eligible.map((r) => r.comments)),
      avg_saves_90d: avg(eligible.map((r) => r.saves)),
      avg_follows_90d: avg(eligible.map((r) => r.follows)),
      avg_likes_90d: avg(eligible.map((r) => r.likes)),
      avg_shares_90d: avg(eligible.map((r) => r.shares)),
      avg_reach_90d: avg(eligible.map((r) => r.reachTotal)),
      avg_watch_time_90d: avg(withWatchTime.map((r) => r.avgWatchTime ?? 0)),
      avg_likes_per_view: avg(withViews.map((r) => r.likes / r.viewsTotal)),
      avg_comments_per_view: avg(withViews.map((r) => r.comments / r.viewsTotal)),
      avg_shares_per_view: avg(withViews.map((r) => r.shares / r.viewsTotal)),
      avg_saves_per_view: avg(withViews.map((r) => r.saves / r.viewsTotal)),
      avg_follows_per_view: avg(withViews.map((r) => r.follows / r.viewsTotal)),
      exclude_trials: true, min_views_threshold: 0,
    })
    .select("id, reels_in_window, window_start, window_end")
    .single();

  if (insertError || !inserted) throw new Error(`Benchmark insert failed: ${insertError?.message}`);

  return { snapshotId: inserted.id, reelsInWindow: inserted.reels_in_window, windowStart: inserted.window_start, windowEnd: inserted.window_end };
}

// ═══════════════════════════════════════════════════════════════
// DAILY METRICS SNAPSHOT
// ═══════════════════════════════════════════════════════════════

// deno-lint-ignore no-explicit-any
async function snapshotDailyMetrics(supabase: any, workspaceId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  // Fetch all reels with their current organic + paid metrics
  const { data: reels, error } = await supabase
    .from("reels")
    .select("id, reel_metrics(views_org, reach_org, impressions_org, likes_total, comments_total, shares_total, saves_total, total_interactions, avg_watch_time_sec), reel_metrics_paid(views_paid, impressions_paid, reach_paid, spend_cents)")
    .eq("workspace_id", workspaceId);

  if (error || !reels?.length) return;

  // Build upsert rows — one per reel for today
  // deno-lint-ignore no-explicit-any
  const rows = reels.map((reel: any) => {
    const organic = Array.isArray(reel.reel_metrics) ? reel.reel_metrics[0] : reel.reel_metrics;
    const paid = Array.isArray(reel.reel_metrics_paid) ? reel.reel_metrics_paid[0] : reel.reel_metrics_paid;

    return {
      reel_id: reel.id,
      workspace_id: workspaceId,
      metric_date: today,
      views_org: organic?.views_org ?? 0,
      reach_org: organic?.reach_org ?? 0,
      impressions_org: organic?.impressions_org ?? 0,
      likes_total: organic?.likes_total ?? 0,
      comments_total: organic?.comments_total ?? 0,
      shares_total: organic?.shares_total ?? 0,
      saves_total: organic?.saves_total ?? 0,
      total_interactions: organic?.total_interactions ?? 0,
      avg_watch_time_sec: organic?.avg_watch_time_sec ?? null,
      views_paid: paid?.views_paid ?? 0,
      impressions_paid: paid?.impressions_paid ?? 0,
      reach_paid: paid?.reach_paid ?? 0,
      spend_cents: paid?.spend_cents ?? 0,
      fetched_at: new Date().toISOString(),
    };
  // deno-lint-ignore no-explicit-any
  }).filter((r: any) => r.views_org > 0 || r.likes_total > 0 || r.views_paid > 0);

  if (rows.length === 0) return;

  // Batch upsert in chunks of 50 to avoid payload limits
  const CHUNK_SIZE = 50;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await supabase.from("reel_metrics_daily").upsert(chunk, { onConflict: "reel_id,metric_date" });
  }
}

// ═══════════════════════════════════════════════════════════════
// GRAPH API HELPERS
// ═══════════════════════════════════════════════════════════════

async function fetchAllMedia(igAccountId: string, accessToken: string): Promise<IGMedia[]> {
  const fields = "id,caption,media_type,media_product_type,permalink,media_url,thumbnail_url,timestamp,is_shared_to_feed";
  const allMedia: IGMedia[] = [];
  let url: string | null = `${GRAPH_BASE}/${igAccountId}/media?fields=${fields}&limit=50&access_token=${accessToken}`;

  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(`IG API error: ${data.error.message}`);
    if (data.data) allMedia.push(...data.data);
    url = data.paging?.next || null;
  }
  return allMedia;
}

async function fetchReelInsights(igMediaId: string, accessToken: string): Promise<Record<string, number> | null> {
  const metrics = "views,reach,likes,comments,shares,saved,total_interactions,ig_reels_avg_watch_time,ig_reels_video_view_total_time";
  try {
    const res = await fetch(`${GRAPH_BASE}/${igMediaId}/insights?metric=${metrics}&access_token=${accessToken}`);
    const data = await res.json();
    if (data.error) {
      if (data.error.code === 100 || data.error.code === 3001) return await fetchReelInsightsFallback(igMediaId, accessToken);
      return null;
    }
    const result: Record<string, number> = {};
    for (const insight of data.data || []) result[insight.name] = insight.values?.[0]?.value ?? 0;
    return result;
  } catch { return null; }
}

async function fetchReelInsightsFallback(igMediaId: string, accessToken: string): Promise<Record<string, number> | null> {
  const metrics = "views,reach,likes,comments,shares,saved,ig_reels_avg_watch_time";
  try {
    const res = await fetch(`${GRAPH_BASE}/${igMediaId}/insights?metric=${metrics}&access_token=${accessToken}`);
    const data = await res.json();
    if (data.error) return null;
    const result: Record<string, number> = {};
    for (const insight of data.data || []) result[insight.name] = insight.values?.[0]?.value ?? 0;
    return result;
  } catch { return null; }
}

async function fetchPostInsights(igMediaId: string, accessToken: string): Promise<Record<string, number> | null> {
  const metrics = "impressions,reach,likes,comments,shares,saved,total_interactions";
  try {
    const res = await fetch(`${GRAPH_BASE}/${igMediaId}/insights?metric=${metrics}&access_token=${accessToken}`);
    const data = await res.json();
    if (data.error) {
      if (data.error.code === 100 || data.error.code === 3001) return await fetchPostInsightsFallback(igMediaId, accessToken);
      return null;
    }
    const result: Record<string, number> = {};
    for (const insight of data.data || []) result[insight.name] = insight.values?.[0]?.value ?? 0;
    if (result.saved !== undefined && result.saves === undefined) result.saves = result.saved;
    return result;
  } catch { return null; }
}

async function fetchPostInsightsFallback(igMediaId: string, accessToken: string): Promise<Record<string, number> | null> {
  const metrics = "impressions,reach,likes,comments,saved";
  try {
    const res = await fetch(`${GRAPH_BASE}/${igMediaId}/insights?metric=${metrics}&access_token=${accessToken}`);
    const data = await res.json();
    if (data.error) return null;
    const result: Record<string, number> = {};
    for (const insight of data.data || []) result[insight.name] = insight.values?.[0]?.value ?? 0;
    if (result.saved !== undefined) result.saves = result.saved;
    return result;
  } catch { return null; }
}

function classifyReelType(media: IGMedia): string {
  if (media.media_product_type !== "REELS") return "unknown";
  if (media.is_shared_to_feed === true) return "normal";
  if (media.is_shared_to_feed === false) return "trial_likely";
  return "unknown";
}

// ── Ads fetch helpers ──

async function fetchAdsWithCreative(adAccountId: string, accessToken: string): Promise<AdRecord[]> {
  const fields = "id,name,campaign_id,adset_id,creative{id,object_story_id,effective_instagram_media_id,source_instagram_media_id,effective_object_story_id,instagram_permalink_url}";
  const effectiveStatuses = JSON.stringify(["ACTIVE", "PAUSED", "PENDING_REVIEW", "DISAPPROVED", "PREAPPROVED", "PENDING_BILLING_INFO", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "ARCHIVED", "IN_PROCESS", "WITH_ISSUES"]);
  const allAds: AdRecord[] = [];
  let url: string | null = `${GRAPH_BASE}/${adAccountId}/ads?fields=${encodeURIComponent(fields)}&effective_status=${encodeURIComponent(effectiveStatuses)}&limit=100&access_token=${accessToken}`;
  while (url) {
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) break;
    if (json.data) allAds.push(...json.data);
    url = json.paging?.next || null;
  }
  return allAds;
}

async function fetchAdByIdWithCreative(adId: string, accessToken: string): Promise<AdRecord | null> {
  const fields = "id,name,campaign_id,adset_id,creative{id,object_story_id,effective_instagram_media_id,source_instagram_media_id,effective_object_story_id,instagram_permalink_url}";
  const res = await fetch(`${GRAPH_BASE}/${adId}?fields=${encodeURIComponent(fields)}&access_token=${accessToken}`);
  const json = await res.json();
  if (json.error || !json.id) return null;
  return { id: json.id, name: json.name, campaign_id: json.campaign_id, adset_id: json.adset_id, creative: json.creative };
}

async function fetchInsightsByAd(adAccountId: string, accessToken: string): Promise<Map<string, InsightRow>> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const until = new Date().toISOString().split("T")[0];
  const fields = "ad_id,impressions,reach,clicks,spend,ctr,cpc,cpp,frequency,inline_link_clicks,outbound_clicks,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions,video_p100_watched_actions";
  const map = new Map<string, InsightRow>();
  let url: string | null = `${GRAPH_BASE}/${adAccountId}/insights?level=ad&time_range={"since":"${since}","until":"${until}"}&fields=${fields}&limit=200&access_token=${accessToken}`;
  while (url) {
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) break;
    for (const row of json.data || []) map.set(row.ad_id, row);
    url = json.paging?.next || null;
  }
  return map;
}

function resolveAdToReel(ad: AdRecord, byId: Map<string, string>, byPermalink: Map<string, string>, byShortcode: Map<string, string>): MatchResult | null {
  const c = ad.creative;
  if (!c) return null;
  if (c.source_instagram_media_id) { const id = byId.get(c.source_instagram_media_id); if (id) return { reelId: id, matchMethod: "source_instagram_media_id" }; }
  if (c.effective_instagram_media_id) { const id = byId.get(c.effective_instagram_media_id); if (id) return { reelId: id, matchMethod: "effective_instagram_media_id" }; }
  if (c.object_story_id) {
    const parts = c.object_story_id.split("_");
    if (parts.length >= 2) { const id = byId.get(parts.slice(1).join("_")); if (id) return { reelId: id, matchMethod: "object_story_id" }; }
    const id = byId.get(c.object_story_id); if (id) return { reelId: id, matchMethod: "object_story_id" };
    if (c.effective_object_story_id) {
      const ep = c.effective_object_story_id.split("_");
      if (ep.length >= 2) { const eid = byId.get(ep.slice(1).join("_")); if (eid) return { reelId: eid, matchMethod: "object_story_id" }; }
    }
  }
  if (c.instagram_permalink_url) {
    const np = normalizeInstagramUrl(c.instagram_permalink_url);
    const sc = extractInstagramShortcode(c.instagram_permalink_url);
    if (np) { const id = byPermalink.get(np); if (id) return { reelId: id, matchMethod: "creative_permalink" }; }
    if (sc) { const id = byShortcode.get(sc); if (id) return { reelId: id, matchMethod: "shortcode" }; }
  }
  return null;
}

function getActionMetricValue(items: { action_type: string; value: string }[] | null | undefined, actionType: string): number {
  return parseInt(items?.find((item) => item.action_type === actionType)?.value || "0") || 0;
}

function normalizeInstagramUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
}

function extractInstagramShortcode(url: string | null | undefined): string | null {
  const normalized = normalizeInstagramUrl(url);
  if (!normalized) return null;
  const match = normalized.match(/instagram\.com\/(?:reel|p)\/([^/]+)/i);
  return match?.[1] ?? null;
}

// ── Account insights helpers ──

async function fetchProfileFields(igAccountId: string, accessToken: string): Promise<{ followers_count: number; follows_count: number; media_count: number } | null> {
  try {
    const res = await fetch(`${GRAPH_BASE}/${igAccountId}?fields=followers_count,follows_count,media_count&access_token=${accessToken}`);
    const data = await res.json();
    if (data.error) return null;
    return { followers_count: data.followers_count ?? 0, follows_count: data.follows_count ?? 0, media_count: data.media_count ?? 0 };
  } catch { return null; }
}

async function fetchDailyInsights(igAccountId: string, accessToken: string, since: number, until: number): Promise<{ insights: IGInsight[]; errors: string[] }> {
  const metrics = "views,reach,profile_views,accounts_engaged,total_interactions,likes,comments,shares,saves,replies,website_clicks,profile_links_taps";
  const allInsights: IGInsight[] = [];
  const errors: string[] = [];
  const dayRanges = buildDayRanges(since, until);
  for (const day of dayRanges) {
    try {
      const url = `${GRAPH_BASE}/${igAccountId}/insights?metric=${metrics}&metric_type=total_value&period=day&since=${day.since}&until=${day.until}&access_token=${accessToken}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) { errors.push(`Daily ${day.date}: ${data.error.message}`); continue; }
      for (const insight of data.data || []) {
        allInsights.push({ name: insight.name, period: insight.period, values: normalizeInsightValues(insight, day.date) });
      }
    } catch (err) {
      errors.push(`Daily ${day.date}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { insights: allInsights, errors };
}

async function fetchFollowerCountInsights(igAccountId: string, accessToken: string, since: number, until: number): Promise<{ insights: IGInsight[]; errors: string[] }> {
  const errors: string[] = [];
  try {
    const url = `${GRAPH_BASE}/${igAccountId}/insights?metric=follower_count&period=day&since=${since}&until=${until}&access_token=${accessToken}`;
    console.log(`[follower_count] Fetching: since=${new Date(since * 1000).toISOString()} until=${new Date(until * 1000).toISOString()}`);
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) { errors.push(`Follower count: ${data.error.message}`); return { insights: [], errors }; }
    // Debug: log what Meta returns
    const rawValues = data.data?.[0]?.values || [];
    console.log(`[follower_count] Meta returned ${rawValues.length} values. Sample:`, JSON.stringify(rawValues.slice(-5)));
    return {
      insights: (data.data || []).map((insight: IGInsight) => ({ name: insight.name, period: insight.period, values: normalizeInsightValues(insight) })),
      errors,
    };
  } catch (err) {
    errors.push(`Follower count: ${err instanceof Error ? err.message : String(err)}`);
    return { insights: [], errors };
  }
}

async function fetchDemographics(igAccountId: string, accessToken: string): Promise<{ audience_gender_age: Record<string, number>; audience_city: Record<string, number>; audience_country: Record<string, number>; audience_locale: Record<string, number> } | null> {
  try {
    const gender = await fetchDemographicBreakdown(igAccountId, accessToken, "gender");
    const age = await fetchDemographicBreakdown(igAccountId, accessToken, "age");
    const city = await fetchDemographicBreakdown(igAccountId, accessToken, "city");
    const country = await fetchDemographicBreakdown(igAccountId, accessToken, "country");
    const audienceGenderAge: Record<string, number> = {};
    for (const [key, value] of Object.entries(gender)) audienceGenderAge[`gender:${key}`] = value;
    for (const [key, value] of Object.entries(age)) audienceGenderAge[`age:${key}`] = value;
    return { audience_gender_age: audienceGenderAge, audience_city: city, audience_country: country, audience_locale: {} };
  } catch { return null; }
}

async function fetchDemographicBreakdown(igAccountId: string, accessToken: string, breakdown: string): Promise<Record<string, number>> {
  try {
    const url = `${GRAPH_BASE}/${igAccountId}/insights?metric=follower_demographics&breakdown=${breakdown}&metric_type=total_value&period=lifetime&access_token=${accessToken}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) return {};
    const result: Record<string, number> = {};
    for (const insight of data.data || []) {
      const breakdowns = insight.total_value?.breakdowns || [];
      for (const bd of breakdowns) {
        for (const item of bd.results || []) {
          const key = item.dimension_values?.join(".") || "";
          if (key) result[key] = item.value ?? 0;
        }
      }
    }
    return result;
  } catch { return {}; }
}

function buildDayRanges(since: number, until: number): Array<{ date: string; since: number; until: number }> {
  const ranges: Array<{ date: string; since: number; until: number }> = [];
  const start = new Date(since * 1000); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(until * 1000); end.setUTCHours(0, 0, 0, 0);
  for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dayStart = new Date(cursor);
    const dayEnd = new Date(cursor); dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    ranges.push({ date: dayStart.toISOString().split("T")[0], since: Math.floor(dayStart.getTime() / 1000), until: Math.floor(dayEnd.getTime() / 1000) });
  }
  return ranges;
}

function normalizeInsightValues(insight: IGInsight, fallbackDate?: string): IGInsightValue[] {
  if (Array.isArray(insight.values)) return insight.values;
  const totalValue = insight.total_value?.value;
  if (typeof totalValue === "number") {
    const date = fallbackDate || new Date().toISOString().split("T")[0];
    return [{ end_time: `${date}T00:00:00+0000`, value: totalValue }];
  }
  return [];
}

// ── Apify helper ──

function getApifyToken(): string | null {
  const raw = Deno.env.get("APIFY_API_TOKEN")?.trim();
  if (!raw) return null;
  const unquoted = raw.replace(/^['"]|['"]$/g, "");
  try {
    const parsed = new URL(unquoted);
    const t = parsed.searchParams.get("token");
    if (t) return t;
  } catch { /* not a URL */ }
  const match = unquoted.match(/apify_api_[A-Za-z0-9]+/);
  return match?.[0] ?? unquoted;
}

async function fetchApifyReelDuration(reelUrl: string, apifyToken: string): Promise<number | null> {
  try {
    const normalized = reelUrl.trim().replace(/[?#].*$/, "").replace(/\/$/, "");
    const endpoint = `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items?${new URLSearchParams({ token: apifyToken })}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeDownloadedVideo: false, includeSharesCount: false, includeTranscript: false, resultsLimit: 1, skipPinnedPosts: false, username: [normalized] }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return null;
    const data = await response.json() as ApifyReelItem[];
    return data[0]?.videoDuration ?? null;
  } catch { return null; }
}
