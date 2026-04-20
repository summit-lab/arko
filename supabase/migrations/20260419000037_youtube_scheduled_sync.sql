-- ═══════════════════════════════════════════════════════════════
-- YouTube scheduled sync — daily cron at 03:30 UTC
-- ═══════════════════════════════════════════════════════════════
-- Mirrors the pattern in `20260324000014_pg_cron_scheduled_sync.sql` and
-- `20260404000031_stories_scheduled_sync.sql`:
--   * Trigger function iterates active YouTube connections (yt_channels) and
--     fires a fire-and-forget POST to the sync-youtube edge function via pg_net.
--   * SYNC_SECRET is read from Supabase Vault.
--   * project_ref is derived from `app.settings.supabase_project_ref`. If this
--     setting is not explicitly configured at the database level it RAISES — we
--     no longer fall back to a hardcoded DEV ref because that made PROD syncs
--     silently hit DEV's edge function in the past.
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_scheduled_yt_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ws RECORD;
  sync_secret text;
  edge_url text;
  project_ref text;
BEGIN
  project_ref := current_setting('app.settings.supabase_project_ref', true);
  IF project_ref IS NULL OR project_ref = '' THEN
    RAISE EXCEPTION 'trigger_scheduled_yt_sync: app.settings.supabase_project_ref is not set. Configure it per environment.';
  END IF;
  edge_url := 'https://' || project_ref || '.supabase.co/functions/v1/sync-youtube';

  SELECT decrypted_secret INTO sync_secret
  FROM vault.decrypted_secrets
  WHERE name = 'SYNC_SECRET'
  LIMIT 1;

  IF sync_secret IS NULL THEN
    RAISE LOG 'trigger_scheduled_yt_sync: SYNC_SECRET not found in vault, aborting';
    RETURN;
  END IF;

  -- Iterate all workspaces with an active YouTube channel.
  -- (The sync-youtube edge function is idempotent per-workspace; if the same
  -- workspace has multiple channel rows, this will invoke once per row.)
  FOR ws IN
    SELECT DISTINCT workspace_id
    FROM yt_channels
  LOOP
    PERFORM net.http_post(
      url := edge_url,
      body := jsonb_build_object('workspace_id', ws.workspace_id, 'steps', 'all'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-sync-secret', sync_secret
      )
    );

    RAISE LOG 'trigger_scheduled_yt_sync: queued yt sync for workspace %', ws.workspace_id;
  END LOOP;
END;
$$;

-- Schedule: once per day at 03:30 UTC.
-- YouTube view counts refresh slowly on Google's side (~24-48h), so there's no
-- benefit from higher cadence. Daily keeps us inside the 10k units/day quota
-- with comfortable headroom for user-initiated syncs.
-- Offset from the IG cron (06:00/12:00/18:00/00:00) to avoid piling edge-function
-- invocations at the same moment.
SELECT cron.unschedule('sync-youtube-all')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-youtube-all');

SELECT cron.schedule(
  'sync-youtube-all',
  '30 3 * * *',
  $$SELECT public.trigger_scheduled_yt_sync()$$
);
