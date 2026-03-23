-- ═══════════════════════════════════════════════════════════════
-- Migration 000012: reel_metrics_daily
-- Daily snapshots of per-reel metrics for time-series charts.
-- Designed for 100+ users × 75+ reels × 365 days = ~2.7M rows/year.
-- ═══════════════════════════════════════════════════════════════

-- Table: daily snapshot of each reel's metrics
CREATE TABLE IF NOT EXISTS reel_metrics_daily (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id             uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_date         date NOT NULL,

  -- Organic metrics snapshot
  views_org           bigint DEFAULT 0,
  reach_org           bigint DEFAULT 0,
  impressions_org     bigint DEFAULT 0,
  likes_total         bigint DEFAULT 0,
  comments_total      bigint DEFAULT 0,
  shares_total        bigint DEFAULT 0,
  saves_total         bigint DEFAULT 0,
  total_interactions  bigint DEFAULT 0,
  avg_watch_time_sec  real,

  -- Paid metrics snapshot (from reel_metrics_paid at time of sync)
  views_paid          bigint DEFAULT 0,
  impressions_paid    bigint DEFAULT 0,
  reach_paid          bigint DEFAULT 0,
  spend_cents         bigint DEFAULT 0,

  -- Timestamps
  fetched_at          timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),

  -- One row per reel per day
  UNIQUE(reel_id, metric_date)
);

-- ── Indexes for multi-tenant queries ──
-- Primary query pattern: "all metrics for workspace X between date A and date B"
CREATE INDEX idx_reel_metrics_daily_workspace_date
  ON reel_metrics_daily (workspace_id, metric_date DESC);

-- Secondary: lookup by reel + date range (for per-reel charts)
CREATE INDEX idx_reel_metrics_daily_reel_date
  ON reel_metrics_daily (reel_id, metric_date DESC);

-- ── RLS ──
ALTER TABLE reel_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reel_metrics_daily_select"
  ON reel_metrics_daily FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "reel_metrics_daily_insert"
  ON reel_metrics_daily FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "reel_metrics_daily_update"
  ON reel_metrics_daily FOR UPDATE
  USING (is_workspace_member(workspace_id));

-- ── Updated_at trigger ──
CREATE TRIGGER handle_updated_at_reel_metrics_daily
  BEFORE UPDATE ON reel_metrics_daily
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
