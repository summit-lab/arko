-- ═══════════════════════════════════════════════════════════════
-- Convert competitor_reels (competitor_id, short_code) from a partial
-- unique index to a true unique constraint.
--
-- Why: PostgREST's ON CONFLICT (`upsert` from supabase-js) requires the
-- unique constraint to match the conflict target *exactly*. The original
-- partial index `WHERE short_code IS NOT NULL` (migration ...19) is not
-- recognized by ON CONFLICT, so the upsert in the new scrape flow was
-- failing with "there is no unique or exclusion constraint matching the
-- ON CONFLICT specification" → 0 rows inserted → "Scrape terminado:
-- 0 reels" UI bug.
--
-- All existing rows in Dev (34) and Prod (234) have non-null short_code,
-- so promoting the partial index to a full constraint is safe.
-- ═══════════════════════════════════════════════════════════════

-- Defensive: scrub any NULL short_code rows (none expected).
DELETE FROM competitor_reels WHERE short_code IS NULL;

-- Make short_code NOT NULL so the constraint can target it cleanly.
ALTER TABLE competitor_reels
  ALTER COLUMN short_code SET NOT NULL;

-- Drop the legacy partial index and replace with a true UNIQUE constraint.
DROP INDEX IF EXISTS idx_competitor_reels_unique;

ALTER TABLE competitor_reels
  ADD CONSTRAINT competitor_reels_competitor_id_short_code_key
  UNIQUE (competitor_id, short_code);
