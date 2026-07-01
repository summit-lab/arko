-- ============================================================================
-- moka_coins_v1 — Billetera de créditos (Moka Coins). Aditiva + reversible.
--
--   1 Moka Coin = $0.001 USD   =>   coins = round(cost_usd * 1000)
--
-- El allotment diario (demo 150 / standard 500 / pro 500) vive en TS
-- (TIER_CONFIG.dailyBudgetUsd * 1000). La DB SOLO ACUMULA gasto vía trigger
-- AFTER INSERT sobre las tablas de usage existentes; nunca re-deriva el tier.
--
-- Regla system-vs-usuario: se clasifica por `feature` (ambas tablas la tienen,
-- NOT NULL). Solo las features del allowlist debitan; TODO lo demás — incl.
-- los syncs automáticos (ig-sync-enrichment / ig-reel-enrichment) y cualquier
-- string desconocido — cae en 'system' y NUNCA debita (fail-safe).
--
-- Huso: America/Argentina/Buenos_Aires (el reset coincide con la medianoche AR).
-- ============================================================================

-- 1) Balances: exactamente una fila realtime-legible por workspace -------------
CREATE TABLE IF NOT EXISTS public.workspace_credit_balances (
  workspace_id       uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period_date        date        NOT NULL DEFAULT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
  spent_today_coins  integer     NOT NULL DEFAULT 0,
  month_start        date        NOT NULL DEFAULT date_trunc('month', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
  spent_month_coins  integer     NOT NULL DEFAULT 0,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wcb_spent_sane CHECK (spent_today_coins >= 0 AND spent_month_coins >= 0)
);

ALTER TABLE public.workspace_credit_balances ENABLE ROW LEVEL SECURITY;

-- Los miembros LEEN su billetera (solo números, benigno). No hay policy de
-- escritura: solo el trigger SECURITY DEFINER y service-role mutan esta tabla.
DROP POLICY IF EXISTS "Members read workspace balance" ON public.workspace_credit_balances;
CREATE POLICY "Members read workspace balance"
  ON public.workspace_credit_balances
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- 2) Clasificador de categoría. Desconocido => 'system' (fail-safe) ------------
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
    ELSE 'system'   -- ig-sync-enrichment, ig-reel-enrichment, competitor-cron-scraping, + cualquier desconocido
  END;
$$;

-- 3) Débito AFTER INSERT (compartido por ambas tablas de usage) ----------------
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
  -- Gasto system/service jamás toca la billetera del usuario.
  IF public.credit_category(NEW.feature) = 'system' THEN
    RETURN NEW;
  END IF;

  v_coins := round(COALESCE(NEW.cost_usd, 0) * 1000)::int;   -- 1 coin = $0.001
  IF v_coins <= 0 THEN
    RETURN NEW;
  END IF;

  -- Best-effort: el balance es un acumulador; si el débito fallara (p.ej. una
  -- fila de usage con workspace_id huérfano), NO debe romper el logging de
  -- usage ni la operación del usuario. Las tablas de usage son la verdad.
  BEGIN
    INSERT INTO public.workspace_credit_balances AS b
      (workspace_id, period_date, spent_today_coins, month_start, spent_month_coins, updated_at)
    VALUES
      (NEW.workspace_id, v_today, v_coins, v_month, v_coins, now())
    ON CONFLICT (workspace_id) DO UPDATE SET
      -- Lazy reset: si la fila es de un día/mes anterior, arranca de cero.
      spent_today_coins = CASE WHEN b.period_date < v_today
                               THEN v_coins ELSE b.spent_today_coins + v_coins END,
      period_date       = v_today,
      spent_month_coins = CASE WHEN b.month_start < v_month
                               THEN v_coins ELSE b.spent_month_coins + v_coins END,
      month_start       = v_month,
      updated_at        = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[credit_debit] fallo débito ws=% feature=%: %', NEW.workspace_id, NEW.feature, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_debit_llm ON public.llm_usage;
CREATE TRIGGER trg_credit_debit_llm
  AFTER INSERT ON public.llm_usage
  FOR EACH ROW EXECUTE FUNCTION public.credit_debit_from_usage();

DROP TRIGGER IF EXISTS trg_credit_debit_integration ON public.integration_usage;
CREATE TRIGGER trg_credit_debit_integration
  AFTER INSERT ON public.integration_usage
  FOR EACH ROW EXECUTE FUNCTION public.credit_debit_from_usage();

-- 4) Realtime: stream de UPDATEs al chip -------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_credit_balances;

-- 5) Backfill: fila para cada workspace existente (el chip renderiza hoy) -----
INSERT INTO public.workspace_credit_balances (workspace_id)
SELECT id FROM public.workspaces
ON CONFLICT (workspace_id) DO NOTHING;
