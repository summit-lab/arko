-- Migration 110: Content Plan v2 — nuevos campos y simplificación de statuses
-- Agrega reference_url, raw_video_url, edited_video_url
-- Migra los 8 statuses viejos a los 6 nuevos
-- Agrega youtube_video como content_type válido

-- 1. Nuevas columnas opcionales
ALTER TABLE content_plan
  ADD COLUMN IF NOT EXISTS reference_url   TEXT,
  ADD COLUMN IF NOT EXISTS raw_video_url   TEXT,
  ADD COLUMN IF NOT EXISTS edited_video_url TEXT;

-- 2. Migrar status values viejos → nuevos
UPDATE content_plan SET status = 'ready_to_record'  WHERE status IN ('script', 'needs_recording');
UPDATE content_plan SET status = 'raw_footage'       WHERE status = 'recorded';
UPDATE content_plan SET status = 'editing'           WHERE status = 'needs_editing';
UPDATE content_plan SET status = 'ready_to_publish'  WHERE status = 'scheduled';
-- 'idea', 'editing', 'published' no cambian

-- 3. Índice para raw_video_url (útil para filtros de "con material")
CREATE INDEX IF NOT EXISTS idx_content_plan_workspace_status_v2
  ON content_plan(workspace_id, status, planned_date);
