-- Comentarios anclados a un rango del documento (estilo Google Docs / Notion).
-- Antes los comentarios eran "random" sobre el guion entero. Ahora cada uno
-- queda atado a un texto específico via `comment_id` que matchea la marca
-- TipTap (data-comment-id) en el editor.

ALTER TABLE script_comments
  ADD COLUMN IF NOT EXISTS comment_id   TEXT,         -- uuid string que matchea data-comment-id en el HTML
  ADD COLUMN IF NOT EXISTS anchor_quoted TEXT;        -- snapshot del texto citado al crear (fallback si el ancla se pierde)

CREATE INDEX IF NOT EXISTS idx_script_comments_comment_id
  ON script_comments(content_plan_id, comment_id);

-- RLS: extender policy de workspace_members (antes era solo owner).
DROP POLICY IF EXISTS "script_comments_workspace_access" ON script_comments;
CREATE POLICY "script_comments_workspace_access" ON script_comments
  FOR ALL USING (is_workspace_member(workspace_id));
