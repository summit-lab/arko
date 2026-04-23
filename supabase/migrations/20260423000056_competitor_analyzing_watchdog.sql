-- ═══════════════════════════════════════════════════════════════
-- Competitor analyzing watchdog — desbloquea workspace_competitors
-- stuck en analysis_status='analyzing' por más de 10 minutos.
--
-- Contexto: el endpoint POST /api/v1/competitors/[id]/scrape marca
-- analysis_status='analyzing' al arrancar y lo resetea al final.
-- Si la función de Vercel se cae (timeout duro, crash silencioso)
-- el status queda pegado para siempre y la UI muestra spinner eterno.
-- El fix en el endpoint (PR #59) cubre los caminos normales, pero
-- este watchdog es red de seguridad contra regresiones futuras.
--
-- Se agrega la columna analysis_started_at para distinguir scrapes
-- recién iniciados (legítimos, en curso) de los realmente stuck.
-- last_scraped_at no sirve porque refleja el último scrape exitoso,
-- no el intento actual.
--
-- El watchdog corre cada 10 minutos. maxDuration de Vercel es 120s,
-- así que cualquier cosa con analysis_started_at > 10 min está muerta.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.workspace_competitors
  ADD COLUMN IF NOT EXISTS analysis_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.competitor_analyzing_watchdog_unblock_stuck()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE workspace_competitors
  SET
    analysis_status = 'idle',
    analysis_started_at = NULL
  WHERE analysis_status = 'analyzing'
    AND (
      analysis_started_at IS NULL
      OR analysis_started_at < now() - interval '10 minutes'
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    RAISE LOG 'competitor_analyzing_watchdog: liberados % competitors stuck', updated_count;
  END IF;

  RETURN updated_count;
END;
$$;

-- Unschedule any prior version before re-registering (idempotent)
SELECT cron.unschedule('competitor-analyzing-watchdog')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'competitor-analyzing-watchdog');

-- Every 10 minutes
SELECT cron.schedule(
  'competitor-analyzing-watchdog',
  '*/10 * * * *',
  $$SELECT public.competitor_analyzing_watchdog_unblock_stuck()$$
);

-- One-shot cleanup al aplicar
SELECT public.competitor_analyzing_watchdog_unblock_stuck();
