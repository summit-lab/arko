-- Migration 9: Instagram Account-level insights + demographics
-- Stores daily metrics from GET /{ig-user-id}/insights and demographic snapshots

-- =============================================================
-- IG_ACCOUNT_INSIGHTS — Daily account metrics from IG User Insights API
-- Endpoint: GET /{ig-user-id}/insights?metric=...&period=day
-- =============================================================
CREATE TABLE ig_account_insights (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Date of the metric (one row per day)
  metric_date           date NOT NULL,

  -- Core daily metrics (period=day)
  impressions           bigint DEFAULT 0,
  reach                 bigint DEFAULT 0,
  profile_views         bigint DEFAULT 0,
  accounts_engaged      bigint DEFAULT 0,
  total_interactions    bigint DEFAULT 0,
  likes                 bigint DEFAULT 0,
  comments              bigint DEFAULT 0,
  shares                bigint DEFAULT 0,
  saves                 bigint DEFAULT 0,
  replies               bigint DEFAULT 0,

  -- Follower metrics
  follower_count        bigint DEFAULT 0,
  follows_count         bigint DEFAULT 0,
  media_count           bigint DEFAULT 0,

  -- Website / external
  website_clicks        bigint DEFAULT 0,
  email_contacts        bigint DEFAULT 0,
  phone_call_clicks     bigint DEFAULT 0,
  get_directions_clicks bigint DEFAULT 0,

  fetched_at            timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, metric_date)
);

CREATE INDEX idx_ig_account_insights_ws_date ON ig_account_insights(workspace_id, metric_date DESC);

CREATE TRIGGER ig_account_insights_updated_at
  BEFORE UPDATE ON ig_account_insights
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE ig_account_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY ig_account_insights_select ON ig_account_insights FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY ig_account_insights_insert ON ig_account_insights FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY ig_account_insights_update ON ig_account_insights FOR UPDATE USING (is_workspace_member(workspace_id));

-- =============================================================
-- IG_ACCOUNT_DEMOGRAPHICS — Lifetime demographic snapshots
-- Endpoint: GET /{ig-user-id}/insights?metric=audience_*&period=lifetime
-- =============================================================
CREATE TABLE ig_account_demographics (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Snapshot timestamp
  snapshot_date         date NOT NULL,

  -- Demographics stored as JSONB for flexibility
  -- { "M.18-24": 120, "F.25-34": 95, ... }
  audience_gender_age   jsonb DEFAULT '{}',

  -- { "Montevideo, Montevideo Department": 253, "Buenos Aires": 44, ... }
  audience_city         jsonb DEFAULT '{}',

  -- { "UY": 253, "AR": 44, "CO": 30, ... }
  audience_country      jsonb DEFAULT '{}',

  -- { "es": 400, "en": 80, ... }
  audience_locale       jsonb DEFAULT '{}',

  fetched_at            timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, snapshot_date)
);

CREATE INDEX idx_ig_account_demographics_ws ON ig_account_demographics(workspace_id, snapshot_date DESC);

CREATE TRIGGER ig_account_demographics_updated_at
  BEFORE UPDATE ON ig_account_demographics
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE ig_account_demographics ENABLE ROW LEVEL SECURITY;

CREATE POLICY ig_account_demographics_select ON ig_account_demographics FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY ig_account_demographics_insert ON ig_account_demographics FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY ig_account_demographics_update ON ig_account_demographics FOR UPDATE USING (is_workspace_member(workspace_id));
