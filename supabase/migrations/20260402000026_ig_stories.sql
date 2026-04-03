-- Migration 26: Instagram Stories — archivado de historias dentro de las 24hs
-- Las historias de IG desaparecen de la API después de 24h.
-- Esta tabla guarda cada "secuencia de historia" (set de slides publicados
-- en el mismo bloque), con sus slides individuales y métricas por slide.

-- =============================================================
-- IG_STORY_SEQUENCES — Una fila por grupo/secuencia de historias
-- =============================================================
CREATE TABLE ig_story_sequences (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Identificador del primer slide (usado como anchor)
  ig_story_id      text NOT NULL,

  -- Fecha de publicación (UTC)
  published_at     timestamptz NOT NULL,

  -- Fecha en que expira / expiró en IG
  expires_at       timestamptz,

  -- Totales agregados de la secuencia
  total_impressions   int4 NOT NULL DEFAULT 0,
  total_reach         int4 NOT NULL DEFAULT 0,
  total_replies       int4 NOT NULL DEFAULT 0,
  total_exits         int4 NOT NULL DEFAULT 0,

  -- Si ya no está disponible en la API
  archived          boolean NOT NULL DEFAULT false,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, ig_story_id)
);

CREATE INDEX idx_story_seq_workspace ON ig_story_sequences(workspace_id);
CREATE INDEX idx_story_seq_published ON ig_story_sequences(workspace_id, published_at DESC);

ALTER TABLE ig_story_sequences ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER ig_story_sequences_updated_at
  BEFORE UPDATE ON ig_story_sequences
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- RLS: workspace members only
CREATE POLICY "workspace_members_own_stories"
  ON ig_story_sequences
  FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- =============================================================
-- IG_STORY_SLIDES — Un slide por fila dentro de una secuencia
-- =============================================================
CREATE TABLE ig_story_slides (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id      uuid NOT NULL REFERENCES ig_story_sequences(id) ON DELETE CASCADE,
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- IG Graph API
  ig_media_id      text NOT NULL,
  slide_index      int2 NOT NULL DEFAULT 0,   -- 0-based order

  media_type       text,   -- IMAGE | VIDEO
  media_url        text,
  thumbnail_url    text,
  caption          text,

  -- Métricas por slide (drop-off tracking)
  impressions      int4 NOT NULL DEFAULT 0,
  reach            int4 NOT NULL DEFAULT 0,
  replies          int4 NOT NULL DEFAULT 0,
  exits            int4 NOT NULL DEFAULT 0,
  taps_forward     int4 NOT NULL DEFAULT 0,
  taps_back        int4 NOT NULL DEFAULT 0,
  swipe_aways      int4 NOT NULL DEFAULT 0,

  -- Storage path para imagen archivada
  media_storage_path   text,

  -- Ya no disponible en IG
  archived         boolean NOT NULL DEFAULT false,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, ig_media_id)
);

CREATE INDEX idx_story_slides_sequence ON ig_story_slides(sequence_id, slide_index);
CREATE INDEX idx_story_slides_workspace ON ig_story_slides(workspace_id);

ALTER TABLE ig_story_slides ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER ig_story_slides_updated_at
  BEFORE UPDATE ON ig_story_slides
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- RLS: workspace members only
CREATE POLICY "workspace_members_own_story_slides"
  ON ig_story_slides
  FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));
