-- ═══════════════════════════════════════════════════════════════
-- Migration 53: reel_benchmarks by-type + organic-only semantics
--
-- Añade avg_views_by_type (jsonb) a reel_benchmarks, que almacena
-- 3 benchmarks de views_org promediadas en los últimos 90 días:
--
--   { "normal": <num>, "trial": <num>, "all": <num> }
--
-- Reemplaza la lógica previa donde el multiplicador se calculaba
-- contra un único promedio (excluyendo trials). Esto permite:
--
--   1. Filtrar por "Trial" en la UI y comparar trials contra su
--      propio promedio (antes todos caían en ~0.2x).
--   2. El numerador del multiplicador pasa a ser views_org (no
--      views_org + views_paid), así los reels con ads no inflan
--      su multiplicador ni el promedio de los demás.
--
-- Compatibilidad: mantenemos avg_views_90d por si algún cliente
-- viejo lo consume. El service lo seguirá escribiendo igual a
-- avg_views_by_type.normal para no romper nada.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE reel_benchmarks
  ADD COLUMN IF NOT EXISTS avg_views_by_type jsonb DEFAULT '{}'::jsonb;

-- Backfill desde avg_views_90d existente al slot "normal".
-- trial y all quedan en 0 hasta el próximo refresh del cron (cada 6h)
-- o hasta que se dispare manualmente refreshReelBenchmarks().
UPDATE reel_benchmarks
SET avg_views_by_type = jsonb_build_object(
  'normal', COALESCE(avg_views_90d, 0),
  'trial',  0,
  'all',    COALESCE(avg_views_90d, 0)
)
WHERE avg_views_by_type = '{}'::jsonb OR avg_views_by_type IS NULL;
