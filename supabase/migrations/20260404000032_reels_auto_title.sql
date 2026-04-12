-- Add auto_title column to reels table
-- Stores AI-generated title (≤60 chars) derived from reel transcript

ALTER TABLE reels ADD COLUMN IF NOT EXISTS auto_title TEXT;

COMMENT ON COLUMN reels.auto_title IS 'AI-generated title (max 60 chars) derived from reel transcript';
