-- Migration 3: Reels, metrics (organic + paid), benchmarks, ad mappings
-- PRD sections: 5.1, 5.2, 6.1-6.4

-- =============================================================
-- REELS — Core entity: one row per Instagram Reel
-- PRD 6.1: Datos base
-- =============================================================
CREATE TABLE reels (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id              uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- IG Graph API fields
  ig_media_id               text NOT NULL,
  caption                   text,
  media_type                text,
  media_product_type        text,
  permalink                 text,
  media_url                 text,
  thumbnail_url             text,
  is_shared_to_feed         boolean,
  published_at              timestamptz,

  -- Derived fields
  duration_seconds          real,
  reel_type                 text NOT NULL DEFAULT 'unknown'
                            CHECK (reel_type IN ('normal', 'trial_likely', 'unknown')),

  -- Ads relationship
  has_ads                   boolean NOT NULL DEFAULT false,
  attribution_confidence    text NOT NULL DEFAULT 'none'
                            CHECK (attribution_confidence IN ('none', 'low', 'medium', 'high')),

  -- Processing status
  sync_status               text NOT NULL DEFAULT 'synced'
                            CHECK (sync_status IN ('synced', 'processing', 'analyzed', 'error')),

  -- Media storage
  media_storage_path        text,
  thumbnail_storage_path    text,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, ig_media_id)
);

CREATE INDEX idx_reels_workspace ON reels(workspace_id);
CREATE INDEX idx_reels_published ON reels(workspace_id, published_at DESC);
CREATE INDEX idx_reels_type ON reels(workspace_id, reel_type);
CREATE INDEX idx_reels_ig_media ON reels(ig_media_id);

CREATE TRIGGER reels_updated_at
  BEFORE UPDATE ON reels
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE reels ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- REEL_METRICS — Organic metrics from IG Graph API
-- PRD 6.2: Métricas orgánicas
-- =============================================================
CREATE TABLE reel_metrics (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id               uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Core organic metrics (IG Graph API)
  views_org             bigint DEFAULT 0,
  impressions_org       bigint DEFAULT 0,
  reach_org             bigint DEFAULT 0,
  likes_total           bigint DEFAULT 0,
  comments_total        bigint DEFAULT 0,
  shares_total          bigint DEFAULT 0,
  saves_total           bigint DEFAULT 0,
  total_interactions    bigint DEFAULT 0,
  profile_visits        bigint,
  follows_generated     bigint,
  avg_watch_time_sec    real,
  completion_rate       real,

  -- Fetched at (for re-sync tracking)
  fetched_at            timestamptz NOT NULL DEFAULT now(),

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (reel_id)
);

CREATE INDEX idx_reel_metrics_reel ON reel_metrics(reel_id);
CREATE INDEX idx_reel_metrics_workspace ON reel_metrics(workspace_id);

CREATE TRIGGER reel_metrics_updated_at
  BEFORE UPDATE ON reel_metrics
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE reel_metrics ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- REEL_METRICS_PAID — Paid metrics from Marketing API
-- PRD 6.2: Métricas pagas
-- =============================================================
CREATE TABLE reel_metrics_paid (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id               uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Aggregated paid metrics across all ads for this reel
  views_paid            bigint DEFAULT 0,
  impressions_paid      bigint DEFAULT 0,
  reach_paid            bigint DEFAULT 0,
  clicks                bigint DEFAULT 0,
  spend_cents           bigint DEFAULT 0,
  video_plays           bigint DEFAULT 0,

  fetched_at            timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (reel_id)
);

CREATE INDEX idx_reel_metrics_paid_reel ON reel_metrics_paid(reel_id);
CREATE INDEX idx_reel_metrics_paid_workspace ON reel_metrics_paid(workspace_id);

CREATE TRIGGER reel_metrics_paid_updated_at
  BEFORE UPDATE ON reel_metrics_paid
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE reel_metrics_paid ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- AD_MAPPINGS — Reel ↔ Ad mapping
-- PRD 5.2: Mapeo Ad → Reel
-- =============================================================
CREATE TABLE ad_mappings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id               uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Meta Ads fields
  ad_id                 text NOT NULL,
  ad_name               text,
  campaign_id           text,
  adset_id              text,
  ad_account_id         text,

  -- How the mapping was resolved (PRD 5.2 priority order)
  match_method          text NOT NULL
                        CHECK (match_method IN ('object_story_id', 'creative_permalink', 'permalink_match', 'manual')),
  match_confidence      text NOT NULL DEFAULT 'medium'
                        CHECK (match_confidence IN ('low', 'medium', 'high')),

  -- Ad-level metrics
  impressions           bigint DEFAULT 0,
  reach                 bigint DEFAULT 0,
  clicks                bigint DEFAULT 0,
  spend_cents           bigint DEFAULT 0,
  video_plays           bigint DEFAULT 0,

  -- Raw Meta API fields for debugging
  object_story_id       text,
  creative_id           text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (reel_id, ad_id)
);

CREATE INDEX idx_ad_mappings_reel ON ad_mappings(reel_id);
CREATE INDEX idx_ad_mappings_workspace ON ad_mappings(workspace_id);
CREATE INDEX idx_ad_mappings_ad ON ad_mappings(ad_id);

CREATE TRIGGER ad_mappings_updated_at
  BEFORE UPDATE ON ad_mappings
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE ad_mappings ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- REEL_BENCHMARKS — 90-day rolling benchmarks per workspace
-- PRD 6.4: Benchmark (comparación 90d)
-- =============================================================
CREATE TABLE reel_benchmarks (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Window
  calculated_at                 timestamptz NOT NULL DEFAULT now(),
  window_start                  date NOT NULL,
  window_end                    date NOT NULL,
  reels_in_window               int NOT NULL DEFAULT 0,

  -- Averages (PRD 6.4)
  avg_views_90d                 real DEFAULT 0,
  avg_comments_90d              real DEFAULT 0,
  avg_saves_90d                 real DEFAULT 0,
  avg_follows_90d               real DEFAULT 0,
  avg_likes_90d                 real DEFAULT 0,
  avg_shares_90d                real DEFAULT 0,
  avg_reach_90d                 real DEFAULT 0,
  avg_watch_time_90d            real DEFAULT 0,

  -- Ratios averages
  avg_likes_per_view            real DEFAULT 0,
  avg_comments_per_view         real DEFAULT 0,
  avg_shares_per_view           real DEFAULT 0,
  avg_saves_per_view            real DEFAULT 0,
  avg_follows_per_view          real DEFAULT 0,

  -- Config
  exclude_trials                boolean NOT NULL DEFAULT false,
  min_views_threshold           int NOT NULL DEFAULT 5000,

  created_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reel_benchmarks_workspace ON reel_benchmarks(workspace_id);
CREATE INDEX idx_reel_benchmarks_calc ON reel_benchmarks(workspace_id, calculated_at DESC);

ALTER TABLE reel_benchmarks ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- VIEW: reel_computed — Computed fields (views_total, ratios, performer multiples)
-- PRD 6.2-6.3: Calculated metrics and ratios
-- =============================================================
CREATE OR REPLACE VIEW reel_computed AS
SELECT
  r.id AS reel_id,
  r.workspace_id,

  -- Total views (PRD 6.2)
  COALESCE(rm.views_org, 0) AS views_org,
  COALESCE(rmp.views_paid, 0) AS views_paid,
  COALESCE(rm.views_org, 0) + COALESCE(rmp.views_paid, 0) AS views_total,

  -- Total impressions/reach
  COALESCE(rm.impressions_org, 0) + COALESCE(rmp.impressions_paid, 0) AS impressions_total,
  COALESCE(rm.reach_org, 0) + COALESCE(rmp.reach_paid, 0) AS reach_total,

  -- Engagement
  COALESCE(rm.likes_total, 0) AS likes_total,
  COALESCE(rm.comments_total, 0) AS comments_total,
  COALESCE(rm.shares_total, 0) AS shares_total,
  COALESCE(rm.saves_total, 0) AS saves_total,

  -- Ratios per view (PRD 6.3)
  CASE WHEN (COALESCE(rm.views_org, 0) + COALESCE(rmp.views_paid, 0)) > 0
    THEN rm.likes_total::real / (COALESCE(rm.views_org, 0) + COALESCE(rmp.views_paid, 0))
    ELSE 0 END AS likes_per_view,
  CASE WHEN (COALESCE(rm.views_org, 0) + COALESCE(rmp.views_paid, 0)) > 0
    THEN rm.comments_total::real / (COALESCE(rm.views_org, 0) + COALESCE(rmp.views_paid, 0))
    ELSE 0 END AS comments_per_view,
  CASE WHEN (COALESCE(rm.views_org, 0) + COALESCE(rmp.views_paid, 0)) > 0
    THEN rm.shares_total::real / (COALESCE(rm.views_org, 0) + COALESCE(rmp.views_paid, 0))
    ELSE 0 END AS shares_per_view,
  CASE WHEN (COALESCE(rm.views_org, 0) + COALESCE(rmp.views_paid, 0)) > 0
    THEN rm.saves_total::real / (COALESCE(rm.views_org, 0) + COALESCE(rmp.views_paid, 0))
    ELSE 0 END AS saves_per_view,
  CASE WHEN (COALESCE(rm.impressions_org, 0) + COALESCE(rmp.impressions_paid, 0)) > 0
    THEN (COALESCE(rm.views_org, 0) + COALESCE(rmp.views_paid, 0))::real /
         (COALESCE(rm.impressions_org, 0) + COALESCE(rmp.impressions_paid, 0))
    ELSE 0 END AS views_per_impression,
  CASE WHEN (COALESCE(rm.views_org, 0) + COALESCE(rmp.views_paid, 0)) > 0 AND rm.follows_generated IS NOT NULL
    THEN rm.follows_generated::real / (COALESCE(rm.views_org, 0) + COALESCE(rmp.views_paid, 0))
    ELSE 0 END AS follows_per_view,

  -- Retention (PRD 6.2)
  CASE WHEN r.duration_seconds > 0 AND rm.avg_watch_time_sec IS NOT NULL
    THEN rm.avg_watch_time_sec / r.duration_seconds
    ELSE NULL END AS retention_ratio

FROM reels r
LEFT JOIN reel_metrics rm ON rm.reel_id = r.id
LEFT JOIN reel_metrics_paid rmp ON rmp.reel_id = r.id;
