-- F2.5-5 Phase 0 RAMP — sumar Franco (9a36a8d7) y PROVIDA (be955785) al canary particionado.
--
-- Validado en vivo antes del ramp (reels-solo, 2026-06-02):
--   Franco (1297 reels): full_sync reels-solo = 141.7s ✓ (<150s, pero al filo)
--   PROVIDA (2968 reels): full_sync reels-solo = 113.8s ✓ (cómodo)
-- Antes, con steps='all' (reels+ads en 1 invocación), ambas timeouteaban siempre
-- (Franco 89% de fallo, PROVIDA 68%). Con la partición cada step tiene su budget.
--
-- NOTA: Franco a 141.7s deja poco margen → el fetch incremental (próxima fase)
-- es necesario para darle aire real, no opcional.
--
-- REVERSIBLE: volver canary_ws a solo ['ac331157-...'] (migración anterior).

CREATE OR REPLACE FUNCTION public.trigger_scheduled_sync()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  ws RECORD;
  sync_secret text;
  edge_url text;
  project_ref text;
  -- CANARY F2.5-5 Phase 0 (ramp): ac331157 (validado) + Franco + PROVIDA (timeout).
  canary_ws uuid[] := ARRAY[
    'ac331157-26ea-49c7-9c8b-26d2bad95934',
    '9a36a8d7-c626-4160-947e-1d557bcfb462',
    'be955785-3b33-40e1-8cea-dbcea5cbd505'
  ]::uuid[];
BEGIN
  project_ref := current_setting('app.settings.supabase_project_ref', true);
  IF project_ref IS NULL OR project_ref = '' THEN
    project_ref := 'zphvrohosizkbrnxtppj';
  END IF;
  edge_url := 'https://' || project_ref || '.supabase.co/functions/v1/sync-instagram';

  SELECT decrypted_secret INTO sync_secret
  FROM vault.decrypted_secrets
  WHERE name = 'SYNC_SECRET'
  LIMIT 1;

  IF sync_secret IS NULL THEN
    RAISE LOG 'trigger_scheduled_sync: SYNC_SECRET not found in vault, aborting';
    RETURN;
  END IF;

  FOR ws IN
    SELECT mc.workspace_id,
           COALESCE(array_length(mc.ad_account_ids, 1), 0) AS n_ads
    FROM meta_connections mc
    WHERE mc.status = 'active'
      AND mc.ig_business_account_id IS NOT NULL
  LOOP
    IF ws.workspace_id = ANY(canary_ws) THEN
      PERFORM net.http_post(
        url := edge_url,
        body := jsonb_build_object('workspace_id', ws.workspace_id, 'steps', 'account'),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', sync_secret)
      );
      PERFORM net.http_post(
        url := edge_url,
        body := jsonb_build_object('workspace_id', ws.workspace_id, 'steps', 'reels'),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', sync_secret)
      );
      IF ws.n_ads > 0 THEN
        PERFORM net.http_post(
          url := edge_url,
          body := jsonb_build_object('workspace_id', ws.workspace_id, 'steps', 'ads'),
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', sync_secret)
        );
      END IF;
      RAISE LOG 'trigger_scheduled_sync: queued PARTITIONED sync (ads=%) for workspace %', (ws.n_ads > 0), ws.workspace_id;
    ELSE
      PERFORM net.http_post(
        url := edge_url,
        body := jsonb_build_object('workspace_id', ws.workspace_id, 'steps', 'all'),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', sync_secret)
      );
      RAISE LOG 'trigger_scheduled_sync: queued sync for workspace %', ws.workspace_id;
    END IF;
  END LOOP;
END;
$function$;
