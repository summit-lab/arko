-- ═══════════════════════════════════════════════════════════════
-- Migration 55: competitor_reels enrichment
--
-- Expande los datos que guardamos de cada reel scrapeado:
--   - location_name / location_id: si el reel tiene ubicación taggeada.
--   - tagged_users: array de @usernames taggeados (colabs, menciones).
--   - product_type: clips | feed | igtv | carousel (del payload de Apify).
--   - is_video: boolean — siempre true para reels, pero Apify a veces
--     trae entradas de otros tipos; útil para debug y análisis futuros.
--   - maybe_trial: heurística de trial reel. Hoy se deja en NULL (unknown).
--     En el futuro un scrape dual (reels vs grid) puede rellenarlo. Se agrega
--     ahora para no romper migraciones y tener la columna lista si activamos
--     la detección heurística.
--
-- Aplicada en Prod Arko (2026-04-23). Idempotente con IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE competitor_reels
  ADD COLUMN IF NOT EXISTS location_name text,
  ADD COLUMN IF NOT EXISTS location_id   text,
  ADD COLUMN IF NOT EXISTS tagged_users  text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS product_type  text,
  ADD COLUMN IF NOT EXISTS is_video      boolean,
  ADD COLUMN IF NOT EXISTS maybe_trial   boolean;

COMMENT ON COLUMN competitor_reels.maybe_trial IS
  'Heurística: true si el reel está en la tab Reels pero no en el grid del perfil (posible trial). NULL = no evaluado. Requiere scrape dual habilitado.';
