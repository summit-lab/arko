// ── Instagram Media ──
export interface IGMedia {
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

export interface IGInsightValue {
  end_time: string;
  value: number | Record<string, number>;
}

export interface IGInsightBreakdownResult {
  dimension_values?: string[];
  value?: number;
}

export interface IGInsightBreakdown {
  dimension_keys?: string[];
  results?: IGInsightBreakdownResult[];
}

export interface IGInsight {
  name: string;
  period: string;
  values?: IGInsightValue[];
  total_value?: {
    value?: number | Record<string, number>;
    breakdowns?: IGInsightBreakdown[];
  };
}

// ── Ads ──
export interface AdRecord {
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

export interface InsightRow {
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

type MatchMethod = "source_instagram_media_id" | "effective_instagram_media_id" | "object_story_id" | "creative_permalink" | "shortcode";

export interface MatchResult {
  reelId: string;
  matchMethod: MatchMethod;
}

// ── Sync Results ──
export interface SyncResult {
  reelsSynced: number;
  reelsSkipped: number;
  insightsFetched: number;
  durationsEnriched: number;
  errors: string[];
}

export interface AdsSyncResult {
  adsProcessed: number;
  adsMapped: number;
  adsUnmapped: number;
  reelsUpdated: number;
  errors: string[];
}

export interface AccountSyncResult {
  daysUpserted: number;
  demographicsUpserted: boolean;
  errors: string[];
}

export interface RefreshReelBenchmarksResult {
  snapshotId: string;
  reelsInWindow: number;
  windowStart: string;
  windowEnd: string;
}

// ── Apify ──
export interface ApifyReelItem {
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
  latestComments?: Array<{
    id?: string;
    text?: string;
    ownerUsername?: string;
    timestamp?: string;
    likesCount?: number;
    repliesCount?: number;
    owner?: { username?: string };
  }>;
  displayUrl?: string;
  videoUrl?: string;
  taggedUsers?: Array<{ username?: string; full_name?: string }>;
  coauthorProducers?: Array<{ username?: string; full_name?: string }>;
  musicInfo?: {
    artist_name?: string;
    song_name?: string;
    uses_original_audio?: boolean;
    audio_id?: string;
  };
  isCommentsDisabled?: boolean;
  isSponsored?: boolean;
}
