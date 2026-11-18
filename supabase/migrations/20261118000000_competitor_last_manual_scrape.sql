-- ============================================================================
-- workspace_competitors.last_manual_scrape_at
--
-- Problema: el cron `scrape-competitors` (L/Mi/V 04:00 UTC) solo refresca
-- métricas de reels YA guardados (no descubre reels nuevos), pero pisa
-- `last_scraped_at`. El scrape manual usaba ese mismo campo para:
--   1) el cooldown de 6h → el cron bloqueaba el scrape manual con
--      "los datos ya están frescos" aunque los reels nuevos nunca se buscaron;
--   2) la ventana incremental (días desde el último scrape + 7) → con el cron
--      corriendo cada 2-3 días la ventana quedaba en ~8-10 días y los reels
--      publicados entre el último scrape manual y esa ventana no se
--      descubrían NUNCA.
--
-- Fix: columna propia del scrape manual (el que sí descubre reels). Aditiva,
-- nullable, sin backfill a propósito: NULL ⇒ el próximo scrape manual de cada
-- competidor hace la ventana completa del tier y recupera los reels perdidos.
-- ============================================================================

ALTER TABLE public.workspace_competitors
  ADD COLUMN IF NOT EXISTS last_manual_scrape_at timestamptz;

COMMENT ON COLUMN public.workspace_competitors.last_manual_scrape_at IS
  'Último scrape MANUAL exitoso (descubre reels nuevos). Lo escribe solo POST /api/v1/competitors/[id]/scrape; el cron no lo toca. Base del cooldown de 6h y de la ventana incremental.';
