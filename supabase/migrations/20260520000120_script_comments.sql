-- Comentarios en guiones (Mesa de Trabajo)
CREATE TABLE IF NOT EXISTS script_comments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_plan_id UUID        NOT NULL REFERENCES content_plan(id) ON DELETE CASCADE,
  workspace_id    UUID        NOT NULL REFERENCES workspaces(id)   ON DELETE CASCADE,
  user_id         UUID        REFERENCES auth.users(id)             ON DELETE SET NULL,
  author_name     TEXT        NOT NULL,
  text            TEXT        NOT NULL CHECK (char_length(text) <= 2000),
  resolved        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_comments_content_plan ON script_comments(content_plan_id);
CREATE INDEX IF NOT EXISTS idx_script_comments_workspace    ON script_comments(workspace_id);

ALTER TABLE script_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "script_comments_workspace_access" ON script_comments
  FOR ALL USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );
