-- Eliminamos views_generated_in_window: no se usa.
-- Reemplazada por SUM(ig_account_insights.impressions) directo en el dashboard,
-- que matchea exactamente la metrica que IG nativo muestra como "Vistas".
DROP FUNCTION IF EXISTS views_generated_in_window(uuid, date, date);
