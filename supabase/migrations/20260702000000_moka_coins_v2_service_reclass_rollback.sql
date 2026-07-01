-- Rollback de moka_coins_v2_service_reclass: restaura los cuerpos exactos de
-- 20260701000000_moka_coins_v1 (competitor/reference-scraping vuelven a debitar)
-- y quita la columna de intentos.

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
      'competitor-scraping','reference-scraping','reel-analysis-rescrape'
    ) THEN 'scraping'
    ELSE 'system'
  END;
$$;

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
  IF public.credit_category(NEW.feature) = 'system' THEN
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

ALTER TABLE public.reels DROP COLUMN IF EXISTS duration_enrich_attempts;
