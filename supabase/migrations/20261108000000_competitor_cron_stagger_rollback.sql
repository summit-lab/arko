-- Rollback de competitor_cron_stagger: una sola corrida a las 04:00 UTC L/Mi/V
-- y función sin tandas (cuerpo exacto pre-migración, verificado en Prod via
-- pg_get_functiondef el 2026-11-08).

SELECT cron.unschedule('scrape-competitors-daily');
SELECT cron.schedule(
  'scrape-competitors-daily',
  '0 4 * * 1,3,5',
  'SELECT public.trigger_scheduled_competitor_scraping()'
);

CREATE OR REPLACE FUNCTION public.trigger_scheduled_competitor_scraping()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  comp RECORD;
  sync_secret text;
  edge_url text;
  project_ref text;
BEGIN
  project_ref := current_setting('app.settings.supabase_project_ref', true);
  IF project_ref IS NULL OR project_ref = '' THEN
    project_ref := 'zphvrohosizkbrnxtppj';
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
    SELECT wc.id
    FROM workspace_competitors wc
    JOIN workspaces w ON w.id = wc.workspace_id
    WHERE wc.ig_url IS NOT NULL AND wc.ig_url <> ''
      AND w.plan IN ('standard','pro')
      AND EXISTS (
        SELECT 1 FROM llm_usage lu
        WHERE lu.workspace_id = wc.workspace_id
          AND lu.created_at > now() - interval '14 days'
      )
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
$function$;
