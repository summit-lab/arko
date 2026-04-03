-- Migration 27: Sales Module
-- Módulo de ventas: trackeo de revenue, cash collected, cash por cobrar
-- con atribución a contenido (reels, historias, posts)

-- =============================================================
-- SALES — Una venta por fila
-- =============================================================
CREATE TABLE sales (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Atribución a contenido (opcional pero recomendado)
  reel_id          uuid REFERENCES reels(id) ON DELETE SET NULL,
  story_sequence_id uuid REFERENCES ig_story_sequences(id) ON DELETE SET NULL,

  -- Fuente de la venta
  source_type      text NOT NULL DEFAULT 'reel'
                   CHECK (source_type IN ('reel', 'historia', 'post', 'otro')),
  source_label     text, -- descripción libre si source_type = 'otro'

  -- Montos
  amount_total     numeric(12, 2) NOT NULL,   -- total del deal/precio acordado
  amount_collected numeric(12, 2) NOT NULL DEFAULT 0, -- cash ya cobrado
  -- amount_pending = amount_total - amount_collected (calculado)

  -- Tipo de pago
  payment_type     text NOT NULL DEFAULT 'full'
                   CHECK (payment_type IN ('full', 'cuotas', 'deposito')),

  -- Estado
  payment_status   text NOT NULL DEFAULT 'collected'
                   CHECK (payment_status IN ('collected', 'cancelled', 'pending')),

  -- Detalles
  sale_date        date NOT NULL DEFAULT CURRENT_DATE,
  payment_method   text, -- 'transferencia', 'wap', 'efectivo', 'tarjeta', 'otro'
  notes            text,

  -- Metadatos del cliente (opcional, para futuro CRM)
  client_name      text,
  client_contact   text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_workspace ON sales(workspace_id);
CREATE INDEX idx_sales_date ON sales(workspace_id, sale_date DESC);
CREATE INDEX idx_sales_reel ON sales(reel_id) WHERE reel_id IS NOT NULL;
CREATE INDEX idx_sales_status ON sales(workspace_id, payment_status);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE POLICY "workspace_members_own_sales"
  ON sales
  FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- =============================================================
-- Eliminar sales_amount de reels (migrar a tabla sales)
-- NOTA: No droppamos la columna para no romper código existente.
-- La columna queda como legacy hasta que el módulo de ventas esté
-- completamente integrado. El nuevo flow usa la tabla sales.
-- =============================================================
-- (No action — backward compat)
