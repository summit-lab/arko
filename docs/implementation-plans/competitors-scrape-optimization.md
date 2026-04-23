# Plan de implementación — Optimización del scrape de competidores

> **Para el próximo agente:** este doc describe el estado actual del módulo
> Competidores (tab `/instagram?tab=competencia`), qué bugs se arreglaron en
> la sesión 2026-04-23, qué queda pendiente verificar y qué optimizaciones
> seguir sumando si el usuario lo pide. Leer de punta a punta antes de tocar
> código — hay contexto fuera del codebase (Apify limits, estado Prod real).

---

## 1. Qué hace el módulo Competidores

Flow end-to-end:

```
User click "Scrape + Analizar" en workspace_competitors row
    ↓
POST /api/v1/competitors/[id]/scrape
    ↓
scrapeCompetitor(competitorId, workspaceId) en src/services/competitor-scraper.service.ts
    ↓
  1. Llama Apify profile-scraper (1 call) → devuelve followers, bio, avatar
  2. Llama Apify reel-scraper (1 call, limit=50) → devuelve reels
  3. Sube avatar a Storage (bucket competitor-assets)
  4. Sube thumbnails de los 50 reels a Storage en paralelo (Promise.all)
  5. Delete todos los competitor_reels anteriores de ese competitor
  6. BULK INSERT de los 50 reels nuevos en una sola query
    ↓
Endpoint resetea analysis_status='idle' y devuelve apiSuccess
    ↓
UI refetchea y muestra la grilla con los 50 reels + botón "Analizar" individual
```

Después, por separado, el user puede clickear "Analizar" en cada reel:
```
POST /api/v1/competitors/[id]/reels/[reelId]/analyze
    ↓
Gemini video analysis (~30-45s por reel) → guarda en competitor_reel_analysis
```

---

## 2. Bugs arreglados en sesión 2026-04-23

### Bug A — `analysis_status` quedaba pegado en "analyzing"

**Síntoma:** user clickeaba "Scrape + Analizar", el scrape terminaba exitoso en
Apify (verificable en dashboard Apify), pero en la UI el spinner "Analizando"
quedaba para siempre y no aparecían los reels.

**Causa:** `src/app/api/v1/competitors/[id]/scrape/route.ts` marcaba
`analysis_status='analyzing'` al arrancar pero **solo reseteaba a `'idle'` en
el branch de error**. En el happy path el return `apiSuccess(...)` no tocaba
el status → quedaba trabado.

**Fix (ya aplicado en PR #59, commit `498fefc`):**
- Extraído helper `resetStatus()` que se llama en todos los exit paths.
- Agregado try/catch alrededor de `scrapeCompetitor` para capturar crashes y
  resetear status.
- Reset explícito justo antes del return success.

### Bug B — 50 INSERTs seriales eran lentos

**Síntoma:** el scrape total (incluyendo DB writes) tardaba ~5 minutos.

**Causa:** `competitor-scraper.service.ts` hacía `for (const reel of ...) { await
supabase.from('competitor_reels').insert({...}) }` — 50 INSERTs con roundtrip
de 100-300ms cada uno.

**Fix (ya aplicado):** bulk insert de los 50 reels en una sola query. Ganancia
estimada: ~10-20s menos por scrape.

---

## 3. Estado tras el fix

**En código (merged en PR #59):**
- ✅ Status reset garantizado en success/error/crash paths
- ✅ Bulk insert de 50 reels en 1 query
- ✅ Migration 55 `competitor_reels_enrichment` aplicada en Prod (columnas
  `location_name`, `location_id`, `tagged_users`, `product_type`, `is_video`,
  `maybe_trial`)
- ✅ Scraper service extrae y persiste los campos nuevos desde Apify

**En Prod (hecho en sesión 2026-04-23 segunda tanda):**
- ✅ Correr SQL para desbloquear competitors ya trabados — se desbloquearon
  `Max Inhouse` y `Nik Setting`. La query original del plan usaba `updated_at`
  que NO existe en `workspace_competitors`; adaptada a `last_scraped_at`:

```sql
UPDATE workspace_competitors
SET analysis_status = 'idle'
WHERE analysis_status = 'analyzing'
  AND (last_scraped_at IS NULL OR last_scraped_at < now() - interval '10 minutes');
```

- 🔲 Verificar que los competitors que se scrapearon después del merge
  aparecen con su grilla de reels. Query de verificación:

```sql
SELECT
  wc.name,
  wc.analysis_status,
  wc.last_scraped_at,
  EXTRACT(EPOCH FROM (now() - wc.updated_at))/60 AS minutos_desde_update,
  COUNT(cr.id) AS reels_en_db,
  COUNT(cra.id) AS reels_analizados
FROM workspace_competitors wc
LEFT JOIN competitor_reels cr ON cr.competitor_id = wc.id
LEFT JOIN competitor_reel_analysis cra ON cra.competitor_reel_id = cr.id
GROUP BY wc.id, wc.name, wc.analysis_status, wc.last_scraped_at, wc.updated_at
ORDER BY wc.updated_at DESC
LIMIT 10;
```

Esperamos: `analysis_status='idle'` en todos los que no estén siendo
scrapeados activamente + `reels_en_db` cercano a 50 para los que se
scrapearon post-fix.

---

## 4. Pendientes opcionales

### 4.1 Watchdog pg_cron para auto-desbloquear ✅ APLICADO 2026-04-23

Aplicado como migration `20260423000056_competitor_analyzing_watchdog.sql`.
Detalles de lo que quedó en Prod:

- Columna nueva `workspace_competitors.analysis_started_at timestamptz`
  (se agregó porque `updated_at` no existe y `last_scraped_at` sólo refleja
  el último scrape exitoso, no el intento en curso).
- Función `public.competitor_analyzing_watchdog_unblock_stuck()` que resetea
  a 'idle' todos los rows con `analysis_status='analyzing'` cuyo
  `analysis_started_at IS NULL` o es más viejo que 10 min.
- pg_cron `competitor-analyzing-watchdog` cada `*/10 * * * *`.
- Endpoints actualizados para setear `analysis_started_at=now()` al marcar
  analyzing y limpiarlo al resetear:
  - `src/app/api/v1/competitors/[id]/scrape/route.ts`
  - `src/app/api/v1/competitors/[id]/analyze/route.ts`

**Para referencia histórica, el SQL original del plan era:**

```sql
CREATE OR REPLACE FUNCTION public.unblock_stuck_competitor_analyzing()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE workspace_competitors
  SET analysis_status = 'idle', updated_at = now()
  WHERE analysis_status = 'analyzing'
    AND updated_at < now() - interval '10 minutes';

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    RAISE LOG 'competitor_analyzing_watchdog: liberados % competitors stuck', updated_count;
  END IF;

  RETURN updated_count;
END;
$$;

SELECT cron.unschedule('competitor-analyzing-watchdog')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'competitor-analyzing-watchdog');

SELECT cron.schedule(
  'competitor-analyzing-watchdog',
  '*/10 * * * *',  -- cada 10 min
  $$SELECT public.unblock_stuck_competitor_analyzing()$$
);
```

Aplicar: vía MCP (si está activo) o manualmente en el SQL editor de Prod
(`zphvrohosizkbrnxtppj`) y Dev (`hrsvglgswatwklivkoyp`).

### 4.2 Optimización de thumbnail uploads

Actualmente los 50 thumbnails se suben en `Promise.all` concurrente (50
uploads en paralelo). Supabase Storage puede throttlear bajo esa carga y
devolver 429. Si el usuario reporta thumbnails faltantes, bajar a batches de
10 simultáneos con una pequeña biblioteca de concurrency (`p-limit`) o un
loop manual:

```ts
const CONCURRENCY = 10;
const reelsWithStableUrls: CompetitorReelData[] = [];
for (let i = 0; i < reels.length; i += CONCURRENCY) {
  const batch = reels.slice(i, i + CONCURRENCY);
  const processed = await Promise.all(batch.map(uploadThumbnail));
  reelsWithStableUrls.push(...processed);
}
```

### 4.3 Streaming progress a la UI ✅ APLICADO 2026-04-23

Implementado con polling cada 2s en vez de SSE (más simple + mismo UX):
- Nueva columna `workspace_competitors.scrape_progress jsonb` (migration 57).
- Endpoints `/scrape` y `/analyze` emiten progress entre fases.
- Endpoint nuevo `GET /api/v1/competitors/[id]` liviano para polling.
- `CompetitorTab.tsx` pollea cada 2s y muestra `message` del progress.

### 4.4 Detección de trial reels (`maybe_trial`) ✅ APLICADO 2026-04-23

Implementado con scrape paralelo best-effort:
- `apify~instagram-post-scraper` corre en paralelo con los scrapes de profile
  y reels (sin penalización de latencia).
- Se comparan shortcodes: si un reel está en `/reels/` pero no en el grid →
  `maybe_trial = true`.
- Si el actor del grid falla, la columna queda NULL y el resto del scrape
  procede normal.

### 4.5 Ventana 30 días ✅ APLICADO 2026-04-23

El scraper ahora pasa `onlyPostsNewerThan: "30 days"` al actor + filtro
defensivo post-fetch. Límite global subido a 100 reels (scraper) y 100 en
el SELECT del GET /api/v1/competitors (antes 24).

---

## 5. Archivos relevantes

**Código:**
- `src/app/api/v1/competitors/[id]/scrape/route.ts` — endpoint principal
- `src/app/api/v1/competitors/[id]/reels/[reelId]/analyze/route.ts` — analyze per-reel
- `src/app/api/v1/competitors/[id]/analyze/route.ts` — analyze bulk
- `src/services/competitor-scraper.service.ts` — scrape + upload + DB writes
- `src/services/competitor-analysis.service.ts` — Gemini analysis
- `src/components/instagram/CompetitorTab.tsx` — UI principal
- `src/app/(dashboard)/instagram/page.tsx` — fetch inicial (buscar `competitor_reels (`)

**Migrations:**
- `20260326000019_competitor_reels.sql` — tabla original
- `20260407000033_competitor_assets_and_follower_snapshots.sql` — storage
  bucket + follower snapshots
- `20260420000050_competitor_scraping_cron.sql` — cron diario 4am UTC
- `20260423000055_competitor_reels_enrichment.sql` — columnas nuevas

**Infra externa:**
- Apify actors: `apify~instagram-profile-scraper`, `apify~instagram-reel-scraper`
- Supabase bucket: `competitor-assets` (públicas, used storage)
- pg_cron job: `scrape-competitors-daily` (4am UTC)

---

## 6. Cómo verificar el fix después de mergear PR #59

1. **Desbloquear manualmente competidores trabados** (query de sección 3).
2. **Re-scrapear uno**: clickear "Scrape + Analizar" en un competidor.
3. **Observar que el spinner desaparece** al completar y la grilla de reels
   aparece. Tiempo esperado: ~2-3 min.
4. **Verificar en DB**: correr la query de sección 3, esperar ver
   `analysis_status='idle'` + ~50 reels para ese competidor.
5. **Regresión**: abrir/cerrar el panel de CompetitorTab varias veces, no
   debería quedar ningún status pegado.

---

## 7. Contexto Prod vs Dev

Per memoria del proyecto:
- **Prelaunch Prod mode** desde 2026-04-23 — todo el trabajo va directo a
  Prod Arko (`zphvrohosizkbrnxtppj`), no Dev.
- Aún así, para probar queries destructivas o DDL, aplicar primero en Dev
  (`hrsvglgswatwklivkoyp`) — las tablas son las mismas.

**Proyectos:**
- Prod: `zphvrohosizkbrnxtppj`
- Dev: `hrsvglgswatwklivkoyp`
- URL app: `https://usemoka.io`

---

## 8. Checklist de arranque para el próximo agente

- [x] Leer este archivo completo
- [x] Confirmar que MCP `arko` está conectado (`claude mcp list` → ✓ Connected)
- [x] Correr query de verificación (sección 3) y adjuntar resultado
- [x] Si hay stuck → correr UPDATE de sección 3 para desbloquear (Max Inhouse + Nik Setting)
- [x] Aplicar 4.1 watchdog (migration 56)
- [ ] Si user pide optimizaciones adicionales → revisar sección 4.2 (thumbnails)
      y 4.3 (streaming progress). 4.4 (maybe_trial) requiere pedirlo explícito.
- [ ] NO re-aplicar los fixes del PR #59, ya están mergeados

---

**Última actualización**: 2026-04-23 · Segunda pasada: watchdog + `analysis_started_at`
**PR de referencia**: #59 en `summit-lab/arko` (fixes iniciales) + rama actual `chore/sync-pending-benchmarks-dashboard` (watchdog)
**Commits con los fixes**: `498fefc` (scrape bugs) + migration 56 en Prod Arko
