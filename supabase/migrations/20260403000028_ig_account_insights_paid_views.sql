-- Add paid views column to ig_account_insights
-- Source: IG Graph API views breakdown by source_type (ads vs organic)

ALTER TABLE ig_account_insights
  ADD COLUMN IF NOT EXISTS views_paid bigint NOT NULL DEFAULT 0;
