-- Cuando Moka quiere modificar un script, en vez de aplicarlo directamente,
-- crea un "pending change" que el usuario tiene que aprobar desde la UI.
-- Esto evita que Moka pise el contenido del usuario sin confirmación.

CREATE TABLE IF NOT EXISTS content_plan_pending_changes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_plan_id   UUID        NOT NULL REFERENCES content_plan(id) ON DELETE CASCADE,
  workspace_id      UUID        NOT NULL REFERENCES workspaces(id)   ON DELETE CASCADE,
  -- Snapshot del estado actual al momento de proponer (para detectar drift al aplicar)
  base_script       TEXT,
  base_title        TEXT,
  -- Propuesta nueva
  proposed_script   TEXT,
  proposed_title    TEXT,
  -- Quién propuso y desde dónde
  proposed_by_kind  TEXT        NOT NULL DEFAULT 'moka'
                                  CHECK (proposed_by_kind IN ('moka','user','system')),
  source_session    UUID        REFERENCES chat_sessions(id) ON DELETE SET NULL,
  rationale         TEXT,       -- nota corta opcional de qué cambió
  -- Estado
  status            TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','applied','rejected','expired')),
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_cppc_content_plan ON content_plan_pending_changes(content_plan_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cppc_workspace    ON content_plan_pending_changes(workspace_id,    status, created_at DESC);

ALTER TABLE content_plan_pending_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_plan_pending_changes_workspace_access" ON content_plan_pending_changes
  FOR ALL USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );
