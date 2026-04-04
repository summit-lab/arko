-- Migration 30: Carousel slides + Story media storage bucket
--
-- 1) carousel_slides — Almacena cada imagen/video hijo de un CAROUSEL_ALBUM
-- 2) story-media bucket — Bucket privado para thumbnails archivados de stories
-- 3) Índices compuestos para consultas eficientes

-- =============================================================
-- CAROUSEL_SLIDES — Una fila por slide hijo de un carrusel
-- =============================================================
CREATE TABLE carousel_slides (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- FK al "reel" padre (la tabla reels almacena posts+carruseles+reels)
  reel_id          uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,

  -- IG Graph API
  ig_media_id      text NOT NULL,
  slide_index      int2 NOT NULL DEFAULT 0,   -- 0-based

  media_type       text,   -- IMAGE | VIDEO
  media_url        text,   -- URL original de IG CDN
  thumbnail_url    text,   -- Para videos: URL del thumbnail

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, ig_media_id)
);

-- Índice para fetch eficiente de slides por carrusel
CREATE INDEX idx_carousel_slides_reel ON carousel_slides(reel_id, slide_index);
CREATE INDEX idx_carousel_slides_workspace ON carousel_slides(workspace_id);

ALTER TABLE carousel_slides ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER carousel_slides_updated_at
  BEFORE UPDATE ON carousel_slides
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- RLS: workspace members only
CREATE POLICY "workspace_members_own_carousel_slides"
  ON carousel_slides
  FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- =============================================================
-- STORY-MEDIA BUCKET — Thumbnails comprimidos de stories archivadas
-- =============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'story-media',
  'story-media',
  false,
  524288,  -- 512KB max per file (compressed thumbnails)
  ARRAY['image/webp', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: workspace members can read their own story media
CREATE POLICY "workspace_members_read_story_media"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'story-media'
    AND (storage.foldername(name))[1] IN (
      SELECT workspace_id::text FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Service role can insert/update (used by Edge Function)
CREATE POLICY "service_role_manage_story_media"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'story-media')
  WITH CHECK (bucket_id = 'story-media');
