# Changelog — Arko
 
> Formato: [Semantic Versioning](https://semver.org/)
> Cada entrada incluye: fecha, tipo, archivos afectados, request original.
 
---

## [unreleased] — 2026-06-03

### Perf — Contenido sin 10s de skeleton (Suspense streaming) + portadas que ya no cargan "de a 2-3" (re-host + getClaims)

Diagnóstico (workflow multi-agente Opus): con los `loading.tsx` ya puestos, el skeleton aparecía al instante pero el **contenido tardaba ~10s** y las **portadas cargaban de a 2-3** con 502 intermitente. Dos causas raíz, atacadas de raíz (sin parches):

**1) Los 10s de skeleton — el page `await`-eaba TODA la data de TODAS las tabs antes de pintar.**
La IG page fetcheaba competencia (embed de 3 niveles: 50 reels × 12 campos de texto AI × 90 snapshots por competidor — la query más cara de la pantalla) + referencias + `reference_reel_analysis` (3er await secuencial), todo en el critical path, aunque la tab default es **reels**. Ahora:
- **Competencia y referencias streamean via `<Suspense>`**: `CompetitorsLoader` / `ReferencesLoader` (Server Components async) cargan su data pesada FUERA del critical path y llegan como slots a `InstagramShell`. La tab reels pinta apenas terminan SUS queries; el resto llega por detrás sin bloquear.
- **`auth.getUser()` → `auth.getClaims()`** en middleware (round-trip de red en CADA request, ANTES del streaming) + Header + admin layout + fallback de `getWorkspaceId`. getClaims valida el JWT **localmente** (ES256 via JWKS) → saca ~0.2-0.6s del piso de cada render y descomprime el cap de 10 conexiones del Auth server bajo concurrencia. Fallback a `getUser()` si no hay claims (nadie queda afuera por un edge case).

**2) Portadas "de a 2-3" + 502 — los reels propios pasaban por el optimizer de `next/image` con URLs efímeras de Meta.**
Cada `/_next/image?url=scontent...` re-bajaba la imagen de Meta + re-encodeaba (1 invocación serverless por portada, serializadas por el cap de ~6 conexiones del browser) y devolvía **502** cuando la URL firmada de scontent ya había expirado (los reels nunca se re-hosteaban, a diferencia de las historias). Ahora:
- **Re-host de thumbnails de reels a Storage** (`reel-media`, bucket privado nuevo): el sync replica `archiveStoryMedia` (`archiveReelThumbnails`, 50 por sync, backfill gradual). El page los sirve **storage-first** (signed URLs batch, URL estable que no expira, sin re-fetch a Meta) con fallback al thumbnail crudo mientras se re-hostea.
- **Componente `ReelThumbnail`** (`<img>` + `onError` + `priority` en la primera fila, fuera del optimizer) reemplaza a `next/image` en ReelsGrid, PublicacionesGrid e IGDashboard. Mata el goteo y el 502; cae a placeholder en vez de hueco roto.
- **Dashboard**: reels storage-first (RecentReelsStrip + thumbnails de ventas).
- **`next.config`**: `minimumCacheTTL` 24h + `formats: webp` + hostname `**.fbcdn.net` (competencia).

**Pendiente (follow-up):** partición `<Suspense>` de la dashboard home (refactor del `getDashboardData` monolítico con agregados cruzados — el getClaims + queries paralelas ya bajan su tiempo); migrar StoriesGrid + PostDetailView a `ReelThumbnail`.

#### DB (Dev + Prod)
- Migración `20260603000000_create_reel_media_bucket` — bucket privado `reel-media` + policy `workspace_members_read_reel_media` (espejo de story-media). La columna `reels.media_storage_path` ya existía.

#### Archivos
- `src/lib/supabase/auth-claims.ts` (nuevo) — `getAuthUser()` con getClaims + fallback getUser; usado en `middleware.ts`, `Header.tsx`, `(admin)/layout.tsx`, `lib/workspace.ts`.
- `supabase/functions/sync-instagram/index.ts` — `archiveReelThumbnails` (Phase 5, try/catch, nunca rompe el sync). **Deployado a Prod con `--no-verify-jwt`.**
- `src/components/instagram/ReelThumbnail.tsx` (nuevo), `CompetitorsLoader.tsx` (nuevo), `ReferencesLoader.tsx` (nuevo).
- `src/components/instagram/InstagramShell.tsx` — slots streameados (competenciaSlot/referenciasSlot) en vez de data pesada inline.
- `src/app/(dashboard)/instagram/page.tsx` — competencia/referencias fuera del Promise.all + reels storage-first.
- `src/app/(dashboard)/page.tsx` — reels storage-first.
- `src/components/instagram/ReelsGrid.tsx`, `PublicacionesGrid.tsx`, `IGDashboard.tsx` — `ReelThumbnail` (fuera del optimizer).
- `next.config.ts` — cache + webp + fbcdn.

### Perf/UX — Navegación más veloz: skeletons instantáneos + feedback de click + prefetch

Diagnóstico (workflow multi-agente Opus): la lentitud de navegación NO es la DB (queries 5-15ms por EXPLAIN), es la capa de app. Esta tanda ataca lo de **menor riesgo / mayor impacto percibido**:
- **`loading.tsx` faltantes** en `/ventas` y `/meta` → antes Next esperaba el RSC entero (queries) antes de pintar = "6s en blanco TOTAL"; ahora skeleton al instante.
- **NavProgressBar visible**: era una barra blanca de 2px **invisible en tema light** → ahora `h-[3px]` + color por tema. Da **feedback inmediato al click** (clave para que no se sienta "muerto" y no haga falta doble-click).
- **Sidebar**: `router.prefetch(href)` en `onMouseEnter` (destino caliente → 1er click navega rápido) + `cursor-pointer`.

**Pendiente (mayor impacto, más delicado, PR propio):** sacar `auth.getUser()` del middleware (round-trip de red en CADA request, ANTES del streaming del skeleton) → `getClaims()` (valida el JWT local). Es la causa raíz del residual del "6s".

#### Archivos
- `src/app/(dashboard)/ventas/loading.tsx`, `src/app/(dashboard)/meta/loading.tsx` (nuevos).
- `src/components/layout/NavigationProvider.tsx` — barra de progreso visible por tema (h-[3px]).
- `src/components/layout/Sidebar.tsx` — `router.prefetch` en hover + `cursor-pointer`.

### Fix — Competencia + Referencias: el scrape ya no tira "Unexpected token 'A'... is not valid JSON"

`POST /competitors/[id]/scrape` corría TODO sincrónico (~120s) → el gateway de Vercel cortaba la respuesta con un **504 en texto plano** ("An error occurred...") y el cliente crasheaba al hacer `res.json()` → `Unexpected token 'A'... is not valid JSON`, **aunque el scrape sí hubiera arrancado** (Apify corría igual). Ahora:
- El route **responde al instante** y corre scrape + analyze en `after()` (fire-and-forget); `maxDuration` 120→300 para cubrir ambos.
- El **analyze se encadena server-side** (antes lo disparaba el cliente con un 2º fetch → si el cliente se caía/timeouteaba, el análisis no corría).
- El cliente **solo dispara + pollea** `scrape_progress`/`analysis_status`; lee la respuesta como **texto** (nunca crashea con `.json()` sobre un 504). El progreso en vivo ya existía.

**Mismo bug en Referencias:** `ReferencesTab` hacía `res.json()` antes de chequear `res.ok` en scrape/analyze/analyze-all → mismo crash si el route (Apify/Gemini) timeouteaba. Ahora parsea seguro (texto + try-parse). El scrape de referencias es más liviano (12 reels) → se mantiene sincrónico; el guard cubre el 504 raro.

#### Archivos
- `src/app/api/v1/competitors/[id]/scrape/route.ts` — fire-and-forget + analyze encadenado en `after()`.
- `src/components/instagram/CompetitorTab.tsx` — kickoff + poll, parseo seguro (sin `.json()` fatal).
- `src/components/instagram/ReferencesTab.tsx` — parseo seguro en scrape/analyze/analyze-all.

### Fix — Sync IG: snapshot diario completo en cuentas grandes (F2.5-5 Tanda 0)

`snapshotDailyMetrics` traía los reels con un `.select()` sin paginar → PostgREST lo capaba a 1000 filas (orden UUID random) → en cuentas grandes el time-series diario cubría solo ~34% de los reels (PROVIDA: 1000 de 2971). Ahora **pagina por rangos** → cobertura completa. Verificado en vivo: PROVIDA pasó de **1000 → 2921** filas de snapshot hoy.

#### Archivos
- `supabase/functions/sync-instagram/index.ts` — `snapshotDailyMetrics` pagina el SELECT de reels por rangos de 1000 (mismo patrón que el lookup de incremental).

### Perf/UX — Sync IG: recompensa rápida (primera página en ~4s + "Listo")

**Lo que se pidió:** al sincronizar, que la primera página de reels se dibuje y marque "Listo" en 3-4s, y el resto siga por detrás.

**Antes:** el botón esperaba el full sync entero (~30-50s) para marcar "Listo" + hacía `router.refresh()` **cada 4s** → **~228 requests por sync** (re-bajaba toda la página RSC + re-disparaba los prefetch del sidebar).

**Ahora:** click → `quick` sync (primeros 12 reels + métricas, **medido 4.1s**) → pinta la primera página + "Listo" → el RESTO (todos los reels + account + stories) corre en segundo plano fire-and-forget, sin tracking ni refresh en loop (adiós storm de 228 requests). **`ads` va último** (no se usa en vistas en tiempo real). Apify queda en el background, no bloquea el quick.

#### Archivos
- `supabase/functions/sync-instagram/index.ts` — `handleQuickSync` sin stories/carousel-children (quick lean ~4s; eso va al full de fondo).
- `src/app/api/v1/sync/instagram/route.ts` — cadena de fondo con `ads` último (`reels→account→stories→ads`).
- `src/components/instagram/SyncButton.tsx` — quick pinta + "Listo", resto fire-and-forget (sin hook/tracking/refresh-loop).

**Pendiente:** la vista de métricas (`account`) todavía tarda ~28s (30 llamadas serial a Meta); su recompensa rápida necesita colapsar esas llamadas (optimización aparte).

### Perf — Sync IG: fetch incremental + fix del cuello de botella Apify (F2.5-5)

**Apify (el cuello de botella REAL, medido en vivo):** el enrichment de duración de videos corría **secuencial** con timeout de 30s → cuando Apify falla/tarda (Franco: 4 de 5 reels timeouteando) dominaba el sync con ~120s de espera. Ahora corre **en paralelo** (5 a la vez) + timeout 30s→15s. **Franco: 124.7s → 31.2s.**

**Fetch incremental:** el sync re-bajaba TODO el historial de media cada vez (~90s en cuentas grandes) aunque lo nuevo fueran 2 reels. Ahora **corta la paginación** al llegar a media ya conocida (Meta devuelve newest-first). Los reels viejos refrescan insights vía selección **desde la DB** (decay), no por el fetch. **PROVIDA (2970 reels): 155s → 16.5s** (corta tras 1 página, refresca 30 insights, 0 pérdida).

**Gotcha resuelto:** el lookup de reels conocidos venía capado a 1000 filas (`db-max-rows` de PostgREST) con orden UUID random → en cuentas >1000 reels el corte no disparaba y faltaba cobertura de insights. Se **pagina el lookup** por rangos para traer todos + backstop de páginas. (Lo destapó el test en PROVIDA — por eso se prueba en cuentas grandes.)

Paridad verificada en vivo (ac331157, Franco, PROVIDA): mismo conteo de reels, insights refrescados, 0 errores. `snapshotDailyMetrics` intacto (ya leía de la DB).

#### Archivos
- `supabase/functions/sync-instagram/index.ts` — `fetchAllMedia` con corte incremental (`onPage`→boolean); `existingReels` paginado (chunks de 1000); selección de insights desde la DB por decay; Apify enrichment en paralelo + timeout 15s.

### Perf — Sync IG: particionar el cron para eliminar timeouts del edge (F2.5-5 Phase 0)

**Problema (verificado en Prod, `sync_jobs` últimos 7d):** el cron `sync-instagram-all` mandaba UNA invocación `steps=all` que corría account + reels + ads en el mismo edge (~150s de límite). En cuentas grandes, reels (p95 120.9s) + ads (p95 104.9s) superan los 150s → el edge muere, el `sync_job` queda en `running` y el watchdog lo marca `failed` a los 30 min. Resultado: `full_sync` 46% de fallo (Franco 25, PROVIDA 19 por timeout), `ads_insights` 35%.

**Fix:** el cron ahora dispara invocaciones SEPARADAS por step (`account` / `reels` / `ads`), cada una con su propio budget de ~150s — el mismo patrón que el botón ya usa via `after()`. Rollout por **canary**: arranca con un solo workspace (ac331157) y se hace ramp agregando IDs al array `canary_ws` del trigger.

**Colateral:** los 2 triggers de IG (`trigger_scheduled_sync`, `trigger_scheduled_stories_sync`) usan URL dinámica (`current_setting('app.settings.supabase_project_ref')`) en vez de hardcodear el ref de Prod — antes, en Dev disparaban el edge de PROD.

**No incluido (Phase 0 quirúrgica, va después detrás de flag + paridad):** migración a `metaFetch` (retry/backoff), doble-fetch 90d de ads, colapso de account 30→1 llamada. La conexión rota de Nacho (`object does not exist`, 100% de fallo) es un bug separado de re-auth, no de timeout.

#### Archivos
- `supabase/functions/sync-instagram/index.ts` — nuevo step `reels` (reels + benchmark, sin ads); ads solo en `all`/`media`. Aditivo: no cambia los paths existentes (botón y workspaces no-canary intactos).
- `supabase/migrations/20260602050000_partition_scheduled_ig_sync.sql` — `trigger_scheduled_sync` con split canary + URL dinámica; `trigger_scheduled_stories_sync` URL dinámica.

### Perf/UX — Sync IG streaming: la primera página de reels aparece en segundos (F2.5-5)

**Antes:** el full sync bajaba TODO el historial de media (`fetchAllMedia`, ~90s en cuentas grandes) y recién después escribía los reels → no se veía nada hasta el final.

**Ahora (streaming):** el edge escribe cada página de reels apenas la baja (newest-first) → los más nuevos aparecen en ~3-5s y el resto va llegando. NO cambia qué datos se traen (se siguen paginando todas las páginas para insights/snapshot), solo CUÁNDO se escriben → paridad verificada en vivo (ac331157: 111 reels antes/después, 111 thumbnails, 0 errores). El `SyncButton` ahora refresca cada 4s mientras el sync corre, así los reels aparecen solos.

**No incluido (va aparte, con canary + paridad):** el corte incremental (dejar de re-paginar el historial completo) — el ahorro de tiempo crudo. Toca la semántica del snapshot diario de reels viejos.

#### Archivos
- `supabase/functions/sync-instagram/index.ts` — `fetchAllMedia` con callback `onPage`; `syncInstagramReels` escribe por página (thumbnails + upsert + progreso) en vez de bajar-todo-y-después-escribir. Phase 2 (insights/Apify/snapshot/carruseles) intacto.
- `src/components/instagram/SyncButton.tsx` — check rápido (~1-2s) en vez de esperar el quick entero (~30s); dispara el full en background y refresca cada 4s (no bloquea). Orden por pestaña: reels-first en `reels`, account-first en `metrics`.
- `src/app/api/v1/sync/instagram/route.ts` — pasos granulares ordenados por vista (param `first`): `reels→account→ads→stories` o `account→reels→…` (consistente con el cron particionado).
- `src/hooks/useSyncJobProgress.ts` — guard `sawActive`: no corta el tracking con un `full_sync` completado de una corrida anterior.

### Fix — Seguidores: gráfico de "nuevos por día" por resta de totales reales + saneo de anomalías

**Arquitectura (estilo Metricool):** el gráfico de "nuevos seguidores por día" del dashboard ahora se calcula como **resta de totales reales** (`followers_total[hoy] − [ayer]`) en vez de confiar en el delta `follower_count` que Meta reporta. Robusto por diseño: si los totales son reales, la resta nunca produce un salto espurio. Es el mismo patrón que ya usa el módulo de competidores (`competitor_follower_snapshots`). Validado con datos reales: emanuelmdzz pasa de mostrar +6615 a un máximo de +68.

**Capa de lectura (red de seguridad):** helper `src/lib/follower-metrics.ts` que sanea outliers al mostrar, conservando los datos reales en la DB. Cubre el histórico viejo (que sigue siendo reconstruido) y glitches en vivo:
- Detecta el "valle" de suspensión (colapso + rebote) y lo excluye de diffs, curva y snapshot de total.
- Umbral adaptativo `max(500, 8 × mediana)` para clampear deltas anómalos donde aún se usa el delta crudo (IGDashboard).

**Pendiente (Fase 3, edge function):** dejar de reconstruir `followers_total` en `sync-instagram` y guardar solo el total real diario. Eso completa la migración para que el histórico futuro se capture perfecto. Requiere redeploy Deno con `--no-verify-jwt`, Dev-first.

**Alcance del bug (verificado en Prod):** afectaba a 2 de 6 workspaces — emanuelmdzz (+6615 el 27/5) y un cliente (+30864 el 25/5). No es bug de sync: son datos reales anómalos que Meta devuelve tras suspensión/reactivación.

Aplicado en las superficies de seguidores: dashboard (gráfico de nuevos/día por resta + KPIs + total + mes), Header (snapshot), Instagram shell (snapshot), IGMetrics (curva de total), IGDashboard (deltas, con clamp del helper hasta la Fase 3). Cuentas sanas no se ven afectadas (regresión verificada). Diseño respaldado por recon multi-agente; plan completo en `docs/features/ig-intelligence.md`.

#### Archivos
- `src/lib/follower-metrics.ts` (nuevo) — helper: `dailyNewFromTotals` (resta de totales), detección de valle, umbral adaptativo. Lógica pura tipada.
- `src/app/(dashboard)/page.tsx` — gráfico de nuevos/día por resta de totales reales.
- `src/app/(dashboard)/instagram/page.tsx`, `src/components/layout/Header.tsx`, `src/components/instagram/IGMetrics.tsx`, `src/components/instagram/IGDashboard.tsx` — consumen el helper.

### Security — Hardening: policy en data_deletion_requests + search_path en funciones

Cierra dos clases de lint del advisor de Supabase, sin cambiar comportamiento:

- **`data_deletion_requests`** tenía RLS activada pero **sin ninguna policy** (lint INFO `rls_enabled_no_policy`). Se agregó una policy RESTRICTIVE que niega acceso a `anon`/`authenticated` (la tabla solo la usa la edge function de borrado vía `service_role`, que bypassa RLS).
- **~19 funciones** tenían `search_path` mutable (lint WARN `function_search_path_mutable`). Se les fijó `search_path`. Las que descifran tokens (`get_meta_access_token`, `get_google_*`, `save_*`) llevan `public, extensions, pg_temp` porque `pgcrypto` vive en `extensions` — sin eso se rompía el descifrado.

Verificado en Dev y Prod: los lints desaparecen y el descifrado de tokens sigue OK (probado contra las 6 conexiones Meta activas de Prod — ejecutan sin error).

**No incluido (a propósito):** el lint `security_definer_function_executable` (anon/authenticated pueden llamar estas funciones vía RPC). Revocar `EXECUTE` rompería el sync, porque `instagram-sync`, `ig-account-sync`, `ads-sync`, `meta/explorer` y `token-refresh` de Google llaman a `get_meta/google_*` con la sesión del usuario (rol `authenticated`), no con `service_role`. Cerrarlo requiere primero mover esas llamadas al admin client → queda como ítem de fase posterior (`docs/11`).

#### Archivos
- `supabase/migrations/20260602010000_harden_rls_and_function_search_path.sql` — aplicada en Dev `hrsvglgswatwklivkoyp` y Prod `zphvrohosizkbrnxtppj`.

---

## [unreleased] — 2026-06-02

### Security — `reel_computed` ahora es SECURITY INVOKER (fix de aislamiento por tenant)

La vista `public.reel_computed` corría como **SECURITY DEFINER** (permisos del creador), por lo que podía leer filas de `reels`/`reel_metrics` de cualquier workspace salteando la RLS. El advisor de Supabase lo marcaba como el único lint **nivel ERROR**.

Fix: `ALTER VIEW public.reel_computed SET (security_invoker = on)` — la vista ahora aplica la RLS del usuario que consulta.

- **Sin impacto en datos ni columnas.** Verificado en Dev y Prod: conteo de filas y suma de `views_total` idénticos antes/después (Prod: 6.079 reels / 6 workspaces / 9.188.868 views, sin cambios).
- Advisor de seguridad: **0 ERROR-level** tras el fix (antes 1).
- Reversible: `ALTER VIEW public.reel_computed SET (security_invoker = off)`.
- Parte de la Fase 0 del plan de auditoría (`docs/11-auditoria-y-plan-optimizacion.md`).

#### Archivos
- `supabase/migrations/20260602000000_reel_computed_security_invoker.sql` — la migración (aplicada en Dev `hrsvglgswatwklivkoyp` y Prod `zphvrohosizkbrnxtppj`).
- `docs/DB_SCHEMA.md` — nota sobre el modo de seguridad de la vista.

---

## [unreleased] — 2026-04-23

### Added — Ventas: botón editar en la tabla

En la fila de cada venta ahora aparece un ícono de lápiz (hover) junto al de eliminar. Abre el mismo SaleFormModal pero en **modo edición**:
- Pre-llena todos los campos desde la venta existente.
- Salta directo al step 2 (información editable).
- Permite modificar: monto total, cobrado, fecha, fuente/sub-label, cliente, notas, status.
- **No permite cambiar**: `payment_type`, `n_cuotas` ni la atribución (reel/historia). Si hace falta, eliminar y recrear. Los campos deshabilitados quedan marcados "(no editable)" para que el user lo vea.
- Submit hace `PATCH /api/sales/[id]` (el endpoint ya existía).

#### Archivos
- `src/components/sales/SaleForm.tsx` — prop `sale?: Sale`, `buildFormFromSale`, `isEditing` flag, PATCH vs POST.
- `src/components/sales/SaleFormModal.tsx` — forward del prop `sale`.
- `src/app/(dashboard)/ventas/VentasClient.tsx` — state `editingSale`, botón `Pencil`, modal de edición.

---

### Added — Ventas: nueva fuente "CTA Bio"

Sexta fuente de pago predeterminada: **CTA Bio** — el copy del bio que empuja a un recurso/DM, distinto del **Link en Bio** (click directo al enlace del perfil). El user pidió poder medirlas por separado en Top fuentes y en el breakdown de Ventas.

- `supabase/migrations/20260423000059_sales_source_type_cta_bio.sql` (NUEVO) — extiende CHECK constraint de `sales.source_type` para aceptar `cta_bio`. Aplicada en Prod + Dev.
- `src/components/sales/SaleForm.tsx` — agrega al type `SaleSourceType` + label "CTA Bio" + color ámbar (#F59E0B).
- `src/app/(dashboard)/ventas/VentasClient.tsx` — mismo mapping para renderizar en la tabla de ventas.
- `src/app/(dashboard)/page.tsx` — extendido `SOURCE_HEX/BG/ICON` (usa ícono `AtSign`). Al ser una fuente sin material asociado, queda excluido del ranking "Top fuentes de facturación" (mismo criterio que `link_bio` y `otro`).

---

### Fixed — Ventas: cuotas retroactivas marcan todas las cuotas como cobradas

Bug: al registrar una venta pasada con cuotas (ej. hace 3 meses, 5 cuotas ya cobradas en la realidad), el sistema solo marcaba paid las cuotas cuyo `due_date ≤ hoy` según el calendario teórico (sale_date + N×30d). Las cuotas "futuras" quedaban pending aunque el cliente ya las hubiera pagado.

**Fix:** si `sale_date < hoy`, asumir venta retroactiva → marcar TODAS las cuotas como paid. Si el user cargó mal (alguna cuota sí quedó pending), puede desmarcarla desde InstallmentsModal.

- `src/app/api/sales/route.ts` — lógica `isRetroactive` al generar cuotas.
- `src/components/sales/SaleForm.tsx` — preview muestra "{N}/{N} cuotas" cobradas + hint cuando es retroactiva.

---

### Fixed — Instagram reels: filtro de fechas cerraba mal el rango

Las queries de `/instagram` (reels, stories, posts) usaban `.gte(published_at)` sin `.lt` cerrando el extremo superior. Al elegir "mes anterior" o cualquier rango que terminara antes de hoy, la UI mostraba también los reels del mes actual. Queries en Prod confirman que el fix trae los 25 reels correctos de marzo cuando se filtra "mes anterior".

- `src/app/(dashboard)/instagram/page.tsx` — 3 queries con `.lt(published_at, nextDay(to))`.

---

### Improved — Competidores: ventana 30 días, progreso en vivo, trial detection

Rediseño del flujo de scrape + análisis para que la UX no sea una caja negra de 2-3 min:

- **Ventana fija de 30 días**: el scraper ahora pide reels publicados en los últimos 30 días (antes tomaba los top-50 sin importar cuándo se publicaron). Usa `onlyPostsNewerThan: "30 days"` en el actor + filtro defensivo post-fetch.
- **Progreso en vivo**: nueva columna `workspace_competitors.scrape_progress jsonb` que los endpoints `/scrape` y `/analyze` actualizan entre fases ("Bajando reels…", "Descargando portadas 12/47…", "Analizando 3/6…"). La UI pollea `GET /api/v1/competitors/[id]` cada 2s y muestra el mensaje dinámico en el botón en vez del texto fijo "Analizando…".
- **Análisis automático de 6 (antes 5)**: `analyzeCompetitorReels` sube el limit de top-views a 6 y emite progress per-reel.
- **Trial-reel detection (best effort)**: nuevo scrape paralelo del grid del perfil vía `apify~instagram-post-scraper`. Si un reel aparece en la tab `/reels/` pero NO en el grid del perfil → `competitor_reels.maybe_trial = true` (señal fuerte de Instagram "share to feed: off"). Si el actor del grid falla o no devuelve nada, la columna queda NULL y el resto del scrape sigue normal.
- **Orden por views en la lista global**: `GET /api/v1/competitors` ahora ordena los reels embebidos por `views_count` desc y sube el límite por competidor a 100 (antes 24).

#### Archivos
- `supabase/migrations/20260423000057_competitor_scrape_progress.sql` (NUEVO) — aplicada en Prod Arko.
- `src/services/competitor-scraper.service.ts` — progreso por fase, ventana 30d, scrape del grid para trials.
- `src/services/competitor-analysis.service.ts` — limit 5→6, emit progress por reel analizado.
- `src/app/api/v1/competitors/[id]/route.ts` (NUEVO) — endpoint liviano para polling.
- `src/app/api/v1/competitors/route.ts` — SELECT incluye `scrape_progress` + `maybe_trial`, orden por views, limit 100.
- `src/components/instagram/CompetitorTab.tsx` — polling cada 2s, botón con mensaje dinámico.

---

### Changed — Ventas: cuotas ahora piden fecha de la primera cuota (no monto upfront)

Simplificación del flujo de cuotas pedida por Francisco: el input **"Cobrado hasta hoy"** se elimina y se reemplaza por **"Fecha de la primera cuota"** (default: fecha de venta si la dejan vacía). Intervalo entre cuotas pasa de "mismo día del mes" a **+30 días exactos**. Las cuotas cuyo `due_date <= hoy` se marcan paid automáticamente al insertar — el efectivo recolectado se va sumando solo a medida que vencen las cuotas (ya lo hacía el cron diario; ahora también al crear).

#### Archivos
- `src/components/sales/SaleForm.tsx` — reemplaza input de "Cobrado hasta hoy" por date picker "Fecha de la primera cuota"; recalcula `amountCollected` preview según cuotas ya vencidas.
- `src/app/api/sales/route.ts` — acepta `first_installment_date` (default `sale_date`), genera cuotas cada 30 días, marca paid las que ya vencieron.
- `docs/features/sales.md` — decisiones y Auto-paid actualizados.

---

### Added — Competidores: watchdog pg_cron para auto-desbloquear scrapes stuck

Red de seguridad contra regresiones del bug de `analysis_status='analyzing'` pegado para siempre (ya arreglado en PR #59 a nivel código). Un pg_cron corre cada 10 min y libera cualquier row cuyo scrape haya pasado de los 10 min sin completarse (Vercel `maxDuration=120s`, así que cualquier cosa >10 min está muerta).

**Cómo distinguir scrapes legítimos en curso:** nueva columna `workspace_competitors.analysis_started_at` seteada por los endpoints `POST /competitors/[id]/scrape` y `POST /competitors/[id]/analyze` al iniciar, y limpiada al terminar. `last_scraped_at` no servía porque refleja el último scrape exitoso, no el intento actual.

**Cleanup ejecutado al aplicar:** 2 competidores stuck (`Max Inhouse`, `Nik Setting`) desbloqueados manualmente antes del deploy.

#### Archivos
- `supabase/migrations/20260423000056_competitor_analyzing_watchdog.sql` (NUEVO) — aplicada en Prod Arko.
- `src/app/api/v1/competitors/[id]/scrape/route.ts` — setea `analysis_started_at` al marcar analyzing; lo resetea en `resetStatus`.
- `src/app/api/v1/competitors/[id]/analyze/route.ts` — mismo patrón (endpoint también deja el status pegado si crashea).

---

### Improved — Competidores: +150% reels scrapeados + campos nuevos

- **Límite subido 20 → 50 reels** por scrape de competidor. Más data histórica para detectar patrones (hooks, estructura, temas recurrentes) sin cambiar de actor.
- **Nuevos campos** persistidos en `competitor_reels`:
  - `location_name` / `location_id` — ubicación taggeada (útil para creators con audiencia geo-específica).
  - `tagged_users` — array de @usernames mencionados en el reel (detecta colabs, partnerships).
  - `product_type` — feed / clips / igtv (distingue reel vs otras piezas).
  - `is_video` — flag booleano para filtrar rápido.
  - `maybe_trial` — columna preparada para heurística futura de detección de trial reels en competidores (hoy queda NULL). La detección de trials de cuentas ajenas **no es 100% posible** vía Apify porque Instagram no expone `is_shared_to_feed` públicamente; un scrape dual (grid + reels tab) + comparación por `short_code` daría ~70-80% precisión pero duplicaría el costo Apify.

**Tradeoff confirmado**: el scrape de cada competidor consume ~2.5× más compute units de Apify. El cron de `competitor-scraping` (4 AM UTC) sigue corriendo igual — solo tarda un poco más.

#### Archivos
- `supabase/migrations/20260423000055_competitor_reels_enrichment.sql` (NUEVO) — aplicada en Prod Arko.
- `src/services/competitor-scraper.service.ts` — MAX_REELS 20→50 + parseo de location/tagged_users/product_type/is_video.

---

### Added — Ventas: cuotas programadas con auto-paid

Cuando una venta tiene `payment_type='cuotas'`, el sistema genera automáticamente las cuotas programadas:

- **Cuota 1**: mismo día que `sale_date`
- **Cuotas 2..N**: mismo día del mes, mes a mes

Un pg_cron diario marca las cuotas vencidas (due_date <= hoy) como cobradas. Un trigger recalcula `sales.amount_collected` y `sales.payment_status` cada vez que cambia una cuota.

Si un cliente no pagó realmente, el usuario abre la venta desde la tabla (ícono Wallet), ve todas las cuotas con su fecha y monto, y desmarca la que corresponda — el total cobrado se actualiza en vivo.

El modal `AddPaymentModal` original sigue disponible para ventas `deposito` y `full` con pendientes (cobros fuera de calendario).

#### Archivos
- `supabase/migrations/20260423000054_sale_installments.sql` (NUEVO) — tabla `sale_installments` + trigger `recalc_sale_from_installments` + pg_cron `auto-pay-installments-daily`. **Aplicada en Prod Arko + backfill de ventas existentes.**
- `src/app/api/sales/route.ts` — POST genera N cuotas al crear venta de cuotas
- `src/app/api/sales/[id]/installments/route.ts` (NUEVO) — GET/PATCH por cuota
- `src/components/sales/InstallmentsModal.tsx` (NUEVO) — UI de toggle cobrada/pendiente
- `src/components/sales/SaleForm.tsx` — envía `n_cuotas` al endpoint
- `src/app/(dashboard)/ventas/VentasClient.tsx` — selecciona InstallmentsModal para `payment_type='cuotas'`

---

### Fixed — Multiplicador de Reels: org-only + contextual al filtro de tipo

Dos bugs en el cálculo del multiplicador (x̄) que se mostraba en cada Reel card:

- **Bug A — Ads inflaban el multiplicador**: el numerador sumaba `views_org + views_paid` pero el denominador (promedio 90d) ya era solo `views_org`. Un Reel con 100k org + 100k ads aparecía con ×2 falso. Ahora el numerador también pasa a `views_org`: ads se siguen mostrando aparte pero no afectan el ranking.
- **Bug B — Multiplicador no reaccionaba al filtro de tipo**: al filtrar por "Trial reel", el multiplicador seguía comparando contra el promedio de Reels normales, y todos los trials caían en ~0.2x. Ahora hay 3 benchmarks separados (`normal`, `trial`, `all`) y la UI elige el apropiado según el filtro activo.

Cambios:

- **DB** — `reel_benchmarks.avg_views_by_type jsonb` con `{ normal, trial, all }`. Migración aplicada en Dev Arko.
- **Service** — `reel-benchmarks.service.ts` calcula los 3 promedios usando solo `views_org`. Métricas derivadas (engagement, retention, etc.) siguen excluyendo trials.
- **Edge Function** — `sync-instagram/index.ts` replica la lógica nueva para que cada sync actualice el JSONB.
- **Server + API** — `page.tsx` e `api/v1/reels/route.ts` leen el JSONB; `is_top_performer` se calcula comparando cada Reel contra el benchmark de su propio tipo.
- **UI** — `ReelsGrid` recibe los 3 benchmarks y computa el multiplicador on-the-fly cuando cambia el `typeFilter`.
- **Docs** — `docs/features/ig-intelligence.md` documenta la nueva semántica.

#### Archivos modificados
- `supabase/migrations/20260423000053_benchmarks_by_type.sql` (NUEVO)
- `src/services/reel-benchmarks.service.ts`
- `supabase/functions/sync-instagram/index.ts` (requiere redeploy)
- `src/app/(dashboard)/instagram/page.tsx`
- `src/app/api/v1/reels/route.ts`
- `src/components/instagram/InstagramShell.tsx`
- `src/components/instagram/ReelsGrid.tsx`
- `docs/features/ig-intelligence.md`

---

## [0.14.4] — 2026-03-27

### Fixed — Supabase error handling + black screen prevention

- **Black screen fix**: `.single()` → `.maybeSingle()` en queries donde el registro puede no existir. Antes, si la conexión Meta no se guardaba correctamente, la app crasheaba con pantalla negra.
- **RPC error handling**: `save_meta_connection` en callback ahora verifica errores y redirige a onboarding con mensaje claro en vez de continuar silenciosamente.
- **Deauthorize webhook**: Ahora retorna HTTP 500 si falla el update de DB (antes retornaba `success: true`).
- **Error boundaries**: Agregados `error.tsx` en `/instagram` y `/instagram/bootstrap` con UI glassmorphism para capturar errores del server component.
- **Sync services**: Todas las operaciones `.update()`, `.upsert()`, `.insert()` en sync jobs ahora verifican errores.
- **Chat route**: Removido debug log que exponía info del OPENAI_API_KEY. Agregado error handling a insert/update de mensajes.
- **Dashboard queries**: Error logging en las 7 queries paralelas del dashboard principal.
- **Admin pages**: Error logging en queries de clients e invitations.
- **Usage services**: `llm-usage` e `integration-usage` ahora loguean errores de insert (antes se swallowed).
- **ADN progress**: Error logging en las 6 queries paralelas de onboarding + `markOnboardingComplete`.
- **Centralized env access**: Services ahora usan helpers de `env.ts` en vez de `process.env` directo (anthropic, openai, gemini, apify).

#### Archivos modificados
- `src/lib/supabase/middleware.ts` (4x `.single()` → `.maybeSingle()`)
- `src/app/api/v1/auth/meta/callback/route.ts` (RPC error check)
- `src/app/api/v1/auth/meta/deauthorize/route.ts` (return 500 on failure)
- `src/app/api/v1/chat/route.ts` (remove debug log, add error handling)
- `src/app/(dashboard)/instagram/page.tsx` (`.maybeSingle()`)
- `src/app/(dashboard)/instagram/bootstrap/page.tsx` (`.maybeSingle()`)
- `src/app/(dashboard)/instagram/error.tsx` (NUEVO)
- `src/app/(dashboard)/instagram/bootstrap/error.tsx` (NUEVO)
- `src/app/(dashboard)/page.tsx` (error logging)
- `src/app/(admin)/admin/clients/page.tsx` (error logging)
- `src/app/(admin)/admin/invitations/page.tsx` (error logging)
- `src/app/(admin)/admin/invitations/actions.ts` (error handling)
- `src/app/api/v1/reels/route.ts` (`.maybeSingle()`)
- `src/app/api/v1/reels/[id]/route.ts` (`.maybeSingle()`)
- `src/app/api/v1/dashboard/stats/route.ts` (`.maybeSingle()`)
- `src/services/ig-account-sync.service.ts` (error handling)
- `src/services/instagram-sync.service.ts` (error handling)
- `src/services/llm-usage.service.ts` (error handling)
- `src/services/integration-usage.service.ts` (error handling)
- `src/services/adn-progress.service.ts` (error logging)
- `src/services/openai.service.ts` (centralized env)
- `src/services/anthropic.service.ts` (centralized env)
- `src/services/gemini-video.service.ts` (centralized env)
- `src/services/apify-reel.service.ts` (centralized env)
- `src/services/competitor-scraper.service.ts` (centralized env)
- `src/services/competitor-analysis.service.ts` (centralized env)
- `src/lib/env.ts` (added provider key helpers)

---

## [0.14.3] — 2026-03-27

### Added — Meta deauthorize & data deletion webhooks

- **Deauthorize callback** (`POST /api/v1/auth/meta/deauthorize`): Webhook called by Meta when a user removes the app from Facebook Business Integrations. Verifies HMAC-SHA256 signed_request, revokes tokens and connection status.
- **Data deletion callback** (`POST /api/v1/auth/meta/data-deletion`): Webhook called by Meta when a user requests data deletion via Facebook settings. Verifies signature, deletes all stored Meta data, returns confirmation_code + status URL as required by Meta.
- Both endpoints added to PUBLIC_ROUTES in middleware (no auth required — Meta calls them server-to-server).

#### Archivos modificados
- `src/app/api/v1/auth/meta/deauthorize/route.ts` (NUEVO)
- `src/app/api/v1/auth/meta/data-deletion/route.ts` (NUEVO)
- `src/lib/supabase/middleware.ts` (added public routes)
- `docs/API_DOCS.md` (added endpoint docs)

---

## [0.14.2] — 2026-03-26

### Fixed — follower_count era total en vez de delta diario

- **Bug**: El sync mezclaba el delta diario de Meta (`follower_count` period=day) con el total acumulado (`profileData.followers_count`) como fallback cuando el delta era 0. Desde el 18 mar, todos los días guardaban 2,705 (total) como si fueran nuevos seguidores.
- **Fix sync**: `follower_count` ahora siempre guarda el delta diario. Sin fallback al total.
- **Nueva columna `followers_total`**: Almacena el snapshot acumulado real desde el profile de Meta. Migración `20260326000021`.
- **Fix datos corruptos**: 8 filas (18-25 mar) corregidas en DEV: `follower_count` → 0, `followers_total` → 2705.
- **IGMetrics / IGDashboard**: Vuelven a tratar `follower_count` como delta diario (suma directa, sin computar deltas entre filas).
- **Header topbar**: Usa `followers_total` (snapshot) en vez de `follower_count` (delta).
- **Dashboard page**: "Nuevos Follows 7d" ahora suma deltas diarios correctamente.
- **Duration display fix**: ReelsGrid redondeaba mal los segundos decimales (ej: `1:18.947`). Ahora usa `Math.round()`.
- **Sync refresh suave**: `window.location.reload()` reemplazado por `router.refresh()` en SyncButton y SyncControls para evitar flash de pantalla completa.

#### Archivos modificados
- `supabase/functions/sync-instagram/index.ts` (fix fallback follower_count)
- `supabase/migrations/20260326000021_followers_total_column.sql` (NUEVA)
- `src/components/instagram/IGMetrics.tsx` (revert a delta directo)
- `src/components/instagram/IGDashboard.tsx` (revert a delta directo)
- `src/components/layout/Header.tsx` (usar followers_total)
- `src/app/(dashboard)/page.tsx` (suma de deltas 7d)
- `src/components/instagram/ReelsGrid.tsx` (Math.round duration)
- `src/components/instagram/SyncButton.tsx` (router.refresh)
- `src/components/instagram/SyncControls.tsx` (router.refresh)

---

## [0.14.1] — 2026-03-26

### Added — Gráficos diarios en dashboard y detalle de reel

- **Dashboard charts diarios**: Cambiados de granularidad mensual a diaria usando `ig_account_insights`.
  - Growth chart: Reach & Impressions por día (últimos 30 días).
  - Engagement chart: Likes, Saves, Comments por día.
- **Reel detail daily charts**: Nuevo componente `ReelDailyChart` integrado en la página de detalle de reel.
  - Views por día (area chart) — delta diario calculado desde snapshots acumulativos de `reel_metrics_daily`.
  - Engagement por día (bar chart) — likes, saves, comments, shares como deltas diarios.
  - Hasta 90 días de historia por reel.

#### Archivos modificados
- `src/app/(dashboard)/page.tsx` (charts cambiados a granularidad diaria)
- `src/components/dashboard/DashboardCharts.tsx` (interfaces actualizadas: month→date, organic/ads→reach/impressions)
- `src/components/instagram/ReelDailyChart.tsx` (NUEVO — componente de charts diarios por reel)
- `src/app/(dashboard)/instagram/[id]/page.tsx` (query `reel_metrics_daily` + renderizado de `ReelDailyChart`)

---

## [0.14.0] — 2026-03-26

### Changed — Dashboard con métricas 100% reales

- **Dashboard reescrito como Server Component**: Eliminó `"use client"`, ahora hace data fetching directo a Supabase.
- **Hero KPIs reales**: Total Views (de reels 90d), Guardados, Likes, Comentarios (de insights 30d) con % change vs período anterior.
- **Charts con datos reales**: Growth Trend (views orgánicas vs ads por mes), Engagement (likes/saves/comments por mes desde insights).
- **Top Performing Content real**: Top 4 reels por views con saves, likes y engagement rate calculado.
- **Quick Stats reales**: Alcance Total 30d, Engagement Rate, Mejor Reel, Nuevos Follows (7d).
- **Top Países real**: Desde `ig_account_demographics.audience_country` con mapa de banderas.
- **Monthly Goals eliminado**: No existían datos de goals en DB, sección removida.
- **Loading skeleton actualizado**: Matchea el nuevo layout sin sección de goals.
- **DashboardCharts recibe props**: Ya no tiene datos hardcodeados, recibe `growthData` y `engagementData` del server.
- Fallback a "—" / "Sin datos" en todas las secciones si no hay data.

#### Archivos modificados
- `src/app/(dashboard)/page.tsx` (reescrito: client → server component, 6 queries paralelas)
- `src/components/dashboard/DashboardCharts.tsx` (hardcoded → props-based)
- `src/app/(dashboard)/loading.tsx` (actualizado a nuevo layout)

---

## [0.13.5] — 2026-03-26

### Fixed — Métricas reales en topbar

- **Header topbar ahora muestra datos reales de Instagram**: Views (reach total 30d), Followers (último dato), Engagement Rate (interacciones/reach 30d).
- Datos consultados desde `ig_account_insights` con `getWorkspaceId()` en server component.
- Fallback a "—" si no hay datos disponibles.

#### Archivos modificados
- `src/components/layout/Header.tsx` (reemplazó valores hardcodeados por query a DB)

---

## [0.13.4] — 2026-03-26

### Improved — ADN Onboarding anti-vaguedad

- **Protocolo anti-vaguedad en el system prompt de Arko ADN**: El agente ahora evalúa la calidad de cada respuesta antes de guardarla. Respuestas genéricas o vagas no se guardan — Arko repregunta con foco específico hasta obtener información profunda y accionable.
- Criterios claros de qué es "vago" vs "suficiente" para cada campo
- Guía de tono para repreguntar sin ser agresivo
- Justificación al usuario de por qué se necesita más detalle

#### Archivos modificados
- `src/services/adn-prompts.ts` (nuevo protocolo anti-vaguedad en system prompt)

---

## [0.13.3] — 2026-03-26

### Added — Análisis de Competidores

- **Scraping de competidores via Apify**: Scrapea perfil IG (followers, bio, posts) + últimos 15 reels públicos de cada competidor.
- **Análisis IA de reels de competidores**: Claude analiza hooks (5 tipos), estructura narrativa, tipo de contenido, CTA, fortalezas y debilidades de cada reel.
- **Tab "Competencia" en Customer Voice**: UI completa con cards por competidor, stats de perfil, lista expandible de reels con análisis, badges de tipo de hook coloreados.
- **Tool `get_competitor_analysis` para Arko AI**: Arko puede consultar datos de competidores y comparar hooks/estilo/métricas contra los del usuario.
- **Tablas `competitor_reels` + `competitor_reel_analysis`**: Almacenamiento escalable con deduplicación por short_code, índices por workspace, RLS multi-tenant.

#### Archivos creados
- `src/services/competitor-scraper.service.ts` (Apify scraping de perfil + reels)
- `src/services/competitor-analysis.service.ts` (análisis IA con Claude)
- `src/app/api/v1/competitors/[id]/scrape/route.ts` (endpoint de scraping)
- `src/app/api/v1/competitors/[id]/analyze/route.ts` (endpoint de análisis)
- `src/app/(dashboard)/customer-voice/CustomerVoiceTabs.tsx` (tab switcher)
- `src/app/(dashboard)/customer-voice/CompetitorPanel.tsx` (UI de competidores)
- `supabase/migrations/20260326000019_competitor_reels.sql`

#### Archivos modificados
- `src/app/(dashboard)/customer-voice/page.tsx` (refactored a tabbed layout)
- `src/services/arko-ai-context.ts` (nueva tool `get_competitor_analysis`)
- `docs/features/customer-voice.md` (reescrito completo)
- `docs/DB_SCHEMA.md` (tablas 27-28 + ER diagram)
- `docs/API_DOCS.md` (2 endpoints nuevos)

---

## [0.13.2] — 2026-03-26

### Added — Sub-agentes especializados (multi-call)

- **5 sub-agentes especializados**: hook_expert, content_strategist, metrics_analyst, cta_expert, concept_evaluator. Cada uno con prompts ultra-profundos extraídos de la call de Fran.
- **Arquitectura multi-call**: Arko detecta cuando necesita profundidad → llama `consult_specialist` → segunda LLM call con prompt especializado + ADN + datos → resultado integrado en la respuesta.
- **Tool `consult_specialist`**: Nueva herramienta en ARKO_TOOLS que Arko puede llamar dentro del tool-use loop.
- **Tracking de especialistas**: `grounding_data` ahora incluye `specialists_used` con dominio, tokens y latencia de cada consulta especializada.
- **Bubble consistency**: Mensajes de Arko ahora se muestran en burbujas consistentes con los mensajes del usuario.

#### Archivos creados
- `src/services/arko-ai-specialists.ts` (prompts de 5 especialistas + `callSpecialist()` + `getAllSpecialists()`)

#### Archivos modificados
- `src/services/arko-ai-context.ts` (nuevo tool `consult_specialist`, `ArkoToolResult` type, `executeArkoTool` con soporte de especialistas)
- `src/app/api/v1/chat/route.ts` (pasa `adnContext` a tools, trackea specialist usage en grounding_data)
- `src/app/(dashboard)/agents/AgentsClient.tsx` (burbujas consistentes para mensajes de Arko)
- `docs/features/ai-agents.md` (documentación de sub-agentes)

---

## [0.13.1] — 2026-03-26

### Added — "Segundo Cerebro" de Francisco Doglio

- **Cerebro de Fran**: System prompt reescrito con toda la filosofía de análisis de contenido de Francisco Doglio, extraída de una call de entrenamiento de 2 horas. Arko ya no es un asistente genérico — analiza todo a través del framework de Fran.
- **13 módulos de conocimiento** inyectados en el prompt: jerarquía de análisis (concepto → estructura → ejecución), contenido semi-viral, seguidor ideal vs cliente ideal, dos tipos de contenido (reputación/conexión), lectura de métricas vs promedio, 5 tipos de hooks, estructura narrativa (3-5 puntos), 7 características del CTA, regla 80/20, red flags, guardable vs compartible, limitaciones honestas.

#### Archivos modificados
- `src/services/arko-ai-prompts.ts` (rewrite completo — de ~50 líneas genéricas a ~200 líneas con framework de Fran)
- `docs/features/ai-agents.md` (actualizado con descripción del cerebro de Fran)

---

## [0.13.0] — 2026-03-25

### Added — Arko AI: Asistente Unificado de IA con tool_use

- **Arko AI**: Reemplaza el sistema de 4 agentes separados con @mentions por un solo asistente inteligente conversacional.
- **tool_use**: Claude decide qué datos necesita y consulta la DB on-demand via 7 herramientas (query_reels, get_reel_details, get_benchmarks, get_goals, search_reels_by_topic, get_top_hooks, get_topic_clusters).
- **Tool loop**: El backend ejecuta tool calls en un loop (max 5 iteraciones) hasta que Claude genera una respuesta de texto final.
- **ADN en system prompt**: El ADN del workspace se incluye siempre como contexto estático. Las métricas se cargan dinámicamente via tools.
- **Multi-session**: Sidebar con historial de conversaciones, nueva conversación, eliminación de sesiones.
- **Real LLM integration**: Claude Sonnet 4 con 4096 max tokens via `callLLM()`.
- **Markdown rendering**: Soporte de bold, code, headers, listas en las respuestas de Arko.
- **Usage tracking**: Cada iteración del tool loop se loguea via `logLLMUsage()` con cálculo de costos.

#### Archivos creados
- `src/services/arko-ai-context.ts`
- `src/services/arko-ai-prompts.ts`
- `src/app/api/v1/chat/sessions/route.ts`
- `src/app/api/v1/chat/messages/route.ts`

#### Archivos modificados
- `src/app/api/v1/chat/route.ts` (reemplazado placeholder con LLM call real)
- `src/app/(dashboard)/agents/page.tsx` (carga sesiones server-side)
- `src/app/(dashboard)/agents/AgentsClient.tsx` (rewrite completo como chat unificado)
- `src/app/(dashboard)/agents/loading.tsx` (skeleton actualizado)
- `src/components/layout/Sidebar.tsx` (renombrado "AI Agents" → "Arko AI")
- `docs/features/ai-agents.md` (actualizado con nueva arquitectura)

---

## [0.12.0] — 2026-03-26

### Added — ADN de Comunicación: Onboarding Conversacional con Arko AI

- **Conversational onboarding**: Arko AI guía al usuario a través de 4 secciones para construir su ADN de Comunicación (brand DNA). Claude Haiku con tool_use para extracción estructurada en cada respuesta.
- **Anthropic Service**: Wrapper fetch para Anthropic Messages API (`src/services/anthropic.service.ts`). Modelo: `claude-haiku-4-5-20251001`.
- **ADN Progress Service**: Deriva completitud de las 6 tablas existentes de onboarding. Sin campo `current_step` — progreso es función del estado de la DB.
- **API endpoints**: `GET/POST /api/v1/onboarding/chat` — carga estado, procesa mensajes, ejecuta tool calls, verifica completitud.
- **Feature blocking**: Middleware redirige a `/onboarding/adn` si `onboarding_completed = false`. Cookie caching de 24h.
- **Chat UI**: Glass design system. Sidebar de progreso (4 secciones), area de chat con auto-scroll, typing indicator, soporte markdown bold.
- **Sidebar disabled state**: Links greyed out y no-clickeables durante onboarding, con mensaje "Completá tu ADN para desbloquear".
- **Persistencia**: Reusa `chat_sessions` + `chat_messages`. El usuario puede cerrar y volver sin perder progreso.
- **Migration 18**: `workspaces.onboarding_completed` boolean column. Admin workspaces marcados como completados.

#### Archivos creados
- `supabase/migrations/20260326000018_onboarding_completed.sql`
- `src/services/anthropic.service.ts`
- `src/services/adn-progress.service.ts`
- `src/services/adn-prompts.ts`
- `src/app/api/v1/onboarding/chat/route.ts`
- `src/app/(dashboard)/onboarding/adn/page.tsx` + `loading.tsx`
- `src/components/features/onboarding/AdnChat.tsx`
- `src/components/features/onboarding/AdnSectionProgress.tsx`
- `src/components/features/onboarding/AdnMessage.tsx`
- `docs/features/onboarding-adn.md`

#### Archivos modificados
- `src/lib/env.ts` (added ANTHROPIC_API_KEY)
- `src/lib/supabase/middleware.ts` (onboarding gate)
- `src/components/layout/Sidebar.tsx` (onboardingMode prop)
- `src/app/(dashboard)/layout.tsx` (pass onboardingMode)
- `docs/DB_SCHEMA.md` (onboarding_completed column)
- `docs/API_DOCS.md` (onboarding chat endpoints)
- `CHANGELOG.md`

---

## [0.11.0] — 2026-03-25

### Added — Admin Panel + Sistema de Invitaciones + Onboarding Schema

- **Admin Panel**: Panel de administración en `/admin` con dashboard de stats globales, lista de clientes, y gestión de invitaciones. Protección defense-in-depth (middleware + layout server component + RLS).
- **Sistema de Invitaciones**: Registro solo por invitación. Admin genera links con token UUID, usuario se registra con email pre-filled. Trigger `handle_new_user()` marca invitación como usada automáticamente.
- **Onboarding Schema**: 6 tablas para contexto de marca (workspace_profile, workspace_strategies, workspace_competitors, workspace_market, workspace_references, workspace_brand). Schema only, UI pendiente.
- **Bloqueo de Registro Público**: `/register` redirige a `/login`. Login page muestra "Acceso solo por invitación".
- **Admin Link en Sidebar**: Link al admin panel visible solo para usuarios con role='admin' (Shield icon, amber accent).
- **RPC `validate_invitation`**: SECURITY DEFINER function para validar tokens sin exponer la tabla de invitaciones.

#### Archivos creados
- `supabase/migrations/20260325000015_invitations_and_onboarding.sql`
- `src/app/(admin)/layout.tsx`
- `src/app/(admin)/admin/page.tsx` + `loading.tsx`
- `src/app/(admin)/admin/clients/page.tsx` + `loading.tsx`
- `src/app/(admin)/admin/invitations/page.tsx` + `loading.tsx` + `actions.ts`
- `src/app/(admin)/admin/invitations/InvitationForm.tsx`
- `src/app/(admin)/admin/invitations/InvitationList.tsx`
- `src/components/layout/AdminSidebar.tsx`
- `src/app/(auth)/invite/[token]/page.tsx`
- `src/app/(auth)/invite/[token]/InviteRegisterForm.tsx`
- `docs/features/admin-panel.md`

#### Archivos modificados
- `src/lib/supabase/middleware.ts` (admin route protection, block /register, allow /invite)
- `src/app/(auth)/actions.ts` (registerWithInvite, logout clears cookies)
- `src/app/(auth)/login/page.tsx` (removed register link)
- `src/app/(auth)/register/page.tsx` (replaced with redirect)
- `src/types/database.ts` (added invitation + onboarding types)
- `src/components/layout/Sidebar.tsx` (admin link for admin users, custom SVG icons replacing Lucide icons)
- `src/app/(dashboard)/layout.tsx` (pass isAdmin to Sidebar)
- `docs/DB_SCHEMA.md` (new tables, migration, RLS, functions)

### Fixed — Post-testing Fixes

- **RLS infinite recursion (42P17):** Admin profiles policy queried profiles table, causing recursion. Created `is_admin()` SECURITY DEFINER function. Migration: `20260325000016_fix_profiles_admin_rls_recursion.sql`.
- **Admin can view all workspaces/meta_connections:** Added RLS policies for admin SELECT on workspaces and meta_connections.
- **Plan simplificado a 'pro' único:** Eliminados planes 'free' y 'agency'. CHECK constraint actualizado, columna Plan removida de UI de clientes. Migration: `20260325000017_simplify_plan_to_pro_only.sql`.
- **Hydration mismatch:** Fixed `toLocaleString()` → `Intl.NumberFormat("en-US")` in dashboard goals.
- **PostgREST FK join error:** Split clients query into two separate queries (workspaces + profiles) since no FK exists.
- **Admin filtered from clients:** Admin workspaces excluded from `/admin/clients` list.
- **Onboarding page redesign:** Left-aligned layout, descriptive permission scopes (no technical names).
- **Custom SVG icons in sidebar:** Replaced Lucide icons with custom SVGs from `/public/svgs/`.
- **Settings cleanup:** Removed `reels_limit` display, added Admin Panel link (admin-only).
- **Invitation form autofill:** CSS fix for dark theme autofill override.

#### Archivos creados
- `supabase/migrations/20260325000016_fix_profiles_admin_rls_recursion.sql`
- `supabase/migrations/20260325000017_simplify_plan_to_pro_only.sql`
- `public/svgs/` (dashboard, instagram, youtube, megaphone, person-voice, robot SVGs)

#### Archivos modificados
- `src/app/(admin)/admin/clients/page.tsx` (separate queries, admin filter)
- `src/app/(dashboard)/page.tsx` (hydration fix)
- `src/app/(dashboard)/settings/page.tsx` (remove reels_limit, add admin link)
- `src/app/(dashboard)/onboarding/page.tsx` (left-aligned, descriptive scopes)
- `src/components/layout/Sidebar.tsx` (custom SVG icons)
- `src/components/meta/ConnectMetaButton.tsx` (left-aligned)
- `src/app/(admin)/admin/invitations/InvitationForm.tsx` (autofill fix)
- `src/app/globals.css` (autofill-dark CSS)

---

## [0.10.0] — 2026-03-24

### Added — Data Decay + pg_cron Scheduled Sync + Quick Sync mejorado

- **Data Decay**: Insights se refrescan por tier de antigüedad del reel: Hot (<7d) cada 1h, Warm (7-30d) cada 24h, Cold (>30d) cada 7d. Reduce insight calls de ~30 a ~8-15 por full sync, eliminando timeouts.
- **pg_cron Scheduled Sync**: Sincronización automática cada 6 horas usando `pg_cron` + `pg_net` dentro de Supabase. No depende de Vercel. Función `trigger_scheduled_sync()` itera workspaces activos y llama a la Edge Function directamente.
- **Supabase Vault**: `SYNC_SECRET` almacenado en `vault.decrypted_secrets` para uso seguro desde pg_cron.
- **Progreso Incremental**: Edge Function actualiza `sync_jobs.processed_items` después de cada batch de insights.

#### Archivos afectados
- `supabase/functions/sync-instagram/index.ts` (modificado — data decay, progreso incremental, ordenamiento por prioridad)
- `supabase/migrations/20260324000014_pg_cron_scheduled_sync.sql` (nuevo — pg_cron + pg_net + trigger_scheduled_sync)
- `src/components/instagram/SyncButton.tsx` (modificado — simplificado)
- `src/components/instagram/SyncControls.tsx` (modificado — simplificado)
- `src/hooks/useSyncJobProgress.ts` (nuevo — hook disponible para futuro uso)
- `docs/features/ig-intelligence.md` (modificado — sección 11 y 14 actualizadas)

---

## [0.9.9] — 2026-03-24

### Added — Quick Sync + Auto-Polling de contenido nuevo

- **Quick Sync**: Click en "Sincronizar" trae los últimos 12 media + insights en ~3-5s (antes 2+ min). Full sync corre en background después del reload.
- **Auto-Polling**: Hook `useNewContentPolling` chequea cada 3 min si hay media nuevo en IG. Muestra badge "N nuevos" sin intervención del usuario.
- **Check endpoint**: Nuevo step `steps=check` compara últimos 5 media IDs de IG vs DB (~1-2s).
- **Batch upsert**: Reels se upsertean en batches de 20 (antes 1 por 1).
- **Parallel insights**: Concurrencia de 5 para fetch de insights (antes secuencial).
- **SyncControls**: Nuevo componente que combina SyncButton + badge de polling.

#### Archivos afectados
- `supabase/functions/sync-instagram/index.ts` (modificado — quick sync, check, batch upsert, parallel insights)
- `src/app/api/v1/sync/instagram/route.ts` (modificado — soporte steps=quick|check)
- `src/components/instagram/SyncButton.tsx` (modificado — 2-phase UX)
- `src/components/instagram/SyncControls.tsx` (nuevo — sync + polling badge)
- `src/hooks/useNewContentPolling.ts` (nuevo — auto-polling hook)
- `src/app/(dashboard)/instagram/page.tsx` (modificado — usa SyncControls)
- `docs/features/ig-intelligence.md` (modificado — sección 14)

---

## [0.9.8] — 2026-03-23

### Changed — Tipografía global: Manrope Bold + Manrope Light

- Reemplazadas todas las fuentes de la app: `Sh Ad Grotesk` y `Montserrat` eliminadas.
- Títulos/headings: `Manrope Bold` (`/fonts/manrope.bold.otf`).
- Texto body/secundario: `Manrope Light` (`/fonts/manrope.light.otf`).
- Carga optimizada con `next/font/local` (sin dependencia de Google Fonts).

#### Archivos afectados
- `src/app/layout.tsx` (modificado — nuevas fuentes locales Manrope)
- `src/app/globals.css` (modificado — @font-face, CSS variables, base font-family)
- `docs/08-design-system.md` (modificado — tipografía actualizada)
- `docs/features/dashboard-layout.md` (modificado — tipografía actualizada)

Aguante la merca

---

## [0.9.7] — 2026-03-23

### Added — Dashboard unificado IG Intelligence + métricas diarias por reel

- **Nueva tabla `reel_metrics_daily`:** snapshots diarios de métricas por reel (orgánico + pagado). Permite gráficas de evolución temporal. Índices compuestos para queries multi-tenant (workspace_id + metric_date). RLS completo.
- **Dashboard unificado:** nueva vista principal de `/instagram` con layout tipo panel de control — rendimiento de visitas (AreaChart), conversión de perfil, crecimiento, desglose orgánico/pagado (PieChart), interacciones clave, mejor Reel, reels recientes.
- **Tabs reorganizados:** Dashboard (default) → Reels → Posts → Demografía. Se elimina la tab "Todos" redundante.
- **Fix `follower_count = 0`:** el sync ahora usa `profileData.followers_count` como fallback cuando Meta devuelve 0 en el endpoint daily.
- **Snapshots diarios automáticos:** cada sync de media ahora guarda un snapshot en `reel_metrics_daily` con UPSERT por (reel_id, metric_date).

#### Archivos afectados
- `supabase/migrations/20260323000012_reel_metrics_daily.sql` (nuevo)
- `supabase/functions/sync-instagram/index.ts` (modificado — fix follower_count + snapshotDailyMetrics)
- `src/components/instagram/IGDashboard.tsx` (nuevo)
- `src/components/instagram/IGDashboardClient.tsx` (nuevo)
- `src/components/instagram/InstagramTabs.tsx` (modificado — nueva tab Dashboard)
- `src/app/(dashboard)/instagram/page.tsx` (modificado — layout unificado)
- `src/app/(dashboard)/instagram/loading.tsx` (modificado — skeleton del dashboard)
- `docs/DB_SCHEMA.md` (actualizado)
- `docs/features/ig-intelligence.md` (actualizado)

#### Migración aplicada en
- DEV (`hrsvglgswatwklivkoyp`) — aplicada via MCP

---

## [0.9.6] — 2026-03-23

### Enhanced — Benchmark extendido con métricas compuestas + UPSERT

- **5 métricas nuevas en `reel_benchmarks`:** `avg_engagement_rate`, `avg_retention_rate`, `avg_duration_seconds`, `avg_reach_per_view`, `avg_saves_per_reach`.
- **INSERT → UPSERT:** `reel_benchmarks` ahora mantiene solo 1 fila por workspace (UNIQUE en `workspace_id`). Cada sync sobrescribe el snapshot anterior en vez de acumular filas.
- **UPDATE RLS policy** agregada para soportar UPSERT.
- **Service actualizado:** `reel-benchmarks.service.ts` calcula las 5 métricas nuevas y usa `upsert(..., { onConflict: 'workspace_id' })`.
- **Types actualizados:** `ReelBenchmark` en `database.ts` incluye las nuevas columnas.
- **Ficha [id]** consume `avg_engagement_rate`, `avg_retention_rate`, `avg_duration_seconds`, `avg_reach_per_view` del benchmark de DB.
- **Grilla /instagram** ya usaba benchmark de DB (single source of truth desde v0.9.5).

#### Archivos afectados
- `supabase/migrations/20260323000011_benchmark_extended_metrics_upsert.sql` (nuevo)
- `src/services/reel-benchmarks.service.ts` (modificado por Windsurf)
- `src/types/database.ts` (modificado por Windsurf)
- `src/app/(dashboard)/instagram/[id]/page.tsx` (modificado por Windsurf)
- `docs/DB_SCHEMA.md` (actualizado)

#### Migración aplicada en
- DEV (`hrsvglgswatwklivkoyp`) — aplicada por Windsurf
- PROD (`zphvrohosizkbrnxtppj`) — aplicada por Claude Code via MCP

### Request original
> Agregar avg_engagement_rate, avg_retention_rate, avg_duration_seconds, avg_reach_per_view, avg_saves_per_reach al benchmark. Cambiar INSERT a UPSERT. Unificar grilla para usar benchmark de DB. Actualizar consumidores UI.

---

## [0.9.5] — 2026-03-23

### Changed — Sync performance v2: paralelización completa + auto-sync en segundo plano

- **`src/services/instagram-sync.service.ts`** — insights de media ahora se fetchean en paralelo con `runConcurrent()` (concurrency=5) en vez de secuencial. Apify corre en paralelo (concurrency=3). Límite de insights subido de 30 a 50. Límite de Apify subido de 5 a 10.
- **`src/app/api/v1/sync/instagram/route.ts`** — Ads sync + Account insights ahora corren en paralelo después de media sync, en vez de secuencialmente. Benchmark se calcula al final con datos completos.
- **`src/lib/concurrency.ts`** — nueva utilidad `runConcurrent()` con worker pool controlado para ejecutar tareas async con concurrencia limitada sin exceder rate limits.
- **`src/app/api/v1/sync/cron/route.ts`** — nuevo endpoint `GET /api/v1/sync/cron` para sincronización automática en segundo plano. Itera todos los workspaces activos y ejecuta full sync. Protegido por `CRON_SECRET`.
- **`vercel.json`** — configuración de Vercel Cron para ejecutar background sync cada 6 horas (`0 */6 * * *`).
- **`src/lib/env.ts`** — agregada variable `CRON_SECRET` al schema de validación.
- **`.env.example`** — documentada `CRON_SECRET` para producción.
- **`docs/features/ig-intelligence.md`** / **`docs/API_DOCS.md`** — documentación actualizada con secciones de performance v2, background sync y nuevo endpoint cron.

### Request original
> fueron unos 200 segundos de sincronización inicial, hay forma de acelerar eso? [...] necesito que las métricas se sincronizen solas en segundo plano cada x tiempo

---

## [0.9.4] — 2026-03-23
 
### Added — Desconexión manual de cuenta Instagram/Meta desde Settings
 
- **`src/app/api/v1/auth/meta/disconnect/route.ts`** — nuevo endpoint para desconectar una cuenta Meta del workspace autenticado limpiando tokens, permisos e identificadores sensibles y dejando el estado en `revoked`.
- **`src/components/meta/DisconnectMetaButton.tsx`** — nuevo botón client-side con confirmación, estado loading y refresh inmediato de la UI.
- **`src/app/(dashboard)/settings/page.tsx`** — Settings ahora muestra una acción explícita para desconectar la cuenta activa y volver a probar o reconectar otra cuenta.
- **`docs/features/ig-intelligence.md`** / **`docs/API_DOCS.md`** — documentación actualizada para reflejar el nuevo flujo de desconexión.
 
### Request original
> bien, ahora necesito un botón de desconectar la cuenta de instagram. para volver a probar el test y que quede ya porque quizas unna persona la quiere desconectar
 
---
 
## [0.9.3] — 2026-03-23
 
### Added — Primera sincronización automática de Instagram con pantalla de bootstrap
 
- **`src/app/api/v1/auth/meta/callback/route.ts`** — después de conectar Meta exitosamente, el usuario ya no vuelve a una vista vacía; ahora entra a un flujo de bootstrap de Instagram.
- **`src/app/(dashboard)/instagram/bootstrap/page.tsx`** — nueva pantalla protegida para la preparación inicial del workspace después de conectar una cuenta.
- **`src/components/instagram/InitialInstagramSyncScreen.tsx`** — nueva experiencia visual de primera sincronización con loader, progreso estimado, etapas descriptivas y manejo de error/reintento.
- **Primera sync automática** — el bootstrap dispara `POST /api/v1/sync/instagram` automáticamente para traer contenido histórico, métricas de cuenta y benchmark inicial sin requerir acción manual del usuario.
- **`docs/features/ig-intelligence.md`** / **`docs/API_DOCS.md`** — documentación actualizada para reflejar el nuevo flujo post-conexión.
 
### Request original
> como podemos manejar la primser sincronización de un usuario? me gustaría que como va a demorar bastante en traer toda la info de los ultimos 90 días que se comienze automáticamente al conectar cualquier cuenta, ahora vamos con IG pero que mientras lo haga que aparezca una buena pantalla de carga con loadres, y textos de que está haciendo
 
---
 
## [0.9.2] — 2026-03-23
 
### Fixed — Login de Instagram no queda trabado en `pending`
 
- **`src/app/api/v1/auth/meta/callback/route.ts`** — el callback de Meta ahora marca la conexión como `error` cuando el OAuth falla, el usuario cancela, faltan parámetros o no existe una cuenta de Instagram Business válida. Antes podía quedar en `pending` y generar una UX confusa.
- **`src/app/api/v1/auth/meta/connect/route.ts`** — al reiniciar el login limpia `last_error` anterior para que el nuevo intento arranque limpio.
- **`src/app/(dashboard)/settings/page.tsx`** — Settings ahora trata la conexión como binaria a nivel visual: solo `active` se muestra como conectada; cualquier otro estado se muestra como no conectada con CTA para reintentar.
- **`src/app/(dashboard)/onboarding/page.tsx`** — Onboarding ahora muestra errores legibles de Meta y mantiene disponible el botón para reiniciar el login cuando la conexión no está activa.
- **`docs/features/ig-intelligence.md`** / **`docs/API_DOCS.md`** — documentación actualizada para reflejar el flujo correcto de reintento y errores del OAuth de Meta.
 
### Request original
> quiero que arregles esto, no se porque cuando no se logra loguear dice pendiente pero no me deja rieniciar nuevamente el login de instagram. no se si debería exioster el estado pendiente, o está conectada o no
 
---
 
## [0.9.1] — 2026-03-23
 
### Fixed — Auto-creación de workspace al registrarse (fix "workspace_id is required")
 
- **`handle_new_user()` trigger actualizado** — ahora crea automáticamente un workspace + workspace_member al registrarse un usuario nuevo. Antes solo creaba el profile, lo que causaba el error "workspace_id is required" al intentar conectar Instagram.
- **Backfill incluido** — usuarios existentes sin workspace recibieron uno automáticamente al aplicar la migración.
- **ConnectMetaButton** — ahora se deshabilita si no hay workspaceId y muestra un mensaje informativo en vez de fallar silenciosamente.
 
#### Archivos afectados
- `supabase/migrations/20260323000010_auto_create_workspace_on_signup.sql` (nuevo)
- `src/components/meta/ConnectMetaButton.tsx` (modificado)
- `docs/DB_SCHEMA.md` (actualizado)
 
#### Migración aplicada en
- DEV (`hrsvglgswatwklivkoyp`) via MCP
- PROD (`zphvrohosizkbrnxtppj`) via MCP
 
### Request original
> workspace_id is required me da este error al querer abrir la cuenta de IG, que falta?
 
---
 
## [0.9.0] — 2026-03-23
 
### Added — Migración a nuevos proyectos Supabase (arkov2)
 
- **Prod Arko** (`zphvrohosizkbrnxtppj`, us-east-2) — nuevo proyecto Supabase de producción. Schema completo aplicado con las 11 migraciones.
- **Dev Arko** (`hrsvglgswatwklivkoyp`, us-west-2) — nuevo proyecto Supabase de desarrollo/staging. Schema completo aplicado con las 11 migraciones.
- `.mcp.json` — agregado servidor MCP `arkov2` apuntando a los nuevos proyectos.

### Changed — Variables de entorno actualizadas a los nuevos proyectos

- `.env.example` — actualizado con URLs y anon keys de Dev Arko y Prod Arko. Los valores de Dev Arko son los predeterminados para local.
- `docs/05-environments-guide.md` — actualizada la matriz de ambientes y agregada tabla de claves por proyecto.
- `docs/06-github-stages-databases-guide.md` — actualizada la sección 6.1 con los IDs reales de los proyectos Supabase.

### Infra — Migraciones aplicadas a ambos proyectos nuevos
Las siguientes migraciones fueron aplicadas en orden a Prod Arko y Dev Arko:
`core_infrastructure` → `meta_connections` → `reels_and_metrics` → `ai_pipeline` → `chat` → `sync_and_rls` → `auth_profiles_members` → `reel_metrics_watch_time` → `ig_account_insights` → `add_account_insights_job_type` → `get_meta_access_token_rpc`

### Request original
> necesito migrar lo que tenemos en arko en supabase a estos dos nuevos proyectos. por ahora solo migra las tablas, relaciones etc. haz un espejo tal cual de lo que tenemos. y hay que cambiar las claves para que apunten al nuevo proyecto.

---

## [0.9.0] — 2026-03-23

### Added — Migración de Instagram Sync a Supabase Edge Functions

- `supabase/functions/sync-instagram/index.ts` — Edge Function completa que ejecuta el sync de Instagram (media, insights, ads, benchmarks, account insights, duración Apify). Reemplaza la ejecución pesada en Vercel Functions para eliminar costos de invocación.
- `supabase/functions/_shared/supabase-client.ts` — Cliente Supabase con service-role para Deno Edge Functions.
- `supabase/functions/_shared/types.ts` — Tipos compartidos para las Edge Functions.
- `SYNC_SECRET` — Nueva variable de entorno para autenticar llamadas del proxy Next.js a la Edge Function.

### Changed — Thin Proxy en Next.js

- `src/app/api/v1/sync/instagram/route.ts` — Reescrito como thin proxy: solo autentica y delega a la Edge Function via `supabase.functions.invoke()`. Reduce la ejecución en Vercel a ~1s (auth only).
- `src/lib/env.ts` — Agregada `SYNC_SECRET` al schema de validación.
- `.env.example` — Agregada `SYNC_SECRET` con instrucciones de generación.
- `docs/features/ig-intelligence.md` — Documentada la nueva arquitectura de sync con Edge Functions.

### Motivation

- Vercel Functions cobraba ~$0.60 por 12 invocaciones (~$1/hora con 1 usuario activo), insostenible a escala.
- Supabase Edge Functions son gratis (500K invocaciones/mes incluidas) y no tienen límite de duración como Vercel.

### Request original
> elimina lo de vercel ahora, y haz lo de supabase

---

## [0.8.1] — 2026-03-21

### Added — Guía maestra de GitHub para humanos e IA

- `docs/06-github-stages-databases-guide.md` — nueva guía central de GitHub del proyecto. Explica ramas, commits, push, Pull Requests, merges, releases, relación entre GitHub y local/staging/production, y cómo se coordina GitHub con Supabase y migraciones.

### Changed — Reglas y documentación alineadas a la nueva guía de GitHub

- `docs/02-architecture.md` — registrada la nueva guía en la estructura oficial del proyecto.
- `.windsurfrules` — agregada la nueva guía a la lista de lectura obligatoria y tabla de lookup para tareas de GitHub.
- `CLAUDE.md` — agregada la nueva guía a la tabla de documentación y lookup.
- `.github/copilot-instructions.md` — agregada la nueva guía a la tabla de documentación y lookup.

### Request original
> necesito que me crees un doc, un .md donde le expliques TODO a la IA de como manejamos el proyecto en cuanto github, ftages, bses de datos necesito entender!!! y agrega ese doc en ruter, para que siempre que se hable de github sepa que hacer

## [0.8.0] — 2026-03-21

### Added — Sistema profesional de ambientes y configuración centralizada

- `src/lib/env.ts` — configuración centralizada de variables de entorno con validación Zod. Helpers: `getAppUrl()`, `getMetaRedirectUri()`, `isProduction()`, `isLocal()`. Si falta una variable obligatoria, la app no arranca y muestra el error exacto.
- `docs/05-environments-guide.md` — guía operativa completa para humanos y IA. Explica qué es un ambiente, cómo configurar local/staging/production, matriz de ambientes, reglas de variables y paso a paso para cada escenario.
- `APP_ENV` — nueva variable obligatoria (`local` | `staging` | `production`) para identificar el ambiente actual.

### Changed — Eliminación de hardcodes y centralización de config

- `src/app/api/v1/auth/meta/callback/route.ts` — eliminados `process.env` directos y fallback a `localhost`. Ahora usa `env`, `getAppUrl()` y `getMetaRedirectUri()`.
- `src/app/api/v1/auth/meta/connect/route.ts` — eliminados `process.env` directos. Ahora usa `env` y `getMetaRedirectUri()`.
- `src/services/instagram-sync.service.ts` — reemplazado `process.env.META_TOKENS_ENCRYPTION_KEY` por `env.META_TOKENS_ENCRYPTION_KEY`.
- `src/services/ig-account-sync.service.ts` — idem.
- `src/services/ads-sync.service.ts` — idem.
- `src/app/api/v1/meta/explorer/route.ts` — idem.
- `.env.example` — reorganizado con `APP_ENV`, comentarios claros por ambiente. Eliminada `META_REDIRECT_URI` (ahora se deriva automáticamente de `NEXT_PUBLIC_APP_URL`).
- `README.md` — agregada referencia a `docs/05-environments-guide.md`.
- `docs/02-architecture.md` — registrado `05-environments-guide.md` en la estructura oficial.
- `docs/features/team-collaboration.md` — agregadas referencias a la guía de ambientes y `src/lib/env.ts`.
- `.windsurfrules`, `CLAUDE.md`, `.github/copilot-instructions.md` — agregado `docs/05-environments-guide.md` a las tablas de documentación y lookup.

### Removed

- `META_REDIRECT_URI` como variable de entorno separada. Ahora se construye automáticamente desde `NEXT_PUBLIC_APP_URL + /api/v1/auth/meta/callback`.

### Request original
> como manejamos los ambientes? [...] como podemos hacer para manejar este proyecto profesionalmente y de manera robusta?

## [0.7.5] — 2026-03-21

### Changed — Metadata del repositorio y preparación de publicación inicial en GitHub

- `README.md` — agregada la sección "Repositorio Oficial" con nombre del proyecto, owner GitHub, remoto principal y contacto operativo.
- `docs/features/team-collaboration.md` — registrado el repositorio canónico del equipo para onboarding y trabajo en paralelo.

### Request original
> bien, ahora hagamos el primer push y docuementemos que proyecto es, que usuario es.

## [0.7.4] — 2026-03-21

### Added — Sistema autónomo de trabajo en equipo, onboarding y gobernanza para IA

- `docs/features/team-collaboration.md` — nueva guía central para onboarding técnico, ramas, Pull Requests, setup local, coordinación de cambios sensibles, publicación del repositorio y uso correcto de IA en equipo.
- `.github/PULL_REQUEST_TEMPLATE.md` — template estándar para Pull Requests con checklist de documentación, DB, API, seguridad, validaciones y riesgos.
- `.windsurf/workflows/team-onboarding.md` — workflow reutilizable para que el equipo y la IA ejecuten un onboarding consistente del proyecto.
- `.github/workflows/ci.yml` — validación automática para `pull_request` y `push` sobre `develop`/`main` con `lint`, `tsc` y `build`.

### Changed — Documentación operativa del repositorio

- `README.md` — reemplazado el template genérico de Next.js por un README operativo de Arko con setup local, comandos, flujo de branches, trabajo con IA y referencias rápidas del proyecto.
- `docs/02-architecture.md` — actualizada la estructura oficial para registrar `docs/features/team-collaboration.md`, `.github/PULL_REQUEST_TEMPLATE.md` y `.windsurf/workflows/`.
- `docs/03-security.md` — agregadas reglas de publicación segura del repositorio, control de `.env.example` y protocolo ante exposición de secretos.
- `docs/04-deployment.md` — ampliada con flujo de integración `develop` → `main`, checklist de release del equipo y lineamientos de GitHub/ambientes.
- `.env.example` — saneado para publicación: removido valor real expuesto y dejados placeholders seguros para todo el equipo.
- `.windsurfrules`, `.cursorrules`, `.clinerules`, `CLAUDE.md`, `.aider.conf.yml`, `.github/copilot-instructions.md` — alineadas para que las IAs consulten `docs/features/team-collaboration.md` cuando la tarea toque onboarding, GitHub, setup o trabajo en paralelo.

### Request original
> Este proyecto va a ser publicado en un repositorio de github y descargado por otro integrante del equipo para trabajar en paralelo. necesito que dejes todo seteado para la integración y el trabajo en equipo. toda la guía de como hacerlo, las guias para la IA que entienda lo que está haciendo, tambien una guia de todo lo que hay que hacer para iniciar el proyecto correctamente, dependencias, conecciones, ramas d github todo. necesito que me ayudes a crear un sistema autonomo de trabajo en equipo

## [0.7.3] — 2024-03-20

### Changed — Visual Redesign v4 (Clean SaaS Dark)

- **Visual Redesign v4 (Clean SaaS Dark)**: Reemplazado el efecto "Liquid Glass" por un diseño SaaS oscuro más limpio y moderno (referencia Stakent).
- **Fondo**: Cambiado a oscuro sólido (`#0e0d14`).
- **Sidebar**: Ítem activo ahora usa un fondo de píldora gris claro (`#e2e2e9`) con texto e íconos oscuros para alto contraste.
- **KPI Cards**: Eliminados los desenfoques pesados e íconos grandes. Ahora usan fondo sólido oscuro (`#111116`), bordes sutiles y priorizan la tipografía (label en mayúsculas pequeñas, números grandes limpios).
- **Tabs y Filtros**: Rediseñados como Segmented Controls con forma de píldora (`rounded-full`) y fondos sutiles.
- **Tipografía**: Ajustados los pesos y el tracking de `.page-title` y `.stat-number` para un aspecto más premium y legible.
- **Botones**: Actualizados a forma de píldora (`rounded-full`). glassmorphic con `backdrop-blur-xl`, `font-light`, bordes `rgba(255,255,255,0.07)`, item activo `bg-white/[0.07]`.
- **Gráficos:** neon glow dual `drop-shadow`, strokes `2`, gradientes `0.25-0.30` opacidad, ejes `rgba(255,255,255,0.3)`.
- **Espaciados:** `space-y-10` entre secciones, `mb-5` label→número, `mb-7` subtítulo→contenido.
- **Backward compat:** `.card-dark` → alias de `.glass-card`, `.card-dark-lg` → alias de `.glass-section`. `.glass-panel` redefinido con backdrop-blur real.
- Archivos: `globals.css`, `IGMetrics.tsx`, `page.tsx` (instagram), `InstagramTabs.tsx`, `PeriodFilter.tsx`, `SyncButton.tsx`, `ReelMetricsSkeleton.tsx`.
- Documentación: `docs/05-design-system.md` reescrito como v3 Liquid Glass.

## [0.7.2] — 2026-03-20

### Changed — Visual Redesign v3 (Liquid Glass / Glassmorphic Premium)

- **Estilo:** pasamos de "neon dark sólido" a **glassmorphism real** con `backdrop-blur-xl`, bordes translúcidos luminosos, e `inset` shadows que simulan vidrio líquido.
- **Fondo:** `#08080c` negro profundo abisal. Sin imagen, sin overlay.
- **Tarjetas:** nuevas clases `.glass-card` y `.glass-section` con `rgba(255,255,255,0.04)` de fondo, `border rgba(255,255,255,0.08)`, triple box-shadow (outer + inset top + inset bottom), hover animado con cubic-bezier.
- **Tipografía PREMIUM:** números KPI `34px font-light`, hero `48px font-extralight`, títulos sección `22px font-extralight`, labels `11px uppercase tracking-[0.08em] text-white/40`. **NUNCA font-bold para datos** — esto es lo que da el look Stakent/DeFi.
- **Page title:** `font-extralight tracking-[-0.03em]` clamp `2rem–2.75rem` — enorme y delicado.
- **Iconos:** `40x40 rounded-full` con fondo `rgba(255,255,255,0.06)` + `inset 0 1px 0 rgba(255,255,255,0.1)`.
- **Controles:** tabs, filtros y botones glassmorphic con `backdrop-blur-xl`, `font-light`, bordes `rgba(255,255,255,0.07)`, item activo `bg-white/[0.07]`.
- **Gráficos:** neon glow dual `drop-shadow`, strokes `2`, gradientes `0.25-0.30` opacidad, ejes `rgba(255,255,255,0.3)`.
- **Espaciados:** `space-y-10` entre secciones, `mb-5` label→número, `mb-7` subtítulo→contenido.
- **Backward compat:** `.card-dark` → alias de `.glass-card`, `.card-dark-lg` → alias de `.glass-section`. `.glass-panel` redefinido con backdrop-blur real.
- Archivos: `globals.css`, `IGMetrics.tsx`, `page.tsx` (instagram), `InstagramTabs.tsx`, `PeriodFilter.tsx`, `SyncButton.tsx`, `ReelMetricsSkeleton.tsx`.
- Documentación: `docs/05-design-system.md` reescrito como v3 Liquid Glass.

## [0.7.1] — 2026-03-18

### Changed — Visual Redesign v2 (Neon Dark) — *Superseded by v3*

- Fondo sólido `#0a0a0f`, tarjetas opacas `bg-[#13131a]`, tipografía bold.

---

## [0.7.0] — 2026-03-18

### Changed — Arquitectura de 2 capas en ficha de Reel

- **Capa 1 (métricas básicas):** al abrir la ficha solo se leen datos ya sincronizados en Supabase (métricas, benchmark, caption, thumbnail). Sin llamadas externas.
- **Capa 2 (análisis profundo ArkoAI):** se dispara bajo demanda con botón "Analizar en profundidad". ArkoAI procesa transcripción con timestamps por línea (`start_sec`, `end_sec`), narrativa, visual, audio e insights en un solo call. Se persiste en las 4 tablas analíticas existentes y se rehidrata automáticamente en futuras aperturas.
- **Apify desacoplado:** queda como enriquecimiento opcional en sección separada "Datos Públicos Externos" (play count, hashtags, mentions, comentarios públicos). Su transcript se muestra como fallback en el bloque de análisis cuando no hay resultado de ArkoAI.
- **Retención estimada:** la ficha del Reel ahora calcula `retention_rate` (% del Reel visto en promedio) como `avg_watch_time / duration * 100`, usando `ig_reels_avg_watch_time` (Meta) + `duration_seconds` (Apify). `view_rate_3s` y `skip_rate` fueron removidos porque no son calculables desde la API de Meta — Instagram los mide internamente con la curva de retención real por viewer, y derivarlos de un promedio produce resultados incorrectos.
- **Performance fix:** la duración del Reel ahora se obtiene de Apify **durante el sync**, no al abrir la ficha. Esto evita bloquear la página 10-15s esperando Apify. El sync enriquece hasta 5 reels sin duración por ejecución. Si un reel no tiene duración aún, la retención se muestra como "—".
- **Performance fix:** `workspace_id` ahora se cachea en cookie (`arko_workspace_id`) por el middleware, evitando la query de workspace en cada página. El helper `getWorkspaceId()` en `@/lib/workspace.ts` lee de cookie o hace fallback a DB.
- **Performance fix:** la navegación entre `/instagram` y `/instagram/[id]` ahora prioriza el router cache del App Router. La grilla hace `prefetch` explícito del detail en hover/focus y la ficha vuelve con `router.back()` cuando viene desde la grilla, usando `push('/instagram')` solo como fallback.
- **ArkoAI branding:** la UI y la documentación de análisis profundo del Reel ahora usan `ArkoAI` como naming visible. La UI consume la nueva ruta `/api/v1/reels/[id]/arkoai-analyze`; `/gemini-analyze` queda como alias interno por compatibilidad.
- **ArkoAI fix:** el parser del análisis ahora une todos los `parts` devueltos por el modelo, extrae el JSON útil aunque venga fenced o con texto extra, aumenta `maxOutputTokens` a `8192`, fuerza `responseMimeType: application/json` y devuelve errores más claros cuando la respuesta sale incompleta o inválida.
- **Métricas Reel fix:** la ficha ya no muestra `0` cuando `impressions_org` es desconocido; ahora presenta "impresiones conocidas" como total conocido o `—` con nota aclaratoria.
- **Benchmark UI fix:** si no existe snapshot usable en `reel_benchmarks`, la comparación 90d deja de renderizar promedios `0.00%` y barras falsas; muestra estado vacío explícito hasta que haya benchmark real.
- **Benchmark sync fix:** el endpoint `/api/v1/sync/instagram` ahora recalcula y persiste `reel_benchmarks` al finalizar el sync de media/ads, dejando disponible un snapshot 90d del workspace desde el primer sync con métricas reales.
- **Paid split fix:** los bloques de split orgánico/pagado para `views` y `reach` solo se muestran cuando existen métricas paid reales. Si no hay split usable, la ficha evita el `100% orgánico` visualmente engañoso.
- **Retención UI fix:** la sección de retención ahora degrada con mensaje claro cuando falta `duration_seconds` o `avg_watch_time_sec`, en lugar de aparentar una lectura completa con barras parciales.
- `src/app/(dashboard)/meta/page.tsx` / `src/components/meta/MetaExplorerClient.tsx` / `src/app/api/v1/meta/explorer/route.ts` — agregado sandbox interno de Meta Graph API en la ruta `/meta`, con contexto real de la conexión activa (`ig_account_id`, `ig_username`, `page_id`, `page_name`) y ejecución arbitraria de requests para inspeccionar el JSON crudo que devuelve Meta antes de tocar sync o UI.
- `src/components/meta/MetaExplorerClient.tsx` — actualizados presets y referencia visual de `/{media_id}/insights` con métricas activas, métricas deprecated, períodos válidos y breakdowns compatibles según la documentación actual de Meta; removidos defaults inválidos como `video_duration` en media object.
- `src/app/(dashboard)/meta-explorer/page.tsx` — la ruta anterior ahora redirige a `/meta`.
- `src/app/(dashboard)/instagram/[id]/page.tsx` — fusionadas SECTIONS 3 (Transcript hardcoded), 4 (Visual+Audio hardcoded) y 5 (IA standalone) en un único bloque "Análisis Profundo" alimentado por `GeminiAnalysis`. Eliminada demo data de transcript/narrative/visual/audio que ya no se usa. Eliminados imports y helpers huérfanos (`formatTranscriptParagraphs`, `ImageIcon`, `Mic`, `FileText`, `Users`).
- `src/services/gemini-video.service.ts` — `TranscriptLine` ahora incluye `start_sec` y `end_sec`; prompt actualizado para pedir timestamps por línea.
- `src/services/gemini-analysis-persistence.service.ts` — persistencia de timestamps en `timestamps_per_block`; rehidratación reconstruye timestamps desde datos almacenados.
- `src/components/instagram/GeminiAnalysis.tsx` — muestra timestamps junto a cada línea de transcripción; acepta `apifyTranscript` como fallback en estado idle; botón renombrado a "Analizar en profundidad".
- `src/app/(dashboard)/instagram/page.tsx` — la grilla de Reels ahora hace prefetch explícito de la ficha de cada Reel en hover/focus, mejorando la experiencia de navegación.
- `src/app/(dashboard)/instagram/[id]/page.tsx` — la ficha del Reel ahora utiliza `router.back()` para volver a la grilla de Reels, en lugar de `push('/instagram')`, mejorando la experiencia de navegación.
- `docs/features/ig-intelligence.md` — documentación actualizada con arquitectura de 2 capas.

### Added — Persistencia del análisis ArkoAI en Instagram Intelligence

- `src/app/api/v1/reels/[id]/arkoai-analyze/route.ts` / `src/services/gemini-analysis-persistence.service.ts` — el análisis bajo demanda con ArkoAI ahora se persiste al finalizar en `reel_transcripts`, `reel_narrative_analysis`, `reel_visual_analysis` y `reel_audio_analysis`, reutilizando las tablas existentes sin nuevas migraciones.
- `src/app/(dashboard)/instagram/[id]/page.tsx` — la ficha del Reel ahora lee esas cuatro relaciones al cargar y rehidrata el análisis ArkoAI persistido para mostrarlo sin volver a ejecutar el modelo si ya existe resultado guardado.
- `src/components/instagram/GeminiAnalysis.tsx` — el componente acepta `initialAnalysis`, arranca en estado `done` cuando hay análisis persistido y muestra acción secundaria de `Re-analizar` sin perder el resultado ya guardado si el reintento falla.

### Fixed — Performance de apertura en ficha de Reel

- `src/app/(dashboard)/instagram/[id]/page.tsx` — la ficha del Reel ya no espera síncronamente a Apify durante el render server-side inicial, evitando timeouts de ~30s al abrir piezas con scraping lento o caído.
- `src/app/(dashboard)/instagram/[id]/page.tsx` — el benchmark 90d de la ficha ahora se lee desde el snapshot persistido en `reel_benchmarks` en lugar de recalcularse sobre todos los Reels en cada request.
- `src/app/(dashboard)/instagram/[id]/page.tsx` — el módulo `GeminiAnalysis` ahora puede usar `media_url` propia del Reel como fuente de video cuando no existe `video_url` externo de Apify.

### Added — Tabs, Posts, IG Metrics y Account Insights

- `src/app/(dashboard)/instagram/page.tsx` — refactorizado para soportar navegación por tabs (`?tab=reels|posts|all|metrics`) usando `searchParams`. Eliminada toda demo data hardcodeada; ahora solo muestra datos reales de Supabase.
- `src/components/instagram/InstagramTabs.tsx` — nuevo componente client para tabs: Reels, Posts, Todos, IG Metrics.
- `src/components/instagram/IGMetrics.tsx` — nuevo componente de dashboard de cuenta con gráficos reales (evolución, interacciones, comunidad, demografía) usando recharts.
- `src/components/instagram/PostsGrid.tsx` — nuevo componente para mostrar posts (IMAGE/CAROUSEL_ALBUM) con métricas reales.
- `src/components/instagram/PeriodFilter.tsx` — actualizado para preservar `?tab=` al cambiar período.
- `src/services/ig-account-sync.service.ts` — nuevo servicio que sincroniza métricas de cuenta diarias (impressions, reach, profile_views, follower_count, etc.) y demografía (audience_gender_age, audience_city, audience_country, audience_locale) vía IG User Insights API.
- `src/services/ig-account-sync.service.ts` / `src/app/api/v1/sync/instagram/route.ts` / `src/components/instagram/SyncButton.tsx` — ajuste de compatibilidad con la versión actual de Instagram Graph API: métricas account insights actualizadas, requests con `metric_type=total_value`, errores reales expuestos en la UI y sync de la tab Metrics desacoplado del sync completo de media para evitar esperas innecesarias.
- `src/services/ig-account-sync.service.ts` / `src/app/(dashboard)/instagram/page.tsx` / `src/components/instagram/IGMetrics.tsx` — corregido el falso “bajón” del último día en IG Metrics excluyendo el día actual parcial del sync/query y renderizando `metric_date` en UTC-safe para evitar que `YYYY-MM-DD` se corra un día por zona horaria local.
- `src/components/instagram/IGMetrics.tsx` — corregida la semántica de la sección Comunidad: `follower_count` ya no se presenta como total histórico ni crecimiento neto, sino como captación diaria de seguidores, evitando KPIs engañosos.
- `src/services/instagram-sync.service.ts` — ampliado para traer ALL media types (Reels + Posts + Carousels) en vez de solo REELS, con insights específicos por tipo de media.
- `src/app/api/v1/sync/instagram/route.ts` — ampliado para ejecutar account insights sync además de reels y ads sync.
- `supabase/migrations/20260318000009_ig_account_insights.sql` — nuevas tablas `ig_account_insights` (métricas diarias) e `ig_account_demographics` (demografía lifetime) con índices y RLS.
- `package.json` — agregada dependencia `recharts` para gráficos.

## [0.6.2] — 2026-03-18

### Changed — Métricas extendidas de Reel en Instagram Intelligence

- `src/app/(dashboard)/instagram/[id]/page.tsx` — expansión de la ficha del Reel con métricas orgánicas y pagas disponibles, más KPIs derivados como engagement rate, CTR, CPM, CPV y views/reach.
- `src/app/(dashboard)/instagram/[id]/page.tsx` — mejora visual de la ficha con layout centrado y responsive, transcript externo formateado en bloques legibles y nuevos gráficos de magnitud/interacción/retención usando datos reales disponibles.
- `src/app/(dashboard)/instagram/[id]/page.tsx` — ajuste del hero de la ficha con preview más grande, mejor aprovechamiento del espacio horizontal y reproducción inline del Reel cuando existe `media_url` o `video_url` público utilizable.
- `src/app/(dashboard)/instagram/[id]/page.tsx` — mejora de legibilidad en toda la ficha del Reel con paneles más sólidos, mayor contraste, labels más grandes y tipografía reforzada en métricas, transcript, análisis y datos externos.
- `src/app/(dashboard)/instagram/page.tsx` — mejora de legibilidad en KPIs del listado, recálculo consistente de resumen/cards según el frame temporal seleccionado y rediseño de cards horizontales con portada a la izquierda y contenido distribuido a la derecha.
- `src/app/(dashboard)/instagram/page.tsx` — simplificación visual adicional del listado para reducir carga: cards más compactas, menos cajas internas, métricas inline y jerarquía tipográfica más liviana.
- `src/app/(dashboard)/instagram/page.tsx` / `src/app/(dashboard)/instagram/[id]/page.tsx` — badges y métricas de anuncios ahora se muestran solo cuando el Reel tiene señales reales de promoción, evitando ruido paid en piezas puramente orgánicas.
- `src/app/globals.css` — agregado de overlay negro global (~30%) sobre el wallpaper para mejorar contraste general en toda la app.
- `src/app/(dashboard)/instagram/[id]/page.tsx` — corrección de visualizaciones ambiguas: los valores absolutos ya no usan barras relativas sin base y las barras ahora muestran relaciones explícitas como `x de y`.
- `src/app/(dashboard)/instagram/[id]/page.tsx` — ajuste del benchmark 90d de la ficha para excluir `trial_likely` y usar `views_total` (orgánico + paid) como base consistente en la comparación contra promedios.
- `src/app/api/v1/reels/[id]/route.ts` — exposición de métricas computadas extendidas para consumo programático.
- `src/services/apify-reel.service.ts` — nueva integración server-side con Apify para enriquecer Reels públicos con transcript, play/view count, shares, metadata de audio, hashtags, mentions y últimos comentarios sin mezclar esos datos con métricas oficiales de Meta.
- `src/services/apify-reel.service.ts` — tolerancia a `APIFY_API_TOKEN` pegado como token raw o URL completa y manejo graceful de credenciales inválidas (`401`) sin romper la ficha del Reel.
- `src/services/ads-sync.service.ts` — adopción de campos validados desde `docs/skills/meta-api-expert.md` para Ads Insights, priorizando `outbound_clicks` / `inline_link_clicks` sobre `clicks` genérico y ampliando el fetch con cuartiles de video y métricas de entrega soportadas.
- `docs/features/ig-intelligence.md` — documentación de métricas soportadas por Meta para Reel media insights y limitaciones de `profile_visits` / `follows`.
- `docs/API_DOCS.md` — detalle de los nuevos campos computados del endpoint de Reel.
- `.env.example` / `docs/02-architecture.md` / `docs/03-security.md` — registro de `APIFY_API_TOKEN` como credencial privada server-side para enriquecimiento externo opcional.
- `docs/skills/meta-api-expert.md` — notas de implementación para Arko sobre la diferencia entre `video_insights` de Page y `insights` de Instagram media, más campos validados de Marketing API para Ads.

### Request original
> Hay que mejorar las métricas extendidas de reel necesito que traigas todos los datos que puedas y luego vemos como los trabajamos.

---

## [0.6.1] — 2026-03-18

### Fixed — Atribución de views pagas en Instagram Intelligence

- `src/services/ads-sync.service.ts` — normalización de permalink de Instagram y mapeo adicional por shortcode para ads de Meta que llegan como `/p/{shortcode}` mientras los Reels se almacenan como `/reel/{shortcode}`.
- `src/services/ads-sync.service.ts` — uso de `source_instagram_media_id` como clave primaria de mapeo para Reels promocionados, ya que `effective_instagram_media_id` puede apuntar al asset publicitario y no al Reel orgánico original.
- `src/services/ads-sync.service.ts` — codificación de `fields` en el fetch de Ads y lookup por `ad_id` para evitar errores `Invalid parameter` al pedir campos anidados del creative en Meta Marketing API.
- `src/services/ads-sync.service.ts` — exclusión de `DELETED` del filtro `effective_status`, porque el endpoint `/ads` de Meta falla con `error_subcode 1815001` y devuelve cero anuncios procesables.
- `docs/features/ig-intelligence.md` — documentación del flujo de atribución pagada y del fallback por shortcode.

### Request original
> dale igual algo está fallando, porque este reel tiene como 7k de vistas y es al que le puse publicidad desde el ads manager, aca solo me marca 4.5k

---

## [0.6.0] — 2026-03-18

### Added — Frontend Instagram Intelligence (PRD 8.1 + 8.2)

#### /instagram — Grid de Reels con badges (PRD 8.1)
- Server component con data real de Supabase (fallback a demo data)
- Zona superior: 8 métricas agregadas (views totales, promedio, org/paid split, likes, saves, comments, top performers)
- Zona central: Grid 4 columnas con cards de Reel
- Cada card muestra: thumbnail, badge top performer estilo vidIQ (x3/x5/x8), views con split org/paid, engagement, duración, tipo (normal/trial), follows generados
- Badge colors: x3+ azul, x5+ verde, x8+ dorado
- Botón "Conectar Instagram" si no hay conexión Meta activa
- Indicador de demo data cuando no hay Reels reales

#### /instagram/[id] — Ficha de Reel (PRD 8.2)
- Sección 1: Métricas principales (% likes/saves/shares/comments sobre views) con comparación vs benchmark 90d
- Sección 2: Métricas extendidas (views org/paid/total, impressions, reach, profile visits, follows, watch time, views/impressions ratio)
- Sección 3: Transcript y guion (líneas etiquetadas hook/development/CTA, promesa central, especificidad, términos de nicho, clasificación de hook, topic cluster)
- Sección 4: Análisis visual (frames clave clasificados, formato, text overlay, persona) + Audio (WPM, fillers, pausas)
- Sección 5: Diagnóstico IA bajo demanda (fortalezas, puntos de mejora)
- Demo data completa para preview sin conexión real

#### /onboarding — Conexión Meta
- Página para conectar cuenta Instagram Business via Meta OAuth
- Muestra permisos requeridos con descripciones
- Benefits cards (métricas, diagnóstico IA, benchmark 90d)
- Estado de conexión activa con link a IG Intelligence

#### /settings — Configuración
- Perfil de usuario (nombre, email, rol, fecha de registro)
- Workspace info (nombre, slug, plan, límite de reels)
- Estado de conexión Meta/Instagram con detalles

### Archivos creados
- `src/app/(dashboard)/instagram/page.tsx` (reescrito completo)
- `src/app/(dashboard)/instagram/[id]/page.tsx`
- `src/app/(dashboard)/onboarding/page.tsx`
- `src/app/(dashboard)/settings/page.tsx`

### Request original
> avanza

---

## [0.5.0] — 2026-03-18

### Added — Sistema de autenticación, roles y multi-tenancy

#### Base de datos (Migración 7)
- `profiles` — Tabla de perfiles con roles (admin/user), auto-creada via trigger on signup
- `workspace_members` — Relación many-to-many user ↔ workspace con roles (owner/admin/member/viewer)
- `handle_new_user()` — Trigger que auto-crea profile al registrarse; asigna role=admin a emendoza@ainnovateagency.com
- `save_meta_connection()` — RPC function que encripta tokens con pgcrypto (upsert)
- Actualización de `is_workspace_member()` para soportar workspace_members además de owner_id

#### Reestructuración de rutas (Route Groups)
- `(auth)` group: `/login`, `/register` — Sin sidebar, layout centrado con fondo glassmorphic
- `(dashboard)` group: `/`, `/instagram`, `/youtube`, `/ads`, `/customer-voice`, `/agents` — Con Sidebar + Header
- Root layout simplificado (solo fonts + body wrapper)

#### Páginas de Auth
- `/login` — Login con email/password, show/hide password, error handling, link a register
- `/register` — Register con full name, email, password, auto-redirect al dashboard

#### Server Actions
- `login()` — signInWithPassword via Supabase Auth
- `register()` — signUp con user_metadata.full_name
- `logout()` — signOut + redirect a /login

#### Middleware de protección
- Rutas protegidas: redirect a `/login` si no autenticado
- Auth pages: redirect a `/` si ya autenticado
- API routes: no redirigidas (manejan auth internamente)

#### Componentes actualizados
- `Sidebar` — Logout funcional via form action
- `Header` — Muestra nombre real del usuario, badge de admin (shield icon), role

#### Usuario admin creado
- Email: emendoza@ainnovateagency.com
- Role: admin (auto-asignado por trigger)
- Workspace: "AInnovate Agency" (plan: agency, slug: ainnovate)
- Membership: owner

#### Tipos TypeScript
- `Profile`, `WorkspaceMember`, `UserRole`, `WorkspaceMemberRole` agregados a `src/types/database.ts`

### Archivos creados
- `supabase/migrations/20260318000007_auth_profiles_members.sql`
- `src/app/(auth)/layout.tsx`
- `src/app/(auth)/actions.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/page.tsx` (movido desde src/app/page.tsx)
- `src/app/(dashboard)/instagram/page.tsx` (movido)
- `src/app/(dashboard)/youtube/page.tsx` (movido)
- `src/app/(dashboard)/ads/page.tsx` (movido)
- `src/app/(dashboard)/customer-voice/page.tsx` (movido)
- `src/app/(dashboard)/agents/page.tsx` (movido)
- `src/app/api/v1/auth/seed-admin/route.ts` (one-time setup)

### Archivos modificados
- `src/app/layout.tsx` (simplificado — sin Sidebar/Header)
- `src/lib/supabase/middleware.ts` (route protection)
- `src/components/layout/Sidebar.tsx` (client component + logout)
- `src/components/layout/Header.tsx` (server component + real user data)
- `src/types/database.ts` (nuevos tipos)

### Request original
> Todo eso y hacer el login a la app, roles de admin y users

---

## [0.4.0] — 2026-03-18

### Added — Backend completo alineado al PRD Instagram v1

#### Decisiones técnicas (PRD Sección 14)
- `docs/ADR-005-prd-technical-decisions.md` — Decisiones para todos los puntos abiertos del PRD (stack, storage, queue, IA providers, multi-tenancy, seguridad, sync, pricing).

#### Base de datos — 16 tablas + 1 view + 2 funciones + RLS completo
- `supabase/migrations/20260318000001_core_infrastructure.sql` — pgcrypto, handle_updated_at(), workspaces
- `supabase/migrations/20260318000002_meta_connections.sql` — OAuth tokens encriptados + assets de Meta
- `supabase/migrations/20260318000003_reels_and_metrics.sql` — reels, reel_metrics, reel_metrics_paid, ad_mappings, reel_benchmarks, reel_computed (view)
- `supabase/migrations/20260318000004_ai_pipeline.sql` — reel_transcripts, reel_narrative/visual/audio_analysis, reel_diagnostics
- `supabase/migrations/20260318000005_chat.sql` — chat_sessions, chat_messages, audit_logs
- `supabase/migrations/20260318000006_sync_and_rls.sql` — sync_jobs, RLS policies (todas las tablas), storage buckets

#### Tipos TypeScript
- `src/types/database.ts` — Tipos completos para las 16 tablas + views + tipos compuestos (ReelDetail, ReelCard, DashboardStats)

#### API Routes (11 endpoints nuevos)
- `POST /api/v1/auth/meta/connect` — Inicia OAuth Meta (PRD 4.3)
- `GET /api/v1/auth/meta/callback` — Callback OAuth con descubrimiento de assets (PRD 4.3)
- `GET /api/v1/workspaces` — Lista workspaces del usuario
- `POST /api/v1/workspaces` — Crea workspace
- `GET /api/v1/reels` — Lista reels con métricas y badges top performer (PRD 8.1)
- `GET /api/v1/reels/[id]` — Ficha completa de Reel (PRD 8.2)
- `POST /api/v1/reels/[id]/analyze` — Diagnóstico IA bajo demanda (PRD 9.3)
- `GET /api/v1/dashboard/stats` — Stats agregados del dashboard (PRD 8.1)
- `POST /api/v1/sync/instagram` — Trigger sync IG + Ads (PRD 5.3)
- `GET /api/v1/sync/status` — Estado de sync jobs
- `POST /api/v1/chat` — Chat analítico con grounding (PRD 8.3)

#### Utilidades de API
- `src/lib/api/response.ts` — Helpers de respuesta estándar (apiSuccess, apiPaginated, apiError, etc.)
- `src/lib/api/auth.ts` — Autenticación de requests + validación de workspace ownership

#### Documentación actualizada
- `docs/DB_SCHEMA.md` — Reescrito completo con 16 tablas, diagrama ER, RLS, funciones, migraciones
- `docs/API_DOCS.md` — Reescrito completo con 12 endpoints documentados
- `.env.example` — Variables de Meta OAuth + encryption key

### Archivos creados
- `docs/ADR-005-prd-technical-decisions.md`
- `supabase/migrations/20260318000001_core_infrastructure.sql`
- `supabase/migrations/20260318000002_meta_connections.sql`
- `supabase/migrations/20260318000003_reels_and_metrics.sql`
- `supabase/migrations/20260318000004_ai_pipeline.sql`
- `supabase/migrations/20260318000005_chat.sql`
- `supabase/migrations/20260318000006_sync_and_rls.sql`
- `src/types/database.ts`
- `src/lib/api/response.ts`
- `src/lib/api/auth.ts`
- `src/app/api/v1/auth/meta/connect/route.ts`
- `src/app/api/v1/auth/meta/callback/route.ts`
- `src/app/api/v1/workspaces/route.ts`
- `src/app/api/v1/reels/route.ts`
- `src/app/api/v1/reels/[id]/route.ts`
- `src/app/api/v1/reels/[id]/analyze/route.ts`
- `src/app/api/v1/dashboard/stats/route.ts`
- `src/app/api/v1/sync/instagram/route.ts`
- `src/app/api/v1/sync/status/route.ts`
- `src/app/api/v1/chat/route.ts`

### Archivos modificados
- `docs/DB_SCHEMA.md`
- `docs/API_DOCS.md`
- `.env.example`

### Request original
> @docs/ARKO_PRD_INSTAGRAM_v1.md Ahora necesito que empezemos con el BACK de la APP y que modifiques todo lo que hicimos hasta ahora para alinearlo con este PRD

---

## [0.3.4] — 2026-03-17

### Changed — Títulos más agresivos + tipografía secundaria Montserrat
- Títulos principales (`.page-title`) con degradado más marcado (blanco → plateado oscuro), más tamaño y mayor espaciado de letras.
- Tipografía secundaria/global cambiada a `Montserrat` para mejorar legibilidad en textos de UI.
- Se mantiene `Sh Ad Grotesk` para encabezados para preservar la identidad visual del producto.

### Archivos afectados
- `src/app/layout.tsx` (modificado — carga de Montserrat + variable local para heading)
- `src/app/globals.css` (modificado — body en Montserrat, headings en Sh Ad Grotesk, `.page-title` reforzado)
- `docs/features/dashboard-layout.md` (modificado — documentación tipográfica)

### Request original
> Creo que tienen que ser mas agresivas, mira la diferencia entre el logo y el de Dashboard, es muy blanco. aparte las letras se siguen viendo feas, no se porque, pon las letras secundarias en montserrat

---

## [0.3.3] — 2026-03-17

### Changed — Estilo de títulos grandes
- Ajustados los títulos principales (`h1`) de todas las vistas para que sean más grandes.
- Aplicado degradado de texto blanco → plateado en títulos principales.
- Incrementado el espaciado de letras para dar una presencia más premium.
- Unificado el estilo mediante clase reutilizable `.page-title`.

### Archivos afectados
- `src/app/globals.css` (modificado — nueva utilidad `.page-title`)
- `src/app/page.tsx` (modificado — `h1` con `.page-title`)
- `src/app/instagram/page.tsx` (modificado — `h1` con `.page-title`)
- `src/app/youtube/page.tsx` (modificado — `h1` con `.page-title`)
- `src/app/ads/page.tsx` (modificado — `h1` con `.page-title`)
- `src/app/customer-voice/page.tsx` (modificado — `h1` con `.page-title`)
- `src/app/agents/page.tsx` (modificado — `h1` con `.page-title`)
- `docs/features/dashboard-layout.md` (modificado — documentación del estilo de títulos)

### Request original
> bien, ya cambio la fuiente, ahora necesiot qu elos tpítulos grandes, sean un poco mas grandes y no todos blanco que sea cmo un degradado de blanco a plateado, y con un poquito mas de espaciado

---

## [0.3.2] — 2026-03-17

### Fixed — Aplicación real de fuente global
- Corregida la aplicación de `Sh Ad Grotesk` para que se renderice efectivamente en toda la UI.
- Implementación cambiada a `next/font/local` con `className` global en `<body>` (en lugar de depender de variables CSS intermedias).

### Archivos afectados
- `src/app/layout.tsx` (modificado — `next/font/local` + `className` global)
- `docs/features/dashboard-layout.md` (modificado — nota técnica de implementación)

### Request original
> SIGUE IGUAL, REINICIE TODO Y SIGUE, FIJATE QUE LA FUENTE ESTÉ BIEN Y HAZLO

---

## [0.3.1] — 2026-03-17

### Changed — Fuente principal global
- Reemplazada la tipografía principal de la aplicación por la fuente local `public/Sh Ad Grotesk Regular.ttf`.
- Eliminadas las referencias a Google Fonts en el layout raíz.
- Aplicada la misma fuente en body y headings para unificar la identidad visual en toda la app.
- Actualizada la documentación base del layout para reflejar la nueva fuente global.

### Archivos afectados
- `src/app/layout.tsx` (modificado — carga de fuente local)
- `src/app/globals.css` (modificado — variables tipográficas globales)
- `docs/features/dashboard-layout.md` (modificado — documentación de tipografía)

### Request original
> @[public/Sh Ad Grotesk Regular.ttf] por favor elimina ya la fuente principal y cambiala por esta! en todos lados

---

## [0.3.0] — 2026-03-17

### Added — Todas las Vistas del SaaS + Fuentes Profesionales
- **Fuentes:** Cambiadas a Space Grotesk (headings) + Nunito (body) reemplazando Geist.
- **Dashboard (`/`):** Rediseñado con gráfica de views orgánicas vs ads (barras), monthly goals con barras de progreso, métricas clave (views, saves, likes, comments), views por país orgánico vs ads, top performing content con tabla expandida.
- **IG Intelligence (`/instagram`):** Lista de Reels con métricas completas (views, likes, saves, comments, hook rate, retención, duración), insights de IA en barra superior, stats overview.
- **YT Intelligence (`/youtube`):** Lista de videos con métricas (views, likes, comments, CTR, watch time, retención, duración), insights de IA, stats overview.
- **Ads Intelligence (`/ads`):** Tabla de campañas (spend, leads, CPA, CTR, ROAS, estado), comparación geográfica orgánico vs ads con leads por país, insights de IA.
- **Customer Voice (`/customer-voice`):** Respuestas de formularios Typeform, dolores más mencionados con barras, frases para copy, llamadas de venta transcritas con key phrases y sentiment.
- **AI Brain (`/agents`):** Interfaz de chat con 4 agentes especializados (@InstagramIntelligence, @YouTubeIntelligence, @AdsIntelligence, @CustomerVoice), sidebar de agentes, ejemplo de conversación.
- **Documentación:** Feature docs creados para cada módulo (`docs/features/`).

### Archivos afectados
- `src/app/layout.tsx` (modificado — fuentes)
- `src/app/globals.css` (modificado — font vars, heading styles)
- `src/app/page.tsx` (modificado — dashboard rediseñado)
- `src/app/instagram/page.tsx` (nuevo)
- `src/app/youtube/page.tsx` (nuevo)
- `src/app/ads/page.tsx` (nuevo)
- `src/app/customer-voice/page.tsx` (nuevo)
- `src/app/agents/page.tsx` (nuevo)
- `docs/features/ig-intelligence.md` (nuevo)
- `docs/features/yt-intelligence.md` (nuevo)
- `docs/features/ads-intelligence.md` (nuevo)
- `docs/features/customer-voice.md` (nuevo)
- `docs/features/ai-agents.md` (nuevo)

### Request original
> te voy a pasar el transcript de lo que quiere el cliente [...] Junto con una foto de algunas pestañas de como se lo imagina. aparte de que hay que cambiar ya la fuente a algo más profesional como Europa Grotesk y nunito

---

## [0.2.0] — 2026-03-17

### Changed — Dashboard Layout (Glassmorphism)
- Eliminados los archivos de la landing page.
- Modificado el layout principal para que sea la vista de Dashboard interno de la aplicación.
- Establecido el fondo global usando `backgrownd.PNG` con fijación (`background-attachment: fixed`).
- Creados componentes estructurales con estilos "glassmorphism":
  - `Sidebar.tsx`: Menú de navegación lateral translúcido.
  - `Header.tsx`: Barra superior con búsqueda y perfil.
- Actualizada la vista base (`src/app/page.tsx`) para mostrar tarjetas de métricas e insights usando contenedores `.glass-panel`.
- Documentada la arquitectura del nuevo layout en `docs/features/dashboard-layout.md`.

### Archivos afectados
- `docs/features/dashboard-layout.md` (nuevo)
- `src/app/globals.css` (modificado)
- `src/components/layout/Sidebar.tsx` (nuevo)
- `src/components/layout/Header.tsx` (nuevo)
- `src/app/layout.tsx` (modificado)
- `src/app/page.tsx` (modificado)

### Request original
> no entendiste un carajo, esto no es una landing, lee lo que es el proyecto??? te pase las fotos iniciales para que veas los estilos, esto es un dashboard no hay video no hay landing!!!!! @[public/backgrownd.PNG] aparte este es el fondo

---

## [0.1.0] — 2026-03-17

### Added — Setup Inicial (Método AInnovate)
- Estructura de proyecto creada con Next.js 15 + Supabase + TailwindCSS
- Documentación base:
  - `docs/01-project-overview.md` — Visión, objetivos, stack, módulos, estado
  - `docs/02-architecture.md` — Estructura de carpetas, stack, flujo de datos, ADRs
  - `docs/03-security.md` — Auth, autorización, variables de entorno, checklist
  - `docs/04-deployment.md` — Template de deployment (pendiente de completar)
  - `docs/DB_SCHEMA.md` — Template de esquema de base de datos
  - `docs/API_DOCS.md` — Template de documentación de API
  - `docs/SKILLS.md` — Registro de skills y MCP servers disponibles
  - `docs/features/` — Carpeta para documentación de features (vacía)
- Reglas para IA (6 IDEs):
  - `.windsurfrules` — Windsurf/Cascade
  - `CLAUDE.md` — Claude Code
  - `.cursorrules` — Cursor
  - `.github/copilot-instructions.md` — GitHub Copilot
  - `.clinerules` — Cline/Continue
  - `.aider.conf.yml` — Aider
- `CHANGELOG.md` inicializado
- `.env.example` con todas las variables de entorno necesarias
- Proyecto Next.js inicializado con TypeScript, TailwindCSS, App Router

### Archivos afectados
- Todos los archivos listados arriba (creación inicial)

### Request original
> Lee el archivo METODO_AINNOVATE.md completo y sigue las instrucciones de la FASE 1. Mi proyecto es: [Arko - AI Marketing Director para creadores de contenido de alta facturación]
