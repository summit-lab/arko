# Arko — PRD Técnico: Módulo Instagram / Ads / IA

**Versión:** 1.0  
**Fecha:** 2026-03-18  
**Autor:** Ainnovate Agency  
**Estado:** Draft para validación técnica

---

## 1. Visión del producto

Arko es una plataforma SaaS de análisis de contenido para creadores e-commerce y marcas personales en Instagram. El módulo Instagram es el core del producto — si este funciona, el resto (YouTube, Ads standalone, Customer Voice) es significativamente más simple.

**Propuesta de valor:** Cruzar datos orgánicos de Instagram, datos pagos de Meta Ads y análisis de IA sobre video/guion/audio/visual para entregar diagnósticos accionables que un creador no puede obtener manualmente.

---

## 2. Definiciones clave del negocio

### 2.1 ¿Qué es un Reel "Winner"?

Un Reel se marca como **Top Performer / Winner** cuando cumple:

| Señal | Regla | Prioridad |
|---|---|---|
| Views | `views_total >= 3x promedio_views_90d` | Principal |
| Comentarios | Por encima del promedio, **si el Reel tiene CTA** | Secundaria |
| Follows generados | Por encima del promedio | Secundaria |
| Saves ratio | Por encima del promedio | Secundaria |

El badge visual debe funcionar como vidIQ: un indicador tipo `x3`, `x5`, `x8` sobre cada thumbnail en el dashboard.

### 2.2 Benchmark de 90 días

- Ventana móvil de 90 días por cuenta.
- Excluir del benchmark Reels en borrador o sin métricas suficientes.
- Permitir opción de excluir Trial Reels del cálculo.
- Fallback: threshold mínimo de views (ej. >= 5000) si la detección de Trial no es confiable.

### 2.3 Distinción Reel vs Trial Reel

**Problema:** Los Trial Reels distorsionan el promedio — pueden tener 200 views o 70.000. Si se mezclan con Reels normales, el benchmark pierde sentido.

**Heurística:**

| Condición | Clasificación |
|---|---|
| `media_product_type = REELS` + `is_shared_to_feed = true` | `normal` |
| `media_product_type = REELS` + `is_shared_to_feed = false` | `trial_likely` |
| Señal ausente o ambigua | `unknown` |

**Fallback si la heurística no es confiable:** Solo incluir en benchmark Reels con >= 5000 views (umbral configurable por workspace).

> **Nota:** No existe endpoint público con flag `is_trial_reel`. La distinción es 100% heurística.

### 2.4 Distinción orgánico vs pago

- `views_org` → Instagram Graph API
- `views_paid` → Marketing API
- `views_total = views_org + views_paid` cuando el mapeo es sólido
- Si el mapping no es perfecto → marcar `attribution_confidence: low|medium|high`

**Esto es crítico:** Sin esta separación, un Reel con 250K views (de las cuales 150K son Ads) se lee como winner orgánico cuando no lo es. La plataforma DEBE separar esto antes de emitir cualquier diagnóstico.

---

## 3. Arquitectura general

### 3.1 Componentes

```
┌─────────────────────────────────────────────────────┐
│                   Frontend SaaS                      │
│   Dashboard · Ficha de Reel · Chat analítico         │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                   Backend API                        │
├─────────────┬────────────┬──────────┬───────────────┤
│ OAuth Meta  │ Sync IG    │ Sync Ads │ Pipeline IA   │
│ Login       │ Media +    │ Insights │ (ASR, OCR,    │
│             │ Insights   │          │  Visión, LLM) │
├─────────────┴────────────┴──────────┴───────────────┤
│          Motor de métricas + Benchmarking            │
├─────────────────────────────────────────────────────┤
│     Storage relacional + Object Storage (media)      │
├─────────────────────────────────────────────────────┤
│     Auditoría de respuestas del chat (grounding)     │
└─────────────────────────────────────────────────────┘
```

### 3.2 Fuentes de datos

| Fuente | Datos |
|---|---|
| Instagram Graph API | Perfil, media, insights orgánicos |
| Marketing API | Insights pagos por ad/adset/campaign |
| API externa de transcripción | Transcript con timestamps |
| API externa de visión/OCR | Frames, texto en pantalla, contexto visual |

### 3.3 Módulos técnicos

| Módulo | Responsabilidad |
|---|---|
| `auth_meta` | OAuth, tokens, refresh, permisos |
| `sync_instagram_media` | Ingesta de Reels y metadata |
| `sync_instagram_insights` | Métricas orgánicas por Reel |
| `sync_ads_insights` | Métricas pagas por ad account |
| `map_reel_to_ads` | Cruce Reel ↔ Ad por `object_story_id` / `creative` / permalink |
| `media_storage` | Descarga y almacenamiento de MP4, thumbnails |
| `transcript_pipeline` | ASR → transcript raw → transcript limpio → líneas de guion |
| `visual_analysis_pipeline` | Extracción de frames → clasificación visual |
| `audio_analysis_pipeline` | Velocidad de habla (WPM), fillers, pausas |
| `llm_analysis_pipeline` | Promesa central, CTA, hook, especificidad, diagnóstico |
| `benchmark_engine` | Cálculo de promedios 90d, ratios, badges |
| `dashboard_api` | API para frontend: listados, filtros, comparaciones |
| `chat_grounding_service` | Context retrieval para el copiloto conversacional |
| `audit_log_service` | Log de cada respuesta del chat con evidencia usada |

---

## 4. Conexión del cliente (OAuth Meta)

### 4.1 Requisitos previos del cliente

- Instagram Business o Creator.
- Cuenta de Instagram conectada a una Página de Facebook.
- Acceso a al menos una cuenta publicitaria de Meta.

### 4.2 Permisos a solicitar

**Mínimos:**

- `instagram_graph_user_profile`
- `instagram_graph_user_media`
- `instagram_manage_insights`
- `pages_show_list`
- `pages_read_engagement`
- `ads_read`

**Opcional:**

- `business_management`

### 4.3 Flujo OAuth completo

#### Paso 1 — Iniciar login

```
GET https://www.facebook.com/v20.0/dialog/oauth
  ?client_id={app_id}
  &redirect_uri={redirect_uri}
  &state={csrf_state}
  &response_type=code
  &scope=instagram_graph_user_profile,instagram_graph_user_media,instagram_manage_insights,pages_show_list,pages_read_engagement,ads_read
```

| Parámetro | Descripción |
|---|---|
| `client_id` | App ID de Meta |
| `redirect_uri` | Callback registrado en la app |
| `state` | Valor anti-CSRF |
| `response_type` | `code` (server-side flow) |
| `scope` | Permisos requeridos |

Opcional: `auth_type=rerequest` para volver a pedir permisos rechazados.

#### Paso 2 — Intercambiar code por access token

```
GET https://graph.facebook.com/v20.0/oauth/access_token
  ?client_id={app_id}
  &redirect_uri={redirect_uri}
  &client_secret={app_secret}
  &code={code}
```

Respuesta: `access_token`, `token_type`, `expires_in`.

#### Paso 3 — Validar token

```
GET https://graph.facebook.com/debug_token
  ?input_token={user_access_token}
  &access_token={app_access_token}
```

#### Paso 4 — Verificar permisos otorgados

```
GET /me/permissions
```

#### Paso 5 — Descubrimiento de activos

**Listar páginas del usuario:**

```
GET /v20.0/{user-id}/accounts?fields=id,name,access_token,tasks
```

**Resolver cuenta IG conectada a la página:**

```
GET /v20.0/{page-id}?fields=instagram_business_account{id,username}
```

**Listar ad accounts autorizados:**

```
GET /v20.0/{user-id}/adaccounts?fields=id,name,account_status
```

#### Paso 6 — Persistir

Backend guarda: tokens, page_id, ig_business_account_id, ad_account_ids.

---

## 5. Ingesta de datos

### 5.1 Sync de Reels (Instagram Graph API)

**Listar media:**

```
GET /v20.0/{ig-user-id}/media
  ?fields=id,caption,media_type,media_product_type,permalink,timestamp,media_url,thumbnail_url,is_shared_to_feed
```

- Soporta paginación temporal con `since` y `until`.
- Filtrar server-side: `media_product_type = REELS`.

**Insights por Reel:**

```
GET /v20.0/{ig-media-id}/insights
  ?metric=plays,reach,impressions,likes,comments,shares,saved,total_interactions,profile_visits,follows,ig_reels_avg_watch_time
```

Métricas objetivo (según disponibilidad):

| Métrica | Notas |
|---|---|
| `plays` / `views` | Views totales orgánicas |
| `reach` | Cuentas únicas alcanzadas |
| `impressions` | Total de impresiones |
| `likes` | — |
| `comments` | — |
| `shares` | — |
| `saved` / `saves` | — |
| `total_interactions` | — |
| `profile_visits` | Puede no estar disponible para todos los tipos de cuenta |
| `follows` / `media_follows` | Followers generados por el Reel |
| `ig_reels_avg_watch_time` | Watch time promedio |
| `completion_rate` | Si está disponible |

### 5.2 Sync de Ads (Marketing API)

```
GET /v20.0/act_{ad_account_id}/insights
  ?level=ad
  &time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
  &fields=ad_id,ad_name,campaign_id,adset_id,impressions,reach,clicks,spend,video_plays,creative,object_story_id
```

**Mapeo Ad → Reel (backend):**

Usar en orden de prioridad:
1. `object_story_id`
2. `creative` → resolver al `instagram_permalink_url`
3. Match por permalink del Reel guardado previamente

### 5.3 Orden de ejecución del backend

```
1. OAuth
   └─ /dialog/oauth → /oauth/access_token → /debug_token → /me/permissions

2. Descubrimiento
   └─ /{user-id}/accounts → instagram_business_account → ad_accounts

3. Sync orgánico
   └─ /{ig-user-id}/media (filtrar REELS) → /{ig-media-id}/insights por cada uno

4. Sync pago
   └─ /act_{ad_account_id}/insights → mapear cada ad al Reel correspondiente

5. Enriquecimiento IA
   └─ Descargar media_url → Transcribir → Extraer frames → Análisis IA

6. Cálculo
   └─ Benchmark 90d → Ratios por view → views_org/paid/total → Badge top performer
```

---

## 6. Modelo de datos: Ficha de Reel

### 6.1 Datos base

| Campo | Tipo | Fuente |
|---|---|---|
| `reel_id` | string | IG Graph API |
| `account_id` | string | Internal |
| `published_at` | datetime | IG `timestamp` |
| `duration_seconds` | float | Media / transcripción |
| `caption` | text | IG `caption` |
| `permalink` | url | IG `permalink` |
| `media_url` | url | IG `media_url` |
| `thumbnail_url` | url | IG `thumbnail_url` |
| `reel_type` | enum: `normal`, `trial_likely`, `unknown` | Heurística interna |
| `has_ads` | boolean | Mapeo ads |
| `attribution_confidence` | enum: `low`, `medium`, `high` | Mapeo ads |

### 6.2 Métricas

| Métrica | Fuente |
|---|---|
| `views_org` | IG Graph API |
| `views_paid` | Marketing API |
| `views_total` | Calculado |
| `impressions_org` / `_paid` / `_total` | Cruce IG + Ads |
| `reach_org` / `_paid` / `_total` | Cruce IG + Ads |
| `likes_total` | IG Graph API |
| `comments_total` | IG Graph API |
| `shares_total` | IG Graph API |
| `saves_total` | IG Graph API |
| `profile_visits` | IG Graph API (si disponible) |
| `follows_generated` | IG Graph API (si disponible) |
| `avg_watch_time_sec` | IG `ig_reels_avg_watch_time` |
| `retention_ratio` | `avg_watch_time / duration` |
| `completion_rate` | IG (si disponible) o estimación |

### 6.3 Ratios derivados

Todos calculados como `métrica / views_total`:

- `likes_per_view`
- `comments_per_view`
- `shares_per_view`
- `saves_per_view`
- `views_per_impression`
- `follows_per_view`

> Referencia de UX: Instagram Edits muestra estos 4 como métricas clave de engagement: **% likes, % saves, % shares, % comments** sobre views.

### 6.4 Benchmark (comparación 90d)

| Campo | Descripción |
|---|---|
| `avg_views_90d` | Promedio de views en ventana 90d |
| `avg_comments_90d` | Promedio de comentarios |
| `avg_saves_90d` | Promedio de guardados |
| `avg_follows_90d` | Promedio de follows generados |
| `performer_multiple_views` | `views_total / avg_views_90d` |
| `performer_multiple_comments` | Ídem para comentarios |
| `performer_multiple_saves` | Ídem para saves |
| `is_top_performer` | Boolean: `performer_multiple_views >= 3` |

---

## 7. Pipeline IA

### 7.1 Decisión automático vs bajo demanda

| Tipo de análisis | Ejecución | Razón |
|---|---|---|
| Transcripción + limpieza | **Automático** por Reel | Dato base necesario para todo lo demás |
| CTA detection (desde caption) | **Automático** | Bajo costo, alta utilidad |
| Promesa central + topic | **Automático** | Core del producto |
| Nivel de especificidad del lenguaje | **Automático** | Core del producto |
| Extracción de 5-10 frames + clasificación visual básica | **Automático** | Necesario para ficha |
| Velocidad de habla (WPM) | **Automático** | Calculable desde transcript + duración |
| Diagnóstico completo "por qué funcionó / no funcionó" | **Bajo demanda** (botón "Generar análisis") | Alto consumo de tokens LLM |
| Comparación detallada con top performers | **Bajo demanda** | Alto consumo |
| Recomendaciones de hooks/temas/claims | **Bajo demanda** (chat) | Requiere contexto amplio |

### 7.2 Transcripción

**Input:** MP4 del Reel + caption.

**Output:**

| Campo | Descripción |
|---|---|
| `transcript_raw` | Transcripción bruta del ASR |
| `transcript_clean` | Limpieza LLM: corregir palabras sin sentido, organizar en frases coherentes |
| `transcript_lines` | Array de líneas separadas del guion (no un párrafo gordo) |
| `timestamps_por_bloque` | Timestamps por cada bloque/línea |

> **Requisito de UX:** La transcripción debe presentarse como guion legible, separado en líneas, NO como la típica transcripción en bloque. Cada línea debería permitir al usuario identificar: "línea 1-2 = hook, línea 3-8 = desarrollo, línea 9 = CTA".

### 7.3 Análisis narrativo (LLM)

| Campo | Descripción |
|---|---|
| `hook_text` | Texto del hook (primeras líneas) |
| `development_summary` | Resumen del desarrollo |
| `cta_text` | Texto del CTA (si existe) |
| `closing_text` | Cierre del video |
| `core_promise` | Promesa central del video (ej: "generé 500 leads con Trial Reels") |
| `topic_cluster` | Tema/categoría (ej: distribución, producción, historias, estrategia general) |
| `language_specificity` | Qué tan anichado es el lenguaje: términos de nicho detectados vs mainstream |
| `niche_terms_detected` | Lista de términos específicos (ej: "ManyChat", "Trial Reels", "secuencias de historias") |
| `has_cta` | Boolean |
| `cta_type` | Tipo: comentar palabra clave, link en bio, DM, seguir, etc. |

**Contexto del análisis de especificidad:**

La IA debe poder distinguir entre:
- Videos con lenguaje altamente anichado (términos que el nicho entiende pero la audiencia general no) → tienden a funcionar mejor cuando desafían una creencia del nicho.
- Videos con lenguaje genérico/estrategia general → tienden a funcionar peor.
- El patrón clave: usar un término conocido del nicho + desafiar lo que la audiencia cree sobre ese término.

**Patrones de promesa central a clasificar:**

| Tipo de promesa | Performance esperado |
|---|---|
| Redistribución / reutilización de contenido existente | Alto |
| Trial Reels como mecanismo de alcance | Alto |
| Producción de nuevo contenido con estrategia X | Medio-bajo |
| Estrategia general sin especificidad | Bajo |
| Secuencias de historias | Variable (depende del ángulo) |

### 7.4 Análisis visual

**Input:** 5-10 frames extraídos del video.

| Campo | Descripción |
|---|---|
| `orientation` | Vertical / horizontal |
| `format_type` | Talking head, pantalla dividida, pizarrón/screen recording, coaching (2 personas), talking head con diálogo |
| `scene_type` | Cocina, patio, oficina, exterior, etc. |
| `background_context` | Descripción del fondo |
| `text_on_screen` | Texto/claim visible en el frame |
| `clothing_features` | Descripción general de vestimenta |
| `hat_detected` | Boolean (señal correlacionada con performance) |
| `people_count` | 1, 2, o más |
| `shot_type` | Close-up, medio, plano abierto |

**Formato del primer frame (especialmente importante):**

- ¿Tiene texto/claim superpuesto?
- ¿Cara visible?
- ¿Contexto visual del gancho?

### 7.5 Análisis de audio / delivery

| Campo | Descripción |
|---|---|
| `words_total` | Total de palabras en el transcript |
| `speaking_rate_wpm` | Palabras por minuto |
| `filler_density` | Densidad de muletillas (opcional, fase 2) |
| `pauses_estimate` | Estimación de pausas (opcional, fase 2) |

> **Contexto:** El creador habla muy rápido y recibe comentarios al respecto. Correlacionar WPM con performance es una señal clave que hoy es imposible de obtener manualmente.

---

## 8. Dashboard y UX

### 8.1 Dashboard principal

**Layout esperado:**

- **Zona superior:** Métricas agregadas del periodo (views totales, promedio, tendencia).
- **Zona central:** Grid de Reels con thumbnail + badge top performer (estilo vidIQ: `x3`, `x5`, `x8`).
- **Zona lateral o inferior:** Gráfico/componente de soporte (a definir — ideas: tendencia de views 90d, distribución orgánico vs pago, top topics).

Cada card de Reel en el grid muestra:
- Thumbnail
- Badge de multiplicador (si aplica)
- Views total (con indicador org/paid si tiene ads)
- Fecha de publicación
- Tipo: normal / trial

### 8.2 Ficha de Reel (detalle)

**Sección 1 — Métricas principales** (estilo Instagram Edits):
- % likes sobre views
- % saves sobre views
- % shares sobre views
- % comments sobre views
- Cada una con comparación vs promedio 90d ("2x más alto que tu promedio")

**Sección 2 — Métricas extendidas:**
- Views org / paid / total
- Impressions, reach
- Profile visits, follows generados
- Watch time promedio (segundos + % de duración)
- Views / impressions (indicador del poder del primer frame)

**Sección 3 — Transcript y guion:**
- Transcripción limpia en líneas
- Etiquetas: hook, desarrollo, CTA
- Promesa central
- Nivel de especificidad + términos de nicho detectados

**Sección 4 — Análisis visual:**
- Frames clave extraídos
- Clasificación de formato, personas, escena, texto en pantalla, gorro

**Sección 5 — Diagnóstico IA (bajo demanda):**
- Botón "Generar análisis"
- Por qué funcionó / por qué no
- Puntos de mejora: hook, visual, CTA, mensaje
- Comparación con top performers 90d

### 8.3 Chat analítico

El chat debe estar preparado para consultas tipo:

- "Basándote en mis Reels de los últimos 90 días, ¿qué tema debería tratar para maximizar alcance?"
- "¿Qué claim debería usar en el hook?"
- "¿Qué nivel de especificidad de lenguaje me funciona mejor?"
- "¿Qué formato visual me da mejores resultados?"
- "¿Mis Trial Reels están funcionando? ¿Cuáles sí y cuáles no?"
- "¿Cuánto de mis views viene de ads vs orgánico este mes?"

**Biblioteca de prompt templates** (dentro de la plataforma):
- Templates prearmados de consultas útiles
- El usuario puede usarlos directamente o como punto de partida

---

## 9. Diagnóstico y copiloto IA

### 9.1 Principios de grounding

La IA **DEBE:**
- Basarse solo en datos disponibles.
- Marcar supuestos y heurísticas explícitamente.
- NO inventar métricas ausentes.
- Separar orgánico de pago ANTES de concluir.
- Explicar la evidencia detrás de cada recomendación.
- Decir "dato insuficiente" cuando corresponda.
- Distinguir entre "dato", "heurística" y "estimación".

La IA **NUNCA debe:**
- Afirmar causalidad fuerte sin suficiente evidencia.
- Decir que un Reel fue exitoso orgánicamente si la mayoría de views vienen de ads.
- Inferir métricas que no están expuestas.
- Decir que sí a todo — debe señalar cuándo las cosas están mal.

### 9.2 Orden de análisis obligatorio

```
1. Leer métricas del Reel
2. Leer benchmark 90 días
3. Determinar si tiene ads (y separar org/paid)
4. Determinar tipo de Reel (normal/trial)
5. Leer transcript y caption
6. Leer features visuales
7. Emitir diagnóstico con evidencia
```

### 9.3 Outputs por Reel

- Por qué funcionó
- Por qué no funcionó
- Puntos de mejora de hook
- Puntos de mejora visual
- Puntos de mejora de CTA
- Similitud con top performers

### 9.4 Outputs del chat (análisis cruzado)

- Temas recomendados (basados en correlación con views)
- Hooks sugeridos
- Claims sugeridos
- Formatos visuales a repetir
- Lenguaje de nicho a usar o evitar
- Patrones de promesa central que funcionan vs no

---

## 10. Límites técnicos y decisiones de producto

### 10.1 Se puede hacer

- Dashboard de Reels con benchmark 90 días
- Badge top performer
- Views orgánicas vs pagas
- Ficha por Reel con métricas y ratios
- CTA detection mediante IA
- Análisis de guion y visuales
- WPM desde transcript + duración

### 10.2 Parcial / con heurística

| Feature | Limitación |
|---|---|
| Trial Reel detection | No hay flag oficial; `is_shared_to_feed` es la mejor señal |
| Follows atribuidos a un Reel | Depende de disponibilidad de `media_follows` |
| Completion rate | Según disponibilidad por tipo de cuenta |
| Separación comments org/paid | No se puede separar exactamente solo con IG Insights |

### 10.3 NO usar como requisito del MVP

- Curva de retención completa por segundo
- Skip rate exacto a 2 segundos universal por API
- Comentarios pagados vs orgánicos exactos por usuario

---

## 11. Scope del MVP

### 11.1 MVP (Fase 1)

- [ ] Conexión Meta OAuth (IG + Ads)
- [ ] Sync de IG Reels (media + insights)
- [ ] Sync de Ads insights
- [ ] Mapeo Reel ↔ Ad
- [ ] Benchmark 90 días
- [ ] Distinción orgánico / pago
- [ ] Distinción trial por heurística
- [ ] Ficha de Reel completa (métricas + ratios)
- [ ] Dashboard con grid + badge top performer
- [ ] Transcripción + limpieza a guion
- [ ] CTA detection
- [ ] Promesa central + topic cluster
- [ ] Nivel de especificidad del lenguaje
- [ ] 5-10 frames clave + clasificación visual básica
- [ ] WPM (velocidad de habla)
- [ ] Diagnóstico IA bajo demanda (por Reel)
- [ ] Chat analítico con grounding

### 11.2 Fase 2

- [ ] OCR avanzado del primer frame
- [ ] Atribución más fina de follows
- [ ] Patrones multi-cuenta
- [ ] Biblioteca de prompts y playbooks automáticos
- [ ] Recomendador de temas y hooks con scoring
- [ ] Filler density y pausas en análisis de audio
- [ ] Comparador A/B entre Reels seleccionados

---

## 12. Criterios de aceptación del MVP

1. Un usuario conecta IG + Ads sin intervención manual.
2. La app lista Reels de los últimos 90 días.
3. Cada Reel muestra métricas orgánicas base.
4. Reels promocionados muestran también métricas pagas separadas.
5. El dashboard marca top performers con badge visual.
6. La ficha del Reel muestra transcript limpio, CTA, promesa central y especificidad.
7. La ficha muestra frames clave con clasificación visual.
8. La ficha muestra WPM del Reel.
9. El diagnóstico IA genera análisis con evidencia y sin inventar datos.
10. El chat responde consultas cruzadas con datos reales.
11. Trial Reels se clasifican y se pueden excluir del benchmark.

---

## 13. Próximos entregables

| Entregable | Responsable | Prioridad |
|---|---|---|
| Modelo de datos relacional (SQL schema) | Backend | Alta |
| Mapeo exacto de endpoints/campos por versión de API | Backend | Alta |
| Diseño de dashboard y ficha de Reel (wireframes) | Design / Frontend | Alta |
| Mega-prompt del copiloto IA (diagnóstico + chat) | Prompt engineering | Alta |
| Flujos de OAuth y sincronización (n8n o backend nativo) | Backend | Alta |
| Biblioteca de prompt templates para el chat | Producto + IA | Media |
| Especificación de pipeline visual (frames + clasificación) | IA | Media |
| Rate limiting y manejo de quotas de Meta API | Backend | Media |

---

## 14. Lo que le falta a este PRD

Los siguientes puntos necesitan definición antes de implementar:

### 14.1 Infraestructura y tech stack

- **Stack definido:** ¿Next.js + Supabase (como Summit SIS)? ¿Otro stack? Definir framework, DB, hosting, queue system para workers.
- **Object storage:** ¿Dónde se guardan los MP4 y frames? (S3, Supabase Storage, Cloudflare R2).
- **Queue/workers:** Cómo se orquesta la sincronización y el pipeline IA (Inngest, BullMQ, n8n, cron jobs).

### 14.2 Modelo de datos

- SQL schema completo con relaciones, índices, RLS (si multi-tenant).
- Definición de tablas: `accounts`, `reels`, `reel_metrics`, `reel_metrics_paid`, `benchmarks`, `reel_analysis`, `ad_mappings`, `transcripts`, `visual_features`, `chat_sessions`, `chat_messages`.

### 14.3 API interna

- Endpoints del backend propio (REST o tRPC) para que el frontend consuma: listado de Reels, ficha, métricas, benchmark, análisis, chat.
- Paginación, filtros, sorting.

### 14.4 Rate limiting y quotas de Meta

- Instagram Graph API y Marketing API tienen rate limits estrictos.
- Definir: batch size, retry strategy, backoff, manejo de tokens expirados.
- ¿Cómo se refresca el token? ¿Long-lived token? ¿System user token?

### 14.5 Pipeline IA — proveedores y costos

- **ASR:** ¿Whisper local, Deepgram, AssemblyAI?
- **Visión/OCR:** ¿Claude Vision, GPT-4V, modelo local?
- **LLM para análisis:** ¿Claude, GPT-4, modelo fine-tuned?
- Estimación de costo por Reel procesado.
- Strategy de caching para evitar re-procesar.

### 14.6 Prompts del copiloto

- Mega-prompt de diagnóstico por Reel (con todo el contexto de negocio del creador).
- System prompt del chat con instrucciones de grounding.
- Prompt templates de la biblioteca.
- Cómo se inyecta el contexto (métricas + transcript + visual) al LLM sin explotar el context window.

### 14.7 Multi-tenancy y pricing

- ¿El producto es multi-tenant desde el día 1?
- ¿Cómo se mide el uso? (Reels procesados, análisis generados, mensajes de chat).
- Tiers de pricing.

### 14.8 Seguridad y compliance

- Tokens de Meta encriptados at rest.
- Datos de Instagram del usuario → GDPR/privacidad.
- Política de retención de media descargados.

### 14.9 Refresh y sincronización

- ¿Cada cuánto se re-sincronizan Reels e insights? (Métricas cambian en los primeros 7 días).
- ¿Webhook de Meta o polling?
- Estrategia de backfill para cuentas nuevas.

### 14.10 UX / wireframes

- No hay wireframes ni mockups. El PRD describe qué datos mostrar pero no cómo.
- Falta: flujo de onboarding, estados vacíos, error states, loading states.

### 14.11 Testing y validación

- ¿Cómo se valida que las métricas coinciden con lo que muestra Instagram nativo?
- ¿Cómo se testea el mapeo Reel ↔ Ad?
- ¿Cómo se evalúa la calidad del diagnóstico IA?
