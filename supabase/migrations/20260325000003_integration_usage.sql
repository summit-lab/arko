-- ─── Integration Usage Tracking ──────────────────────────────────────────────
-- Records every external integration API call (scraping, enrichment, etc.)
-- Used by the admin panel to monitor spend per workspace.
-- Generic: supports any external provider (not just one).

CREATE TABLE IF NOT EXISTS integration_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature       text NOT NULL,          -- 'ig-reel-enrichment', 'ig-sync', etc.
  provider      text NOT NULL,          -- 'scraper', 'enrichment', etc.
  operation     text NOT NULL,          -- 'reel-scrape', 'duration-enrich', etc.
  items_count   integer NOT NULL DEFAULT 1,
  cost_usd      numeric(10,6) NOT NULL DEFAULT 0,
  latency_ms    integer,
  status        text NOT NULL DEFAULT 'success', -- 'success', 'error', 'timeout'
  metadata      jsonb DEFAULT '{}',     -- flexible extra data
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common admin queries
CREATE INDEX idx_integration_usage_workspace ON integration_usage(workspace_id);
CREATE INDEX idx_integration_usage_created   ON integration_usage(created_at DESC);
CREATE INDEX idx_integration_usage_provider  ON integration_usage(provider);

-- RLS
ALTER TABLE integration_usage ENABLE ROW LEVEL SECURITY;

-- Admins can read all usage
CREATE POLICY "Admins can read all integration_usage"
  ON integration_usage FOR SELECT
  TO authenticated
  USING (is_admin());

-- Insert allowed for authenticated users
CREATE POLICY "Authenticated users can insert own integration_usage"
  ON integration_usage FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
