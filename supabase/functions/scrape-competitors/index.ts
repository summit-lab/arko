/**
 * Supabase Edge Function: scrape-competitors
 *
 * Daily cron-driven competitor sync. Writes:
 *   - workspace_competitors.scraped_data         (latest profile snapshot)
 *   - competitor_follower_snapshots              (one row per competitor per day)
 *   - competitor_reels.{views,likes,comments,shares}_count  (refreshed in place)
 *   - competitor_reel_snapshots                  (one row per reel per day)
 *
 * Reel snapshot writing was added 2026-05-01 — the per-reel daily trajectory
 * chart on the reel detail page reads this table. Only refreshes metrics for
 * reels that already exist in the DB (matched by short_code); new reels are
 * still discovered via the heavier manual scrape from the UI which handles
 * thumbnail upload + trial detection + analysis.
 *
 * Invocation patterns:
 *   POST { competitor_id: "uuid" }    → scrape a single competitor (used by cron loop)
 *
 * Auth: x-sync-secret header (matches other sync-* functions).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_SECRET = Deno.env.get("SYNC_SECRET") || "";
const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN") || "";

const APIFY_PROFILE_ACTOR = "apify~instagram-profile-scraper";
const APIFY_REEL_ACTOR = "apify~instagram-reel-scraper";
const APIFY_BASE = "https://api.apify.com/v2/acts";

// El cron solo refresca métricas de reels RECIENTES — el discovery completo es
// del scrape manual. 25 + ventana de 14 días (los competidores publican ~5.7
// reels nuevos/14d): antes eran 50 reels SIN filtro de fecha, todos los días,
// para los 85 competidores = ~$105-160/mes, el 55-80% de la factura de Apify.
const REEL_METRICS_LIMIT = 25;
const REEL_METRICS_WINDOW = "14 days";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract IG username from raw string. Handles:
 *   "@username", "username", "https://instagram.com/username", "instagram.com/username/"
 */
function extractUsername(igUrl: string): string {
  const cleaned = igUrl.trim().replace(/\/$/, "");
  if (cleaned.startsWith("@")) return cleaned.slice(1);
  try {
    const url = new URL(cleaned.startsWith("http") ? cleaned : `https://${cleaned}`);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0] ?? cleaned;
  } catch {
    return cleaned;
  }
}

/** Normalize raw env var that may be a URL or a token. */
function resolveApifyToken(): string | null {
  const raw = APIFY_API_TOKEN.trim();
  if (!raw) return null;
  const unquoted = raw.replace(/^['"]|['"]$/g, "");
  try {
    const parsed = new URL(unquoted);
    const tok = parsed.searchParams.get("token");
    if (tok) return tok;
  } catch { /* not a URL */ }
  const match = unquoted.match(/apify_api_[A-Za-z0-9]+/);
  return match?.[0] ?? unquoted;
}

interface ApifyProfileItem {
  username?: string;
  fullName?: string;
  biography?: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  profilePicUrl?: string;
  externalUrl?: string;
  isVerified?: boolean;
  isBusinessAccount?: boolean;
  businessCategoryName?: string;
}

interface CompetitorRow {
  id: string;
  workspace_id: string;
  ig_url: string | null;
  scraped_data: Record<string, unknown> | null;
}

// ─── Scrape one profile ──────────────────────────────────────────────────────

async function scrapeProfile(username: string, token: string): Promise<ApifyProfileItem | null> {
  const endpoint = `${APIFY_BASE}/${APIFY_PROFILE_ACTOR}/run-sync-get-dataset-items?${new URLSearchParams({ token })}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], resultsLimit: 1 }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    console.warn(`[scrape-competitors] Apify returned ${res.status} for @${username}`);
    return null;
  }
  const data = await res.json() as ApifyProfileItem[];
  return data[0] ?? null;
}

// ─── Scrape recent reel metrics (for daily snapshots) ────────────────────────

interface ApifyReelItem {
  shortCode?: string;
  videoViewCount?: number;
  videoPlayCount?: number;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
}

interface ReelMetrics {
  short_code: string;
  views_count: number | null;
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
}

async function scrapeReelMetrics(username: string, token: string, limit: number): Promise<ReelMetrics[]> {
  const endpoint = `${APIFY_BASE}/${APIFY_REEL_ACTOR}/run-sync-get-dataset-items?${new URLSearchParams({ token })}`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: [`https://www.instagram.com/${username}/`],
        resultsLimit: limit,
        onlyPostsNewerThan: REEL_METRICS_WINDOW,
        skipPinnedPosts: true,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      console.warn(`[scrape-competitors] Reel actor returned ${res.status} for @${username}`);
      return [];
    }
    const data = await res.json() as ApifyReelItem[];
    return data
      .filter((item) => typeof item.shortCode === "string" && item.shortCode.length > 0)
      .map((item) => ({
        short_code: item.shortCode!,
        views_count:    item.videoViewCount ?? item.videoPlayCount ?? null,
        likes_count:    item.likesCount ?? null,
        comments_count: item.commentsCount ?? null,
        shares_count:   item.sharesCount ?? null,
      }));
  } catch (err) {
    console.warn(`[scrape-competitors] Reel scrape exception for @${username}:`, err);
    return [];
  }
}

// ─── Per-competitor sync ──────────────────────────────────────────────────────

async function scrapeOne(
  supabase: ReturnType<typeof createClient>,
  competitorId: string,
  token: string,
): Promise<{ ok: boolean; followers?: number; reelsSnapped?: number; error?: string }> {
  const { data: competitor, error: fetchErr } = await supabase
    .from("workspace_competitors")
    .select("id, workspace_id, ig_url, scraped_data")
    .eq("id", competitorId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: `fetch: ${fetchErr.message}` };
  if (!competitor) return { ok: false, error: "not_found" };
  const comp = competitor as unknown as CompetitorRow;
  if (!comp.ig_url) return { ok: false, error: "no_ig_url" };

  const username = extractUsername(comp.ig_url);

  // Owner para el user_id del logging (integration_usage.user_id es NOT NULL).
  const { data: wsOwner } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", comp.workspace_id)
    .single();
  const ownerId = (wsOwner as { owner_id?: string } | null)?.owner_id ?? null;

  // Log del gasto del cron. Feature 'competitor-scheduled-refresh' = categoría
  // SERVICE en credit_category(): se loguea el costo real pero NO debita la
  // billetera de nadie. Antes este cron era el 55-80% de la factura de Apify
  // y no dejaba NI UNA fila de log.
  const logUsage = (operation: string, itemsCount: number, costUsd: number, status: string) => {
    if (!ownerId) return;
    supabase.from("integration_usage").insert({
      workspace_id: comp.workspace_id,
      user_id: ownerId,
      feature: "competitor-scheduled-refresh",
      provider: "apify",
      operation,
      items_count: itemsCount,
      cost_usd: costUsd,
      status,
      metadata: { competitor_id: competitorId, source: "cron" },
    }).then(({ error }: { error: { message: string } | null }) => {
      if (error) console.warn(`[scrape-competitors] usage log error: ${error.message}`);
    });
  };

  const profile = await scrapeProfile(username, token);
  if (!profile) {
    logUsage("competitor-profile-scrape", 0, 0, "error");
    return { ok: false, error: "apify_empty" };
  }
  logUsage("competitor-profile-scrape", 1, 0.01, "success");

  const followerCount = profile.followersCount ?? null;

  // Preserve existing profile pic URL if Apify returned none (pic is re-uploaded
  // to storage only on manual scrape via the Next.js endpoint, so we don't
  // overwrite the stable storage URL with a fresh CDN URL that expires).
  const existingData = (comp.scraped_data ?? {}) as Record<string, unknown>;
  const scrapedData = {
    ig_username: profile.username ?? username,
    ig_full_name: profile.fullName ?? null,
    ig_bio: profile.biography ?? null,
    ig_follower_count: followerCount,
    ig_following_count: profile.followingCount ?? null,
    ig_post_count: profile.postsCount ?? null,
    ig_profile_pic_url: existingData.ig_profile_pic_url ?? profile.profilePicUrl ?? null,
    ig_external_url: profile.externalUrl ?? null,
    ig_is_verified: profile.isVerified ?? false,
    ig_is_business: profile.isBusinessAccount ?? false,
    ig_business_category: profile.businessCategoryName ?? null,
    scraped_at: new Date().toISOString(),
  };

  await supabase
    .from("workspace_competitors")
    .update({ scraped_data: scrapedData, last_scraped_at: new Date().toISOString() })
    .eq("id", competitorId);

  const today = new Date().toISOString().slice(0, 10);

  if (followerCount && followerCount > 0) {
    await supabase
      .from("competitor_follower_snapshots")
      .upsert({
        competitor_id: competitorId,
        workspace_id: comp.workspace_id,
        snapshot_date: today,
        follower_count: followerCount,
      }, { onConflict: "competitor_id,snapshot_date" });
  }

  // ── Per-reel daily metrics snapshot ────────────────────────────────────────
  // Refresh metrics for the most recent reels and write today's snapshot row
  // for each one we already track. New reels (not yet in DB) are skipped here
  // — they're discovered by the heavier manual scrape from the UI which also
  // handles thumbnail upload and trial detection.
  let reelsSnapped = 0;
  try {
    const fresh = await scrapeReelMetrics(username, token, REEL_METRICS_LIMIT);
    logUsage("competitor-reel-scrape", fresh.length, Number((fresh.length * 0.0039).toFixed(6)), fresh.length > 0 ? "success" : "error");
    if (fresh.length > 0) {
      const shortCodes = fresh.map((r) => r.short_code);
      const { data: existing } = await supabase
        .from("competitor_reels")
        .select("id, short_code")
        .eq("competitor_id", competitorId)
        .in("short_code", shortCodes);

      type Existing = { id: string; short_code: string };
      const byCode = new Map((existing as Existing[] | null ?? []).map((r) => [r.short_code, r.id]));

      // Update metrics in-place on competitor_reels (so the grid stays current).
      // Sequential to keep the request budget predictable; cheaper than a bulk
      // upsert because we don't have all the other reel fields here.
      for (const r of fresh) {
        const id = byCode.get(r.short_code);
        if (!id) continue;
        await supabase
          .from("competitor_reels")
          .update({
            views_count: r.views_count,
            likes_count: r.likes_count,
            comments_count: r.comments_count,
            shares_count: r.shares_count,
            scraped_at: new Date().toISOString(),
          })
          .eq("id", id);
      }

      // Snapshots — one row per (reel_id, snapshot_date). Idempotent on re-runs.
      const snapshotRows = fresh
        .map((r) => {
          const id = byCode.get(r.short_code);
          if (!id) return null;
          return {
            reel_id: id,
            workspace_id: comp.workspace_id,
            snapshot_date: today,
            views_count: r.views_count,
            likes_count: r.likes_count,
            comments_count: r.comments_count,
            shares_count: r.shares_count,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (snapshotRows.length > 0) {
        const { error: snapErr } = await supabase
          .from("competitor_reel_snapshots")
          .upsert(snapshotRows, { onConflict: "reel_id,snapshot_date" });
        if (snapErr) {
          console.warn(`[scrape-competitors] Snapshot upsert error for ${competitorId}:`, snapErr.message);
        } else {
          reelsSnapped = snapshotRows.length;
        }
      }
    }
  } catch (err) {
    console.warn(`[scrape-competitors] Reel snapshot step failed for ${competitorId}:`, err);
  }

  return { ok: true, followers: followerCount ?? undefined, reelsSnapped };
}

// ─── HTTP handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, x-sync-secret, content-type",
      },
    });
  }

  const syncSecret = req.headers.get("x-sync-secret");
  if (syncSecret !== SYNC_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = resolveApifyToken();
  if (!token) {
    return new Response(JSON.stringify({ error: "APIFY_API_TOKEN not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { competitor_id } = await req.json();
    if (!competitor_id || typeof competitor_id !== "string") {
      return new Response(JSON.stringify({ error: "competitor_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const result = await scrapeOne(supabase, competitor_id, token);

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[scrape-competitors] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
