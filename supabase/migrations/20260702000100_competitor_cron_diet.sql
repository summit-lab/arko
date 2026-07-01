-- ============================================================================
-- competitor_cron_diet — El cron de competidores era el 55-80% de la factura
-- de Apify (~$105-160/mes): corría TODOS los días para TODOS los competidores
-- (85), sin filtro de tier ni de actividad, y sin loguear un centavo.
--
-- Cambios:
--   1. Cadencia: diario → Lun/Mié/Vié 04:00 UTC (los competidores publican
--      ~5.7 reels nuevos por 14 días; refrescar métricas 3x/semana alcanza).
--   2. trigger_scheduled_competitor_scraping(): solo competidores de
--      workspaces standard/pro CON actividad LLM en los últimos 14 días
--      (proxy de uso real: chat/análisis/auto-títulos — hoy los 85 son de
--      workspaces pro activos, así que no cambia nada YA, pero evita pagar
--      el refresh perpetuo de demos y abandonados cuando entren cientos).
--      Caveat conocido: un workspace que solo MIRA (cero LLM en 14d) deja de
--      refrescarse hasta que use el chat o entren reels nuevos; el scrape
--      manual sigue disponible.
--
-- (El recorte por-run — límite 25 reels + ventana 14 días + skipPinnedPosts +
--  logging — vive en supabase/functions/scrape-competitors/index.ts, se
--  deploya junto con esta migración.)
-- ============================================================================

-- 1) Cadencia L/Mi/V
SELECT cron.unschedule('scrape-competitors-daily');
SELECT cron.schedule(
  'scrape-competitors-daily',
  '0 4 * * 1,3,5',
  'SELECT public.trigger_scheduled_competitor_scraping()'
);

-- 2) Filtro de tier + actividad (cuerpo base: el vigente en Prod, verificado
--    via pg_get_functiondef antes de escribir esta migración)
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
      -- Solo tiers pagos: demo no ve competidores, no pagamos su refresh.
      AND w.plan IN ('standard','pro')
      -- Solo workspaces con actividad real reciente (proxy: uso de LLM 14d).
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
