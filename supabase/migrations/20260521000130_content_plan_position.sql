ALTER TABLE content_plan ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

UPDATE content_plan cp
SET position = sub.rn - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY workspace_id, status ORDER BY created_at) AS rn
  FROM content_plan
) sub
WHERE cp.id = sub.id;

CREATE INDEX IF NOT EXISTS idx_content_plan_workspace_status_position
  ON content_plan(workspace_id, status, position);
