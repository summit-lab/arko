-- Fix: reel_metrics_daily NO tiene columna updated_at, pero tenía enganchado el
-- trigger BEFORE UPDATE handle_updated_at() (que hace NEW.updated_at = NOW()),
-- así que TODO UPDATE a esa tabla fallaba con:
--   ERROR: record "new" has no field "updated_at"
-- (rompía en silencio el refresh de métricas de un día ya sincronizado).
-- La función handle_updated_at() se usa BIEN en otras 21 tablas que sí tienen la
-- columna; acá estaba mal aplicada. Fix mínimo: quitar el trigger roto — nadie
-- lee updated_at en esta tabla (la columna no existe). Reversible.
DROP TRIGGER IF EXISTS handle_updated_at_reel_metrics_daily ON public.reel_metrics_daily;
