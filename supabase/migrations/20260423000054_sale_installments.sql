-- ═══════════════════════════════════════════════════════════════
-- Migration 54: sale_installments — cuotas programadas de ventas
--
-- Cuando una venta (sales) tiene payment_type = 'cuotas', se genera
-- una fila por cuota en esta tabla. Cada cuota tiene due_date y
-- paid_at (nullable). Un trigger recalcula sales.amount_collected y
-- sales.payment_status cada vez que cambia una cuota. Un cron diario
-- marca como pagadas las cuotas con due_date <= today (auto-paid);
-- si el cliente no pagó realmente, el usuario desmarca la cuota
-- desde la UI y el trigger resta el monto.
--
-- Frecuencia: mismo día del mes siguiente (usa add_months equivalente
-- via + interval '1 month'). La primera cuota es sale_date.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sale_installments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id             uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  installment_number  int  NOT NULL CHECK (installment_number > 0),
  due_date            date NOT NULL,
  amount              numeric(14,2) NOT NULL CHECK (amount >= 0),
  paid_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sale_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_sale_installments_workspace_due
  ON sale_installments (workspace_id, due_date);

-- Partial index para el cron (solo filas pending que pueden vencer).
CREATE INDEX IF NOT EXISTS idx_sale_installments_pending_due
  ON sale_installments (due_date)
  WHERE paid_at IS NULL;

-- ─── updated_at trigger ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION sale_installments_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sale_installments_updated_at ON sale_installments;
CREATE TRIGGER trigger_sale_installments_updated_at
BEFORE UPDATE ON sale_installments
FOR EACH ROW EXECUTE FUNCTION sale_installments_set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────
ALTER TABLE sale_installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "installments_read" ON sale_installments;
CREATE POLICY "installments_read"
  ON sale_installments FOR SELECT
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "installments_insert" ON sale_installments;
CREATE POLICY "installments_insert"
  ON sale_installments FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "installments_update" ON sale_installments;
CREATE POLICY "installments_update"
  ON sale_installments FOR UPDATE
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "installments_delete" ON sale_installments;
CREATE POLICY "installments_delete"
  ON sale_installments FOR DELETE
  USING (is_workspace_member(workspace_id));

-- ─── Trigger: recalcular sales.amount_collected + payment_status ──
-- Cualquier INSERT/UPDATE/DELETE en sale_installments dispara esto.
-- amount_collected = SUM(amount) de cuotas paid.
-- payment_status = 'collected' si collected >= total, else 'pending'.
-- NOTA: solo afecta ventas con payment_type = 'cuotas' (si hay ventas
-- de otro tipo con installments, igual las considera; en la práctica
-- solo cuotas va a tener rows).
CREATE OR REPLACE FUNCTION recalc_sale_from_installments()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_id uuid;
  v_collected numeric;
  v_total numeric;
BEGIN
  v_sale_id := COALESCE(NEW.sale_id, OLD.sale_id);

  SELECT COALESCE(SUM(amount), 0) INTO v_collected
  FROM sale_installments
  WHERE sale_id = v_sale_id AND paid_at IS NOT NULL;

  SELECT amount_total INTO v_total FROM sales WHERE id = v_sale_id;

  UPDATE sales SET
    amount_collected = v_collected,
    payment_status = CASE
      WHEN v_total IS NULL OR v_total <= 0 THEN 'pending'
      WHEN v_collected >= v_total THEN 'collected'
      ELSE 'pending'
    END
  WHERE id = v_sale_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recalc_sale_from_installments ON sale_installments;
CREATE TRIGGER trigger_recalc_sale_from_installments
AFTER INSERT OR UPDATE OR DELETE ON sale_installments
FOR EACH ROW EXECUTE FUNCTION recalc_sale_from_installments();

-- ─── Cron diario: auto-paid de cuotas vencidas ──────────────────
-- Corre a las 00:05 UTC. Marca como paid todas las cuotas cuyo due_date
-- ya llegó y no están pagadas. El trigger de arriba actualiza sales.
-- Si el usuario necesita desmarcar una (cliente no pagó), lo hace
-- desde la UI y el trigger resta el monto.
--
-- Idempotente: si corre 2 veces el mismo día no hace nada la segunda
-- porque el filtro paid_at IS NULL excluye las ya marcadas.
SELECT cron.unschedule('auto-pay-installments-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-pay-installments-daily'
);

SELECT cron.schedule(
  'auto-pay-installments-daily',
  '5 0 * * *',
  $$
    UPDATE sale_installments
    SET paid_at = (due_date::timestamptz + interval '0 hours')
    WHERE paid_at IS NULL
      AND due_date <= (now() at time zone 'utc')::date
  $$
);

COMMENT ON TABLE sale_installments IS
  'Cuotas programadas para ventas con payment_type=cuotas. Un trigger recalcula sales.amount_collected y payment_status cuando cambian. Un cron diario marca paid las vencidas (auto-paid).';
