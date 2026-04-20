-- ═══════════════════════════════════════════════════════════════
-- reference_reel_analysis — AI analysis of scraped reference reels.
--
-- workspace_references.scraped_reels is a jsonb ARRAY inside the parent row
-- (not its own table), so this analysis table identifies a reel by the
-- composite key (reference_id, reel_short_code). Short codes from Instagram
-- are globally unique per reel, so within a single reference this is safe.
--
-- Mirrors the schema of competitor_reel_analysis (fields + indexes + RLS).
-- Populated by POST /api/v1/references/[id]/reels/[shortCode]/analyze
-- (and the bulk POST /api/v1/references/[id]/analyze-all).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE reference_reel_analysis (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id        uuid NOT NULL REFERENCES workspace_references(id) ON DELETE CASCADE,
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  reel_short_code     text NOT NULL,

  hook_text           text,
  hook_type           text,
  narrative_structure text,
  content_type        text,
  cta_text            text,
  cta_type            text,
  topic_cluster       text,
  style_notes         text,
  strengths           text,
  weaknesses          text,
  ai_summary          text,
  model_used          text,
  tokens_used         integer,

  analyzed_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (reference_id, reel_short_code)
);

CREATE INDEX idx_ref_reel_analysis_ws   ON reference_reel_analysis(workspace_id);
CREATE INDEX idx_ref_reel_analysis_ref  ON reference_reel_analysis(reference_id);

ALTER TABLE reference_reel_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_ref_reel_analysis" ON reference_reel_analysis
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "members_insert_ref_reel_analysis" ON reference_reel_analysis
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "members_update_ref_reel_analysis" ON reference_reel_analysis
  FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "members_delete_ref_reel_analysis" ON reference_reel_analysis
  FOR DELETE USING (is_workspace_member(workspace_id));
