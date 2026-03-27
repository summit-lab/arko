-- ============================================================
-- Migration: pg_cron scheduled sync
-- Enables automatic Instagram sync every 6 hours using
-- pg_cron + pg_net (calls Edge Function directly from Postgres)
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function that iterates active workspaces and triggers full sync
CREATE OR REPLACE FUNCTION public.trigger_scheduled_sync()
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
  -- Build Edge Function URL from project ref
  -- In production, change this to the production project ref
  project_ref := current_setting('app.settings.supabase_project_ref', true);
  IF project_ref IS NULL OR project_ref = '' THEN
    -- Fallback: try to get from the request URL pattern
    project_ref := 'hrsvglgswatwklivkoyp'; -- DEV default
  END IF;
  edge_url := 'https://' || project_ref || '.supabase.co/functions/v1/sync-instagram';

  -- Get SYNC_SECRET from Supabase Vault
  SELECT decrypted_secret INTO sync_secret
  FROM vault.decrypted_secrets
  WHERE name = 'SYNC_SECRET'
  LIMIT 1;

  IF sync_secret IS NULL THEN
    RAISE LOG 'trigger_scheduled_sync: SYNC_SECRET not found in vault, aborting';
    RETURN;
  END IF;

  -- Iterate all workspaces with active Meta connection
  FOR ws IN
    SELECT DISTINCT mc.workspace_id
    FROM meta_connections mc
    WHERE mc.status = 'active'
      AND mc.ig_business_account_id IS NOT NULL
  LOOP
    PERFORM net.http_post(
      url := edge_url,
      body := jsonb_build_object('workspace_id', ws.workspace_id, 'steps', 'all'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-sync-secret', sync_secret
      )
    );

    RAISE LOG 'trigger_scheduled_sync: queued sync for workspace %', ws.workspace_id;
  END LOOP;
END;
$$;

-- Schedule: every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
SELECT cron.schedule(
  'sync-instagram-all',
  '0 */6 * * *',
  $$SELECT public.trigger_scheduled_sync()$$
);
