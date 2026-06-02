# ARKO — Auditoría Técnica y Plan de Optimización

> **Documento maestro de limpieza y reorganización.** Esta es la fuente única de verdad para el roadmap de optimización de Arko.
> Verificado contra el sistema en vivo (Supabase Prod `zphvrohosizkbrnxtppj` y Dev `hrsvglgswatwklivkoyp`) y contra el código real del repo.
>
> **Last verified:** 2026-05-31 · **Owner:** Equipo Arko (Emanuel) · **Estado:** propuesta para ejecución por fases

---

## Nota metodológica (leer antes que nada)

Este plan se construyó a partir de 8 auditorías de subsistema + un plan de arquitecto + una crítica escéptica. La crítica **se verificó contra el sistema en vivo vía MCP** y desmintió varias premisas que las auditorías habían dado por ciertas. **Todo lo que sigue ya está corregido con la realidad del sistema.** En particular, estas afirmaciones de las auditorías son **FALSAS** y NO se actúan sobre ellas:

| Afirmación de auditoría | Realidad verificada en vivo | Evidencia |
|---|---|---|
| "Prod está 36 migraciones atrás de `main`" | **FALSO.** Prod tiene 79 migraciones aplicadas hasta `20260522025128_script_comments_constraints`; Dev tiene 80 hasta `20260522025138`. Están al día. | `list_migrations(zphvrohosizkbrnxtppj)` y `list_migrations(hrsvglgswatwklivkoyp)` |
| "El proyecto Prod es `pvxdbszzytltvxhumkqz`" | **FALSO.** Ese proyecto no existe. Solo existen `zphvrohosizkbrnxtppj` (Prod) y `hrsvglgswatwklivkoyp` (Dev). | `list_projects` |
| "`ig_conversation_messages` y `content_plans` v1 siguen vivas en Prod con RLS desactivado (fuga cross-tenant)" | **FALSO.** `get_advisors(security)` en Prod devuelve **cero** lints `rls_disabled_in_public` y **cero** menciones de esas tablas. El drop (`045_drop_ig_conversations_infra`) sí se aplicó en Prod. | `get_advisors` en vivo + `list_migrations` |
| "Tokens de Meta guardados en texto plano" | **FALSO.** `meta_connections` usa `access_token_encrypted bytea` + `page_access_token_enc bytea`, escritos con `pgp_sym_encrypt`. No existe columna en texto plano. | `20260318000002_meta_connections.sql:10,20`; `20260318000007_auth_profiles_members.sql:135` |
| "Versión de Graph API `v23.0` hardcodeada y a punto de desincronizarse" | **FALSO.** Todos los call sites usan `v25.0` de forma uniforme. Centralizarla sigue siendo buena higiene, pero no hay un defecto de drift hoy. | `sync-instagram/index.ts:28` (`GRAPH_API_VERSION = "v25.0"`) |

**Implicación operativa:** la "Fase 0" del plan del arquitecto (aplicar 36 migraciones a Prod) **se eliminó por completo** porque habría re-ejecutado DDL ya aplicado y roto Prod. La Fase 0 real se reconstruyó desde el output de advisors en vivo.

> **Nota de proceso (importante):** este documento fue generado por un workflow multi-agente y **luego verificado a mano**. Los agentes acertaron en lo estructural pero alucinaron varios datos puntuales (los de la tabla de arriba). Regla para el futuro: **los workflows mapean estructura; los datos puntuales (versiones, estado de DB, conteos, rutas) se verifican contra el sistema vivo antes de actuar.**

---

## 0. Tablero de progreso (fuente de verdad del avance)

> Última actualización: **2026-06-02**. Este tablero se actualiza en CADA cambio. ✅ hecho · 🟡 en curso/diferido · ⬜ pendiente · ❌ descartado.
>
> **Estado global:** Red de seguridad ✅ · F0 ✅ · Bug seguidores ✅ · **F1 (base de datos) ✅ COMPLETA** (advisor de performance Prod sin WARN) · F2 parcial (F2.1 ✅; el resto = refactor grande, documentado abajo, NO apurar con clientes vivos).

### Decisiones de gobernanza tomadas
- ✅ **Fin del "prelaunch / directo a Prod".** Se volvió a **Dev→Prod con confirmación explícita** para Prod (hay clientes reales). Probar siempre en Dev `hrsvglgswatwklivkoyp` primero.
- ✅ **Flujo branch → PR → main** (nunca push directo a `main`; el merge lo hace siempre un humano).
- ✅ **Sin PITR** (el usuario decidió no pagarlo aún) → se compensa con: probar en Dev primero, snapshot antes/después, cambios no destructivos y reversibles.
- ✅ **Auth git multi-cuenta** resuelta (GCM + usuario en la URL del remote).

### Avance por fase

| Fase | Ítem | Estado | Evidencia |
|------|------|--------|-----------|
| **Red de seguridad** | Sacar claves Supabase de `docs/05` → placeholders | ✅ | PR #97 (merged) |
| **Red de seguridad** | Arreglar hook pre-commit (eximía `docs/` + regex de JWT rota) | ✅ | PR #97 (merged) |
| **Red de seguridad** | Secret-scanning (gitleaks) en CI | ✅ | PR #97 (merged) |
| **F0** | `reel_computed` → SECURITY INVOKER (único ERROR de seguridad) | ✅ Dev+Prod | PR #98 (merged) |
| **F0** | Policy en `data_deletion_requests` (RLS sin policy) | ✅ Dev+Prod | PR #99 (merged) |
| **F0** | `search_path` fijo en ~19 funciones | ✅ Dev+Prod | PR #99 (merged) |
| **F0** | Cron `sync-ads-metrics` cada minuto | ❌ No existía | Alucinación de la auditoría; los 8 crons reales son sanos |
| **F0** | Limpieza repo (`adn-call.txt`, `gcm-diagnose.log`, `notes.md`, `original-*.webp`) + `.gitignore` (`*.log`) | ✅ | PR limpieza |
| **F0** | Borrar ruta muerta `reels/[id]/analyze` (0 callers, tabla vacía) | ✅ | PR limpieza |
| **F0** | Alias `arkoai-analyze` | ❌ NO borrar | Lo llama el front (`GeminiAnalysis.tsx:117`) — verificado, se mantiene |
| **F0** | Huérfanos `reel_diagnostics` | ❌ N/A | Tabla VACÍA en Dev+Prod (0 filas) — nada que limpiar |
| **F0** | Consolidar los 2 endpoints de data-deletion en 1 | 🟡 Bloqueado | Requiere confirmar URL en dashboard de Meta (compliance). Evidencia: el vivo es `/api/v1/auth/meta/data-deletion` (`APP_REVIEW_META.md:637`) |
| **F0** | Consolidar data-deletion + dominios arko→moka | ✅ | PR #101 (merged) |
| **Bug** | Seguidores: anomalía suspensión/reactivación (lectura por resta de totales + escritor snapshot real) | ✅ Dev+Prod | PR #103 + #104 (merged) |
| **F1.1/F1.2** | Índices de cobertura para 11 FKs sin índice | ✅ Dev+Prod | PR #107 |
| **F1.5** | `auth_rls_initplan` (20 policies, 13 tablas): `auth.uid()` → `(select auth.uid())` | ✅ Dev+Prod | PR #109. Advisor 20→0 |
| **F1.6** | `multiple_permissive_policies` (12 tablas): fusionar admin+member | ✅ Dev+Prod | PR #110. Advisor 75→0 |
| **F2.1** | Borrar 3 servicios Node de sync muertos (~1650 líneas) | ✅ | PR #106 |
| **F1** | ✅ **COMPLETA** — advisor de performance de Prod: 0 WARN (solo quedan `unused_index` INFO, tenant-scoping legítimo a conservar) | ✅ | — |
| **F2.2** | Fix split tokens 85/15 fabricado en costos IA | 🟡 Diferido | El TOTAL de costo es correcto; solo el split input/output es estimado. Requiere capturar `promptTokenCount`/`candidatesTokenCount` en `competitor-analysis.service.ts` + 4 rutas → va con F2.5 (capa IA) |
| **F2.3** | Dedup de scrapes Apify (guard `last_scraped_at`) | ⬜ | Control de costo. Medio riesgo (toca scraping de 6 clientes) |
| **F2.4** | Centralizar `META_GRAPH_VERSION` | ⬜ Diferido | No hay drift (v25.0 uniforme; el `v22.0` es solo comentario). Va con el cliente Meta unificado |
| **F2.5/F2.6** | Clientes unificados Meta/Apify + adapter Gemini en `callLLM` + convención API | ⬜ | §4–§7. Refactor grande, feature por feature, con feature flags. NO apurar con clientes vivos |
| **API** | getWorkspaceId sin verificar membership · `/api/sales` vs `/v1` · zero-Zod | ⬜ | Pendiente real (verificado). Va con la reorg de API (F2.5+) |

### Deudas de SEGURIDAD aún abiertas (importantes)
- 🟡 **Rotar las claves Supabase** (Dev+Prod). El PR #97 frenó la propagación pero las claves siguen vivas y en el historial de git. Requiere runbook coordinado (Vercel + 4 edge secrets con `--no-verify-jwt`). El usuario lo postergó conscientemente (repo privado, círculo de confianza). Ver §12.
- 🟡 **`security_definer_function_executable`** (anon/authenticated pueden llamar funciones SECURITY DEFINER vía RPC). **No se puede cerrar con un REVOKE** sin romper el sync: `meta/explorer` y `token-refresh` (Google) llaman a `get_meta/google_*` con la sesión del usuario (rol `authenticated`), no `service_role` (los 3 servicios Node que también lo hacían se borraron en PR #106, pero estos 2 callers vivos quedan). Requiere mover esas llamadas al admin client primero → fase posterior.
- 🟡 **Observabilidad / alertas de sync.** No hay alerta de "workspace sin sync en X días". Hoy 2 workspaces (PROVIDA, Nacho `c4df25d9`) están sin syncear hace días y nadie se entera salvo mirando. Candidato para una fase de observabilidad (Sentry/logs + alerta de needs_reauth + failed-sync por tenant).
- 🟡 **`SYNC_SECRET` compartido Dev/Prod** (verificado: el mismo secret invoca el edge de ambos). Resolver con la rotación de claves.

### Hallazgos de la auditoría que resultaron FALSOS (no se actúa)
Ver tabla en la Nota metodológica de arriba: tokens NO en texto plano (ya cifrados con pgcrypto), versión es v25.0 (no v23.0), Prod NO atrás en migraciones, proyecto `pvxdbszzytltvxhumkqz` inexistente, cron de ads cada minuto inexistente.

---

## 1. Resumen ejecutivo

Arko es un SaaS multi-tenant **bien concebido en sus cimientos** que acumuló deuda estructural por "apagar incendios y agregar parches". Los huesos son buenos y conviene decirlo con la misma honestidad que los problemas:

- Existe una capa compartida real en `src/lib/api` (`auth.ts` con `authenticateRequest`, `response.ts` con el envelope `apiSuccess`/`apiError`/`apiPaginated`).
- Existe una fachada `callLLM` provider-agnóstica en `src/services/llm.service.ts` (usada por chat, onboarding y generate-title).
- El trabajo pesado recurrente está correctamente offloadeado a Supabase (pg_cron + 4 edge functions), no a Vercel por invocación.
- El aislamiento multi-tenant está modelado con RLS vía `is_workspace_member()`.
- Los upserts de métricas son idempotentes; los thumbnails de IG se re-hostean en Storage para que las URLs del CDN no expiren.
- **Los tokens de Meta y Google ya están cifrados en reposo.**

**La causa raíz de casi todos los síntomas es una sola: no existe una capa de cliente por proveedor.** No hay UN cliente de Meta Graph, UN cliente de Apify, ni un adapter de Gemini detrás de `callLLM`. Como consecuencia, la lógica de acceso a cada API externa está reimplementada en 3–5 lugares por proveedor, repartida entre dos runtimes (Node/Vercel y Deno/Edge): catálogos de campos/métricas, retry/backoff, clasificación de errores, logging de costos, resolución de token y paginación están copy-pasteados y **divergen en silencio**. La fachada `callLLM` que existe es bypasseada por la mitad de los call sites (todo Gemini va por `fetch` crudo).

Esto se agrava por: una migración a `/api/v1` incompleta (namespace `/api/sales` duplicado, dos endpoints de data-deletion de Meta, un trío de rutas de analyze con una muerta + un alias), una pila plana de 22 archivos en `src/services` que mezcla clientes/prompts/orquestación, y **dos modelos de datos paralelos para la misma entidad** ("perfil de IG scrapeado": competitors relacional vs references en JSONB).

**Hacia dónde vamos:** primero estabilizar seguridad y correctitud en Prod (siguiendo la regla del equipo "DB antes que código"), después construir la capa de clientes por proveedor como refactor keystone, después colapsar la duplicación y reorganizar carpetas/docs encima. **Cada fase es independientemente shippable y reversible.** No hay un big-bang en ningún lado.

**Defectos reales y verificados que sí hay que arreglar** (a diferencia de los desmentidos arriba):

- **CRÍTICO:** claves Supabase reales (anon + `service_role`) de Dev **y** Prod commiteadas en `docs/05-environments-guide.md` (L202-203 y L209-210). Son JWTs decodificables y **están en el historial de git**. **Rotación obligatoria** + purga de historial.
- **ERROR en vivo en Prod (ERROR-level de advisors):** la vista `public.reel_computed` es `SECURITY DEFINER` → aplica la RLS del creador, no la del usuario que consulta (riesgo de lectura cross-tenant real). Ninguna auditoría lo mencionó.
- **RLS sin policy en vivo en Prod:** `public.data_deletion_requests` tiene RLS habilitado pero **ninguna** policy (tabla GDPR/App-Review con acceso indefinido).
- `getWorkspaceId()` resuelve el tenant desde una cookie sin verificar → mis-scoping de la capa financiera (sales/payments) para cualquier usuario multi-workspace.
- `hooks/classify` confía en un `workspace_id` que viene en el body sin chequeo de ownership en la ruta (depende 100% de RLS).
- Validación de input: **cero** rutas usan Zod pese a ser el stack declarado.
- Cron `sync-ads-metrics` corre **cada minuto** contra una ruta de Vercel.
- Rutas de analyze duplicadas (una muerta, un alias de una línea) y dos namespaces completos de sales.
- Duplicación de Apify (5 copias) y Gemini (4 copias) entre runtimes.

> **Verificación de los advisors (nota):** los conteos finos de `get_advisors(security)` (cantidad exacta de WARN `function_search_path_mutable`, funciones `security_definer_function_executable`, etc.) deben re-confirmarse corriendo `get_advisors` en vivo justo antes de la Fase 0, porque distintas corridas de la auditoría reportaron números distintos. Lo **confirmado a mano** es: 1 ERROR `security_definer_view` sobre `reel_computed`, e `rls_enabled_no_policy` sobre `data_deletion_requests`. El resto se toma del advisor en vivo al ejecutar.

---

## 2. Temas raíz del desorden (las causas, no los síntomas)

1. **No existe capa de cliente por proveedor (el keystone).** Es la causa de la mayoría de la duplicación: catálogos de campos, versión, retry/backoff, clasificación de errores, resolución de token (5 copias del regex `apify_api_...`), paginación y logging de costos están duplicados. Un cliente por proveedor colapsa todo eso de una.

2. **Split Deno-vs-Node sin frontera de código compartido.** El sync recurrente corre en edge functions (Deno); el sync user-triggered y la capa de servicios corren en Node; Deno no puede importar de `src/`. Por eso cada plataforma (IG, YouTube) tiene **dos motores** mantenidos por separado (`sync-instagram/index.ts` vs servicios Meta; `sync-youtube/index.ts` vs `src/services/youtube/sync-core.ts`, 1027 líneas). Sin una estrategia deliberada de núcleo compartido, esta duplicación es permanente.

3. **Migración a `/api/v1` incompleta + renames a parche.** Sales existe en `/api/sales` y `/api/v1/sales` (dos estilos de auth, dos shapes de respuesta); hay dos endpoints de data-deletion de Meta; analyze de reels es ruta muerta + alias de una línea + worker real.

4. **Convención por disciplina en vez de por construcción.** Tres estilos de auth (`authenticateRequest`, `getWorkspaceId` con cookie-fallback, `auth.getUser` crudo) y dos estilos de respuesta conviven en 55 rutas sin wrapper `withRoute`. Cero Zod. El aislamiento de tenant depende de que cada handler recuerde el `.eq('workspace_id')`. Así se filtró la inconsistencia y aparecieron los gaps (`hooks/classify`).

5. **Drift entre fuentes de verdad: código vs docs vs archivos "generados".** `database.ts` dice "Generated" pero está hand-editado; `API_DOCS.md` cubre ~26/56 rutas y está 2 meses desactualizado; el árbol de carpetas y los índices de feature-docs son ficción; los archivos de reglas de IA (`.windsurfrules`, `copilot-instructions`) **omiten el guardrail crítico** "la IA solo migra Dev, nunca Prod". Nada falla en CI cuando el código y su doc/esquema divergen.

6. **Modelado inconsistente para el mismo concepto.** Competitors es relacional (indexable, con snapshots); references guarda reels como JSONB no indexable en `workspace_references`. Las 4 tablas de métricas diarias divergen en nombre de columna (`date` vs `metric_date`), estilo de RLS e índices, y **ninguna** tiene el índice compuesto `(workspace_id, date)` que toda query por tenant necesita.

7. **El costo se observa tarde, parcial y sobre datos fabricados.** Las rutas de analyze de Gemini fabrican un split 85/15 input/output e insertan directo en `llm_usage`; `hooks/classify` no loguea nada; la edge function de scrape diario no loguea gasto de Apify; los precios de Apify son adivinanzas hardcodeadas; no hay dedup/cooldown de scrape ni cuota por tenant. La telemetría de costo está mal e incompleta.

---

## 3. Hallazgos por subsistema

Severidad: **Crítico** (riesgo de datos/seguridad o ruptura en vivo) · **Alto** · **Medio** · **Bajo**.

### 3.1 Meta / Instagram (Graph API)

**Estado actual.** La integración está partida en 3 capas que reimplementan acceso a Graph de forma independiente: OAuth/lifecycle en route handlers (`src/app/api/v1/auth/meta/*`), sync pesado en el edge worker `supabase/functions/sync-instagram/index.ts`, y una capa de servicio paralela en Node (`instagram-sync.service.ts`, `ig-account-sync.service.ts`, `ads-sync.service.ts`). **Lo bueno:** el lifecycle de conexión está completo (connect/callback/disconnect/deauthorize/data-deletion), el sync está en edge+cron, hay refresh de token dedicado (`refresh-meta-tokens`), los tokens ya están cifrados, y la versión es uniforme `v25.0`.

| # | Problema | Sev | Evidencia |
|---|---|---|---|
| M1 | Lógica de llamada a Graph **duplicada** entre el edge worker (Deno) y los servicios Node, con catálogos de campos/métricas que pueden divergir | Crítico | `supabase/functions/sync-instagram/index.ts:28-29` (fetch inline + field lists) vs `instagram-sync.service.ts:23-24`, `ig-account-sync.service.ts:15-16`, `ads-sync.service.ts:13-14`; ningún módulo compartido |
| M2 | Sin backoff exponencial ni manejo de error-codes de Meta (4/17/32/613 rate-limit; OAuthException 190 token inválido) | Alto | `fetch()` crudos en `sync-instagram/index.ts` y servicios Meta sin clasificación de errores |
| M3 | Refresh de token: corrección y manejo de fallo no demostrablemente seguros antes del vencimiento a 60 días (no marca `needs_reauth` ni notifica) | Alto | `supabase/functions/refresh-meta-tokens/index.ts` + `20260504000090_meta_token_auto_refresh.sql` |
| M4 | **Dos** endpoints de data-deletion divergentes | Alto | `src/app/api/v1/auth/meta/data-deletion/route.ts` y `src/app/api/data-deletion-callback/route.ts` |
| M5 | Versión `v25.0` repetida en ~9 archivos (no es drift hoy, pero un bump toca 9 lugares en 2 runtimes); además un **`v22.0` suelto** | Medio | `sync-instagram:28` y `:1256` (v22.0), `refresh-meta-tokens:73`, connect/callback/explorer, `instagram-sync.service.ts:23`, `ads-sync.service.ts:13`, `ig-account-sync.service.ts:15` |
| M6 | Catálogos de campos/métricas como magic strings inline (no tipados, no centralizados) | Medio | field/metric strings inline en `sync-instagram/index.ts` y servicios |
| M7 | Limitación de `CAROUSEL_ALBUM` (`/insights` no soportado) manejada por call-site, no en un solo lugar | Medio | branching en `sync-instagram/index.ts` no compartido con la capa de servicio |
| M8 | `explorer/route.ts` es un passthrough ad-hoc a Graph que bypassa todo cliente central | Medio | `src/app/api/v1/meta/explorer/route.ts` |

**Recomendaciones:** UN `MetaGraphClient` runtime-agnóstico (ver §4 y §7) que concentre versión, catálogos tipados, inyección de auth, descifrado de token al momento de la llamada, clasificación de errores (rate-limit/190/transient), backoff con jitter, paginación + tope de concurrencia, y la regla CAROUSEL una sola vez. Migrar `sync-instagram`, los servicios, connect/callback/explorer y refresh a usarlo. Reconciliar a UN solo data-deletion callback con verificación de `signed_request`. **Auditar la gestión de la clave pgcrypto y el path de descifrado del RPC `get_meta_access_token`** (NO migrar columna: ya está cifrada).

### 3.2 Apify / Providers (scraping competitor + reference)

**Estado actual.** Apify se invoca desde **5 lugares** que reimplementan el boilerplate de actor-call, sin cliente compartido. Peor aún, competitors y references son **dos subsistemas paralelos con modelos de datos incompatibles para la misma entidad.** **Lo bueno:** upsert bulk idempotente en competitors, re-hosting de thumbnails en Storage, snapshots time-series correctos, scoping por workspace consistente en rutas user-facing.

| # | Problema | Sev | Evidencia |
|---|---|---|---|
| A1 | Invocación de actor de Apify duplicada en 5 lugares, sin cliente compartido | Alto | `competitor-scraper.service.ts`, `supabase/functions/scrape-competitors/index.ts`, `references/[id]/scrape/route.ts`, `apify-reel.service.ts`, `sync-instagram/index.ts` |
| A2 | Competitors (relacional, indexable) vs references (JSONB en `workspace_references`, no indexable) modelan la misma entidad de dos formas | Alto | `competitor_reels` (`20260326000019`) + snapshots vs `workspace_references.scraped_reels` JSONB (`20260407000034`) |
| A3 | **Sin dedup/cooldown de scrape** — cada scrape manual re-ejecuta actores pagos | Alto | `POST /api/v1/competitors/[id]/scrape` y `references/[id]/scrape` disparan sin leer `last_scraped_at` |
| A4 | Cron diario hace fan-out **sin tope** de runs pagos por tenant | Alto | `competitor_scraping_cron` loopea TODO `workspace_competitors` con `ig_url`, un `net.http_post` cada uno, sin `LIMIT` ni `WHERE last_scraped_at` |
| A5 | Costos de Apify: precios hardcodeados, logueados post-hoc, y el cron diario **no loguea gasto** | Medio | `integration-usage.service.ts`; la edge fn `scrape-competitors` no llama `logIntegrationUsage` |
| A6 | Errores de Apify swallow-and-warn sin retry; resultado vacío persiste como scrape "exitoso" (`last_scraped_at` avanza) | Medio | `competitor-scraper.service.ts`; `references` route |
| A7 | Refresh de métricas del cron hace N UPDATEs secuenciales en vez de upsert bulk | Bajo | `scrape-competitors/index.ts` vs path manual ya correcto |
| A8 | `GET /api/v1/competitors` over-fetch: hasta 100 reels anidados + análisis por competitor | Bajo | `src/app/api/v1/competitors/route.ts` |

**Recomendaciones:** UN `ApifyClient` (ver §7) con `resolveApifyToken` validado una vez, `runActorSync/Async`, mappers tipados `ScrapedIgProfile/ScrapedIgReel`, retry en 429/5xx, distinción **fallo vs vacío** (no avanzar `last_scraped_at` en fallo silencioso). Dedup/cooldown + flag `force` + cuotas por tenant. `WHERE last_scraped_at < now()-interval` + `LIMIT` en el cron. `logIntegrationUsage` en la edge fn. Mover scrapes pesados a run async + `run_id` persistido + poll/webhook. Unificar competitors+references sobre un núcleo `scraped_ig_profiles`/`scraped_ig_reels` (esfuerzo XL, fase tardía).

### 3.3 Capa IA / LLM

**Estado actual.** Coexisten **dos generaciones**. Existe una abstracción limpia (`callLLM` en `llm.service.ts`, backed por `openai.service.ts` + `anthropic.service.ts`, config por feature en `llm-config.ts`, costos en `llm-usage.service.ts`). **Pero Gemini se atornilló por fuera:** cada llamada a Gemini es `fetch` crudo con retry/parse/usage duplicados.

| # | Problema | Sev | Evidencia |
|---|---|---|---|
| L1 | Dos pilas de LLM paralelas: Gemini bypassa `callLLM` por completo | Alto | `gemini-video.service.ts`, `competitor-analysis.service.ts`, `reference-analysis.service.ts`, `hooks/classify/route.ts` |
| L2 | Retry/backoff/JSON-parse/usage-extraction de Gemini duplicados | Alto | `hooks/classify`, `gemini-video`, `competitor-analysis` |
| L3 | Split input/output de tokens **fabricado** (85/15) corrompe la contabilidad de costo | Alto | `competitors/[id]/analyze/route.ts`, `references/[id]/reels/[shortCode]/analyze/route.ts` (insertan directo, bypassan `logLLMUsage`) |
| L4 | `hooks/classify` llama a Gemini en batches **sin logging de costo** | Alto | `hooks/classify/route.ts` (no importa `logLLMUsage`) |
| L5 | Ruta de analyze **muerta** con TODO no implementado, aún montada | Medio | `reels/[id]/analyze/route.ts:61` (`// TODO: Trigger Edge Function`; inserta filas `reel_diagnostics` 'pending' que nadie completa) |
| L6 | `arkoai-analyze` es alias de una línea de `gemini-analyze` | Medio | `reels/[id]/arkoai-analyze/route.ts:1` (`export { maxDuration, POST } from '../gemini-analyze/route'`) |
| L7 | Model IDs / provider names como magic strings en ~8 archivos | Medio | `'gemini-2.5-flash'`/`'google'` repetidos; `llm-config.ts`, PRICING `llm-usage.service.ts` |
| L8 | Prompts inline dispersos; sin registry | Medio | `generate-title/route.ts`, `hooks/classify/route.ts` |
| L9 | `onboarding/chat` carga historial completo sin límite y doble-llama al LLM en tool-use | Medio | `onboarding/chat/route.ts` (sin `.limit()`; segunda `callLLM`) |
| L10 | RLS de INSERT en `llm_usage` atada a `auth.uid()`, incompatible con logging service-role/edge | Bajo | `20260325000001_llm_usage.sql` |

**Recomendaciones:** adapter de Gemini detrás de `callLLM` (mismo contrato `LLMResponse` con token splits normalizados); enrutar TODO Gemini por ahí; centralizar retry/parse + la resiliencia inline de chat; registry de prompts en `src/services/ai/prompts/`; constantes de modelo/provider cableadas a PRICING; `logLLMUsage` con counts reales en TODA llamada; **borrar la ruta muerta y el alias**, dejar UNA canónica; limpiar filas `reel_diagnostics` 'pending' huérfanas. Arreglar RLS de `llm_usage` para service-role antes de mover analyze a edge.

### 3.4 Base de datos

**Estado actual (verificado en vivo).** Postgres 17.6 en ambos proyectos. Prod (`zphvrohosizkbrnxtppj`) y Dev (`hrsvglgswatwklivkoyp`) **están al día**. Aislamiento multi-tenant vía `is_workspace_member()` SECURITY DEFINER. **Lo bueno:** uniqueness natural en métricas (upserts idempotentes), `timestamptz` consistente, PKs `gen_random_uuid`, retention cron para `reel_metrics_daily`.

> **El backlog de seguridad real proviene de `get_advisors(security)` en vivo sobre Prod.** Re-correr el advisor justo antes de la Fase 0 para tener los conteos exactos del momento.

| # | Problema (verificado en vivo) | Sev | Evidencia |
|---|---|---|---|
| D1 | Vista `public.reel_computed` es **SECURITY DEFINER** → aplica RLS del creador, no del que consulta (riesgo lectura cross-tenant). **Único ERROR-level.** | Crítico | `get_advisors(security)`: `security_definer_view` sobre `public.reel_computed` (ERROR) |
| D2 | `public.data_deletion_requests` con RLS habilitado **sin ninguna policy** (tabla GDPR/App-Review) | Alto | `get_advisors(security)`: `rls_enabled_no_policy` sobre `data_deletion_requests` |
| D3 | Funciones con `search_path` mutable (incl. `handle_updated_at`, `handle_new_user`, posiblemente `is_workspace_member`/`is_admin`) — vector en SECURITY DEFINER | Alto | `get_advisors(security)`: `function_search_path_mutable` (WARN) — confirmar lista exacta al ejecutar |
| D5 | **Ningún** índice compuesto `(workspace_id, date)` en tablas de métricas diarias | Alto | `reel_metrics_daily`/`ad_metrics_daily`/`ig_account_insights` solo índice por `date`; `yt_channel_metrics_daily` solo `metric_date` |
| D6 | Tablas de métricas diarias modeladas inconsistentemente (`date` vs `metric_date`, estilo RLS) | Alto | `reel_metrics_daily`/`ad_metrics_daily` usan `date`; `yt_channel_metrics_daily` usa `metric_date` |
| D7 | `content_plan_versions` sin unique `(content_plan_id, version_number)` ni índice en FK | Alto | `20260521190000_content_plan_versions.sql` |
| D8 | Sin retention/partición para `ad_metrics_daily` y `yt_channel_metrics_daily` (crecen sin tope) | Medio | solo existe retention para `reel_metrics_daily` |
| D9 | Columna `role` free-text sin CHECK/enum | Bajo | `core_infrastructure`: `role text not null default 'member'` |

**Recomendaciones (orden DB-first, ver roadmap):** Fase 0 cierra D1/D2/D3 con DDL chico y revertible. Fase 1 agrega los índices compuestos `CONCURRENTLY` (D5), unifica la familia de métricas (D6), arregla `content_plan_versions` (D7) y agrega retention (D8). El enum de `role` (D9) requiere **pre-chequear valores distintos en Prod** antes de agregar el CHECK.

> **Pre-requisito inviolable:** verificar PITR/backup de Prod **antes** de cualquier DDL en Prod.

### 3.5 Arquitectura / Estructura

**Estado actual.** Next.js 16 App Router con route groups coherentes. **Lo bueno:** `src/lib` cross-cutting es el modelo a extender; versionado `/api/v1` ya cubre la mayoría; `.gitignore` correcto para `.env*`.

| # | Problema | Sev | Evidencia |
|---|---|---|---|
| S1 | `src/services` es una pila plana de 22 archivos que mezcla 4 concerns (sync, clientes de provider, **data** de prompts, billing) | Alto | `ls src/services`: sin subdirs; `arko-ai-context.ts` 1655 líneas, `gemini-video.service.ts` 936 |
| S2 | Dos árboles de componentes; el scaffold `features/` está casi vacío mientras el código real vive en top-level | Alto | `src/components/features/instagram` vacía; código real en `src/components/instagram` (31 archivos) |
| S3 | Mega-componentes monolíticos (hasta 2.147 líneas) mezclando lógica y presentación | Alto | `instagram/CompetitorTab.tsx` 2147; `youtube/YouTubeDashboard.tsx` 1501; `instagram/ReferencesTab.tsx` 1198 |
| S4 | Sales en dos namespaces de API completos | Alto | legacy `src/app/api/sales/*` + `src/app/api/v1/sales/*` |
| S5 | Handlers gordos con lógica de negocio que debería estar en servicios | Medio | `chat/route.ts` 660, `onboarding/chat/route.ts`, `hooks/classify/route.ts` |
| S6 | Naming inconsistente `.service.ts` vs `.ts`; prompts (data) misfiled como servicios | Medio | `src/services` mezcla ambos |
| S7 | Capa `types` delgada, sin barrel; `database.ts` dice "Generated" pero está hand-editado | Medio | `src/types` |
| S8 | Artefactos de scratch trackeados en root | Medio | `adn-call.txt` (108 KB), `gcm-diagnose.log`, `notes.md`, `original-*.webp` |
| S10 | Naming mixto ES/EN sin mapa documentado | Medio | `ventas`/`sales`, `instagram/competencia`/`competitors`, `mesa-de-trabajo` |

**Recomendaciones:** ver árbol objetivo en §4. Reorganizar `src/services` por dominio; mover clientes a `src/lib/providers`; mover prompts a `src/services/ai/prompts` (data); colapsar componentes a un solo árbol `features/<domain>`; codemod de imports + `eslint-plugin-boundaries`.

### 3.6 Capa API

**Estado actual.** 55 route handlers. **Lo bueno:** `authenticateRequest` en la mayoría, envelope centralizado, delegación a servicios real en competitors/references/adn, RPC atómicos donde importa (`apply_sale_payment`).

| # | Problema | Sev | Evidencia |
|---|---|---|---|
| API1 | `getWorkspaceId()` resuelve tenant desde cookie **sin verificar pertenencia** → mis-scoping de capa financiera | Crítico | `src/lib/workspace.ts:13-14,31-33`; usado en `sales/route.ts`, `sales/[id]`, `installments`, `instagram/reels/[id]/sales`, `v1/sales/[id]/payment` |
| API2 | Múltiples estilos de auth + de respuesta; sales en varios URL roots | Alto | `getWorkspaceId`+`Response.json` vs `authenticateRequest`+envelope vs `auth.getUser` crudo |
| API3 | **Cero** rutas usan Zod; todo input es `as`-cast + ifs manuales | Alto | `grep "from 'zod'"` en rutas = vacío |
| API4 | Sin wrapper higher-order; auth+try/catch+envelope copy-pasteado en 55 handlers | Alto | `src/lib/api/` solo tiene `auth.ts` y `response.ts` |
| API5 | Aislamiento de tenant depende de disciplina por handler, no de enforcement central | Alto | `scripts/comments/route.ts` agrega guard manual porque RLS no cubre el INSERT |
| API6 | `hooks/classify` toma `workspace_id` del body sin verificar ownership (depende solo de RLS) | Alto | `hooks/classify/route.ts` |
| API8 | Envelope/status inconsistentes incluso dentro de v1 | Medio | `apiSuccess({items})` vs `{competitors}` vs `apiSuccess(data)` |
| API9 | Paginación implementada en una sola ruta; el resto unbounded o hard-cap silencioso | Medio | solo `v1/reels` usa `apiPaginated` |

**Recomendaciones:** ver §5. Wrapper `withRoute()`; Zod en todo input; eliminar/arreglar `getWorkspaceId`; consolidar sales en `/api/v1/sales`; cerrar gap de `hooks/classify`. **Unificar tenancy en `authenticateRequest` con verificación de membership** — si eso amplía/cambia accesos, es decisión de producto + modelo RLS desplegado primero, no un refactor mecánico.

### 3.7 Sync / Cron / Edge

**Estado actual.** Dos paths de trigger: pg_cron→edge (autenticado por `x-sync-secret`) y route→work (Node/Vercel, para "Sync now"). Estado en `sync_jobs`, polleado por `sync/status`. **Lo bueno:** trabajo recurrente en Supabase; refresh de token como job aparte; `_shared/` para el lado Deno.

| # | Problema | Sev | Evidencia |
|---|---|---|---|
| SY1 | Lógica de sync **duplicada** entre edge (Deno) y servicios/rutas (Node) — dos motores por plataforma | Crítico | `sync-instagram/index.ts` vs servicios Meta; `sync-youtube/index.ts` vs `src/services/youtube/sync-core.ts` |
| SY2 | `x-sync-secret` comparado con `===` no constante en tiempo, duplicado en 4 funciones | Alto | header-check al tope de cada edge fn |
| SY4 | Sin rate limiter / token bucket cross-tenant para cuotas de Meta/Apify/YouTube | Alto | edge fns hacen fan-out inline |
| SY5 | Idempotencia/watchdog de `sync_jobs` no demostrablemente seguros | Alto | `20260420000048_sync_jobs_watchdog` |
| SY6 | Cron `sync-ads-metrics` corre **cada minuto** contra ruta de Vercel | Alto | `cron.job` schedule `* * * * *` |
| SY7 | `sync-core.ts` es un god-file de 1027 líneas | Medio | `src/services/youtube/sync-core.ts` |

**Recomendaciones:** elegir UN runtime por plataforma; centralizar el check de secret (timing-safe) en `_shared/auth.ts`; índice parcial único en `sync_jobs (workspace_id, platform) WHERE status='running'`; rate governor cross-tenant + schedules escalonados; **agregar alerting** (conteo `needs_reauth`, failed-sync por tenant, tasa 4xx/empty de Apify). **Borrar el motor Node solo tras una ventana de paridad de datos.**

### 3.8 Documentación

**Estado actual.** Framework Documentation-Driven Development fuerte (CLAUDE.md hub, routers, protocolo, guardrail MCP). **Pero el contenido driftó del código** y hay una fuga de secretos real.

| # | Problema | Sev | Evidencia |
|---|---|---|---|
| DOC1 | **JWTs reales de Supabase (anon + `service_role`, Dev Y Prod) commiteados** | Crítico | `docs/05-environments-guide.md` L202-203, L209-210 (JWTs `eyJhbGci...` decodificables, en historial de git) |
| DOC2 | Árbol de carpetas en `02-architecture.md` parcialmente ficticio | Alto | referencia archivos/carpetas inexistentes |
| DOC3 | `API_DOCS.md` stale, cubre ~26/56 rutas | Alto | header desactualizado |
| DOC4 | Índices hand-maintained stale (faltan feature-docs del router) | Alto | falta `arko-live-intelligence.md`, `i18n.md`, `sales.md`, `mesa-de-trabajo.md` en el router |
| DOC5 | `.windsurfrules`/`copilot-instructions` omiten el guardrail "solo migra Dev" | Alto | CLAUDE.md §5 lo tiene; los otros no |
| DOC7 | Sin doc de orquestación de APIs externas, capa LLM multi-provider, ni sync/cron | Alto | no hay `docs/09-integrations.md` ni `docs/10-sync-and-jobs.md` |
| DOC8 | `CHANGELOG.md` monolítico (~95 KB) | Medio | merge-conflicts frecuentes |

**Recomendaciones:** ver §9.

---

## 4. Arquitectura objetivo

### Reglas de capas (enforced por `eslint-plugin-boundaries`)

```
route handler (fino)  ->  domain service  ->  provider client  ->  API externa
                          domain service  ->  db (supabase)
```

- **Routes** (`src/app/api/v1/**`): parse + authz + validación Zod + llamar UN servicio + devolver envelope. Sin `fetch` externo, sin lógica de negocio, sin `NextResponse.json` crudo. Objetivo < 120 líneas.
- **Domain services** (`src/services/<domain>`): orquestación + persistencia. Nunca construyen URLs de Graph/Apify ni hablan con providers directo — llaman a provider clients.
- **Provider clients** (`src/lib/providers/<provider>`): el ÚNICO lugar que conoce base URL, versión, header de auth, catálogos de campos/métricas, retry/backoff, clasificación de errores, paginación y emisión de costo. Un cliente tipado por proveedor.
- Routes no importan routes; components no importan services directo (solo vía hooks); services no importan internals de otros services (solo el index público).

### Límite Deno (edge) vs Node (servicios) — explícito

> El punto más propenso a romper la idea de "código compartido". Se adopta el límite **seguro**, no el ingenuo.

- Los provider clients se escriben como **núcleos sin dependencias que reciben `fetch` + config por inyección** (NO leen `Deno.env`/`process.env` adentro, NO usan imports por URL `esm.sh` en el core). Viven canónicamente en `supabase/functions/_shared/providers/`.
- El lado Node los re-exporta desde `src/lib/providers/<provider>` vía un **sync con checksum en CI** que falla el build si divergen.
- **Adapters finos por runtime** leen el env y arman el cliente: el adapter Deno usa `Deno.env.get`; el Node usa `process.env`.
- **CI obligatorio:** correr `deno check` **y** `tsc` sobre los módulos compartidos. Un checksum idéntico garantiza bytes iguales, **no** que compile bajo ambos toolchains.

> **No se adopta** la copia byte-idéntica ingenua. El "pure modules over fetch con config inyectada" es la frontera correcta.

### Árbol de carpetas propuesto

```
src/
  app/
    (admin)/ (auth)/ (dashboard)/ (public)/        # tiers de UI (mantener)
    api/v1/                                          # namespace ÚNICO; handlers finos
      sales/ competitors/ references/ instagram/ youtube/ ads/
      hooks/ content-plan/ scripts/ sync/ auth/ ...
      health/route.ts                               # excepción no-auth documentada
      webhooks/meta/data-deletion/route.ts          # UNO canónico, pinneado en Meta
  lib/
    api/        auth.ts response.ts handler.ts(withRoute) schemas/
    providers/                                       # NUEVO: un cliente por proveedor
      meta/    client.ts version.ts fields.ts errors.ts pagination.ts
      apify/   client.ts actors.ts mappers.ts
      ai/      index.ts(callLLM) openai.ts anthropic.ts gemini.ts usage.ts prompts/
      google/  (absorbe el actual google/token-refresh.ts)
    supabase/   workspace.ts concurrency.ts env.ts
  services/                                          # orquestación por dominio (NO plano)
    instagram/ youtube/ ads/ competitors/ references/ sales/ onboarding/ ai/
  components/
    ui/ layout/ features/<domain>/                   # UN árbol; borrar scaffolds vacíos
  hooks/  types/  constants/ i18n/
supabase/
  functions/_shared/providers/{meta,apify,ai}/        # clientes núcleo (pure, config inyectada)
  functions/_shared/auth.ts                            # UN check timing-safe de x-sync-secret
  functions/{sync-instagram,sync-youtube,scrape-competitors,refresh-meta-tokens}/
  migrations/                                          # numeradas, gated en CI, Dev==Prod
```

### Responsabilidades concretas de cada cliente

- **MetaGraphClient:** `META_GRAPH_VERSION` único, catálogos tipados (media/reel/story/account), inyección de header de auth, **descifrado de token al momento de la llamada** (vía RPC existente), clasificación de errores (4/17/32/613→backoff; 190→`needs_reauth`; 5xx→transient), regla CAROUSEL una vez, iterador de paginación + knob de max-concurrency.
- **ApifyClient:** `resolveApifyToken` validado una vez, `runActorSync/Async(actor,input,{timeoutMs,retries})`, mappers tipados `ScrapedIgProfile/ScrapedIgReel`, retry en 429/5xx, distinción fallo-vs-vacío, emisión de costo keyed por actor ID.
- **AI client:** `callLLM({provider})` con adapters OpenAI/Anthropic/**Gemini** devolviendo token splits normalizados; resiliencia compartida (truncación de historial, shrink-retry, `safeParseLLMJson`); registry de prompts; constantes de modelo/provider cableadas a PRICING; toda llamada pasa por `logLLMUsage`.

---

## 5. Convenciones de API canónicas

**Documentar en `docs/API_DOCS.md` como fuente única:**

1. Toda ruta bajo `/api/v1`, salvo webhooks externos explícitamente listados.
2. Auth SIEMPRE vía `authenticateRequest` con un workspace id **explícito y verificado** — eliminar el fallback cookie/first-owned de `getWorkspaceId`.
3. Toda respuesta vía `lib/api/response.ts` con una convención única de success-key y un **enum estable de error-code**.
4. Todo input validado con **Zod** (body/params/query).
5. Paginación vía `apiPaginated`.
6. Enforce vía wrapper `withRoute()` + regla ESLint que prohíbe `NextResponse.json`/`Response.json` crudos dentro de `src/app/api/**`.

> **Aclaración honesta:** `withRoute` + Zod **no** dan aislamiento de tenant "por construcción". Un wrapper no puede forzar el `.eq('workspace_id')` por query — solo RLS puede. El wrapper es **necesario pero no suficiente**; la RLS member-aware debe aterrizar **con o antes** del reorg de API. `hooks/classify` es la prueba viva.

### Rutas a migrar / renombrar / colapsar

| Acción | Rutas | Destino |
|---|---|---|
| **Colapsar** (dos namespaces → uno) | `src/app/api/sales/*` | Borrar legacy tras confirmar `/api/v1/sales` vivo; redirect/410 por un release |
| **Mover a v1** | `src/app/api/instagram/reels/[id]/sales` | `GET /api/v1/sales?reelId=...` |
| **Mover off `getWorkspaceId`** | `src/app/api/v1/sales/[id]/payment` | helper verificado (mantener RPC atómico `apply_sale_payment`) |
| **Reconciliar** (dos → uno) | `src/app/api/data-deletion-callback` + `src/app/api/v1/auth/meta/data-deletion` | UN callback con `signed_request` verificado, cascada completa. **Verificar la URL pinneada en el dashboard de Meta ANTES de renombrar.** |
| **Borrar** (muerta) | `reels/[id]/analyze/route.ts` | limpiar las filas `reel_diagnostics` 'pending' acumuladas |
| **Borrar** (alias) | `reels/[id]/arkoai-analyze/route.ts` | dejar UNA ruta canónica de analyze |
| **Fix auth** | `hooks/classify` (verificar ownership de `body.workspace_id`) | — |
| **Mantener** | `/api/v1/health` | excepción no-auth documentada |

---

## 6. Mejores prácticas de Meta Graph API a adoptar

1. **UN `META_GRAPH_VERSION`** dentro del cliente; borrar los literales `v25.0` repartidos y el `v22.0` suelto en `sync-instagram:1256`.
2. **Retry/backoff con jitter consciente de error-codes:** 4/17/32/613 → rate-limit; OAuthException 190 → token inválido (`needs_reauth`, stop, notificar); 5xx/red → transient. Una vez, en el cliente.
3. **Endurecer el auto-refresh de token:** refrescar cualquier conexión que venza dentro de un margen seguro (7–10 días), respetar la regla `>24h-since-issue` de Meta, marcar `needs_reauth` + notificar en fallo, verificar la cadencia de pg_cron en `20260504000090`.
4. **Paginación + un solo knob de max-concurrency** centralizados en el cliente.
5. **Regla CAROUSEL_ALBUM una sola vez** (solo `like_count`/`comments_count`).
6. **UN data-deletion callback** verificado con `signed_request`, cascada completa por tenant; **probar que la cascada cubre cada tabla derivada**.
7. **Minimizar OAuth scopes**; `state` CSRF session-bound y single-use.
8. **Auditar la gestión de la clave pgcrypto** y el path de descifrado del RPC `get_meta_access_token` (tokens YA cifrados — no migrar columna).

---

## 7. Estrategia unificada de proveedores externos

**Un cliente por proveedor, compartido entre Node y Deno** vía módulos pure (config inyectada) en `supabase/functions/_shared/providers/{meta,apify,ai}/`, re-exportados a `src/lib/providers/` con gate de checksum + `deno check`/`tsc` en CI.

| Concern | Meta | Apify | LLM |
|---|---|---|---|
| **Un cliente** | `MetaGraphClient` | `ApifyClient` | `callLLM` + adapters (incl. Gemini) |
| **Versión/IDs** | `META_GRAPH_VERSION` único | actor IDs en `actors.ts` | constantes modelo/provider |
| **Token** | descifrar al momento (RPC) | `resolveApifyToken` validado 1 vez | keys vía env adapter |
| **Errores** | 4/17/32/613/190/5xx | 429/5xx + fallo-vs-vacío | transient + context-overflow |
| **Costo** | — | `logIntegrationUsage` keyed por actor | `logLLMUsage` con counts reales |
| **Rate** | backoff + max-concurrency | retry + run async para pesados | shrink-retry |

**Caché / dedup / control de costo:** guard de `last_scraped_at` (con flag `force`) al tope de ambas rutas de scrape; caps por workspace; `WHERE last_scraped_at < now()-interval` + `LIMIT` en el cron; toda llamada externa loguea costo con datos reales (eliminar fabricación 85/15); `logIntegrationUsage` en la edge fn.

**Rate limiting con números (no hand-waving):** YouTube Data API **10.000 unidades/día** es probablemente la restricción vinculante a 100+ tenants — computar costo por sync y pedir aumento/escalonar. Meta BUC per-app/per-user → backoff + max-concurrency. Apify runs concurrentes por plan → run async + cola. Governor cross-tenant compartido + schedules escalonados.

**Secretos en dos runtimes:** la clave pgcrypto, el token de Apify, el app secret de Graph y las keys de LLM deben vivir en Vercel env Y Supabase edge secrets, sincronizadas. Definir una fuente única + procedimiento (`vercel env` / `supabase secrets set`).

---

## 8. Plan de base de datos

### Índices a agregar (Fase 1, `CONCURRENTLY`)

| Índice | Tabla | Razón |
|---|---|---|
| `(workspace_id, date DESC)` | `reel_metrics_daily` | toda query de dashboard filtra por ws + rango de fecha |
| `(workspace_id, date DESC)` | `ad_metrics_daily` | idem |
| `(workspace_id, date DESC)` | `ig_account_insights` | idem |
| `(workspace_id, metric_date DESC)` | `yt_channel_metrics_daily` | idem |
| `(workspace_id, posted_at DESC)` | `competitor_reels` | listados por tenant |
| `unique (content_plan_id, version_number)` + idx en `content_plan_id` | `content_plan_versions` | integridad de versionado + lookups |

Dropear los índices bare por `date` que el advisor reporta unused.

### Checklist de auditoría RLS

- [x] Re-correr `get_advisors(security)` en Prod en vivo (baseline tomado 2026-06-02: 1 ERROR + 1 INFO + ~60 WARN).
- [x] **D1:** `reel_computed` → `SECURITY INVOKER`. Aplicado Dev+Prod, 0 ERROR tras el fix, datos idénticos. (PR #98)
- [x] **D2:** policy en `data_deletion_requests` (RESTRICTIVE deny anon/authenticated; service_role bypassa). (PR #99)
- [x] **D3:** `search_path` fijo en ~19 funciones (las de tokens con `extensions` para no romper el descifrado). (PR #99)
- [ ] Toda tabla tenant-scoped tiene RLS habilitado y la policy filtra por **membership** (`is_workspace_member`), no solo `auth.uid()`. *(auditoría pendiente)*
- [ ] Verificar que `service_role` (edge functions) no expone datos cross-tenant.
- [ ] Verificar que el data-deletion callback cascadea sobre **todas** las tablas derivadas del tenant.
- [ ] `get_advisors(performance)` en Prod para el plan de índices de la Fase 1.

---

## 9. Plan de documentación

- **DOC1 (CRÍTICO):** sacar las claves de `docs/05-environments-guide.md`, reemplazar por placeholders + instrucción de "obtener desde Supabase Dashboard"; **rotar las claves** y **purgar el historial de git** (ver §12).
- Actualizar `API_DOCS.md` y `DB_SCHEMA.md` al estado real (script que liste rutas + `generate_typescript_types` para el esquema).
- Agregar feature docs faltantes: `docs/09-integrations.md` (Meta/Apify/LLM), `docs/10-sync-and-jobs.md`, y los del router (`sales.md`, `i18n.md`, `mesa-de-trabajo.md`, `arko-live-intelligence.md`).
- `CLAUDE.md` como fuente única de reglas IA; `.windsurfrules` y `copilot-instructions` → puntero a `CLAUDE.md` (incluir el guardrail "solo migra Dev").
- Archivar CHANGELOG viejo por trimestre en `docs/changelog/`.
- **Checklist docs-as-code atado a PR:** tocó API → `API_DOCS`; tocó DB → `DB_SCHEMA` + migración; feature nueva → feature doc + CHANGELOG; cambió arquitectura → este doc.

---

## 10. Roadmap por fases

> Cada fase es shippable e independiente. **Seguridad primero** (claves filtradas + ERROR de RLS), después DB-first, después la red de tests, después el refactor keystone, después limpieza. Verificar PITR de Prod antes de cualquier DDL.

| Fase | Objetivo | Acciones | Esfuerzo | Riesgo | Métrica de éxito |
|------|----------|----------|----------|--------|------------------|
| **F0 — Seguridad crítica** | Cerrar lo urgente y real | **Rotar claves Supabase Dev+Prod** + runbook de propagación (Vercel envs + 4 edge secrets con `--no-verify-jwt` + pg_cron) + sacar claves de docs; fix `reel_computed` (D1); policies `data_deletion_requests` (D2); `search_path` en funciones (D3); consolidar data-deletion en 1 endpoint | S–M | 🟠 | Claves rotadas/propagadas; 0 ERROR en `get_advisors`; secretos fuera del repo |
| **F1 — Limpieza + tenancy** | Quick wins + cerrar API1 | Borrar basura raíz (`adn-call.txt`, `gcm-diagnose.log`, `original-*.webp`, `notes.md`); arreglar `getWorkspaceId` (verificar pertenencia) + unificar en `authenticateRequest`; **pre-auditar filas de sales mis-scopeadas** antes de cambiar el helper | S–M | 🟠 | 1 sola función de tenancy con verificación; repo limpio |
| **F2 — Constantes Meta + índices DB** | Eliminar drift + escala | `META_GRAPH_VERSION` único (+ fix `v22.0`); índices compuestos `CONCURRENTLY` (D5); unificar familia de métricas (D6); `content_plan_versions` (D7) | S–M | 🟢 | Bump de versión = 1 archivo; queries de dashboard usan índice |
| **F3 — Tests + observabilidad** | Red de seguridad pre-refactor | Tests de integración de los clientes Meta/Apify/AI; logs estructurados + **alerting** (jobs fallidos, `needs_reauth`, 4xx/empty de Apify) | M | 🟢 | Cobertura de los 3 clientes; alertas activas |
| **F4 — Cliente Meta unificado** | Resolver R1+R2 (Meta) | `lib/providers/meta` (núcleo pure) con backoff + errores + paginación; refactor de `sync-instagram` y servicios Node para usarlo, **detrás de feature flag con corrida paralela viejo/nuevo comparando datos** | L | 🔴 | 1 implementación de Graph; output de datos idéntico antes de cortar |
| **F5 — Apify + IA unificados** | Resolver R1 (Apify/IA) | `lib/providers/apify` (caché/dedup) + adapter Gemini detrás de `callLLM`; colapsar 3 rutas de analyze en 1 + limpiar huérfanos; `logLLMUsage`/`logIntegrationUsage` en TODA llamada con counts reales | L | 🟠 | 1 pipeline scraping; 1 ruta análisis; costos reales visibles |
| **F6 — API + estructura + docs** | Resolver R3+R4+R5 | Migrar todo a `/api/v1` (redirects); `withRoute()` + Zod + envelope; extraer lógica de handlers gordos a servicios; `services/` por dominio; unificar árbol de componentes; retention DB (D8); actualizar docs + feature docs faltantes | L | 🟠 | 100% /v1; handlers <120 líneas; 1 árbol de componentes; docs al día |

---

## 11. Quick wins inmediatos

1. ✅ **Sacar claves Supabase de `docs/05`** → placeholders. (PR #97) · 🟡 **Rotarlas** sigue pendiente (ver §12).
2. ✅ **Fix `reel_computed`** (único ERROR) + ✅ **policy `data_deletion_requests`**. (PR #98, #99)
3. ⬜ **Borrar basura raíz:** `adn-call.txt`, `gcm-diagnose.log`, `original-*.webp`, `notes.md` (revisar `.gitignore`).
4. ⬜ **Consolidar los 2 endpoints de data-deletion** en uno registrado en Meta.
5. ⬜ **`META_GRAPH_VERSION` único** + arreglar el `v22.0` suelto.
6. ⬜ **Mapear las 3 rutas de análisis de reel** y borrar la muerta + el alias; limpiar `reel_diagnostics` huérfanos.
7. ❌ ~~Bajar el cron `sync-ads-metrics`~~ — **no existe** (alucinación de la auditoría; los 8 crons reales son sanos).

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Rotar claves rompe consumidores | Runbook coordinado: Vercel prod+preview envs → redeploy; `supabase secrets set` para las 4 edge functions → redeploy **con `--no-verify-jwt`** (sino rompe `x-sync-secret` con 401); recrear cualquier pg_cron que embeba el secret |
| Purga de historial de git (claves) | Es un force-push que reescribe `main`; hacerlo en ventana sin PRs en vuelo. La rotación deja las claves inútiles igual, así que la purga se puede agendar aparte |
| Refactor de Meta (F4) rompe sync en Prod | Feature flag + corrida paralela viejo/nuevo comparando **datos** antes de cortar; F3 (tests) primero |
| Compartir código Node/Deno no es trivial | F2 centraliza solo constantes; núcleo isomórfico con `fetch` + config inyectada; nunca symlink; CI con `deno check` **y** `tsc` |
| Unificar tenancy cambia accesos | Pre-auditar filas de sales mis-scopeadas; si `authenticateRequest` member-aware amplía acceso, es decisión de producto + RLS primero |
| Colapsar rutas/analyze rompe el front | Mapear uso real; deprecar antes de borrar |
| Tocar DB/RLS en Prod | Verificar PITR primero; DB antes que código; mostrar SQL; aplicar de a una; verificar con `get_advisors` |

---

## Apéndice — Metodología

Workflow de **11 agentes** (8 auditores + arquitecto + crítico + redactor), ~1.7M tokens, ~40 min. Útil para mapear estructura, **pero con alucinaciones en datos puntuales** (ver tabla en §0). **Cada hallazgo crítico/alto se verificó a mano** contra código, migraciones y `get_advisors`/`list_projects` en vivo antes de incluirlo. Antes de ejecutar la Fase 0, re-correr `get_advisors(security)` y `get_advisors(performance)` en vivo para tener los conteos exactos del momento.
