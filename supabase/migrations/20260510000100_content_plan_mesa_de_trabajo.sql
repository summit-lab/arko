-- Migration 100: Extend content_plan for Mesa de Trabajo
-- Adds script, source tracking, and metrics columns to the existing content_plan table

ALTER TABLE content_plan
  ADD COLUMN IF NOT EXISTS script      TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_ref  TEXT,
  ADD COLUMN IF NOT EXISTS metrics     JSONB;

-- Index for status-based kanban queries
CREATE INDEX IF NOT EXISTS idx_content_plan_workspace_status
  ON content_plan(workspace_id, status);
