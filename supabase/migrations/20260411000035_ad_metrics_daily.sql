-- ═══════════════════════════════════════════════════════════════
-- Migration 000035: ad_metrics_daily
-- Daily snapshots of per-ad metrics for time-series charts & trends.
-- Designed for 100+ users × 50 ads × 365 days = ~1.8M rows/year.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ad_metrics_daily (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ad_id             text NOT NULL,
  campaign_id       text NOT NULL,
  adset_id          text NOT NULL,
  ad_account_id     text NOT NULL,
  ad_name           text,
  metric_date       date NOT NULL,

  -- Daily metrics
  impressions       bigint DEFAULT 0,
  reach             bigint DEFAULT 0,
  clicks            bigint DEFAULT 0,
  spend_cents       bigint DEFAULT 0,
  video_plays       bigint DEFAULT 0,

  -- Timestamps
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),

  -- One row per ad per day
  UNIQUE(workspace_id, ad_id, metric_date)
);

-- Primary query: all daily metrics for workspace X between date A and B
CREATE INDEX idx_ad_metrics_daily_ws_date
  ON ad_metrics_daily (workspace_id, metric_date DESC);

-- Secondary: per-campaign drill-down
CREATE INDEX idx_ad_metrics_daily_campaign_date
  ON ad_metrics_daily (workspace_id, campaign_id, metric_date DESC);

-- ── RLS ──
ALTER TABLE ad_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_metrics_daily_select"
  ON ad_metrics_daily FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "ad_metrics_daily_insert"
  ON ad_metrics_daily FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "ad_metrics_daily_update"
  ON ad_metrics_daily FOR UPDATE
  USING (is_workspace_member(workspace_id));
