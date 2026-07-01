-- ============================================================================
-- moka_coins_admin — Control de Moka Coins desde el panel de admin. Aditiva.
--
--   • unlimited          → monedas infinitas (nunca se bloquea, chip = ∞)
--   • bonus_daily_coins  → cupo diario extra que se suma al allotment del tier
--   • RPC moka_admin_adjust(...) gated is_admin() para setear todo esto + reset
--
-- También amplía la policy SELECT para que el ADMIN pueda leer la billetera de
-- cualquier cliente (antes solo la leían los miembros del propio workspace).
-- ============================================================================

-- 1) Campos de override por workspace ----------------------------------------
ALTER TABLE public.workspace_credit_balances
  ADD COLUMN IF NOT EXISTS unlimited         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bonus_daily_coins integer NOT NULL DEFAULT 0;

ALTER TABLE public.workspace_credit_balances
  DROP CONSTRAINT IF EXISTS wcb_bonus_sane;
ALTER TABLE public.workspace_credit_balances
  ADD CONSTRAINT wcb_bonus_sane CHECK (bonus_daily_coins >= 0);

-- 2) El admin puede LEER todas las billeteras (panel de admin) -----------------
DROP POLICY IF EXISTS "Members read workspace balance" ON public.workspace_credit_balances;
CREATE POLICY "Members read workspace balance"
  ON public.workspace_credit_balances
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id) OR public.is_admin());

-- 3) RPC de ajuste — SECURITY DEFINER, gated is_admin() -----------------------
--    Los NULL dejan el campo como estaba (patch parcial). Crea la fila si falta.
CREATE OR REPLACE FUNCTION public.moka_admin_adjust(
  p_workspace_id      uuid,
  p_unlimited         boolean DEFAULT NULL,
  p_bonus_daily_coins integer DEFAULT NULL,
  p_reset_today       boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  INSERT INTO public.workspace_credit_balances (workspace_id)
  VALUES (p_workspace_id)
  ON CONFLICT (workspace_id) DO NOTHING;

  UPDATE public.workspace_credit_balances SET
    unlimited         = COALESCE(p_unlimited, unlimited),
    bonus_daily_coins = GREATEST(0, COALESCE(p_bonus_daily_coins, bonus_daily_coins)),
    spent_today_coins = CASE WHEN p_reset_today THEN 0 ELSE spent_today_coins END,
    spent_month_coins = CASE WHEN p_reset_today THEN 0 ELSE spent_month_coins END,
    updated_at        = now()
  WHERE workspace_id = p_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.moka_admin_adjust(uuid, boolean, integer, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.moka_admin_adjust(uuid, boolean, integer, boolean) TO authenticated;
