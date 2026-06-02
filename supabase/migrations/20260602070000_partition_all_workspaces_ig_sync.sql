-- F2.5-5 Phase 0 — GO 100%: partición para TODOS los workspaces (se elimina el canary).
--
-- El canary (ac331157 → +Franco/PROVIDA) era el rollout gradual, no el estado final.
-- Validado en vivo (reels-solo: Franco 141.7s, PROVIDA 113.8s, vos 23s; todos <150s,
-- sin rate-limit en el burst paralelo). Es un SaaS: un solo comportamiento para todos.
-- Se elimina el array hardcodeado canary_ws → el cron particiona a cualquier workspace.
--
-- REVERSIBLE: volver a steps='all' en un solo PERFORM (definición pre-Phase-0).

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
    -- Particionado para TODOS: cada step su propia invocación edge (budget ~150s),
    -- para que reels + ads no compitan por el límite y timeouteen juntos.
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
    RAISE LOG 'trigger_scheduled_sync: queued partitioned sync (ads=%) for workspace %', (ws.n_ads > 0), ws.workspace_id;
  END LOOP;
END;
$function$;
