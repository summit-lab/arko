-- ═══════════════════════════════════════════════════════════════
-- competitor_reel_snapshots
-- Daily per-reel metrics snapshot. The user wants to see the views-per-day
-- trajectory of a single competitor reel (what Instagram's own analytics shows
-- for a creator's own posts). The existing daily cron at 04:00 UTC already
-- re-scrapes every competitor; this table stores each scrape's per-reel
-- counts so we can plot the curve over time.
--
-- Primary key on (reel_id, snapshot_date) gives idempotency: re-runs of the
-- scrape on the same calendar day overwrite the row instead of accumulating
-- duplicates.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS competitor_reel_snapshots (
  reel_id        uuid NOT NULL REFERENCES competitor_reels(id) ON DELETE CASCADE,
  workspace_id   uuid NOT NULL,
  snapshot_date  date NOT NULL DEFAULT CURRENT_DATE,
  views_count    integer,
  likes_count    integer,
  comments_count integer,
  shares_count   integer,
  scraped_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reel_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_comp_reel_snap_reel_date
  ON competitor_reel_snapshots(reel_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_comp_reel_snap_workspace
  ON competitor_reel_snapshots(workspace_id);

ALTER TABLE competitor_reel_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_read_reel_snapshots"
  ON competitor_reel_snapshots FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_write_reel_snapshots"
  ON competitor_reel_snapshots FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Workspace members can also write snapshots from manual scrapes triggered
-- from the UI (vs the cron, which uses the service role).
CREATE POLICY "workspace_members_write_reel_snapshots"
  ON competitor_reel_snapshots FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
