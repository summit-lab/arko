-- Migration 024: Content Calendar
-- Adds content_plan table for planning and tracking content ideas by date

CREATE TABLE IF NOT EXISTS content_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  planned_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  platform TEXT NOT NULL DEFAULT 'instagram', -- 'instagram' | 'youtube' | 'tiktok' | 'general'
  content_type TEXT,                           -- 'reel' | 'post' | 'story' | 'video' | 'short'
  status TEXT NOT NULL DEFAULT 'idea',         -- 'idea' | 'in_progress' | 'ready' | 'published'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index for workspace + date range queries
CREATE INDEX IF NOT EXISTS idx_content_plan_workspace_date
  ON content_plan(workspace_id, planned_date);

-- RLS
ALTER TABLE content_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_can_manage_content_plan"
  ON content_plan FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_content_plan_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_content_plan_updated_at
  BEFORE UPDATE ON content_plan
  FOR EACH ROW EXECUTE FUNCTION update_content_plan_updated_at();
