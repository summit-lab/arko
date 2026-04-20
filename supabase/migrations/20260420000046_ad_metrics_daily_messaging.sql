-- ═══════════════════════════════════════════════════════════════
-- Add `messaging_conversations` column to `ad_metrics_daily`.
-- Captures the `onsite_conversion.messaging_conversation_started_7d`
-- action from Meta Ads Insights — i.e. conversations started via
-- Click-to-Message ads within 7 days of click.
-- Used by the dashboard "Interacciones nuevas" metric.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE ad_metrics_daily
  ADD COLUMN IF NOT EXISTS messaging_conversations integer NOT NULL DEFAULT 0;
