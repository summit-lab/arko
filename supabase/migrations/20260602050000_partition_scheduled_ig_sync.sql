-- F2.5-5 / Phase 0 — Particionar el cron de sync de Instagram (matar timeout del edge)
--
-- PROBLEMA (verificado en Prod 2026-06-02, sync_jobs 7d):
--   El cron `sync-instagram-all` manda UNA invocación con steps='all', que corre
--   account + reels + ads en el mismo edge (~150s de límite). En cuentas grandes
--   reels (p95 120.9s) + ads (p95 104.9s) superan los 150s y el edge muere; el
--   sync_job queda 'running' hasta que el watchdog lo marca 'failed' a los 30min.
--   full_sync: 46% de fallo (Franco 25, PROVIDA 19 por timeout). ads: 35%.
--
-- FIX:
--   1) trigger_scheduled_sync: para los workspaces CANARY dispara invocaciones
--      SEPARADAS (account / reels / ads), cada una con su propio budget de ~150s
--      del edge — replicando lo que el botón ya hace via after(). El resto sigue
--      con 'all' (1 invocación) hasta validar y hacer ramp.
--      Requiere el step 'reels' en el edge sync-instagram (reels+benchmark, sin ads).
--   2) Ambos triggers de IG: URL del edge DINÁMICA via current_setting (igual que
--      yt/competitor/token), en vez de hardcodear el ref de Prod. Antes, en Dev
--      estos 2 triggers disparaban el edge de PROD.
--
-- CANARY: arranca solo con ac331157 (Emanuel/emanuelmdzz, 10 ad accounts).
-- RAMP: agregar workspace_ids al array canary_ws (los de timeout: Franco/PROVIDA).
-- REVERSIBLE: re-aplicar la definición previa (1 PERFORM steps='all', URL hardcodeada).

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
  -- CANARY F2.5-5 Phase 0: estos workspaces usan el sync PARTICIONADO.
  -- Para hacer ramp, agregar workspace_ids a este array.
  canary_ws uuid[] := ARRAY['ac331157-26ea-49c7-9c8b-26d2bad95934']::uuid[];
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
      -- PARTICIONADO: cada step su propia invocación edge (budget ~150s c/u)
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
      -- LEGACY: 1 invocación con todo (account + reels + ads + benchmark)
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

-- Stories trigger: SOLO arreglar la URL hardcodeada → dinámica (sin cambio de lógica).
CREATE OR REPLACE FUNCTION public.trigger_scheduled_stories_sync()
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
    RAISE LOG 'trigger_scheduled_stories_sync: SYNC_SECRET not found in vault, aborting';
    RETURN;
  END IF;

  FOR ws IN
    SELECT DISTINCT mc.workspace_id
    FROM meta_connections mc
    WHERE mc.status = 'active'
      AND mc.ig_business_account_id IS NOT NULL
  LOOP
    PERFORM net.http_post(
      url := edge_url,
      body := jsonb_build_object('workspace_id', ws.workspace_id, 'steps', 'stories'),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', sync_secret)
    );
    RAISE LOG 'trigger_scheduled_stories_sync: queued stories sync for workspace %', ws.workspace_id;
  END LOOP;
END;
$function$;
