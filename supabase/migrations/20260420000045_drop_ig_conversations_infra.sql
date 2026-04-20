-- ═══════════════════════════════════════════════════════════════
-- Drop IG DM webhook infrastructure (migrations 41 + 43 rolled back).
-- Reason: pivot to an estimation-based approach (story replies +
-- account-level comments / 2) instead of webhook-delivered events.
-- No data loss: both tables were empty (webhook never received events
-- because the OAuth scope for instagram_manage_messages was not
-- available for new Meta apps — they only offer the Instagram Login
-- variant which would require a second OAuth flow).
-- ═══════════════════════════════════════════════════════════════

-- Unschedule cron jobs
SELECT cron.unschedule('aggregate-conversations-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aggregate-conversations-daily');

SELECT cron.unschedule('ig-conv-events-retention')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ig-conv-events-retention');

-- Drop helper function
DROP FUNCTION IF EXISTS public.trigger_aggregate_conversations();

-- Drop tables (order matters: ig_daily_conversations FKs through meta_connections only,
-- and ig_conversation_events has its own FKs. Both drop cleanly via DROP TABLE.)
DROP TABLE IF EXISTS ig_daily_conversations;
DROP TABLE IF EXISTS ig_conversation_events;

-- Drop webhook subscription flags on meta_connections
ALTER TABLE meta_connections DROP COLUMN IF EXISTS webhook_subscribed;
ALTER TABLE meta_connections DROP COLUMN IF EXISTS webhook_subscribed_at;
