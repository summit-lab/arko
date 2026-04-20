-- ═══════════════════════════════════════════════════════════════
-- Daily competitor profile scraping cron.
--
-- Iterates every workspace_competitor with a configured ig_url and fires one
-- async pg_net call per competitor to the scrape-competitors edge function.
-- The edge function is responsible for the Apify request and DB writes
-- (workspace_competitors.scraped_data + competitor_follower_snapshots).
--
-- Runs daily at 04:00 UTC — offset from IG (0/6/12/18) and YT (03:30) to
-- spread edge function invocations. Apify cost per run ≈ $0.0006/competitor
-- (profile actor only, no reels).
--
-- project_ref resolution mirrors trigger_scheduled_yt_sync: prefer
-- `app.settings.supabase_project_ref` so the same function body works in both
-- envs once the setting is configured; fall back to the DEV ref for safety.
-- The PROD deploy applies a follow-up migration with the PROD fallback ref.
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_scheduled_competitor_scraping()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  comp RECORD;
  sync_secret text;
  edge_url text;
  project_ref text;
BEGIN
  project_ref := current_setting('app.settings.supabase_project_ref', true);
  IF project_ref IS NULL OR project_ref = '' THEN
    project_ref := 'hrsvglgswatwklivkoyp';  -- DEV fallback
  END IF;
  edge_url := 'https://' || project_ref || '.supabase.co/functions/v1/scrape-competitors';

  SELECT decrypted_secret INTO sync_secret
  FROM vault.decrypted_secrets
  WHERE name = 'SYNC_SECRET'
  LIMIT 1;

  IF sync_secret IS NULL THEN
    RAISE LOG 'trigger_scheduled_competitor_scraping: SYNC_SECRET not found, aborting';
    RETURN;
  END IF;

  FOR comp IN
    SELECT id
    FROM workspace_competitors
    WHERE ig_url IS NOT NULL AND ig_url <> ''
  LOOP
    PERFORM net.http_post(
      url := edge_url,
      body := jsonb_build_object('competitor_id', comp.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-sync-secret', sync_secret
      )
    );

    RAISE LOG 'trigger_scheduled_competitor_scraping: queued scrape for competitor %', comp.id;
  END LOOP;
END;
$$;

-- Unschedule any prior version (idempotent for re-runs)
SELECT cron.unschedule('scrape-competitors-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scrape-competitors-daily');

SELECT cron.schedule(
  'scrape-competitors-daily',
  '0 4 * * *',
  $$SELECT public.trigger_scheduled_competitor_scraping()$$
);
