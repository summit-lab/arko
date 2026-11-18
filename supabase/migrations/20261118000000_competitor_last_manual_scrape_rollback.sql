-- Rollback de 20261118000000_competitor_last_manual_scrape.
-- OJO: deployar primero el código que NO lee la columna, después correr esto.
ALTER TABLE public.workspace_competitors
  DROP COLUMN IF EXISTS last_manual_scrape_at;
