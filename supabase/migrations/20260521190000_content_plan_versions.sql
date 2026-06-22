-- Versionado automático de scripts y títulos de content_plan.
-- Cada UPDATE que cambia script o title genera una fila histórica.
-- Pensado para poder recuperar cambios pisados por Moka u otros flujos.

CREATE TABLE IF NOT EXISTS content_plan_versions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_plan_id  UUID        NOT NULL REFERENCES content_plan(id) ON DELETE CASCADE,
  workspace_id     UUID        NOT NULL REFERENCES workspaces(id)   ON DELETE CASCADE,
  -- snapshot del valor PREVIO (lo que se está pisando)
  title            TEXT,
  script           TEXT,
  -- contexto opcional: quién cambió y por qué
  changed_by_kind  TEXT        NOT NULL DEFAULT 'unknown'
                                CHECK (changed_by_kind IN ('user','moka','system','unknown')),
  changed_by_user  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason    TEXT,       -- ej. 'manual_edit', 'moka_propose_apply', 'auto_save'
  source_session   UUID,       -- chat session si aplica
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cpv_content_plan ON content_plan_versions(content_plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpv_workspace    ON content_plan_versions(workspace_id,    created_at DESC);

ALTER TABLE content_plan_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_plan_versions_workspace_access" ON content_plan_versions
  FOR ALL USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- ─── Trigger: snapshot automático antes de cada UPDATE que toca script o title ─
-- Captura el OLD (estado previo) para que sea recuperable después.
CREATE OR REPLACE FUNCTION public.snapshot_content_plan_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kind   TEXT;
  v_reason TEXT;
BEGIN
  -- Solo snapshot si script o title efectivamente cambian.
  IF OLD.script IS NOT DISTINCT FROM NEW.script
     AND OLD.title  IS NOT DISTINCT FROM NEW.title THEN
    RETURN NEW;
  END IF;

  -- Si no hay script previo (era NULL/vacío) y nada que perder, saltar.
  -- Igual snapshoteamos el title si cambia.
  IF (OLD.script IS NULL OR OLD.script = '')
     AND OLD.title IS NOT DISTINCT FROM NEW.title THEN
    RETURN NEW;
  END IF;

  -- changed_by_kind / change_reason pueden venir vía settings de sesión opcionales.
  -- Si no, queda 'unknown'.
  BEGIN
    v_kind   := COALESCE(current_setting('app.changed_by_kind', true), 'unknown');
  EXCEPTION WHEN OTHERS THEN
    v_kind := 'unknown';
  END;
  BEGIN
    v_reason := current_setting('app.change_reason', true);
  EXCEPTION WHEN OTHERS THEN
    v_reason := NULL;
  END;

  INSERT INTO content_plan_versions (
    content_plan_id, workspace_id,
    title, script,
    changed_by_kind, change_reason
  ) VALUES (
    OLD.id, OLD.workspace_id,
    OLD.title, OLD.script,
    v_kind, v_reason
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_plan_version_snapshot ON content_plan;
CREATE TRIGGER content_plan_version_snapshot
BEFORE UPDATE OF script, title ON content_plan
FOR EACH ROW
EXECUTE FUNCTION public.snapshot_content_plan_version();

-- ─── Bootstrap: meter una versión inicial para cada item existente que tenga script ─
-- Así, aunque el primer cambio sea inmediato, no perdemos el estado actual.
INSERT INTO content_plan_versions (content_plan_id, workspace_id, title, script, changed_by_kind, change_reason)
SELECT id, workspace_id, title, script, 'system', 'initial_snapshot'
FROM content_plan
WHERE script IS NOT NULL AND script <> ''
ON CONFLICT DO NOTHING;
