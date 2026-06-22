-- ═══════════════════════════════════════════════════════════════
-- sync_jobs watchdog — marca como 'failed' jobs stuck en 'running'
-- por más de 30 minutos.
--
-- Contexto: sync-instagram/sync-youtube a veces no llaman al final del flow
-- (crash, timeout, etc.) y dejan la row en status='running' indefinidamente.
-- El audit encontró 4 jobs stuck, el más viejo 2.75 días.
--
-- El watchdog corre cada 10 minutos, detecta rows stale y las marca failed
-- con un mensaje que indica timeout. Esto desbloquea el polling del cliente
-- (useSyncJobProgress) y deja history honesto en sync_jobs.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_jobs_watchdog_mark_stuck()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE sync_jobs
  SET
    status = 'failed',
    completed_at = now(),
    error_message = COALESCE(error_message, '') ||
      CASE WHEN error_message IS NULL OR error_message = ''
        THEN 'Watchdog: job stuck in ''running'' for >30 min (edge function likely timed out or crashed)'
        ELSE ''
      END
  WHERE status = 'running'
    AND started_at < now() - interval '30 minutes';

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    RAISE LOG 'sync_jobs_watchdog: marked % stuck jobs as failed', updated_count;
  END IF;

  RETURN updated_count;
END;
$$;

-- Unschedule any prior version before re-registering (idempotent for re-runs)
SELECT cron.unschedule('sync-jobs-watchdog')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-jobs-watchdog');

-- Every 10 minutes
SELECT cron.schedule(
  'sync-jobs-watchdog',
  '*/10 * * * *',
  $$SELECT public.sync_jobs_watchdog_mark_stuck()$$
);

-- One-shot cleanup of currently stuck jobs (run the watchdog once immediately)
SELECT public.sync_jobs_watchdog_mark_stuck();
