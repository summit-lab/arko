-- ============================================================================
-- moka_coins_v2_service_reclass — El scrape de datos pasa a ser SERVICIO.
--
-- Incidente 2026-07-01: un click de "analizar competidor" debitó 335 coins
-- (86 reels × $0.0039) — el scrape que el cron ya hace GRATIS a las 4AM.
-- Decisión: la carga/refresh de datos (Apify) es parte del servicio y NO
-- debita la billetera; solo las acciones de IA on-demand debitan.
--
-- Cambios:
--   1. credit_category: rama 'service' nueva (no debita). Los strings legacy
--      competitor-scraping / reference-scraping se mueven ahí para que el
--      overlap de deploy (código viejo aún emitiéndolos) tampoco debite.
--   2. Trigger: la condición pasa de "= 'system'" a "NOT IN ('ai','scraping')"
--      — cualquier categoría no-debitable (system, service, futuras) sale
--      temprano. Fail-safe se mantiene: desconocido => system => no debita.
--   3. reels.duration_enrich_attempts: negative-cache del enrichment de
--      duraciones (71-76% de los intentos fallaban y se reintentaban para
--      siempre = ~6.855 runs pagos de Apify tirados). Máx 3 intentos.
-- ============================================================================

-- 1) Clasificador v2 --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_category(p_feature text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN p_feature IN (
      'ai-agents','ai-agents-light','onboarding-adn','competitor-analysis',
      'reference-analysis','arkoai-video-analysis','reel-auto-title','hooks-classify'
    ) THEN 'ai'
    WHEN p_feature IN (
      'reel-analysis-rescrape'
    ) THEN 'scraping'
    WHEN p_feature IN (
      -- Carga/refresh de datos = servicio incluido en el plan (NO debita).
      'competitor-base-load','competitor-scheduled-refresh','reference-base-load',
      -- Legacy (código pre-v2 aún los emite durante el overlap de deploy):
      'competitor-scraping','reference-scraping'
    ) THEN 'service'
    ELSE 'system'   -- ig-sync-enrichment, ig-reel-enrichment, + desconocidos
  END;
$$;

-- 2) Trigger: no-debitable sale temprano (system + service) -----------------
CREATE OR REPLACE FUNCTION public.credit_debit_from_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_coins integer;
  v_today date := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  v_month date := date_trunc('month', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
BEGIN
  -- Solo 'ai' y 'scraping' (on-demand) debitan; system/service/futuras no.
  IF public.credit_category(NEW.feature) NOT IN ('ai','scraping') THEN
    RETURN NEW;
  END IF;

  v_coins := round(COALESCE(NEW.cost_usd, 0) * 1000)::int;
  IF v_coins <= 0 THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.workspace_credit_balances AS b
      (workspace_id, period_date, spent_today_coins, month_start, spent_month_coins, updated_at)
    VALUES
      (NEW.workspace_id, v_today, v_coins, v_month, v_coins, now())
    ON CONFLICT (workspace_id) DO UPDATE SET
      spent_today_coins = CASE WHEN b.period_date < v_today
                               THEN v_coins ELSE b.spent_today_coins + v_coins END,
      period_date       = v_today,
      spent_month_coins = CASE WHEN b.month_start < v_month
                               THEN v_coins ELSE b.spent_month_coins + v_coins END,
      month_start       = v_month,
      updated_at        = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[credit_debit] fallo debito ws=% feature=%: %', NEW.workspace_id, NEW.feature, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 3) Negative-cache del enrichment de duraciones ----------------------------
ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS duration_enrich_attempts smallint NOT NULL DEFAULT 0;
