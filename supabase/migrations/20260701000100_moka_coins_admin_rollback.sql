-- Rollback de moka_coins_admin.
DROP FUNCTION IF EXISTS public.moka_admin_adjust(uuid, boolean, integer, boolean);
DROP POLICY IF EXISTS "Members read workspace balance" ON public.workspace_credit_balances;
CREATE POLICY "Members read workspace balance"
  ON public.workspace_credit_balances FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
ALTER TABLE public.workspace_credit_balances DROP CONSTRAINT IF EXISTS wcb_bonus_sane;
ALTER TABLE public.workspace_credit_balances DROP COLUMN IF EXISTS bonus_daily_coins;
ALTER TABLE public.workspace_credit_balances DROP COLUMN IF EXISTS unlimited;
