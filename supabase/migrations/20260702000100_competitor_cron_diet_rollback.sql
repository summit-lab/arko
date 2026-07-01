-- Rollback de competitor_cron_diet: cadencia diaria + función sin filtros
-- (cuerpo exacto pre-migración, verificado en Prod via pg_get_functiondef).

SELECT cron.unschedule('scrape-competitors-daily');
SELECT cron.schedule(
  'scrape-competitors-daily',
  '0 4 * * *',
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
$function$;
