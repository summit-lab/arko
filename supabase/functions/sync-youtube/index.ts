/**
 * Supabase Edge Function: sync-youtube
 * Fetches YouTube videos + metrics via YouTube Data API v3 (API Key only, no OAuth)
 * Quota budget: ~5 units per full sync (well within 10,000/day free tier)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_SECRET = Deno.env.get("SYNC_SECRET") || "";
const YT_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || "";

const YT_BASE = "https://www.googleapis.com/youtube/v3";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseIsoDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600) +
         (parseInt(match[2] || "0") * 60) +
         (parseInt(match[3] || "0"));
}

/** Extract channel ID or handle from a YouTube URL */
function parseChannelInput(input: string): { type: "id" | "handle" | "custom"; value: string } | null {
  const trimmed = input.trim();

  // Direct channel ID (UC...)
  if (/^UC[\w-]{22}$/.test(trimmed)) {
    return { type: "id", value: trimmed };
  }

  // @handle format
  if (trimmed.startsWith("@")) {
    return { type: "handle", value: trimmed };
  }

  try {
    const url = new URL(trimmed);
    // youtube.com/channel/UCxxxx
    const channelMatch = url.pathname.match(/\/channel\/(UC[\w-]{22})/);
    if (channelMatch) return { type: "id", value: channelMatch[1] };

    // youtube.com/@handle
    const handleMatch = url.pathname.match(/\/@([\w.-]+)/);
    if (handleMatch) return { type: "handle", value: `@${handleMatch[1]}` };

    // youtube.com/c/CustomName or youtube.com/CustomName
    const customMatch = url.pathname.match(/\/(?:c\/)?([\w.-]+)/);
    if (customMatch && customMatch[1] !== "watch" && customMatch[1] !== "shorts") {
      return { type: "custom", value: customMatch[1] };
    }
  } catch {
    // Not a URL — try as handle
    if (/^[\w.-]+$/.test(trimmed)) {
      return { type: "handle", value: `@${trimmed}` };
    }
  }

  return null;
}

// ─── Resolve channel ID from various inputs ──────────────────────────────────

async function resolveChannelId(input: string): Promise<{ channelId: string; title: string } | null> {
  const parsed = parseChannelInput(input);
  if (!parsed) return null;

  if (parsed.type === "id") {
    // Verify it exists
    const res = await fetch(`${YT_BASE}/channels?part=snippet&id=${parsed.value}&key=${YT_API_KEY}`);
    const data = await res.json();
    const ch = data.items?.[0];
    return ch ? { channelId: ch.id, title: ch.snippet?.title || "" } : null;
  }

  // Handle or custom URL — search by forHandle or forUsername
  if (parsed.type === "handle") {
    const handle = parsed.value.replace("@", "");
    const res = await fetch(`${YT_BASE}/channels?part=snippet&forHandle=${handle}&key=${YT_API_KEY}`);
    const data = await res.json();
    const ch = data.items?.[0];
    if (ch) return { channelId: ch.id, title: ch.snippet?.title || "" };
  }

  // Fallback: search
  const searchRes = await fetch(`${YT_BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(parsed.value)}&maxResults=1&key=${YT_API_KEY}`);
  const searchData = await searchRes.json();
  const result = searchData.items?.[0];
  return result ? { channelId: result.snippet?.channelId || result.id?.channelId, title: result.snippet?.title || "" } : null;
}

// ─── Sync Logic ───────────────────────────────────────────────────────────────

interface SyncResult {
  videosFetched: number;
  videosUpserted: number;
  channelUpdated: boolean;
  errors: string[];
}

async function syncYouTube(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  channelId: string,
  maxVideos: number
): Promise<SyncResult> {
  const result: SyncResult = { videosFetched: 0, videosUpserted: 0, channelUpdated: false, errors: [] };

  let uploadsPlaylistId: string | null = null;

  // 1. Update channel metadata (1 quota unit)
  try {
    const chRes = await fetch(`${YT_BASE}/channels?part=snippet,contentDetails,statistics&id=${channelId}&key=${YT_API_KEY}`);
    const chData = await chRes.json();
    const ch = chData.items?.[0];
    if (ch) {
      uploadsPlaylistId = ch.contentDetails?.relatedPlaylists?.uploads || null;
      const subscriberCount = parseInt(ch.statistics?.subscriberCount || "0");
      const videoCountStat = parseInt(ch.statistics?.videoCount || "0");
      const viewCountStat = parseInt(ch.statistics?.viewCount || "0");

      const { data: channelRow } = await supabase.from("yt_channels").upsert({
        workspace_id: workspaceId,
        yt_channel_id: channelId,
        title: ch.snippet?.title,
        description: ch.snippet?.description,
        custom_url: ch.snippet?.customUrl,
        thumbnail_url: ch.snippet?.thumbnails?.high?.url || ch.snippet?.thumbnails?.default?.url,
        country: ch.snippet?.country,
        published_at: ch.snippet?.publishedAt,
        subscriber_count: subscriberCount,
        video_count: videoCountStat,
        view_count: viewCountStat,
        uploads_playlist_id: uploadsPlaylistId,
        fetched_at: new Date().toISOString(),
      }, { onConflict: "workspace_id,yt_channel_id" }).select("id").maybeSingle();

      // Daily channel snapshot (idempotent within the day via UNIQUE constraint)
      if (channelRow?.id) {
        await supabase.from("yt_channel_metrics_daily").upsert({
          channel_id: channelRow.id,
          workspace_id: workspaceId,
          metric_date: new Date().toISOString().split("T")[0],
          subscriber_count: subscriberCount,
          video_count: videoCountStat,
          view_count: viewCountStat,
          fetched_at: new Date().toISOString(),
        }, { onConflict: "channel_id,metric_date" });
      }

      result.channelUpdated = true;
    }
  } catch (err) {
    result.errors.push(`Channel fetch: ${err}`);
  }

  if (!uploadsPlaylistId) {
    result.errors.push("No uploads playlist ID found");
    return result;
  }

  // 2. Get video IDs from uploads playlist (1 quota unit per page)
  const videoIds: string[] = [];
  let nextPageToken: string | undefined;

  try {
    do {
      const plUrl = new URL(`${YT_BASE}/playlistItems`);
      plUrl.searchParams.set("part", "snippet");
      plUrl.searchParams.set("playlistId", uploadsPlaylistId);
      plUrl.searchParams.set("maxResults", "50");
      plUrl.searchParams.set("key", YT_API_KEY);
      if (nextPageToken) plUrl.searchParams.set("pageToken", nextPageToken);

      const plRes = await fetch(plUrl.toString());
      const plData = await plRes.json();

      if (plData.error) {
        result.errors.push(`Playlist fetch: ${plData.error.message}`);
        break;
      }

      for (const item of plData.items || []) {
        const vid = item.snippet?.resourceId?.videoId;
        if (vid) videoIds.push(vid);
      }

      nextPageToken = plData.nextPageToken;
      result.videosFetched = videoIds.length;
    } while (nextPageToken && videoIds.length < maxVideos);
  } catch (err) {
    result.errors.push(`Playlist pagination: ${err}`);
  }

  if (videoIds.length === 0) return result;

  const idsToFetch = videoIds.slice(0, maxVideos);

  // 3. Batch fetch video details + statistics (1 quota unit per batch of 50)
  const todayDate = new Date().toISOString().split("T")[0];

  for (let i = 0; i < idsToFetch.length; i += 50) {
    const batch = idsToFetch.slice(i, i + 50);
    try {
      const vUrl = new URL(`${YT_BASE}/videos`);
      vUrl.searchParams.set("part", "snippet,contentDetails,statistics");
      vUrl.searchParams.set("id", batch.join(","));
      vUrl.searchParams.set("key", YT_API_KEY);

      const vRes = await fetch(vUrl.toString());
      const vData = await vRes.json();

      if (vData.error) {
        result.errors.push(`Videos batch: ${vData.error.message}`);
        continue;
      }

      for (const v of vData.items || []) {
        // Skip Shorts (videos under 65 seconds). Durations of 0 (live streams /
        // premieres / parse failures) are kept — the UI can decide how to treat them.
        const durationSec = parseIsoDuration(v.contentDetails?.duration || "");
        if (durationSec > 0 && durationSec < 65) continue;

        const viewCount = parseInt(v.statistics?.viewCount || "0");
        const likeCount = parseInt(v.statistics?.likeCount || "0");
        const commentCount = parseInt(v.statistics?.commentCount || "0");
        const favoriteCount = parseInt(v.statistics?.favoriteCount || "0");

        // Upsert video
        const { data: videoRow } = await supabase.from("yt_videos").upsert({
          workspace_id: workspaceId,
          yt_video_id: v.id,
          title: v.snippet?.title,
          description: v.snippet?.description,
          thumbnail_url: v.snippet?.thumbnails?.maxres?.url || v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.default?.url,
          published_at: v.snippet?.publishedAt,
          channel_id: v.snippet?.channelId,
          tags: v.snippet?.tags || [],
          category_id: v.snippet?.categoryId,
          duration_seconds: parseIsoDuration(v.contentDetails?.duration || ""),
          definition: v.contentDetails?.definition,
          caption_available: v.contentDetails?.caption === "true",
          privacy_status: v.status?.privacyStatus || "public",
        }, { onConflict: "workspace_id,yt_video_id" }).select("id").maybeSingle();

        if (!videoRow?.id) continue;

        // Upsert metrics
        await supabase.from("yt_video_metrics").upsert({
          video_id: videoRow.id,
          workspace_id: workspaceId,
          view_count: viewCount,
          like_count: likeCount,
          comment_count: commentCount,
          favorite_count: favoriteCount,
          likes_per_view: viewCount > 0 ? likeCount / viewCount : 0,
          comments_per_view: viewCount > 0 ? commentCount / viewCount : 0,
          fetched_at: new Date().toISOString(),
        }, { onConflict: "video_id" });

        // Daily snapshot
        await supabase.from("yt_video_metrics_daily").upsert({
          video_id: videoRow.id,
          workspace_id: workspaceId,
          metric_date: todayDate,
          view_count: viewCount,
          like_count: likeCount,
          comment_count: commentCount,
          fetched_at: new Date().toISOString(),
        }, { onConflict: "video_id,metric_date" });

        result.videosUpserted++;
      }
    } catch (err) {
      result.errors.push(`Videos batch process: ${err}`);
    }
  }

  return result;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, x-sync-secret, content-type" } });
  }

  const syncSecret = req.headers.get("x-sync-secret");
  if (syncSecret !== SYNC_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  if (!YT_API_KEY) {
    return new Response(JSON.stringify({ error: "YOUTUBE_API_KEY not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  try {
    const { workspace_id, steps = "all", channel_input } = await req.json();
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "workspace_id required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Resolve channel ID — from input (first time) or from DB (subsequent syncs)
    let channelId: string | null = null;

    if (channel_input) {
      const resolved = await resolveChannelId(channel_input);
      if (!resolved) {
        return new Response(JSON.stringify({ error: "Could not find YouTube channel" }), { status: 404, headers: { "Content-Type": "application/json" } });
      }
      channelId = resolved.channelId;
    } else {
      // Get from existing yt_channels
      const { data: ch } = await supabase
        .from("yt_channels")
        .select("yt_channel_id")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .maybeSingle();
      channelId = ch?.yt_channel_id || null;
    }

    if (!channelId) {
      return new Response(JSON.stringify({ error: "No channel connected. Provide channel_input." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const maxVideos = steps === "quick" ? 10 : 200;
    const result = await syncYouTube(supabase, workspace_id, channelId, maxVideos);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sync-youtube] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
