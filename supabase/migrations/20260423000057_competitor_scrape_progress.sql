-- ═══════════════════════════════════════════════════════════════
-- Competitor scrape progress column
--
-- El flujo de scrape+analyze de competidores tarda 2-3 min y durante
-- ese tiempo la UI solo mostraba "Analizando...". El user no sabe si
-- está bajando thumbnails, scrapeando metadata, o analizando con Gemini.
--
-- Esta columna la escriben los endpoints scrape/analyze con objetos como:
--   {"phase": "scraping_reels", "message": "Bajando reels del último mes"}
--   {"phase": "uploading_thumbs", "current": 12, "total": 47, "message": "..."}
--   {"phase": "analyzing", "current": 2, "total": 6, "message": "Analizando 2/6"}
--
-- La UI pollea GET /api/v1/competitors/[id] cada 2s mientras el status
-- sea 'analyzing' y muestra el mensaje dinámicamente.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.workspace_competitors
  ADD COLUMN IF NOT EXISTS scrape_progress jsonb;
