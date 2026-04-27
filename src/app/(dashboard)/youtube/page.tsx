import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { YouTubeConnect } from "@/components/youtube/YouTubeConnect";
import { YouTubeDashboard, type YTChannel, type YTVideo } from "@/components/youtube/YouTubeDashboard";
import { DateFilter } from "@/components/ui/DateFilter";
import { parseDateParams, toISOStart } from "@/lib/date-utils";

export default async function YouTubePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const workspaceId = await getWorkspaceId();
  const dateRange = parseDateParams(params, "90d");
  const t = await getTranslations("youtube");

  if (!workspaceId) {
    return (
      <div className="px-8 py-10">
        <h1 className="page-title">{t("pageTitle")}</h1>
        <p className="text-white/35 mt-3 text-[15px]">{t("needWorkspace")}</p>
      </div>
    );
  }

  const supabase = await createClient();

  // Check if Google/YouTube is connected
  const { data: googleConn } = await supabase
    .from("google_connections")
    .select("status, yt_channel_id, yt_channel_title")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const isConnected = googleConn?.status === "active" && googleConn?.yt_channel_id;

  // If not connected, show connect screen
  if (!isConnected) {
    return (
      <div className="px-8 py-10">
        <div className="mb-8">
          <h1 className="page-title tracking-[-0.04em]">{t("pageTitle")}</h1>
          <p className="text-white/40 mt-3 text-[15px] font-normal">
            {t("pageSubtitle")}
          </p>
        </div>
        <YouTubeConnect workspaceId={workspaceId} />
      </div>
    );
  }

  const periodStartIso = toISOStart(dateRange.from);

  // Fetch channel + videos + metrics
  const [channelResult, videosResult] = await Promise.all([
    supabase
      .from("yt_channels")
      .select("title, custom_url, thumbnail_url, subscriber_count, video_count, view_count")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("yt_videos")
      .select(`
        id, yt_video_id, title, thumbnail_url, published_at, duration_seconds,
        yt_video_metrics (view_count, like_count, comment_count, likes_per_view, comments_per_view)
      `)
      .eq("workspace_id", workspaceId)
      .gte("duration_seconds", 65)
      .gte("published_at", periodStartIso)
      .order("published_at", { ascending: false })
      .limit(100),
  ]);

  const channel: YTChannel = channelResult.data ?? {
    title: googleConn.yt_channel_title,
    custom_url: null,
    thumbnail_url: null,
    subscriber_count: 0,
    video_count: 0,
    view_count: 0,
  };

  const videos: YTVideo[] = (videosResult.data ?? []).map((v) => {
    const m = Array.isArray(v.yt_video_metrics) ? v.yt_video_metrics[0] : v.yt_video_metrics;
    return {
      id: v.id,
      yt_video_id: v.yt_video_id,
      title: v.title,
      thumbnail_url: v.thumbnail_url,
      published_at: v.published_at,
      duration_seconds: v.duration_seconds,
      view_count: m?.view_count ?? 0,
      like_count: m?.like_count ?? 0,
      comment_count: m?.comment_count ?? 0,
      likes_per_view: m?.likes_per_view ?? null,
      comments_per_view: m?.comments_per_view ?? null,
    };
  });

  return (
    <div className="px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between relative">
        <div>
          <h1 className="page-title tracking-[-0.04em]">{t("pageTitle")}</h1>
          <p className="text-white/40 mt-3 text-[15px] font-normal">
            {t("pageSubtitle")}
          </p>
        </div>
        <Suspense fallback={null}>
          <DateFilter mode="url" defaultPreset="90d" />
        </Suspense>
      </div>

      <YouTubeDashboard
        channel={channel}
        videos={videos}
        workspaceId={workspaceId}
      />
    </div>
  );
}
