-- ─── competitor-assets storage bucket ────────────────────────────────────────
-- Stores scraped profile pictures and reel thumbnails for competitors
-- (keeps URLs stable when Instagram CDN links expire)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'competitor-assets',
  'competitor-assets',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Service role writes (scrapers run as service role)
CREATE POLICY "service_role_write_competitor_assets"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'competitor-assets')
WITH CHECK (bucket_id = 'competitor-assets');

-- Workspace members read objects in their own workspace folder
CREATE POLICY "workspace_members_read_competitor_assets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'competitor-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT wm.workspace_id::text
    FROM workspace_members wm
    WHERE wm.user_id = auth.uid()
  )
);

-- ─── competitor_follower_snapshots ────────────────────────────────────────────
-- One row per (competitor, day) → allows plotting competitor follower growth
-- over time as data accumulates from each re-scrape.

CREATE TABLE IF NOT EXISTS competitor_follower_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id uuid NOT NULL REFERENCES workspace_competitors(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  follower_count integer NOT NULL,
  scraped_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(competitor_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_comp_follower_snap_competitor
  ON competitor_follower_snapshots(competitor_id, snapshot_date DESC);

ALTER TABLE competitor_follower_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_read_follower_snapshots"
  ON competitor_follower_snapshots FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_write_follower_snapshots"
  ON competitor_follower_snapshots FOR ALL
  TO service_role USING (true) WITH CHECK (true);
