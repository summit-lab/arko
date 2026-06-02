# Feature: Instagram Intelligence

## Descripción
Módulo que conecta con la cuenta de Instagram del usuario y analiza los Reels en profundidad. No incluye Stories, solo Reels.

## Funcionalidades

### 1. Lista de Reels
- Muestra los últimos Reels publicados en una lista/grid.
- Cada Reel muestra: miniatura, título/caption, fecha, métricas principales (views, likes, saves, comments, shares).
- El filtro temporal (`7d`, `14d`, `30d`, `90d`) debe recalcular tanto los KPIs agregados como las cards visibles del listado usando la misma ventana temporal seleccionada.
- Las cards del listado priorizan composición horizontal: portada a la izquierda y métricas/caption a la derecha, ocupando todo el alto útil de la card para evitar huecos visuales.
- La card del listado debe evitar sobrecarga visual: una jerarquía principal clara, métricas inline y la menor cantidad posible de cajas anidadas o micro-elementos decorativos.
- El badge `Promocionado` y cualquier métrica pagada dentro del listado o la ficha solo deben mostrarse cuando el Reel tenga señales reales de ads (`has_ads` o métricas paid > 0); si no, la UI debe permanecer 100% orgánica.
- Al hacer clic en un Reel, se expande una vista detallada.

### 2. Vista Detallada de un Reel — Arquitectura de 2 capas

#### Capa 1 — Métricas básicas (automática, siempre visible al abrir)
- **Miniatura grande / Preview del Reel.** La ficha prioriza un preview amplio del asset y, cuando existe `media_url` o `video_url` público reproducible, permite ver el Reel inline sin salir de Arko.
- **Métricas clave:** Views, likes, saves, comments, shares, hook rate.
- **Métricas extendidas:** split orgánico/pagado, reach orgánico/pagado, impresiones pagas, clicks pagados, spend, video plays pagados, watch time promedio y KPIs derivados como engagement rate, CTR, CPM y CPV.
- **Legibilidad UI:** la ficha prioriza contraste alto y tipografía legible sobre fondos oscuros; labels secundarios, chips y descripciones no deben depender de grises demasiado bajos ni tamaños mínimos que comprometan la lectura.
- **Retención y drop-off:** visualización basada en `avg_watch_time_sec` y `completion_rate`; no representa una curva segundo a segundo cuando Meta no expone ese dato.
- **Sin llamadas externas al abrir:** la Capa 1 solo lee datos ya sincronizados en Supabase (métricas, benchmark, caption, thumbnail).

#### Capa 2 — Análisis profundo con ArkoAI (bajo demanda, persistido)
- Se dispara con botón "Analizar en profundidad" cuando el usuario lo decide.
- ArkoAI procesa el video completo en un solo call: transcripción con timestamps por línea (`start_sec`, `end_sec`), narrativa (hook, development, CTA, core promise, topic cluster), análisis visual (formato, plano, orientación, personas, texto en pantalla, primer frame), tono de voz/delivery (energía, formalidad, WPM, muletillas), e insights (fortalezas, mejoras, potencial viral).
- Se persiste en `reel_transcripts`, `reel_narrative_analysis`, `reel_visual_analysis` y `reel_audio_analysis`; si ya existe, la ficha lo hidrata desde Supabase y lo muestra sin volver a llamar al modelo.
- Botón "Re-analizar" para forzar actualización. Si el reanálisis falla, se mantiene el resultado anterior visible.
- Si no hay análisis ArkoAI pero existe transcript público de Apify, se muestra como fallback dentro del bloque de análisis.

#### Apify — Enriquecimiento opcional separado
- La sección "Datos Públicos Externos" muestra metadata que ArkoAI no puede extraer: play count público, shares públicas, hashtags, mentions, comentarios públicos, tagged users, audio/música.
- No bloquea el render inicial. Se muestra solo cuando hay datos disponibles.

### 3. Análisis Comparativo
- Comparar hook rate entre videos.
- Comparar retención entre videos.
- Detectar patrones: qué temas/formatos generan más alcance, más guardados, más ventas.

### 3.1 Análisis de Competidores
- **Fuente**: Apify actors `apify~instagram-profile-scraper` + `apify~instagram-reel-scraper`. Scrape diario vía pg_cron (4 AM UTC).
- **Volumen**: **50 reels por competidor** por scrape (subido desde 20 en 2026-04-23). Tradeoff: ~2.5× más compute units de Apify por run.
- **Campos persistidos** en `competitor_reels`: métricas (views/likes/comments/shares), caption, hashtags, mentions, `tagged_users` (colabs), `location_name`, `product_type`, duración, thumbnail + video_url (almacenados en bucket `competitor-assets`), transcript (on-demand), música.
- **Análisis IA**: una llamada a Gemini 2.5 Flash analiza cada reel y persiste en `competitor_reel_analysis` (hook_text/type, narrative_structure, content_type, cta, topic_cluster, strengths, weaknesses, ai_summary).
- **Follower tracking**: `competitor_follower_snapshots` guarda un snapshot diario (upsert por `snapshot_date`) para trending histórico.
- **Detección de trials en competidores**: **no implementada**. Instagram no expone `is_shared_to_feed` en scraping público, así que la detección exacta requiere el token del dueño (solo disponible para la cuenta propia). La columna `competitor_reels.maybe_trial` está reservada para una heurística futura basada en scrape dual (reels tab vs grid) con match por `short_code` — daría ~70-80% de precisión pero duplicaría el costo Apify.

### 4. Atribución de Views Pagas
- Cruza Meta Marketing API con los Reels de Instagram para calcular `views_paid` por pieza.
- El mapeo Ad → Reel prioriza `source_instagram_media_id`, luego `effective_instagram_media_id`, luego `object_story_id`, y luego permalink del creative.
- Los permalinks de Ads pueden venir en formato `/p/{shortcode}` mientras que los Reels se almacenan como `/reel/{shortcode}`, por lo que el sistema normaliza el shortcode para evitar falsos negativos.
- El fetch de Ads codifica los `fields` anidados del creative para evitar errores `Invalid parameter` en Marketing API al pedir identificadores extra de atribución.
- El sync excluye `DELETED` del filtro `effective_status` porque el endpoint `/ads` de Meta rechaza objetos eliminados y aborta el listado completo.

## Fuente de Datos
- Instagram Graph API (Reels).
- Meta Marketing API (ads y creatives para atribución de vistas pagas).
- Apify Instagram Reel Scraper (solo para Reels públicos y como fuente complementaria on-demand).
- Transcripción de audio vía OpenAI Whisper.
- Análisis cualitativo vía GPT-4.

## Arquitectura de Sync — Supabase Edge Functions

El sync de Instagram se ejecuta en una **Supabase Edge Function** (`sync-instagram`) para evitar costos de Vercel Functions:

- **Next.js route** (`/api/v1/sync/instagram`) actúa como thin proxy: autentica al usuario y delega el trabajo pesado a la Edge Function via `supabase.functions.invoke()`.
- **Edge Function** (`supabase/functions/sync-instagram/index.ts`) ejecuta todo el sync: media fetch, insights, ads, benchmarks, account insights y enriquecimiento de duración.
- **Autenticación**: header `x-sync-secret` valida que la llamada viene del proxy autorizado.
- **Costo**: $0 (Supabase incluye 500K invocaciones/mes gratis).
- **Secrets requeridos en Supabase**: `SYNC_SECRET`, `META_TOKENS_ENCRYPTION_KEY`, `APIFY_API_TOKEN`.
- Los archivos en `src/services/` (instagram-sync, ads-sync, ig-account-sync, reel-benchmarks) quedan como referencia pero ya no se invocan directamente.

## Notas Técnicas de Métricas
- Para Reel media insights, Meta sí expone `views`, `reach`, `likes`, `comments`, `shares`, `saved`, `total_interactions`, `ig_reels_avg_watch_time` e `ig_reels_video_view_total_time`.
- Para Reel media insights, Meta no expone `profile_visits`, `follows` ni `profile_activity`; cuando no existan fuentes alternativas, la UI debe mostrarlos como no disponibles y no como `0` falso.
- Para `/{ig-media-id}/insights`, los períodos admitidos por la documentación actual son `day`, `week`, `days_28`, `month`, `lifetime` y `total_over_range`, aunque para media insights Meta suele devolver/operar en `lifetime`.
- Los breakdowns válidos documentados para media insights son `action_type` sobre `profile_activity` y `story_navigation_action_type` sobre `navigation`; pedir breakdowns sobre métricas no compatibles devuelve error.
- En `/{ig-media-id}/insights`, `impressions`, `plays`, `clips_replays_count`, `ig_reels_aggregated_all_plays_count` y `video_views` deben tratarse como deprecated; `impressions` además puede fallar para contenido creado después del 2024-07-02.
- El skill `docs/skills/meta-api-expert.md` documenta además `video_insights`, pero esa superficie aplica a **Facebook Page videos / Page reels**; no reemplaza el endpoint actual `/{ig-media-id}/insights` de Instagram Platform.
- Para Ads, Arko usa Marketing API con `impressions`, `reach`, `spend`, `video_play_actions`, `inline_link_clicks`, `outbound_clicks` y cuartiles de video (`video_p25/p50/p75/p95/p100_watched_actions`) cuando estén disponibles.
- `paid_clicks` se calcula priorizando `outbound_clicks`, luego `inline_link_clicks`, y recién después el `clicks` genérico de Ads Insights para que `CTR` y `CPV` reflejen mejor intención de tráfico.
- La ficha del Reel deriva `watch_time_total`, `engagement_rate`, `paid_ctr`, `paid_cpm`, `paid_cpv` y `views_per_reach` a partir de métricas reales almacenadas.
- **Retención estimada:** `retention_rate = min(100, avg_watch_time / duration * 100)`. Requiere `ig_reels_avg_watch_time` (Meta) + `duration` (Apify). Si no hay duración, queda `null`.
- **View rate (+3s) y skip rate NO son calculables** desde la API de Meta. Instagram mide internamente qué porcentaje de viewers pasa los 3 primeros segundos usando la curva de retención real (por viewer). La fórmula `avg_watch_time / 3` es matemáticamente incorrecta porque el promedio no indica distribución: un avg de 18s no significa que el 100% vio >3s.
- La duración del Reel (`duration_seconds`) se obtiene de Apify (`videoDuration`) porque Meta no la expone en el media object ni en insights.
- **Impresiones conocidas:** si `impressions_org` no está disponible desde Meta, la ficha no debe mostrar `0` como si fuera dato real. Debe mostrar el total conocido (paid si existe) o `—` con nota aclaratoria de que Meta no expone impresiones orgánicas para todos los Reels.
- Las visualizaciones de la ficha no deben usar barras ambiguas "relativas al mayor número" cuando no existe denominador de negocio; en esos casos se muestran valores absolutos, y las barras quedan reservadas para relaciones explícitas tipo `x de y`.
- El benchmark 90d se calcula **solo con `views_org`** (ads no entran ni al numerador ni al promedio). Se guardan 3 promedios en `reel_benchmarks.avg_views_by_type`: `normal` (excluye `trial_likely`), `trial` (solo trials), `all` (todos). La UI elige cuál usar según el filtro de tipo activo:
  - Filtro `Reel` (default) → compara contra `avg_views_by_type.normal`
  - Filtro `Trial reel` → compara contra `avg_views_by_type.trial` (evita que todos los trials caigan en ~0.2x al compararse contra normales)
  - Filtro `Todos` → compara contra `avg_views_by_type.all`
- Las métricas derivadas (`avg_engagement_rate`, `avg_retention_rate`, `avg_likes_per_view`, etc.) se siguen calculando únicamente con Reels `normal` (excluyendo trials) porque trials distorsionan esas ratios.
- La ficha no debe recalcular ese benchmark en cada apertura: consume el snapshot más reciente persistido en `reel_benchmarks` para mantener tiempos de respuesta bajos.
- `reel_benchmarks` se recalcula por `workspace` al finalizar cada sync de media (`/api/v1/sync/instagram` con `steps=all|media`), por lo que desde el **primer sync** ya debe existir un snapshot base de promedios de la cuenta para las fichas y vistas agregadas.
- El benchmark es **propio de la cuenta/workspace**, no global de Arko: usa únicamente los Reels del usuario dentro de la ventana móvil de 90 días y se actualiza en background cada vez que el usuario vuelve a sincronizar.
- Si no existe snapshot 90d usable en `reel_benchmarks`, la UI no debe renderizar promedios `0.00%` ni dobles barras falsas: debe mostrar estado vacío explícito de "sin benchmark".
- El split orgánico/pagado solo debe renderizarse cuando existan métricas paid reales para ese Reel. Si no hay split usable, la UI debe evitar mostrar `100% orgánico` como barra comparativa porque comunica una precisión que no aporta.
- La visualización actual de retención usa `retention_rate` derivado de `avg_watch_time` + duración de Apify. No es curva real por segundo; se presenta explícitamente como estimación. No se muestran view rate (+3s) ni skip rate porque no son calculables sin la curva interna de Instagram.
- Si falta `duration_seconds` o `avg_watch_time_sec`, la sección de retención debe degradar a estado explicativo y no dibujar barras parciales que aparenten completitud.
- La ruta interna `/meta` funciona como sandbox/debugger de Meta Graph API: usa la conexión activa real guardada en `meta_connections`, expone `ig_account_id`, `ig_username`, `page_id` y devuelve JSON crudo para validar fields/metrics reales antes de tocar sync o UI.
- La integración con Apify no reemplaza métricas oficiales de Meta: agrega transcript público, play count, view count, shares públicas, hashtags, mentions, audio, tagged users y últimos comentarios cuando el Reel es público.
- La duración del Reel se obtiene de Apify **durante el sync**, no al abrir la ficha. Esto evita bloquear la página 10-15s esperando Apify. El sync enriquece hasta 5 reels sin duración por ejecución, persistiendo en `reels.duration_seconds`. Si un reel no tiene duración aún, la retención se muestra como "—".
- La navegación entre `/instagram` y `/instagram/[id]` debe privilegiar el router cache del App Router: la grilla hace `prefetch` explícito del detail en hover/focus y la ficha vuelve con `router.back()` cuando viene desde la grilla. Solo se hace `push('/instagram')` como fallback.
- La resolución de `workspace_id` no debe repetirse por página: el middleware cachea `arko_workspace_id` en cookie y los server components leen `getWorkspaceId()` para evitar una query extra en cada render.
- Los datos adicionales de Apify (transcript, hashtags, mentions, comentarios públicos) siguen siendo complementarios y no bloquean el render.
- El endpoint de ArkoAI persiste el resultado estructurado en las tablas analíticas existentes del Reel para que la UI pueda rehidratar el análisis en futuras aperturas sin repetir el `generateContent`.
- `APIFY_API_TOKEN` debe guardarse como token raw `apify_api_...`; si se pega una URL completa del endpoint, Arko extrae automáticamente el `token=`. Si la credencial es inválida, la ficha degrada a `null` sin romper la página.

### 5. Navegación por Tabs
- La ruta `/instagram` ahora soporta navegación por tabs usando `searchParams`: `?tab=dashboard` (default), `?tab=reels`, `?tab=posts`, `?tab=metrics`.
- El componente `InstagramTabs` (client) lee y escribe `?tab=` preservando el resto de parámetros como `?days=`.
- `PeriodFilter` preserva `?tab=` al cambiar el período temporal.
- Tab "Dashboard" es la vista principal con panel unificado (rendimiento, conversión, crecimiento, desglose orgánico/pagado, interacciones, mejor reel, reels recientes).
- Tab "Demografía" (ex "IG Metrics") muestra evolución temporal y datos demográficos de audiencia.

### 6. Posts (Imágenes / Carousels)
- El sync ahora trae ALL media types de la cuenta IG (no solo REELS), incluyendo `IMAGE` y `CAROUSEL_ALBUM`.
- Los posts se almacenan en la misma tabla `reels` (que funciona como tabla genérica `ig_media`) diferenciados por `media_product_type`.
- Las métricas de posts usan `impressions`, `reach`, `likes`, `comments`, `shares`, `saved` del endpoint `/{ig-media-id}/insights`.
- La tab "Posts" muestra un grid visual con thumbnails, caption, métricas de engagement y fecha.
- La tab "Todos" muestra Reels + Posts juntos.

### 7. IG Metrics (Dashboard de Cuenta)
 - Dashboard de métricas a nivel de cuenta similar a Metricool, usando datos reales del endpoint `GET /{ig-user-id}/insights`.
 - Métricas diarias: impressions, reach, profile_views, follower_count, accounts_engaged, likes, comments, shares, saves, replies, website_clicks.
 - Demografía lifetime: audience_gender_age, audience_city, audience_country, audience_locale.
 - KPIs agregados: impresiones totales, alcance promedio/día, interacciones, engagement rate, seguidores, crecimiento neto.
 - Gráficos: evolución general (AreaChart), balance de seguidores (BarChart), distribución de género (PieChart), edad (BarChart), países (PieChart), ciudades (tabla).
 - Requiere scopes `instagram_basic` + `instagram_manage_insights`.
 - En la versión actual del Graph API, estas métricas de cuenta deben consultarse con `metric_type=total_value`; la sincronización de la tab `IG Metrics` ejecuta solo account insights para evitar re-sync completo de media en cada refresh manual.
 - Para evitar falsos “bajones” del último punto, la UI excluye el día actual parcial y renderiza `metric_date` en formato seguro para UTC, evitando corrimientos de fecha por timezone local.
 - Mientras Meta siga devolviendo `follower_count` con semántica diaria/no acumulada en este flujo, la sección Comunidad lo presenta como captación diaria de seguidores y no como total histórico de followers.

### 8. Estado de conexión Meta / Instagram
 - A nivel de experiencia de usuario, Arko debe tratar la conexión como binaria: **conectada** solo cuando `meta_connections.status = active`; cualquier otro estado se considera **no conectada** y debe ofrecer reintento del login.
 - El estado `pending` puede existir internamente durante el inicio del OAuth, pero no debe bloquear al usuario ni presentarse como una conexión usable en Settings u Onboarding.
 - Si el callback de Meta falla, el usuario cancela el login o no existe una cuenta de Instagram Business válida, Arko debe persistir `status = error`, guardar `last_error` y redirigir nuevamente a `/onboarding` con opción de reintento.
 - Settings debe mostrar CTA de reconexión para cualquier conexión no activa, aunque exista una fila previa en `meta_connections`.
 - Settings debe permitir además **desconectar** manualmente la cuenta activa. La desconexión debe limpiar tokens y datos sensibles guardados en `meta_connections`, cambiar el estado a `revoked` y dejar visible el CTA para volver a conectar cuando el usuario quiera.

### 9. Primera sincronización automática
- Cuando un usuario conecta Instagram exitosamente por primera vez, Arko debe iniciar automáticamente un `full_sync` sin requerir click manual en el botón `Sincronizar`.
- El callback exitoso de Meta debe redirigir a una pantalla intermedia de bootstrap (`/instagram/bootstrap`) en vez de llevar al usuario directo a una grilla vacía.
- Esa pantalla debe disparar `POST /api/v1/sync/instagram?workspace_id=...` automáticamente, mostrar loaders, etapas percibidas y textos claros de qué está haciendo el sistema mientras se procesan los últimos 90 días.
- Al terminar la sincronización inicial, la UI debe redirigir automáticamente a `/instagram` ya con datos reales cargados.
- Si la sincronización inicial falla, la pantalla de bootstrap debe mostrar el error y ofrecer reintento sin obligar al usuario a navegar manualmente por la app.

### 10. Performance de sincronización (v2)
- **Insights en paralelo:** las métricas de cada media item se fetchean con concurrencia controlada (`META_INSIGHTS_CONCURRENCY=5`) en vez de secuencial. Esto reduce la fase de insights de ~120s a ~25-40s para 50 items.
- **Apify en paralelo:** el enriquecimiento de duración vía Apify corre con `APIFY_CONCURRENCY=3` y un límite de `MAX_DURATION_ENRICHMENTS=10` por sync. Antes era secuencial con límite de 5.
- **Ads + Account en paralelo:** después de terminar el sync de media, Ads sync y Account insights corren simultáneamente en vez de secuencialmente. Esto ahorra el tiempo total del más corto de los dos.
- **Límite de insights subido:** `MAX_INSIGHTS_PER_SYNC` pasó de 30 a 50 para cubrir más media en la primera sync sin requerir múltiples pasadas.
- **Benchmark al final:** el refresh de `reel_benchmarks` corre después de que media+ads terminaron para incluir datos paid en el snapshot.
- **Utilidad de concurrencia:** `src/lib/concurrency.ts` provee `runConcurrent()` con worker pool controlado, usado por insights y Apify.

### 11. Sincronización automática en segundo plano (pg_cron)
- Arko sincroniza métricas automáticamente **cada 6 horas** sin intervención del usuario, usando `pg_cron` + `pg_net` dentro de Supabase.
- La función `trigger_scheduled_sync()` en Postgres itera todos los workspaces con conexión Meta activa y dispara un `POST` HTTP directo a la Edge Function `sync-instagram` con `steps=all`.
- **No depende de Vercel** — corre 100% dentro de Supabase (más confiable, gratis).
- El `SYNC_SECRET` se almacena en Supabase Vault (`vault.decrypted_secrets`).
- Schedule: `0 */6 * * *` (00:00, 06:00, 12:00, 18:00 UTC).
- Para probar manualmente: `SELECT public.trigger_scheduled_sync();` desde SQL Editor.
- Para ver el estado del cron: `SELECT * FROM cron.job;`
- Para ver ejecuciones pasadas: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`
- Migración: `20260324000014_pg_cron_scheduled_sync.sql`.

### 12. Métricas diarias por reel (reel_metrics_daily)
- Nueva tabla `reel_metrics_daily` almacena un snapshot de métricas por reel por día (UPSERT con UNIQUE(reel_id, metric_date)).
- Se ejecuta automáticamente al final de cada sync de media (`snapshotDailyMetrics`).
- Permite gráficas de evolución temporal: views, likes, saves, comments por reel a lo largo del tiempo.
- Incluye métricas orgánicas y pagas en cada snapshot.
- Diseñada para escalar a 100+ usuarios × 75+ reels × 365 días (~2.7M filas/año).
- Índices compuestos: `(workspace_id, metric_date DESC)` para queries de dashboard, `(reel_id, metric_date DESC)` para charts per-reel.

### 13. Dashboard unificado
- La vista principal de `/instagram` (tab "Dashboard") muestra un panel tipo control room con:
  - **Rendimiento de visitas:** AreaChart con impresiones y alcance diarios + trend vs período anterior.
  - **Conversión de perfil:** tasa de conversión profile_views → followers.
  - **Crecimiento de perfil:** total de seguidores + ganados en el período.
  - **Desglose orgánico/pagado:** PieChart con distribución de views orgánicas vs pagas.
  - **Interacciones clave:** likes, comentarios, guardados, compartidos del período.
  - **Mejor Reel:** thumbnail + métricas del top performer.
  - **Reels recientes:** strip horizontal con thumbnails y views.
- Componente: `IGDashboard.tsx` (client, Recharts).
- Datos: combina `ig_account_insights` (daily) + `reels` + `reel_metrics` + `reel_metrics_paid`.

### 14. Quick Sync + Auto-Polling + Data Decay (v4)
- **Data Decay**: Los insights se refrescan según la antigüedad del reel:
  - **Hot** (< 7 días): cada 1 hora
  - **Warm** (7-30 días): cada 24 horas
  - **Cold** (> 30 días): cada 7 días
  - Esto reduce los insight calls de ~30 a ~8-15 por full sync (elimina timeouts).
- **Quick Sync**: `steps=quick` trae los últimos 12 media + insights solo de reels que lo necesitan según data decay (~3-5s). `router.refresh()` soft en vez de full page reload.
- **Background Progress**: Después del quick sync, el full sync corre en background. `useSyncJobProgress` hook pollea `/api/v1/sync/status` cada 4s. Muestra barra de progreso con porcentaje real (`sync_jobs.processed_items / total_items`). Auto-refresh al completar.
- **Check New Media**: `steps=check` compara últimos 5 IDs (~1-2s). `useNewContentPolling` cada 3 min.
- **Progreso Incremental**: El full sync actualiza `sync_jobs.processed_items` después de cada batch de 5 insights.
- Componentes: `SyncControls.tsx` (SyncButton + polling badge + progress bar), `useSyncJobProgress.ts`.

## Ruta
 `/instagram` con tabs: `?tab=dashboard` (default) | `?tab=reels` | `?tab=posts` | `?tab=metrics` (demografía)

## Seguidores: arquitectura de "total real diario" (en migración)

**Problema:** Meta solo entrega el total de seguidores de HOY (`followers_count` del perfil) + deltas diarios de ~30 días (`follower_count` insight). El histórico de totales NO existe en la API. Por eso el sync **reconstruía** `followers_total` hacia atrás (resta encadenada de deltas anclada al total de hoy, `sync-instagram/index.ts:994-1065`). Esa reconstrucción es frágil: un delta anómalo (ej. una cuenta suspendida y reactivada hace que Meta reporte +6615 en un día) deforma toda la curva.

**Arquitectura objetivo (estilo Metricool, ya probada en competidores):** guardar el total REAL del perfil como snapshot diario y calcular "nuevos por día" como resta `followers_total[hoy] − [ayer]`. Es exactamente lo que hace `competitor_follower_snapshots` (1 fila/día, total real, upsert idempotente por fecha) — ver `src/services/competitor-scraper.service.ts:523-533`.

**Estado de la migración:**
- ✅ **Fase 1-2 (lectura):** el gráfico de "nuevos por día" del dashboard usa `dailyNewFromTotals` (resta de totales reales, `src/lib/follower-metrics.ts`). La curva de total (IGMetrics) lee `followers_total` directo. El helper `follower-metrics.ts` sanea outliers como red de seguridad para el histórico viejo reconstruido y glitches en vivo.
- ⬜ **Fase 3 (escritor, pendiente — toca edge Deno):** en `sync-instagram/index.ts`, eliminar el bloque de reconstrucción (`:994-1065`), quitar `ftPayload` del loop por-día (`:1069-1093`) y mantener solo el upsert del snapshot real de hoy (`:1095-1103`, que ya guarda `profileData.followers_count`). Resultado: cada día se captura el total real, una fila por día (`onConflict workspace_id,metric_date`, el cron de cada 6h pisa con el valor más reciente). El histórico viejo NO se puede des-reconstruir (límite de Meta) → queda como la mejor reconstrucción posible, cubierto por el saneo de lectura, y sale de la ventana visible a medida que se acumulan capturas reales. Requiere redeploy con `--no-verify-jwt`, Dev-first.
- ⬜ **Fase 4 (opcional):** UPDATE quirúrgico de los días-valle ya persistidos (ej. ac331157 2026-05-27) solo si un cliente nota el escalón pese al saneo de lectura. DML acotado, sin DDL.
