import { getApifyToken } from '@/lib/env';

const APIFY_REEL_SCRAPER_ACTOR = 'apify~instagram-reel-scraper';
const APIFY_BASE_URL = 'https://api.apify.com/v2/acts';

interface ApifyUserReference {
  username?: string;
  full_name?: string;
}

interface ApifyCommentOwner {
  username?: string;
}

interface ApifyLatestComment {
  id?: string;
  text?: string;
  ownerUsername?: string;
  timestamp?: string;
  likesCount?: number;
  repliesCount?: number;
  owner?: ApifyCommentOwner;
}

interface ApifyMusicInfo {
  artist_name?: string;
  song_name?: string;
  uses_original_audio?: boolean;
  audio_id?: string;
}

interface ApifyReelItem {
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
  ownerFullName?: string;
  ownerUsername?: string;
  ownerId?: string;
  productType?: string;
  transcript?: string;
  videoDuration?: number;
  firstComment?: string;
  latestComments?: ApifyLatestComment[];
  displayUrl?: string;
  videoUrl?: string;
  taggedUsers?: ApifyUserReference[];
  coauthorProducers?: ApifyUserReference[];
  musicInfo?: ApifyMusicInfo;
  isCommentsDisabled?: boolean;
  isSponsored?: boolean;
}

export interface ReelExternalPublicComment {
  id: string | null;
  text: string;
  owner_username: string | null;
  timestamp: string | null;
  likes_count: number;
  replies_count: number;
}

export interface ReelExternalPublicMusic {
  artist_name: string | null;
  song_name: string | null;
  uses_original_audio: boolean | null;
  audio_id: string | null;
}

export interface ReelExternalPublicData {
  provider: 'apify';
  provider_reel_id: string | null;
  short_code: string | null;
  url: string;
  caption: string | null;
  owner_username: string | null;
  owner_full_name: string | null;
  owner_id: string | null;
  timestamp: string | null;
  product_type: string | null;
  likes_count: number | null;
  shares_count: number | null;
  comments_count: number | null;
  video_view_count: number | null;
  video_play_count: number | null;
  video_duration_seconds: number | null;
  transcript: string | null;
  first_comment: string | null;
  latest_comments: ReelExternalPublicComment[];
  hashtags: string[];
  mentions: string[];
  tagged_usernames: string[];
  coauthor_usernames: string[];
  display_url: string | null;
  video_url: string | null;
  is_comments_disabled: boolean | null;
  is_sponsored: boolean | null;
  music: ReelExternalPublicMusic | null;
}

function getApifyReelScraperToken(): string | null {
  const rawValue = getApifyToken()?.trim();

  if (!rawValue) {
    return null;
  }

  const unquotedValue = rawValue.replace(/^['"]|['"]$/g, '');

  try {
    const parsedUrl = new URL(unquotedValue);
    const tokenFromUrl = parsedUrl.searchParams.get('token');

    if (tokenFromUrl) {
      return tokenFromUrl;
    }
  } catch {}

  const tokenMatch = unquotedValue.match(/apify_api_[A-Za-z0-9]+/);
  return tokenMatch?.[0] ?? unquotedValue;
}

function normalizeInstagramUrl(url: string): string {
  return url.trim().replace(/[?#].*$/, '').replace(/\/$/, '');
}

function toNullableString(value: string | undefined): string | null {
  return value && value.trim().length > 0 ? value.trim() : null;
}

function toUsernameList(items: ApifyUserReference[] | undefined): string[] {
  return (items || [])
    .map((item) => item.username?.trim())
    .filter((username): username is string => Boolean(username));
}

function mapLatestComments(items: ApifyLatestComment[] | undefined): ReelExternalPublicComment[] {
  return (items || []).slice(0, 5).map((item) => ({
    id: toNullableString(item.id),
    text: item.text?.trim() || '',
    owner_username: toNullableString(item.ownerUsername || item.owner?.username),
    timestamp: toNullableString(item.timestamp),
    likes_count: item.likesCount || 0,
    replies_count: item.repliesCount || 0,
  })).filter((item) => item.text.length > 0);
}

function mapMusic(item: ApifyMusicInfo | undefined): ReelExternalPublicMusic | null {
  if (!item) return null;

  return {
    artist_name: toNullableString(item.artist_name),
    song_name: toNullableString(item.song_name),
    uses_original_audio: typeof item.uses_original_audio === 'boolean' ? item.uses_original_audio : null,
    audio_id: toNullableString(item.audio_id),
  };
}

function mapReelItem(item: ApifyReelItem, reelUrl: string): ReelExternalPublicData {
  return {
    provider: 'apify',
    provider_reel_id: toNullableString(item.id),
    short_code: toNullableString(item.shortCode),
    url: toNullableString(item.url) || reelUrl,
    caption: toNullableString(item.caption),
    owner_username: toNullableString(item.ownerUsername),
    owner_full_name: toNullableString(item.ownerFullName),
    owner_id: toNullableString(item.ownerId),
    timestamp: toNullableString(item.timestamp),
    product_type: toNullableString(item.productType),
    likes_count: item.likesCount ?? null,
    shares_count: item.sharesCount ?? null,
    comments_count: item.commentsCount ?? null,
    video_view_count: item.videoViewCount ?? null,
    video_play_count: item.videoPlayCount ?? null,
    video_duration_seconds: item.videoDuration ?? null,
    transcript: toNullableString(item.transcript),
    first_comment: toNullableString(item.firstComment),
    latest_comments: mapLatestComments(item.latestComments),
    hashtags: item.hashtags || [],
    mentions: item.mentions || [],
    tagged_usernames: toUsernameList(item.taggedUsers),
    coauthor_usernames: toUsernameList(item.coauthorProducers),
    display_url: toNullableString(item.displayUrl),
    video_url: toNullableString(item.videoUrl),
    is_comments_disabled: typeof item.isCommentsDisabled === 'boolean' ? item.isCommentsDisabled : null,
    is_sponsored: typeof item.isSponsored === 'boolean' ? item.isSponsored : null,
    music: mapMusic(item.musicInfo),
  };
}

export function isApifyReelEnrichmentEnabled(): boolean {
  return Boolean(getApifyReelScraperToken());
}

export async function fetchApifyReelPublicData(reelUrl: string | null | undefined): Promise<ReelExternalPublicData | null> {
  const apifyToken = getApifyReelScraperToken();

  if (!apifyToken || !reelUrl) {
    return null;
  }

  try {
    const normalizedUrl = normalizeInstagramUrl(reelUrl);
    const endpoint = `${APIFY_BASE_URL}/${APIFY_REEL_SCRAPER_ACTOR}/run-sync-get-dataset-items?${new URLSearchParams({ token: apifyToken })}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        includeDownloadedVideo: false,
        // Sin shares/transcript: los ÚNICOS consumidores de esta función usan
        // video_duration_seconds (enrich-durations) y video_url (gemini-analyze
        // rescrape) — pagar los add-ons del actor acá era plata tirada.
        includeSharesCount: false,
        includeTranscript: false,
        resultsLimit: 1,
        skipPinnedPosts: false,
        username: [normalizedUrl],
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 401) {
        console.warn('[apify-reel] Invalid Apify credentials in APIFY_API_TOKEN. Use the raw apify_api token or a full Apify URL with ?token=...');
        return null;
      }

      console.warn('[apify-reel] Request failed:', response.status, errorText);
      return null;
    }

    const data = await response.json() as ApifyReelItem[];
    const item = data[0];

    if (!item) {
      return null;
    }

    return mapReelItem(item, normalizedUrl);
  } catch (error) {
    console.error('[apify-reel] Unexpected error:', error);
    return null;
  }
}
