-- Hardening de constraints sobre script_comments:
--  1) UNIQUE(content_plan_id, comment_id) — evita duplicados si el cliente
--     manda dos POST con el mismo UUID.
--  2) CHECK char_length(anchor_quoted) <= 500 — el endpoint ya trunca, pero
--     si alguien bypasea el endpoint, la DB lo rechaza.

-- Permitimos múltiples NULL en comment_id (comentarios viejos sin ancla),
-- por eso usamos un índice parcial en vez de UNIQUE constraint duro.
CREATE UNIQUE INDEX IF NOT EXISTS uq_script_comments_anchor
  ON script_comments(content_plan_id, comment_id)
  WHERE comment_id IS NOT NULL;

ALTER TABLE script_comments
  DROP CONSTRAINT IF EXISTS script_comments_anchor_quoted_length;
ALTER TABLE script_comments
  ADD CONSTRAINT script_comments_anchor_quoted_length
  CHECK (anchor_quoted IS NULL OR char_length(anchor_quoted) <= 500);
