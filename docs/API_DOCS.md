# Documentación de API

**Base URL:** `/api/v1`
**Autenticación:** Bearer Token (JWT via Supabase Auth)
**Última actualización:** 2026-03-18 00:30
**PRD de referencia:** `docs/ARKO_PRD_INSTAGRAM_v1.md`

---

## Autenticación

Endpoints protegidos requieren sesión activa de Supabase Auth.
Además, todos los endpoints protegidos requieren `workspace_id` via:
- Header: `x-workspace-id`
- Query param: `?workspace_id=...`

---

## Índice de Endpoints

| Método | Ruta | Descripción | Auth | PRD |
|--------|------|-------------|------|-----|
| GET | `/api/v1/health` | Estado del servidor | NO | — |
| POST | `/api/v1/auth/meta/connect` | Iniciar OAuth de Meta | SI | 4.3 |
| POST | `/api/v1/auth/meta/disconnect` | Desconectar cuenta de Meta/Instagram | SI | 4.3 |
| GET | `/api/v1/auth/meta/callback` | Callback OAuth de Meta | NO* | 4.3 |
| GET | `/api/v1/workspaces` | Listar workspaces del usuario | SI | — |
| POST | `/api/v1/workspaces` | Crear workspace | SI | — |
| POST | `/api/v1/meta/explorer` | Ejecutar requests arbitrarias a Meta Graph API y devolver JSON crudo | SI | — |
| GET | `/api/v1/reels` | Listar reels con métricas y badges | SI | 8.1 |
| GET | `/api/v1/reels/[id]` | Ficha completa de un Reel | SI | 8.2 |
| POST | `/api/v1/reels/[id]/arkoai-analyze` | Analizar Reel con ArkoAI y persistir resultado | SI | 8.2 |
| POST | `/api/v1/reels/[id]/analyze` | Generar diagnóstico IA (bajo demanda) | SI | 9.3 |
| GET | `/api/v1/dashboard/stats` | Stats agregados del dashboard | SI | 8.1 |
| POST | `/api/v1/sync/instagram` | Trigger sync de IG + Ads | SI | 5.3 |
| GET | `/api/v1/sync/cron` | Background auto-sync (Vercel Cron) | CRON_SECRET | 5.3 |
| GET | `/api/v1/sync/status` | Estado de sync jobs | SI | — |
| POST | `/api/v1/chat` | Arko AI — chat con context-aware grounding | SI | 8.3 |
| GET | `/api/v1/chat/sessions` | Listar sesiones de chat | SI | — |
| DELETE | `/api/v1/chat/sessions?id=xxx` | Eliminar sesión de chat | SI | — |
| GET | `/api/v1/chat/messages?session_id=xxx` | Mensajes de una sesión | SI | — |
| GET | `/api/v1/onboarding/chat` | Estado + historial del onboarding ADN | SI | — |
| POST | `/api/v1/onboarding/chat` | Procesar mensaje del onboarding ADN | SI | — |
| POST | `/api/v1/competitors/[id]/scrape` | Scrapear perfil + reels de un competidor via Apify | SI | — |
| POST | `/api/v1/competitors/[id]/analyze` | Analizar reels de un competidor con IA | SI | — |

*El callback es redirigido por Meta, no requiere auth header pero valida state/CSRF.

---

## Formato de Respuestas

### Exitosa
```json
{ "data": { ... } }
```

### Paginada
```json
{
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 30, "total": 100, "totalPages": 4 }
}
```

### Error
```json
{ "error": "Bad Request", "message": "Descripción", "details": { } }
```

### Accepted (async)
```json
{ "data": { "job_id": "...", "status": "queued", "message": "..." } }
```

---

## Endpoints

### Health Check
**`GET /api/v1/health`** — Sin autenticación

### Meta OAuth Connect
**`POST /api/v1/auth/meta/connect`**
- Body: `{ "workspace_id": "uuid" }`
- Response: `{ "data": { "oauth_url": "https://facebook.com/..." } }`
- Al iniciar un nuevo intento, la conexión del workspace se marca temporalmente como `pending` y se limpia `last_error` previo.
- El frontend redirige al usuario a `oauth_url`.

### Meta OAuth Callback
**`GET /api/v1/auth/meta/callback`**
- Recibe `code` y `state` de Meta.
- Intercambia por long-lived token, descubre assets (pages, IG account, ad accounts).
- Persiste en `meta_connections` con tokens encriptados.
- Si falla el intercambio de token, el usuario cancela OAuth, falta `code/state` o no se encuentra una cuenta de Instagram Business válida, actualiza `meta_connections.status` a `error`, persiste `last_error` y redirige a `/onboarding?error=...`.
- Si completa correctamente el flujo, redirige a `/instagram/bootstrap` para disparar la sincronización inicial automática y mostrar una pantalla de preparación del workspace.

### Meta Disconnect
**`POST /api/v1/auth/meta/disconnect`**
- Requiere `workspace_id` del workspace autenticado.
- Limpia tokens, IDs y permisos almacenados en `meta_connections`.
- Cambia el estado a `revoked` para que la UI trate la cuenta como desconectada y permita volver a iniciar OAuth.
- Response 200: `{ "data": { "status": "disconnected" } }`

### Workspaces
**`GET /api/v1/workspaces`** — Lista workspaces del usuario.
**`POST /api/v1/workspaces`** — Crea workspace. Body: `{ "name": "Mi Marca" }`.

### Meta Explorer
**`POST /api/v1/meta/explorer`**
- Requiere `workspace_id` del workspace con conexión activa a Meta.
- Body: `{ "path": "/{ig_account_id}/media", "params": { "fields": "id,caption,media_type,media_product_type,permalink,media_url,thumbnail_url,timestamp,is_shared_to_feed,like_count,comments_count", "limit": "5" } }`
- Reemplaza automáticamente placeholders de la conexión activa del workspace: `{ig_account_id}`, `{fb_user_id}`, `{fb_page_id}`, `{page_id}`.
- Devuelve el JSON crudo de Meta junto con `meta_status`, `elapsed_ms`, `resolved_url` sanitizada y `connection_context` (`ig_business_account_id`, `ig_username`, `page_id`, `page_name`, `fb_user_id`).
- La UI de `/meta` incluye presets alineados con la documentación actual de `/{media_id}/insights`, distinguiendo métricas activas versus deprecated y mostrando breakdowns válidos (`action_type`, `story_navigation_action_type`).
- Uso previsto: debugging y descubrimiento de fields/metrics reales de Meta sin especular desde el código.

### Reels (Listado)
**`GET /api/v1/reels`**
- Query: `workspace_id`, `page`, `limit`, `type`, `sort`, `order`
- Response: `ReelCard[]` con `performer_multiple`, `is_top_performer`, `views_org/paid/total`

### Reel (Detalle — Ficha)
**`GET /api/v1/reels/[id]`**
- Response: Reel completo + metrics + paid + transcript + narrative + visual + audio + diagnostics + benchmark
- `computed` incluye además `reach_org/paid/total`, `impressions_org/paid/total`, `total_interactions`, `avg_watch_time_sec`, `watch_time_total_sec`, `paid_clicks`, `paid_video_plays`, `spend_cents`, `engagement_rate`, `paid_ctr`, `paid_cpm` y `paid_cpv`.
- `paid_clicks` prioriza `outbound_clicks` o `inline_link_clicks` de Marketing API cuando Meta los devuelve; usa `clicks` genérico solo como fallback.
- Si `APIFY_API_TOKEN` está configurado y el Reel es público, la respuesta incluye `external_public_data` con transcript público, view/play count públicos, shares públicas, hashtags, mentions, audio, tagged/coauthor usernames y últimos comentarios públicos.

### Reel Analyze with ArkoAI
**`POST /api/v1/reels/[id]/arkoai-analyze`**
- Requiere `video_url` pública en el body: `{ "video_url": "https://...mp4" }`.
- Ejecuta análisis completo con ArkoAI sobre el video.
- Persiste el resultado en `reel_transcripts`, `reel_narrative_analysis`, `reel_visual_analysis` y `reel_audio_analysis` reutilizando las tablas analíticas existentes.
- La ruta anterior se mantiene como alias interno por compatibilidad, pero la UI debe usar `arkoai-analyze`.
- Response 200: `{ "data": { "analysis": { ... } } }`

### Reel Analyze (Diagnóstico IA)
**`POST /api/v1/reels/[id]/analyze`**
- Requiere transcripción completada.
- Crea `reel_diagnostics` en estado `pending`.
- Response 202: `{ "diagnostic_id": "...", "status": "pending" }`

### Dashboard Stats
**`GET /api/v1/dashboard/stats`**
- Response: `total_reels`, `total_views`, `avg_views`, `total_views_org/paid`, `top_performers_count`, `benchmark`

### Sync Instagram
**`POST /api/v1/sync/instagram`**
- Requiere `meta_connections` activa.
- Crea `sync_jobs` en estado `queued`.
- Se usa tanto para sincronización manual desde `/instagram` como para la sincronización inicial automática inmediatamente después de conectar una cuenta de Instagram.
- Cuando corre `steps=all` o `steps=media`, además de sincronizar Reels y Ads recalcula el snapshot persistido `reel_benchmarks` del workspace para que la ficha lea promedios de cuenta ya materializados.
- **Performance v2:** insights se fetchean en paralelo (concurrency=5), Apify en paralelo (concurrency=3), Ads + Account corren en paralelo después de media. `MAX_INSIGHTS_PER_SYNC=50`.
- Response 200: `{ "data": { "status", "reels", "ads", "benchmark", "account", "errors" } }`

### Sync Cron (Background Auto-Sync)
**`GET /api/v1/sync/cron`**
- Endpoint para sincronización automática en segundo plano. Diseñado para Vercel Cron.
- Autenticación: header `Authorization: Bearer <CRON_SECRET>`. Sin `CRON_SECRET` configurado retorna noop.
- Itera todos los workspaces con conexión Meta activa y ejecuta full sync (media + ads + account + benchmark) para cada uno.
- Frecuencia recomendada: cada 6 horas (`0 */6 * * *` en `vercel.json`).
- `maxDuration=300` (5 min) para Vercel Pro.
- Response 200: `{ "data": { "status", "workspaces_synced", "total_duration_ms", "summaries" } }`

### Sync Status
**`GET /api/v1/sync/status`**
- Query: `workspace_id`, `job_id` (opcional)
- Response: último(s) sync job(s)

### Arko AI — Chat
**`POST /api/v1/chat`**
- Header: `x-workspace-id`
- Body: `{ "session_id?", "message" }`
- Topic detection por keywords → carga contexto relevante (ADN + dominio).
- LLM: Claude Sonnet via `callLLM()`.
- Usage tracking via `logLLMUsage()`.
- Response: `{ "session_id", "message": { "id", "role", "content", "created_at" }, "tokens_used" }`

**`GET /api/v1/chat/sessions`**
- Header: `x-workspace-id`
- Lista sesiones del workspace (excluye ADN). Max 50.
- Response: `[{ "id", "title", "created_at", "updated_at" }]`

**`DELETE /api/v1/chat/sessions?id=xxx`**
- Header: `x-workspace-id`
- Soft-delete (marca `is_active = false`).
- Response: `{ "deleted": true }`

**`GET /api/v1/chat/messages?session_id=xxx`**
- Header: `x-workspace-id`
- Mensajes de una sesión, ordenados cronológicamente.
- Response: `[{ "id", "role", "content", "created_at" }]`

---

## Códigos de Error Globales

| Código | Descripción |
|--------|-------------|
| 400 | Datos inválidos |
| 401 | Token inválido/expirado |
| 403 | Sin permisos / workspace inválido |
| 404 | No encontrado |
| 429 | Rate limit excedido |
| 500 | Error del servidor |
