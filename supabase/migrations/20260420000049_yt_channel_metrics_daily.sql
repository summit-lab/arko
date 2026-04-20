-- ═══════════════════════════════════════════════════════════════
-- yt_channel_metrics_daily — daily snapshot of channel-level YT stats.
--
-- yt_channels.subscriber_count / video_count / view_count are overwritten
-- on every sync, so we have no history to graph subscriber growth. This
-- table captures one row per (channel, date) using the same pattern as
-- yt_video_metrics_daily and ig daily_insights.
--
-- Populated by the sync-youtube edge function immediately after the
-- channels API fetch, upserting today's values (idempotent within the day).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE yt_channel_metrics_daily (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id        uuid NOT NULL REFERENCES yt_channels(id) ON DELETE CASCADE,
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_date       date NOT NULL,

  subscriber_count  bigint DEFAULT 0,
  video_count       bigint DEFAULT 0,
  view_count        bigint DEFAULT 0,

  fetched_at        timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (channel_id, metric_date)
);

CREATE INDEX idx_yt_cmd_ws_date  ON yt_channel_metrics_daily(workspace_id, metric_date DESC);
CREATE INDEX idx_yt_cmd_channel  ON yt_channel_metrics_daily(channel_id, metric_date DESC);

ALTER TABLE yt_channel_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "yt_cmd_select" ON yt_channel_metrics_daily FOR SELECT
  USING (is_workspace_member(workspace_id));
CREATE POLICY "yt_cmd_insert" ON yt_channel_metrics_daily FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "yt_cmd_update" ON yt_channel_metrics_daily FOR UPDATE
  USING (is_workspace_member(workspace_id));
