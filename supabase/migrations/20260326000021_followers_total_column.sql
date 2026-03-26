-- Add followers_total column to store cumulative follower snapshot from Meta profile.
-- follower_count remains the daily net change (delta) from Meta insights period=day.
-- followers_total stores the real total from profileData.followers_count.

ALTER TABLE ig_account_insights
  ADD COLUMN IF NOT EXISTS followers_total bigint DEFAULT 0;

COMMENT ON COLUMN ig_account_insights.followers_total IS 'Cumulative total followers snapshot from Meta profile API (profileData.followers_count)';
COMMENT ON COLUMN ig_account_insights.follower_count IS 'Daily net change in followers from Meta insights period=day (delta, not total)';
