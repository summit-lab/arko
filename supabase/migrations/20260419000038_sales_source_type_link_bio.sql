-- ═══════════════════════════════════════════════════════════════
-- Add `link_bio` to sales.source_type CHECK constraint
-- ═══════════════════════════════════════════════════════════════
-- The Ventas UI (VentasClient.tsx) has always offered 5 source types:
-- reel / historia / post / link_bio / otro. But the original check
-- constraint (mig 27) only accepted 4, causing a raw Postgres error
-- when a user selected "Link en Bio".
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_source_type_check;

ALTER TABLE sales
  ADD CONSTRAINT sales_source_type_check
  CHECK (source_type IN ('reel', 'historia', 'post', 'link_bio', 'otro'));
