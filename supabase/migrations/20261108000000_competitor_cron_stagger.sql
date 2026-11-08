-- ============================================================================
-- competitor_cron_stagger — Escalona el cron de competidores en 12 tandas.
--
-- Por qué: el cron disparaba a TODOS los competidores elegibles en el mismo
-- segundo (pico medido: 64 runs simultáneos en Apify, 2026-10-07 04:00 UTC).
-- El plan Starter de Apify permite 32. Requisito para bajar de Scale a Starter.
--
-- Cómo: el job corre cada 5 minutos de 04:00 a 04:55 UTC (L/Mi/V). Cada corrida
-- procesa solo la tanda del minuto actual (hash del competitor_id % 12), así
-- cada competidor se scrapea una sola vez por día de cron.
-- Peor caso medido con los 154 competidores con URL: 20 por tanda.
--
-- Nota: el cast a bigint evita "integer out of range" de abs(int) con el valor
-- mínimo de hashtext. Una llamada manual a la función procesa solo una tanda.
-- Rollback: 20261108000000_competitor_cron_stagger_rollback.sql
-- ============================================================================

-- 1) Cadencia: cada 5 min dentro de la hora 04 UTC, L/Mi/V
SELECT cron.unschedule('scrape-competitors-daily');
SELECT cron.schedule(
  'scrape-competitors-daily',
  '*/5 4 * * 1,3,5',
  'SELECT public.trigger_scheduled_competitor_scraping()'
);

-- 2) Filtro por tanda (cuerpo base: el vigente en Prod, verificado via
--    pg_get_functiondef el 2026-11-08)
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
  current_batch int := floor(date_part('minute', now()) / 5)::int;
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
      -- Solo la tanda de este minuto (12 tandas, una cada 5 min).
      AND abs(hashtext(wc.id::text)::bigint) % 12 = current_batch
  LOOP
    PERFORM net.http_post(
      url := edge_url,
      body := jsonb_build_object('competitor_id', comp.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-sync-secret', sync_secret
      )
    );

    RAISE LOG 'trigger_scheduled_competitor_scraping: queued scrape for competitor % (batch %)', comp.id, current_batch;
  END LOOP;
END;
$function$;
