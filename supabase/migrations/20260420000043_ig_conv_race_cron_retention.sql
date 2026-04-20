-- ═══════════════════════════════════════════════════════════════
-- Migration 000043: IG conversations — race guard + cron + retention
--
-- Three concerns, one migration (all operational hardening for Sprint B):
--
--   1. C2 race fix: enforce at most one is_first_inbound=true row per
--      (meta_connection_id, thread_id). Two webhook deliveries racing on a
--      brand-new thread would otherwise both compute is_first_inbound=true
--      and inflate `new_conversations`.
--
--   2. C3 pg_cron: schedule the aggregate-conversations edge function at
--      04:00 UTC (01:00 AR) so `ig_daily_conversations` is filled each
--      morning without manual invocation. Mirrors the pattern in
--      `20260324000014_pg_cron_scheduled_sync.sql`:
--        * project_ref from current_setting('app.settings.supabase_project_ref')
--        * SYNC_SECRET from Supabase Vault
--        * fire-and-forget POST via pg_net
--      This keeps Dev and Prod using the same SQL — no hardcoded URLs.
--
--   3. H1 retention: delete raw ig_conversation_events older than 90 days
--      daily. The aggregated `ig_daily_conversations` table is the source
--      of truth for the UI, so 90 days of raw event history is enough for
--      debugging and replay without unbounded growth.
--
-- Project refs (manual setup required, once per environment):
--   Dev:  ALTER DATABASE postgres SET app.settings.supabase_project_ref = 'hrsvglgswatwklivkoyp';
--   Prod: ALTER DATABASE postgres SET app.settings.supabase_project_ref = '<prod-ref>';
-- SYNC_SECRET must exist in `vault.decrypted_secrets` (already configured for
-- the sync-instagram cron since migration 000014).
-- ═══════════════════════════════════════════════════════════════

-- ── 1) C2: partial unique index for first-inbound race guard ───
-- At most one row with is_first_inbound=true per (meta_connection_id, thread_id).
-- Concurrent webhook inserts that both compute is_first_inbound=true will
-- collide on this index; the loser retries with is_first_inbound=false in
-- application code (src/app/api/webhooks/ig/route.ts).
CREATE UNIQUE INDEX IF NOT EXISTS ig_conv_events_one_first_inbound
  ON ig_conversation_events (meta_connection_id, thread_id)
  WHERE is_first_inbound = true;

-- ── 2) C3: pg_cron schedule for aggregate-conversations ─────────
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_aggregate_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sync_secret text;
  edge_url text;
  project_ref text;
BEGIN
  project_ref := current_setting('app.settings.supabase_project_ref', true);
  IF project_ref IS NULL OR project_ref = '' THEN
    -- Fallback for Dev; change to prod ref in prod migration application
    project_ref := 'hrsvglgswatwklivkoyp';
  END IF;
  edge_url := 'https://' || project_ref || '.supabase.co/functions/v1/aggregate-conversations';

  SELECT decrypted_secret INTO sync_secret
  FROM vault.decrypted_secrets
  WHERE name = 'SYNC_SECRET'
  LIMIT 1;

  IF sync_secret IS NULL THEN
    RAISE LOG 'trigger_aggregate_conversations: SYNC_SECRET not found in vault, aborting';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := edge_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', sync_secret
    )
  );

  RAISE LOG 'trigger_aggregate_conversations: queued aggregate call to %', edge_url;
END;
$$;

-- Unschedule any prior version, then schedule at 04:00 UTC (= 01:00 AR).
SELECT cron.unschedule('aggregate-conversations-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aggregate-conversations-daily');

SELECT cron.schedule(
  'aggregate-conversations-daily',
  '0 4 * * *',
  $$SELECT public.trigger_aggregate_conversations()$$
);

-- ── 3) H1: retention — drop raw events older than 90 days ──────
-- Runs daily at 03:00 UTC, one hour before the aggregator, so we never
-- delete rows that today's aggregation run would have needed.
SELECT cron.unschedule('ig-conv-events-retention')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ig-conv-events-retention');

SELECT cron.schedule(
  'ig-conv-events-retention',
  '0 3 * * *',
  $$DELETE FROM public.ig_conversation_events
    WHERE received_at < now() - interval '90 days'$$
);
