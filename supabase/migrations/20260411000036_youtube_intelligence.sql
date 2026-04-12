-- Migration 36: YouTube Intelligence — Phase 1 (API Key only, no OAuth)
-- yt_channels, yt_videos, yt_video_metrics, yt_video_metrics_daily

-- =============================================================
-- YT_CHANNELS — YouTube channel metadata (cached)
-- =============================================================
CREATE TABLE yt_channels (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  yt_channel_id           text NOT NULL,

  title                   text,
  description             text,
  custom_url              text,
  thumbnail_url           text,
  banner_url              text,
  country                 text,
  published_at            timestamptz,

  subscriber_count        bigint DEFAULT 0,
  video_count             bigint DEFAULT 0,
  view_count              bigint DEFAULT 0,

  uploads_playlist_id     text,

  fetched_at              timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, yt_channel_id)
);

CREATE INDEX idx_yt_channels_workspace ON yt_channels(workspace_id);

ALTER TABLE yt_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "yt_channels_select" ON yt_channels FOR SELECT
  USING (is_workspace_member(workspace_id));
CREATE POLICY "yt_channels_insert" ON yt_channels FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "yt_channels_update" ON yt_channels FOR UPDATE
  USING (is_workspace_member(workspace_id));

-- =============================================================
-- YT_VIDEOS — YouTube video base data
-- =============================================================
CREATE TABLE yt_videos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  yt_video_id             text NOT NULL,

  title                   text,
  description             text,
  thumbnail_url           text,
  published_at            timestamptz,
  channel_id              text,
  tags                    text[] DEFAULT '{}',
  category_id             text,

  duration_seconds        real,
  definition              text,
  caption_available       boolean DEFAULT false,
  privacy_status          text DEFAULT 'public',

  sync_status             text NOT NULL DEFAULT 'synced'
                          CHECK (sync_status IN ('synced', 'processing', 'analyzed', 'error')),

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, yt_video_id)
);

CREATE INDEX idx_yt_videos_workspace ON yt_videos(workspace_id);
CREATE INDEX idx_yt_videos_published ON yt_videos(workspace_id, published_at DESC);
CREATE INDEX idx_yt_videos_yt_id ON yt_videos(yt_video_id);

ALTER TABLE yt_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "yt_videos_select" ON yt_videos FOR SELECT
  USING (is_workspace_member(workspace_id));
CREATE POLICY "yt_videos_insert" ON yt_videos FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "yt_videos_update" ON yt_videos FOR UPDATE
  USING (is_workspace_member(workspace_id));

-- =============================================================
-- YT_VIDEO_METRICS — Latest video statistics
-- =============================================================
CREATE TABLE yt_video_metrics (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id                uuid NOT NULL REFERENCES yt_videos(id) ON DELETE CASCADE,
  workspace_id            uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  view_count              bigint DEFAULT 0,
  like_count              bigint DEFAULT 0,
  comment_count           bigint DEFAULT 0,
  favorite_count          bigint DEFAULT 0,

  likes_per_view          real,
  comments_per_view       real,

  fetched_at              timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (video_id)
);

CREATE INDEX idx_yt_video_metrics_video ON yt_video_metrics(video_id);
CREATE INDEX idx_yt_video_metrics_workspace ON yt_video_metrics(workspace_id);

ALTER TABLE yt_video_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "yt_video_metrics_select" ON yt_video_metrics FOR SELECT
  USING (is_workspace_member(workspace_id));
CREATE POLICY "yt_video_metrics_insert" ON yt_video_metrics FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "yt_video_metrics_update" ON yt_video_metrics FOR UPDATE
  USING (is_workspace_member(workspace_id));

-- =============================================================
-- YT_VIDEO_METRICS_DAILY — Daily snapshots for time-series
-- =============================================================
CREATE TABLE yt_video_metrics_daily (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id                uuid NOT NULL REFERENCES yt_videos(id) ON DELETE CASCADE,
  workspace_id            uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_date             date NOT NULL,

  view_count              bigint DEFAULT 0,
  like_count              bigint DEFAULT 0,
  comment_count           bigint DEFAULT 0,

  fetched_at              timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (video_id, metric_date)
);

CREATE INDEX idx_yt_vmd_ws ON yt_video_metrics_daily(workspace_id, metric_date DESC);
CREATE INDEX idx_yt_vmd_video ON yt_video_metrics_daily(video_id, metric_date DESC);

ALTER TABLE yt_video_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "yt_vmd_select" ON yt_video_metrics_daily FOR SELECT
  USING (is_workspace_member(workspace_id));
CREATE POLICY "yt_vmd_insert" ON yt_video_metrics_daily FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "yt_vmd_update" ON yt_video_metrics_daily FOR UPDATE
  USING (is_workspace_member(workspace_id));

-- =============================================================
-- Update sync_jobs job_type to include YouTube types
-- =============================================================
ALTER TABLE sync_jobs DROP CONSTRAINT IF EXISTS sync_jobs_job_type_check;
ALTER TABLE sync_jobs ADD CONSTRAINT sync_jobs_job_type_check
  CHECK (job_type IN (
    'ig_media', 'ig_insights', 'ads_insights', 'ad_mapping',
    'transcription', 'visual_analysis', 'narrative_analysis',
    'audio_analysis', 'benchmark_calc', 'full_sync',
    'ig_stories',
    'yt_videos', 'yt_full_sync'
  ));
