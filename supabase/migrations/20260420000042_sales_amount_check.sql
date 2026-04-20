-- ═══════════════════════════════════════════════════════════════
-- Sprint A hardening: prevent over-collection + atomic payment RPC
-- ═══════════════════════════════════════════════════════════════
-- 1. CHECK constraint: amount_collected <= amount_total
--    Defence-in-depth against app bugs and races.
-- 2. apply_sale_payment(sale_id, amount): single-statement atomic
--    UPDATE that locks the row, guards overflow, auto-flips status,
--    and appends a payment trace to notes. Replaces the read-modify-
--    write pattern in /api/v1/sales/[id]/payment that had a TOCTOU
--    race (two concurrent requests could both pass the guard and
--    both write, losing one payment).
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Validate existing data then add CHECK ─────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM sales WHERE amount_collected > amount_total) THEN
    RAISE EXCEPTION 'Cannot add CHECK — existing rows violate amount_collected <= amount_total';
  END IF;
END $$;

ALTER TABLE sales
  ADD CONSTRAINT sales_amount_collected_lte_total
  CHECK (amount_collected <= amount_total);

-- ─── 2. Atomic payment RPC ────────────────────────────────────
-- SECURITY DEFINER so the function runs with elevated privileges,
-- but authorization is enforced inside via auth.uid() membership
-- check against workspace_members. This mirrors the RLS policy on
-- the sales table (see mig 27).
CREATE OR REPLACE FUNCTION apply_sale_payment(
  p_sale_id uuid,
  p_amount  numeric
)
RETURNS sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result sales;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid payment amount' USING ERRCODE = 'P0001';
  END IF;

  UPDATE sales
  SET
    amount_collected = amount_collected + p_amount,
    payment_status   = CASE
      WHEN amount_collected + p_amount >= amount_total THEN 'collected'
      ELSE payment_status
    END,
    notes = COALESCE(notes || ' | ', '')
            || 'Pago ' || to_char(CURRENT_DATE, 'YYYY-MM-DD')
            || ': +' || p_amount::text,
    updated_at = now()
  WHERE id = p_sale_id
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    AND amount_collected + p_amount <= amount_total  -- overflow guard
    AND payment_status <> 'cancelled'
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION
      'Payment failed: sale not found, over amount_total, cancelled, or unauthorized'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_sale_payment(uuid, numeric) TO authenticated;
