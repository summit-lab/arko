-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 019: Competitor Reels + Analysis
-- Stores scraped reels from competitors and their AI analysis
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── competitor_reels ────────────────────────────────────────────────────────
-- Stores individual reels scraped from competitor IG accounts via Apify

CREATE TABLE IF NOT EXISTS competitor_reels (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   uuid NOT NULL REFERENCES workspace_competitors(id) ON DELETE CASCADE,
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  short_code      text,
  permalink       text,
  caption         text,
  likes_count     integer,
  comments_count  integer,
  views_count     integer,
  shares_count    integer,
  duration_seconds numeric(6,1),
  published_at    timestamptz,
  thumbnail_url   text,
  video_url       text,
  transcript      text,
  hashtags        text[] DEFAULT '{}',
  mentions        text[] DEFAULT '{}',
  music_artist    text,
  music_name      text,
  raw_data        jsonb DEFAULT '{}',
  scraped_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_competitor_reels_competitor ON competitor_reels(competitor_id);
CREATE INDEX idx_competitor_reels_workspace  ON competitor_reels(workspace_id);
CREATE INDEX idx_competitor_reels_views      ON competitor_reels(views_count DESC NULLS LAST);
CREATE INDEX idx_competitor_reels_published  ON competitor_reels(published_at DESC NULLS LAST);
CREATE UNIQUE INDEX idx_competitor_reels_unique ON competitor_reels(competitor_id, short_code) WHERE short_code IS NOT NULL;

-- RLS
ALTER TABLE competitor_reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_competitor_reels" ON competitor_reels
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "members_insert_competitor_reels" ON competitor_reels
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "members_update_competitor_reels" ON competitor_reels
  FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "members_delete_competitor_reels" ON competitor_reels
  FOR DELETE USING (is_workspace_member(workspace_id));


-- ─── competitor_reel_analysis ────────────────────────────────────────────────
-- AI analysis of competitor reels (hooks, style, structure, CTA)

CREATE TABLE IF NOT EXISTS competitor_reel_analysis (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_reel_id uuid NOT NULL REFERENCES competitor_reels(id) ON DELETE CASCADE UNIQUE,
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  hook_text         text,
  hook_type         text,
  narrative_structure text,
  content_type      text,
  cta_text          text,
  cta_type          text,
  topic_cluster     text,
  style_notes       text,
  strengths         text,
  weaknesses        text,
  ai_summary        text,
  model_used        text,
  tokens_used       integer,
  analyzed_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_competitor_reel_analysis_ws    ON competitor_reel_analysis(workspace_id);
CREATE INDEX idx_competitor_reel_analysis_reel  ON competitor_reel_analysis(competitor_reel_id);

-- RLS
ALTER TABLE competitor_reel_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_competitor_reel_analysis" ON competitor_reel_analysis
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "members_insert_competitor_reel_analysis" ON competitor_reel_analysis
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "members_update_competitor_reel_analysis" ON competitor_reel_analysis
  FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "members_delete_competitor_reel_analysis" ON competitor_reel_analysis
  FOR DELETE USING (is_workspace_member(workspace_id));
