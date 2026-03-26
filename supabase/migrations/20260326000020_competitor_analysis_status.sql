-- Add analysis_status to workspace_competitors for persistent loading state
-- Tracks whether an analysis is currently in progress so UI can show loading
-- even after navigation away and back.

ALTER TABLE workspace_competitors
  ADD COLUMN IF NOT EXISTS analysis_status text NOT NULL DEFAULT 'idle';

COMMENT ON COLUMN workspace_competitors.analysis_status IS 'idle | analyzing — persisted loading state for competitor analysis';
