-- ============================================================================
-- launch_hardening — noche pre-launch (100 demos entran mañana).
--
-- 1) REVOKE: las funciones de cron eran ejecutables por anon/authenticated vía
--    /rest/v1/rpc/ — cualquiera con la anon key (pública, va en el bundle del
--    browser) podía disparar en loop el sync de TODOS los workspaces: el
--    perfil exacto del incidente de saturación de compute. pg_cron corre como
--    postgres → no lo afecta. NO se tocan las RPCs que la app llama como
--    authenticated (save_meta_connection, validate_invitation,
--    apply_sale_payment, moka_admin_adjust, moka_precheck, etc.).
-- 2) Cron de YouTube apagado: la feature se retiró del producto para todos
--    los tiers (2026-07-02) — seguir sincronizando los 2 canales conectados
--    era gasto de API sin consumidor.
--
-- Rollback:
--   GRANT EXECUTE ON FUNCTION ... TO anon, authenticated;  (las 7 de abajo)
--   SELECT cron.schedule('sync-youtube-all','30 3 * * *','SELECT public.trigger_scheduled_yt_sync()');
-- ============================================================================

-- IMPORTANTE: incluir PUBLIC — Postgres da EXECUTE a PUBLIC por default y
-- anon/authenticated lo HEREDAN de ahí (revocar solo de los roles no corta
-- el acceso; verificado con has_function_privilege). service_role y postgres
-- (pg_cron) conservan EXECUTE.
REVOKE EXECUTE ON FUNCTION
  public.trigger_scheduled_sync(),
  public.trigger_scheduled_competitor_scraping(),
  public.trigger_scheduled_stories_sync(),
  public.trigger_scheduled_yt_sync(),
  public.sync_jobs_watchdog_mark_stuck(),
  public.competitor_analyzing_watchdog_unblock_stuck(),
  public.trigger_meta_token_refresh()
FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('sync-youtube-all');
