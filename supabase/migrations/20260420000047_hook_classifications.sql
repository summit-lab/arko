-- ═══════════════════════════════════════════════════════════════
-- hook_classifications — cache for AI-classified reference hooks.
-- Each row maps a scraped reel (by short_code + workspace) to its
-- pattern (pregunta/lista/contraste/cta/historia/shock/afirmacion),
-- detected language and Spanish translation.
-- Populated by POST /api/v1/hooks/classify (Gemini-backed).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE hook_classifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  reference_id      uuid NOT NULL REFERENCES workspace_references(id) ON DELETE CASCADE,
  reel_short_code   text NOT NULL,
  original_text     text NOT NULL,
  translated_text   text,
  pattern           text NOT NULL CHECK (pattern IN (
    'pregunta', 'lista', 'contraste', 'cta', 'historia', 'shock', 'afirmacion'
  )),
  detected_language text NOT NULL,
  classified_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, reel_short_code)
);

CREATE INDEX idx_hook_cls_reference ON hook_classifications(reference_id);
CREATE INDEX idx_hook_cls_workspace_pattern ON hook_classifications(workspace_id, pattern);

ALTER TABLE hook_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_own_hook_classifications"
  ON hook_classifications
  FOR ALL
  USING (is_workspace_member(workspace_id))
  WITH CHECK (is_workspace_member(workspace_id));
