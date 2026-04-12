-- Migration 31: Scheduled stories sync every 12 hours
-- Stories expire after 24h in IG API, so we need to capture them
-- at least once within that window. 12h gives us 2 chances.

-- Function that triggers stories sync for all active workspaces
CREATE OR REPLACE FUNCTION public.trigger_scheduled_stories_sync()
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
    project_ref := 'hrsvglgswatwklivkoyp'; -- DEV default
  END IF;
  edge_url := 'https://' || project_ref || '.supabase.co/functions/v1/sync-instagram';

  SELECT decrypted_secret INTO sync_secret
  FROM vault.decrypted_secrets
  WHERE name = 'SYNC_SECRET'
  LIMIT 1;

  IF sync_secret IS NULL THEN
    RAISE LOG 'trigger_scheduled_stories_sync: SYNC_SECRET not found in vault, aborting';
    RETURN;
  END IF;

  FOR ws IN
    SELECT DISTINCT mc.workspace_id
    FROM meta_connections mc
    WHERE mc.status = 'active'
      AND mc.ig_business_account_id IS NOT NULL
  LOOP
    PERFORM net.http_post(
      url := edge_url,
      body := jsonb_build_object('workspace_id', ws.workspace_id, 'steps', 'stories'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-sync-secret', sync_secret
      )
    );

    RAISE LOG 'trigger_scheduled_stories_sync: queued stories sync for workspace %', ws.workspace_id;
  END LOOP;
END;
$$;

-- Schedule: every 12 hours (03:00 and 15:00 UTC)
-- Offset from the main sync (00, 06, 12, 18) to avoid overlap
SELECT cron.schedule(
  'sync-instagram-stories',
  '0 3,15 * * *',
  $$SELECT public.trigger_scheduled_stories_sync()$$
);
