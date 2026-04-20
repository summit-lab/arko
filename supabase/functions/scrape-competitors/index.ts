/**
 * Supabase Edge Function: scrape-competitors
 *
 * Scrapes a competitor's Instagram profile via Apify and writes:
 *   - workspace_competitors.scraped_data (latest profile snapshot)
 *   - competitor_follower_snapshots (one row per competitor per day)
 *
 * Reels are NOT scraped here — that's an opt-in manual action from the UI
 * (more expensive, ~$0.006/reel). Daily cron only captures the cheap profile
 * fetch (~$0.0006/profile) so we build a follower-growth time series.
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
const APIFY_BASE = "https://api.apify.com/v2/acts";

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

// ─── Per-competitor sync ──────────────────────────────────────────────────────

async function scrapeOne(
  supabase: ReturnType<typeof createClient>,
  competitorId: string,
  token: string,
): Promise<{ ok: boolean; followers?: number; error?: string }> {
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
  const profile = await scrapeProfile(username, token);
  if (!profile) return { ok: false, error: "apify_empty" };

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

  if (followerCount && followerCount > 0) {
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from("competitor_follower_snapshots")
      .upsert({
        competitor_id: competitorId,
        workspace_id: comp.workspace_id,
        snapshot_date: today,
        follower_count: followerCount,
      }, { onConflict: "competitor_id,snapshot_date" });
  }

  return { ok: true, followers: followerCount ?? undefined };
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
