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
- El benchmark 90d de la ficha excluye Reels con `reel_type = trial_likely` y calcula ratios contra `views_total` (`views_org + views_paid`) para comparar con la misma base que ve el usuario en pantalla.
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
- La ruta `/instagram` ahora soporta navegación por tabs usando `searchParams`: `?tab=reels` (default), `?tab=posts`, `?tab=all`, `?tab=metrics`.
- El componente `InstagramTabs` (client) lee y escribe `?tab=` preservando el resto de parámetros como `?days=`.
- `PeriodFilter` preserva `?tab=` al cambiar el período temporal.

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

### 11. Sincronización automática en segundo plano (background sync)
- En producción, Arko sincroniza métricas automáticamente cada 6 horas sin intervención del usuario, usando Vercel Cron.
- El endpoint `GET /api/v1/sync/cron` itera todos los workspaces con conexión Meta activa y ejecuta un full sync (media + ads + account + benchmark) para cada uno.
- El cron está protegido por `CRON_SECRET` (header `Authorization: Bearer <secret>`). Sin esta variable, el endpoint retorna noop.
- La frecuencia de 4 veces/día (cada 6h) mantiene los dashboards frescos sin exceder rate limits de Meta.
- Configurado en `vercel.json` con schedule `0 */6 * * *`.
- En local/dev el cron no corre automáticamente. Se puede probar manualmente enviando el header correcto.
- Variable de entorno: `CRON_SECRET` (opcional, solo producción). Generar con `openssl rand -hex 32`.

## Ruta
 `/instagram` con tabs: `?tab=reels` | `?tab=posts` | `?tab=all` | `?tab=metrics`
