-- Migration 6: Sync jobs tracking + RLS policies for ALL tables
-- PRD sections: 5.3, 14.9

-- =============================================================
-- SYNC_JOBS — Track sync job execution
-- =============================================================
CREATE TABLE sync_jobs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  job_type          text NOT NULL
                    CHECK (job_type IN ('ig_media', 'ig_insights', 'ads_insights', 'ad_mapping',
                                         'transcription', 'visual_analysis', 'narrative_analysis',
                                         'audio_analysis', 'benchmark_calc', 'full_sync')),

  status            text NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),

  -- Progress
  total_items       int DEFAULT 0,
  processed_items   int DEFAULT 0,

  -- Timing
  started_at        timestamptz,
  completed_at      timestamptz,

  -- Error tracking
  error_message     text,
  error_details     jsonb DEFAULT '{}',

  -- Metadata
  metadata          jsonb DEFAULT '{}',

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_jobs_workspace ON sync_jobs(workspace_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(workspace_id, status);
CREATE INDEX idx_sync_jobs_type ON sync_jobs(workspace_id, job_type);
CREATE INDEX idx_sync_jobs_created ON sync_jobs(workspace_id, created_at DESC);

CREATE TRIGGER sync_jobs_updated_at
  BEFORE UPDATE ON sync_jobs
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- HELPER FUNCTION: Check workspace ownership
-- Used by all RLS policies to verify workspace access
-- =============================================================
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = ws_id AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================
-- RLS POLICIES — All tables
-- Principle: users can only access data in their own workspaces
-- =============================================================

-- ---- workspaces ----
CREATE POLICY "Users can view own workspaces"
  ON workspaces FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own workspaces"
  ON workspaces FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own workspaces"
  ON workspaces FOR DELETE
  USING (owner_id = auth.uid());

-- ---- meta_connections ----
CREATE POLICY "meta_connections_select"
  ON meta_connections FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "meta_connections_insert"
  ON meta_connections FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "meta_connections_update"
  ON meta_connections FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "meta_connections_delete"
  ON meta_connections FOR DELETE
  USING (is_workspace_member(workspace_id));

-- ---- reels ----
CREATE POLICY "reels_select"
  ON reels FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "reels_insert"
  ON reels FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "reels_update"
  ON reels FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "reels_delete"
  ON reels FOR DELETE
  USING (is_workspace_member(workspace_id));

-- ---- reel_metrics ----
CREATE POLICY "reel_metrics_select"
  ON reel_metrics FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "reel_metrics_insert"
  ON reel_metrics FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "reel_metrics_update"
  ON reel_metrics FOR UPDATE
  USING (is_workspace_member(workspace_id));

-- ---- reel_metrics_paid ----
CREATE POLICY "reel_metrics_paid_select"
  ON reel_metrics_paid FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "reel_metrics_paid_insert"
  ON reel_metrics_paid FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "reel_metrics_paid_update"
  ON reel_metrics_paid FOR UPDATE
  USING (is_workspace_member(workspace_id));

-- ---- ad_mappings ----
CREATE POLICY "ad_mappings_select"
  ON ad_mappings FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "ad_mappings_insert"
  ON ad_mappings FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "ad_mappings_update"
  ON ad_mappings FOR UPDATE
  USING (is_workspace_member(workspace_id));

-- ---- reel_benchmarks ----
CREATE POLICY "reel_benchmarks_select"
  ON reel_benchmarks FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "reel_benchmarks_insert"
  ON reel_benchmarks FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

-- ---- reel_transcripts ----
CREATE POLICY "reel_transcripts_select"
  ON reel_transcripts FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "reel_transcripts_insert"
  ON reel_transcripts FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "reel_transcripts_update"
  ON reel_transcripts FOR UPDATE
  USING (is_workspace_member(workspace_id));

-- ---- reel_narrative_analysis ----
CREATE POLICY "reel_narrative_select"
  ON reel_narrative_analysis FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "reel_narrative_insert"
  ON reel_narrative_analysis FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "reel_narrative_update"
  ON reel_narrative_analysis FOR UPDATE
  USING (is_workspace_member(workspace_id));

-- ---- reel_visual_analysis ----
CREATE POLICY "reel_visual_select"
  ON reel_visual_analysis FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "reel_visual_insert"
  ON reel_visual_analysis FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "reel_visual_update"
  ON reel_visual_analysis FOR UPDATE
  USING (is_workspace_member(workspace_id));

-- ---- reel_audio_analysis ----
CREATE POLICY "reel_audio_select"
  ON reel_audio_analysis FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "reel_audio_insert"
  ON reel_audio_analysis FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "reel_audio_update"
  ON reel_audio_analysis FOR UPDATE
  USING (is_workspace_member(workspace_id));

-- ---- reel_diagnostics ----
CREATE POLICY "reel_diagnostics_select"
  ON reel_diagnostics FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "reel_diagnostics_insert"
  ON reel_diagnostics FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

-- ---- chat_sessions ----
CREATE POLICY "chat_sessions_select"
  ON chat_sessions FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "chat_sessions_insert"
  ON chat_sessions FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "chat_sessions_update"
  ON chat_sessions FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "chat_sessions_delete"
  ON chat_sessions FOR DELETE
  USING (is_workspace_member(workspace_id));

-- ---- chat_messages ----
CREATE POLICY "chat_messages_select"
  ON chat_messages FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "chat_messages_insert"
  ON chat_messages FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

-- ---- audit_logs ----
CREATE POLICY "audit_logs_select"
  ON audit_logs FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "audit_logs_insert"
  ON audit_logs FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

-- ---- sync_jobs ----
CREATE POLICY "sync_jobs_select"
  ON sync_jobs FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "sync_jobs_insert"
  ON sync_jobs FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "sync_jobs_update"
  ON sync_jobs FOR UPDATE
  USING (is_workspace_member(workspace_id));

-- =============================================================
-- STORAGE BUCKETS
-- =============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('reels-media', 'reels-media', false),
  ('reels-frames', 'reels-frames', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: only workspace owners can access their files
CREATE POLICY "reels_media_select"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('reels-media', 'reels-frames'));

CREATE POLICY "reels_media_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('reels-media', 'reels-frames') AND auth.role() = 'authenticated');

CREATE POLICY "reels_media_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id IN ('reels-media', 'reels-frames') AND auth.role() = 'authenticated');
