-- credit_category v3: agrega 'ai-agents-specialist' al bucket 'ai'.
-- El especialista del chat ahora loguea con feature propia (antes 'ai-agents',
-- imposible de separar en reportes). Debita igual que antes — solo cambia la
-- etiqueta. Resto de la función idéntico a 20260702000000.
CREATE OR REPLACE FUNCTION public.credit_category(p_feature text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN p_feature IN (
      'ai-agents','ai-agents-light','ai-agents-specialist','onboarding-adn',
      'competitor-analysis','reference-analysis','arkoai-video-analysis',
      'reel-auto-title','hooks-classify'
    ) THEN 'ai'
    WHEN p_feature IN (
      'reel-analysis-rescrape'
    ) THEN 'scraping'
    WHEN p_feature IN (
      'competitor-base-load','competitor-scheduled-refresh','reference-base-load',
      'competitor-scraping','reference-scraping'
    ) THEN 'service'
    ELSE 'system'
  END;
$$;
