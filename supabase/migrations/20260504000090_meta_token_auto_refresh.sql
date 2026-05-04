-- ═══════════════════════════════════════════════════════════════
-- Auto-refresh proactivo de tokens de Meta.
--
-- Problema: los tokens long-lived de Meta viven 60 días y NO tienen un
-- mecanismo de refresh con refresh_token como otros OAuth. La única forma
-- de extenderlos es llamar a /oauth/access_token?grant_type=fb_exchange_token
-- ANTES de que el token venza por tiempo. Si dejamos pasar la fecha de
-- expiración o el usuario revoca/cambia password → el token muere y no hay
-- forma programática de recuperarlo (requiere re-OAuth manual).
--
-- Solución: cron diario a las 02:00 UTC que llama a la edge function
-- `refresh-meta-tokens`. Esa función itera todas las meta_connections con
-- status='active' que están a menos de 14 días de vencer y las rota.
-- Resultado: mientras el usuario tenga la app conectada, el token nunca
-- vence por antigüedad — se va rotando solo en lazo continuo.
--
-- Si Meta rechaza la rotación (token ya revocado, app pausada, etc.) la
-- edge function marca la connection como 'expired' para que el banner de UI
-- avise al usuario que tiene que reconectar.
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ─── RPC para guardar el token rotado ────────────────────────────────────────
-- Más focalizada que save_meta_connection (que requiere TODOS los campos).
-- Solo actualiza el access_token y la nueva fecha de expiración. Resto de
-- campos (page_id, ig_business_account_id, permissions_granted) se quedan
-- como están.

CREATE OR REPLACE FUNCTION public.refresh_meta_token(
  p_workspace_id          uuid,
  p_new_access_token      text,
  p_encryption_key        text,
  p_new_token_expires_at  timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  UPDATE meta_connections
  SET
    access_token_encrypted = pgp_sym_encrypt(p_new_access_token, p_encryption_key),
    token_expires_at       = p_new_token_expires_at,
    last_validated_at      = now(),
    last_error             = NULL,
    status                 = 'active',
    updated_at             = now()
  WHERE workspace_id = p_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_meta_token(uuid, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_meta_token(uuid, text, text, timestamptz) TO service_role;

-- ─── Trigger function: dispara la edge function ──────────────────────────────
-- La edge function se encarga de la lógica completa (iterar conexiones,
-- llamar a Meta, encriptar y guardar). Acá solo le hacemos un POST inicial.

CREATE OR REPLACE FUNCTION public.trigger_meta_token_refresh()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  sync_secret text;
  edge_url    text;
  project_ref text;
BEGIN
  project_ref := current_setting('app.settings.supabase_project_ref', true);
  IF project_ref IS NULL OR project_ref = '' THEN
    project_ref := 'hrsvglgswatwklivkoyp';  -- DEV fallback (override en PROD)
  END IF;
  edge_url := 'https://' || project_ref || '.supabase.co/functions/v1/refresh-meta-tokens';

  SELECT decrypted_secret INTO sync_secret
  FROM vault.decrypted_secrets
  WHERE name = 'SYNC_SECRET'
  LIMIT 1;

  IF sync_secret IS NULL THEN
    RAISE LOG 'trigger_meta_token_refresh: SYNC_SECRET not found, aborting';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := edge_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', sync_secret
    )
  );

  RAISE LOG 'trigger_meta_token_refresh: queued refresh-meta-tokens edge function';
END;
$$;

-- ─── Cron diario a las 02:00 UTC ─────────────────────────────────────────────
-- Offset distinto a los otros crons (00:00 IG, 03:00/03:30 stories/YT,
-- 04:00 competitors) para no pisar slots y mantener la cadena ordenada.

SELECT cron.unschedule('refresh-meta-tokens-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-meta-tokens-daily');

SELECT cron.schedule(
  'refresh-meta-tokens-daily',
  '0 2 * * *',
  $$SELECT public.trigger_meta_token_refresh()$$
);
