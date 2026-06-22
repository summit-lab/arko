-- ═══════════════════════════════════════════════════════════════
-- Stories sync — bump de 2x/dia a 3x/dia.
--
-- Antes: 03:00 y 15:00 UTC (cada 12h) — ventana max de 12h entre captures.
-- Ahora: 03:00, 11:00, 19:00 UTC (cada 8h) — ventana max de 8h.
--
-- Motivacion: las historias IG expiran en 24h. Con 2 capturas/dia siempre
-- alcanza, pero 3 da mas margen de seguridad frente a hiccups (edge function
-- timeout, token refresh pendiente, etc). Costo: 1 invocacion extra por
-- workspace por dia — negligible.
-- ═══════════════════════════════════════════════════════════════

-- Unschedule anterior (idempotente)
SELECT cron.unschedule('sync-instagram-stories')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-instagram-stories');

-- Re-schedule 3x/dia
SELECT cron.schedule(
  'sync-instagram-stories',
  '0 3,11,19 * * *',
  $$SELECT public.trigger_scheduled_stories_sync()$$
);
