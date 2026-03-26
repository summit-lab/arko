-- Migration: Add followers_total to ig_account_insights
-- followers_total stores the actual total follower count from the IG profile (snapshot per day)
-- follower_count remains as the daily net change (new followers gained that day)

ALTER TABLE ig_account_insights
  ADD COLUMN IF NOT EXISTS followers_total bigint DEFAULT 0;
