/**
 * competitor-scraper.service.ts
 * Scrapes competitor Instagram profiles and their reels via Apify.
 * Uses the same apify~instagram-reel-scraper actor but configured
 * for profile-level scraping (username instead of URL).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getApifyToken as getApifyTokenFromEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

// ─── Constants ──────────────────────────────────────────────────────────────

const APIFY_PROFILE_SCRAPER_ACTOR = 'apify~instagram-profile-scraper';
const APIFY_REEL_SCRAPER_ACTOR = 'apify~instagram-reel-scraper';
const APIFY_BASE_URL = 'https://api.apify.com/v2/acts';
// Subido de 20 → 50 (2026-04-23): más data histórica para análisis de
// competidores sin cambiar el actor. Tradeoff: cada scrape consume más
// compute units de Apify. Plan mensual de Apify tiene que bancarlo.
const MAX_REELS_PER_SCRAPE = 50;

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApifyProfileResult {
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

interface ApifyReelResult {
  id?: string;
  shortCode?: string;
  url?: string;
  caption?: string;
  hashtags?: string[];
  mentions?: string[];
  commentsCount?: number;
  likesCount?: number;
  sharesCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  timestamp?: string;
  videoDuration?: number;
  transcript?: string;
  displayUrl?: string;
  videoUrl?: string;
  isVideo?: boolean;
  productType?: string;
  type?: string;
  locationName?: string;
  locationId?: string;
  // Apify no siempre normaliza el nombre del campo — a veces viene como
  // `taggedUsers`, a veces como `taggedAccounts`. Parseamos ambos.
  taggedUsers?: Array<{ username?: string } | string>;
  taggedAccounts?: Array<{ username?: string } | string>;
  musicInfo?: {
    artist_name?: string;
    song_name?: string;
  };
}

export interface CompetitorProfileData {
  ig_username: string;
  ig_full_name: string | null;
  ig_bio: string | null;
  ig_follower_count: number | null;
  ig_following_count: number | null;
  ig_post_count: number | null;
  ig_profile_pic_url: string | null;
  ig_external_url: string | null;
  ig_is_verified: boolean;
  ig_is_business: boolean;
  ig_business_category: string | null;
  scraped_at: string;
}

export interface CompetitorReelData {
  short_code: string | null;
  permalink: string | null;
  caption: string | null;
  likes_count: number | null;
  comments_count: number | null;
  views_count: number | null;
  shares_count: number | null;
  duration_seconds: number | null;
  published_at: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  transcript: string | null;
  hashtags: string[];
  mentions: string[];
  music_artist: string | null;
  music_name: string | null;
  // Campos de enriquecimiento (2026-04-23).
  location_name: string | null;
  location_id: string | null;
  tagged_users: string[];
  product_type: string | null;
  is_video: boolean | null;
}

export interface ScrapeResult {
  profile: CompetitorProfileData | null;
  reels: CompetitorReelData[];
  reelsInserted: number;
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getApifyToken(): string | null {
  const rawValue = getApifyTokenFromEnv()?.trim();
  if (!rawValue) return null;

  const unquotedValue = rawValue.replace(/^['"]|['"]$/g, '');
  try {
    const parsedUrl = new URL(unquotedValue);
    const tokenFromUrl = parsedUrl.searchParams.get('token');
    if (tokenFromUrl) return tokenFromUrl;
  } catch { /* not a URL */ }

  const tokenMatch = unquotedValue.match(/apify_api_[A-Za-z0-9]+/);
  return tokenMatch?.[0] ?? unquotedValue;
}

function extractUsername(igUrl: string): string {
  const cleaned = igUrl.trim().replace(/\/$/, '');

  // Handle @username format
  if (cleaned.startsWith('@')) return cleaned.slice(1);

  // Handle full URL
  try {
    const url = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[0] ?? cleaned;
  } catch {
    return cleaned;
  }
}

function toNullableString(val: string | undefined | null): string | null {
  return val && val.trim().length > 0 ? val.trim() : null;
}

// ─── Profile Scraping ───────────────────────────────────────────────────────

async function scrapeProfile(username: string, token: string): Promise<CompetitorProfileData | null> {
  const endpoint = `${APIFY_BASE_URL}/${APIFY_PROFILE_SCRAPER_ACTOR}/run-sync-get-dataset-items?${new URLSearchParams({ token })}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usernames: [username],
      resultsLimit: 1,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    console.warn(`[competitor-scraper] Profile scrape failed for @${username}:`, response.status);
    return null;
  }

  const data = await response.json() as ApifyProfileResult[];
  const item = data[0];
  if (!item) return null;

  return {
    ig_username: item.username ?? username,
    ig_full_name: toNullableString(item.fullName),
    ig_bio: toNullableString(item.biography),
    ig_follower_count: item.followersCount ?? null,
    ig_following_count: item.followingCount ?? null,
    ig_post_count: item.postsCount ?? null,
    ig_profile_pic_url: toNullableString(item.profilePicUrl),
    ig_external_url: toNullableString(item.externalUrl),
    ig_is_verified: item.isVerified ?? false,
    ig_is_business: item.isBusinessAccount ?? false,
    ig_business_category: toNullableString(item.businessCategoryName),
    scraped_at: new Date().toISOString(),
  };
}

// ─── Reels Scraping ─────────────────────────────────────────────────────────

async function scrapeReels(username: string, token: string, limit: number): Promise<CompetitorReelData[]> {
  const endpoint = `${APIFY_BASE_URL}/${APIFY_REEL_SCRAPER_ACTOR}/run-sync-get-dataset-items?${new URLSearchParams({ token })}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: [`https://www.instagram.com/${username}/reels/`],
      resultsLimit: limit,
      includeTranscript: false,
      includeSharesCount: true,
      includeDownloadedVideo: false,
      skipPinnedPosts: true,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    console.warn(`[competitor-scraper] Reels scrape failed for @${username}:`, response.status);
    return [];
  }

  const data = await response.json() as ApifyReelResult[];

  return data.map((item) => {
    // taggedUsers / taggedAccounts normalización: puede venir como string o
    // como objeto { username }. Filtramos vacíos y dedup.
    const taggedRaw = item.taggedUsers ?? item.taggedAccounts ?? [];
    const tagged = Array.from(new Set(
      taggedRaw
        .map((u) => (typeof u === 'string' ? u : u?.username))
        .filter((u): u is string => typeof u === 'string' && u.length > 0)
    ));

    return {
      short_code: toNullableString(item.shortCode),
      permalink: toNullableString(item.url),
      caption: toNullableString(item.caption),
      likes_count: item.likesCount ?? null,
      comments_count: item.commentsCount ?? null,
      views_count: item.videoViewCount ?? item.videoPlayCount ?? null,
      shares_count: item.sharesCount ?? null,
      duration_seconds: item.videoDuration ?? null,
      published_at: item.timestamp ?? null,
      thumbnail_url: toNullableString(item.displayUrl),
      video_url: toNullableString(item.videoUrl),
      transcript: toNullableString(item.transcript),
      hashtags: item.hashtags ?? [],
      mentions: item.mentions ?? [],
      music_artist: toNullableString(item.musicInfo?.artist_name),
      music_name: toNullableString(item.musicInfo?.song_name),
      location_name: toNullableString(item.locationName),
      location_id: toNullableString(item.locationId),
      tagged_users: tagged,
      product_type: toNullableString(item.productType ?? item.type),
      is_video: item.isVideo ?? null,
    };
  });
}

// ─── Image Storage Helpers ──────────────────────────────────────────────────
// The 'competitor-assets' bucket is created via migration
// (20260407000033_competitor_assets_and_follower_snapshots.sql).
// Do NOT try to create it at runtime — the client auth token doesn't have
// storage admin rights and the call would silently fail.

const STORAGE_BUCKET = 'competitor-assets';

async function downloadAndUploadImage(
  sourceUrl: string,
  storagePath: string
): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';

    // Use service-role client — the scraper runs server-side but the user
    // session (anon key) doesn't have storage write permissions.
    const adminClient = createAdminClient();
    const { error } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (error) {
      console.warn('[competitor-scraper] Storage upload error:', error.message);
      return null;
    }

    const { data } = adminClient.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (err) {
    console.warn('[competitor-scraper] Image upload failed:', err);
    return null;
  }
}

// ─── Main scrape function ───────────────────────────────────────────────────

export async function scrapeCompetitor(
  supabase: SupabaseClient,
  competitorId: string,
  workspaceId: string
): Promise<ScrapeResult> {
  const token = getApifyToken();
  if (!token) {
    return { profile: null, reels: [], reelsInserted: 0, error: 'APIFY_API_TOKEN not configured' };
  }

  // Get competitor data
  const { data: competitor, error: fetchError } = await supabase
    .from('workspace_competitors')
    .select('id, name, ig_url, workspace_id')
    .eq('id', competitorId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (fetchError || !competitor) {
    return { profile: null, reels: [], reelsInserted: 0, error: 'Competitor not found' };
  }

  if (!competitor.ig_url) {
    return { profile: null, reels: [], reelsInserted: 0, error: 'No Instagram URL configured for this competitor' };
  }

  const username = extractUsername(competitor.ig_url);

  // Scrape profile and reels in parallel
  const [profile, reels] = await Promise.all([
    scrapeProfile(username, token).catch((err) => {
      console.error('[competitor-scraper] Profile error:', err);
      return null;
    }),
    scrapeReels(username, token, MAX_REELS_PER_SCRAPE).catch((err) => {
      console.error('[competitor-scraper] Reels error:', err);
      return [] as CompetitorReelData[];
    }),
  ]);

  // Upload profile pic to Supabase Storage (so it never expires)
  if (profile?.ig_profile_pic_url) {
    const storageUrl = await downloadAndUploadImage(
      profile.ig_profile_pic_url,
      `${workspaceId}/${competitorId}/profile.jpg`
    );
    if (storageUrl) profile.ig_profile_pic_url = storageUrl;
  }

  // Update competitor record with profile data
  if (profile) {
    await supabase
      .from('workspace_competitors')
      .update({
        scraped_data: profile,
        last_scraped_at: new Date().toISOString(),
      })
      .eq('id', competitorId);

    // Upsert daily follower snapshot (builds historical trend over time)
    if (profile.ig_follower_count && profile.ig_follower_count > 0) {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      await supabase
        .from('competitor_follower_snapshots')
        .upsert({
          competitor_id: competitorId,
          workspace_id: workspaceId,
          snapshot_date: today,
          follower_count: profile.ig_follower_count,
        }, { onConflict: 'competitor_id,snapshot_date' });
    }
  }

  // Upload reel thumbnails to storage in parallel (so they never expire)
  const reelsWithStableUrls = await Promise.all(
    reels.map(async (reel, i) => {
      if (!reel.thumbnail_url) return reel;
      const key = reel.short_code ?? `reel-${i}`;
      const storageUrl = await downloadAndUploadImage(
        reel.thumbnail_url,
        `${workspaceId}/${competitorId}/reels/${key}.jpg`
      );
      return storageUrl ? { ...reel, thumbnail_url: storageUrl } : reel;
    })
  );

  // Delete old reels for this competitor, then BULK insert los 50 nuevos en
  // una sola query. Antes eran 50 INSERTs seriales (~10-20s); ahora 1 roundtrip.
  await supabase
    .from('competitor_reels')
    .delete()
    .eq('competitor_id', competitorId);

  const scrapedAt = new Date().toISOString();
  const rowsToInsert = reelsWithStableUrls.map((reel) => ({
    competitor_id: competitorId,
    workspace_id: workspaceId,
    short_code: reel.short_code,
    permalink: reel.permalink,
    caption: reel.caption,
    likes_count: reel.likes_count,
    comments_count: reel.comments_count,
    views_count: reel.views_count,
    shares_count: reel.shares_count,
    duration_seconds: reel.duration_seconds,
    published_at: reel.published_at,
    thumbnail_url: reel.thumbnail_url,
    video_url: reel.video_url,
    transcript: reel.transcript,
    hashtags: reel.hashtags,
    mentions: reel.mentions,
    music_artist: reel.music_artist,
    music_name: reel.music_name,
    location_name: reel.location_name,
    location_id: reel.location_id,
    tagged_users: reel.tagged_users,
    product_type: reel.product_type,
    is_video: reel.is_video,
    raw_data: reel,
    scraped_at: scrapedAt,
  }));

  let reelsInserted = 0;
  if (rowsToInsert.length > 0) {
    const { error: bulkError, count } = await supabase
      .from('competitor_reels')
      .insert(rowsToInsert, { count: 'exact' });

    if (bulkError) {
      console.error('[competitor-scraper] Bulk insert error:', bulkError.message);
    } else {
      reelsInserted = count ?? rowsToInsert.length;
    }
  }

  return { profile, reels: reelsWithStableUrls, reelsInserted };
}

// ─── Check if scraping is available ─────────────────────────────────────────

export function isCompetitorScrapingEnabled(): boolean {
  return Boolean(getApifyToken());
}
