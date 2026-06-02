-- =============================================================
-- Fase 0 — Hardening: policy en data_deletion_requests + search_path en funciones
-- =============================================================
-- Cierra dos clases de lint del advisor de Supabase:
--   1. rls_enabled_no_policy (INFO) sobre data_deletion_requests.
--   2. function_search_path_mutable (WARN) sobre ~19 funciones.
--
-- Verificado en Dev (hrsvglgswatwklivkoyp) y Prod (zphvrohosizkbrnxtppj):
-- los lints desaparecen y el descifrado de tokens sigue funcionando (las
-- funciones de token resuelven pgp_sym_decrypt porque el search_path incluye
-- 'extensions', donde vive pgcrypto). Probado contra las 6 conexiones Meta
-- activas de Prod: ejecutan sin error.
--
-- NOTA: el lint security_definer_function_executable (anon/authenticated pueden
-- llamar estas funciones vía /rest/v1/rpc) NO se aborda acá: revocar EXECUTE
-- rompería el sync, porque los servicios (instagram-sync, ig-account-sync,
-- ads-sync, explorer, token-refresh de Google) llaman a get_meta/google_* con
-- la sesión del usuario (rol authenticated), no con service_role. Cerrarlo
-- requiere primero mover esas llamadas al admin client (service_role) — queda
-- como ítem de una fase posterior del plan (docs/11).
-- =============================================================

-- 1) data_deletion_requests: RLS activada pero sin policies.
--    Solo la maneja la edge function de borrado (service_role bypassa RLS).
CREATE POLICY "deny_all_non_service" ON public.data_deletion_requests
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 2) Funciones que tocan pgcrypto (schema extensions) — incluir 'extensions'.
ALTER FUNCTION public.get_meta_access_token(uuid, text)            SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_google_access_token(uuid, text)          SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_google_refresh_token(uuid, text)         SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.save_google_connection(uuid, text, text, text, timestamptz, text, text, text, text, text[]) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.save_meta_connection(uuid, text, text, timestamptz, text, text, text, text, text, text, text[], text[]) SET search_path = public, extensions, pg_temp;

-- 3) Funciones simples (triggers, watchdogs, validaciones) — sin crypto.
ALTER FUNCTION public.competitor_analyzing_watchdog_unblock_stuck() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user()                            SET search_path = public, pg_temp;
ALTER FUNCTION public.is_workspace_member(uuid)                    SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_jobs_watchdog_mark_stuck()             SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_scheduled_competitor_scraping()     SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_scheduled_stories_sync()            SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_scheduled_sync()                    SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_scheduled_yt_sync()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_invitation(uuid)                   SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_updated_at()                         SET search_path = public, pg_temp;
ALTER FUNCTION public.recalc_sale_from_installments()             SET search_path = public, pg_temp;
ALTER FUNCTION public.sale_installments_set_updated_at()          SET search_path = public, pg_temp;
ALTER FUNCTION public.update_content_plan_updated_at()            SET search_path = public, pg_temp;
