-- Add scraped IG data to workspace_references
-- scraped_data: profile info (followers, bio, profile pic, etc.)
-- scraped_reels: array of recent reels (thumbnails, views, captions)

ALTER TABLE workspace_references
  ADD COLUMN IF NOT EXISTS scraped_data    jsonb,
  ADD COLUMN IF NOT EXISTS scraped_reels   jsonb,
  ADD COLUMN IF NOT EXISTS last_scraped_at timestamptz;
