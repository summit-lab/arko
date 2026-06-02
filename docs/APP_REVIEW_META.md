# Meta App Review — Guía Operativa Moka

> **Cómo usar este documento:** Para cada permiso a revisar hay 3 bloques que vas a necesitar en el momento del submit:
>
> 1. **Video Script** — Qué grabar, en qué orden, con qué captions. Cada video es independiente de 30-90s.
> 2. **Form Description** — Texto en inglés para pegar en "How will your app use this permission?".
> 3. **Reviewer Instructions** — Texto en inglés para pegar en "Step-by-step instructions to test this feature".
>
> Todo lo que se pega en Meta va en **inglés** (el UI de Moka puede estar en español si agregamos captions en inglés al video, ver la sección 9).

---

## 0. Pre-flight checklist — antes de apretar Submit

| # | Requisito | Estado | Cómo verificarlo |
|---|-----------|--------|------------------|
| 1 | App usa solo Facebook Login (no Instagram Login paralelo) | ✅ | Grep `oauth` en [meta/connect/route.ts](../src/app/api/v1/auth/meta/connect/route.ts) |
| 2 | Código pide solo scopes mínimos en OAuth | ✅ | `REQUIRED_SCOPES` líneas 13-20 del mismo archivo |
| 3 | Test user Meta con credenciales funcionales | 🔲 | Ver sección 10 |
| 4 | Test user de Moka + workspace vinculados | 🔲 | Ver sección 10 |
| 5 | Privacy Policy pública | 🔲 | URL publicada; texto en sección 7 |
| 6 | Terms of Service público | 🔲 | URL publicada; requisitos en sección 8 |
| 7 | Data Deletion callback funcionando | ✅ | Migration `20260420000044` aplicada; verificar que `GET /api/v1/meta/data-deletion` responde |
| 8 | 8 videos grabados (1 por permiso) | 🔲 | Ver scripts en sección 2 |
| 9 | Videos hosteados donde Meta pueda accederlos | 🔲 | Loom / Drive público / YouTube unlisted |
| 10 | App en modo "En desarrollo" hasta aprobación | — | Cambiará a "Live" tras el approve |

---

## 1. Permisos a someter — lista final

### Instagram use case

| # | Permiso | Video requerido | Form fields |
|---|---------|-----------------|-------------|
| 1 | `instagram_basic` | ✅ sección 2.1 | ✅ |
| 2 | `instagram_manage_insights` | ✅ sección 2.2 | ✅ |
| 3 | `pages_show_list` | ✅ sección 2.3 | ✅ |
| 4 | `pages_read_engagement` | ✅ sección 2.4 | ✅ |
| 5 | `ads_read` | ✅ sección 2.5 | ✅ |
| 6 | `ads_management` | ✅ sección 2.6 | ✅ |
| 7 | `business_management` | ✅ sección 2.7 | ✅ |
| 8 | `public_profile` | ❌ no requerido | mínimo |

### Ads use case (además de los compartidos)

| # | Permiso/Feature | Video requerido | Form fields |
|---|-----------------|-----------------|-------------|
| 1 | `Ads Management Standard Access` (feature) | ✅ sección 2.8 | ✅ |

### No enviar (remover de la app antes del submit)

- `instagram_business_basic` · `instagram_business_manage_messages` · `instagram_manage_comments` · `instagram_manage_upcoming_events` · `email`

---

## 2. Por permiso — Video Script + Description + Reviewer Instructions

---

### 2.1 `instagram_basic`

#### 📹 Video Script

**Duración objetivo:** 45-60s · **Nombre archivo:** `01_instagram_basic.mp4`

| Tiempo | Acción en pantalla | Caption (English, overlay) |
|--------|--------------------|----------------------------|
| 00:00-00:05 | Moka logged-out landing page | **"Moka — analytics for Instagram Business accounts. Demonstrating `instagram_basic`."** |
| 00:05-00:10 | Click "Ingresar" / login con test user | **"Step 1: Log in to Moka with test credentials."** |
| 00:10-00:15 | Dashboard vacío, click "Conectar Instagram" | **"Step 2: Initiate Instagram connection."** |
| 00:15-00:25 | Redirección a Facebook OAuth dialog | **"Step 3: Facebook Login dialog. Requested permission `instagram_basic` is highlighted."** (flecha rosa apuntando a `instagram_basic` en el dialog) |
| 00:25-00:30 | User clicks "Continuar" / grants | **"Step 4: User grants `instagram_basic`."** |
| 00:30-00:40 | Redirect back to Moka, sync in progress | **"Step 5: Moka calls `GET /{ig-user-id}` and `GET /{ig-user-id}/media`."** |
| 00:40-00:55 | Navigate to `/instagram` — header muestra username, avatar, followers count | **"Result: Profile header populated via `instagram_basic`: username, profile picture, follower count."** (flecha rosa apuntando cada elemento) |
| 00:55-00:60 | Click tab "Reels" — grid de reels del usuario | **"Media list (reels, posts, stories) also fetched via `instagram_basic`."** |

#### 📋 Form Description — copiar literal

```
Moka is a read-only analytics platform for Instagram Business accounts. We use
instagram_basic to:

1. Display the connected Instagram Business account's public profile (username,
profile picture, follower count, following count, media count) in the account
header of our analytics dashboard.

2. Fetch the list of media (reels, posts, carousels, stories) owned by the
connected account, so users can view performance data per piece of content.

No content is ever created, modified, or deleted. All operations are GET
requests to /{ig-user-id} and /{ig-user-id}/media.
```

#### 🧪 Reviewer Instructions — copiar literal

```
1. Open https://usemoka.io in a browser.
2. Click "Iniciar sesión" and log in with the test credentials provided:
   Email: review@usemoka.io
   Password: [provided in private review channel]
3. After login, click "Conectar Instagram" on the dashboard.
4. You will be redirected to Facebook Login. Authenticate with the test
   Facebook account provided and grant the requested permissions.
5. After redirection back to Moka, the Instagram dashboard loads automatically.
6. Verify the account header shows the connected Instagram Business account's
   username, profile picture, and follower count — all fetched via
   instagram_basic.
7. Click the "Reels" tab. Observe the grid of media owned by the connected
   account — the list is fetched via instagram_basic.
```

---

### 2.2 `instagram_manage_insights`

#### 📹 Video Script

**Duración objetivo:** 60-90s · **Nombre archivo:** `02_instagram_manage_insights.mp4`

**Precondición:** test user ya tiene IG conectada (grabar después del video 2.1 o usar una sesión pre-conectada).

| Tiempo | Acción en pantalla | Caption (English, overlay) |
|--------|--------------------|----------------------------|
| 00:00-00:05 | Logged in dashboard | **"Demonstrating `instagram_manage_insights` — reading media and account performance metrics."** |
| 00:05-00:15 | Navigate to `/instagram?tab=dashboard` — scroll to "Alcance & Visibilidad" chart | **"Chart 'Alcance & Visibilidad' (Reach & Visibility) — daily reach and impressions over 30 days."** |
| 00:15-00:25 | Hover over chart points to show tooltip con values | **"Source: `GET /{ig-user-id}/insights?metric=reach,impressions&period=day`"** |
| 00:25-00:35 | Scroll down to "Nuevos seguidores / día" chart | **"Chart 'Nuevos seguidores' (New Followers) — uses the `follower_count` daily insight metric."** |
| 00:35-00:50 | Click tab "Reels" → click a specific reel card | **"Per-reel insights: open detail view."** |
| 00:50-01:10 | Reel detail page muestra impressions, reach, saves, shares, engagement rate | **"Metrics fetched via `GET /{ig-media-id}/insights` — impressions, reach, saves, shares, total_interactions."** (flecha rosa por cada métrica) |
| 01:10-01:20 | Navigate to `/instagram?tab=metrics` (Demografía) | **"Follower demographics: age, gender, city, country — via `metric=follower_demographics`."** |
| 01:20-01:30 | Cierre | **"All data is displayed in the user's private dashboard. Read-only, never shared publicly."** |

#### 📋 Form Description

```
Moka uses instagram_manage_insights to fetch performance metrics that power our
analytics dashboards:

1. Per-media metrics: for each reel, post, and story, we fetch impressions,
reach, saves, shares, total_interactions, views, and other insights via
/{ig-media-id}/insights.

2. Account-level daily insights: we fetch daily metrics (reach, impressions,
profile_views, follower_count, follows_count) via
/{ig-user-id}/insights?period=day to render historical trend charts.

3. Follower demographics: audience breakdown by age/gender/city/country via
/{ig-user-id}/insights?metric=follower_demographics.

This data is displayed in the user's private analytics dashboard — it is never
shared publicly, never used for advertising by Moka, and never cross-referenced
with other users' data.
```

#### 🧪 Reviewer Instructions

```
1. Complete the instagram_basic connection flow (see test for permission 1).
2. Navigate to the "Instagram" section via the sidebar.
3. On the "Dashboard" tab, observe the "Alcance & Visibilidad" (Reach &
   Visibility) chart showing daily reach and impressions for the last 30
   days. This data is fetched via instagram_manage_insights.
4. Observe the "Nuevos seguidores / día" (New Followers / day) chart —
   uses the follower_count daily insight.
5. Click the "Reels" tab. Each card in the grid shows views, likes, saves,
   shares, engagement rate — all from instagram_manage_insights.
6. Click on any individual reel. The detail view opens showing full
   insights: impressions, reach, average watch time, total interactions.
7. Navigate to the "Demografía" (Demographics) tab. Observe the age/gender/
   city/country breakdown — sourced via the follower_demographics metric.
```

---

### 2.3 `pages_show_list`

#### 📹 Video Script

**Duración objetivo:** 30-45s · **Nombre archivo:** `03_pages_show_list.mp4`

| Tiempo | Acción en pantalla | Caption (English, overlay) |
|--------|--------------------|----------------------------|
| 00:00-00:05 | Moka dashboard vacío | **"Demonstrating `pages_show_list` — enumerating Facebook Pages during connection."** |
| 00:05-00:10 | Click "Conectar Instagram" | **"Step 1: Start Instagram connection flow."** |
| 00:10-00:20 | Facebook OAuth dialog — highlight `pages_show_list` en la lista de permisos | **"Permission `pages_show_list` requested so Moka can enumerate Pages administered by the user."** |
| 00:20-00:25 | User grants | **"User grants `pages_show_list`."** |
| 00:25-00:35 | Return to Moka, brief loading | **"Moka calls `GET /me/accounts` to list the user's Facebook Pages."** |
| 00:35-00:45 | Dashboard loads — show connected account name | **"Moka uses this list to identify the Facebook Page whose connected Instagram Business account the user wants to link. No Page content is read beyond this enumeration."** |

#### 📋 Form Description

```
Moka uses pages_show_list exclusively during the initial connection flow.
Instagram Business accounts are always linked to a Facebook Page, so we need to
enumerate the Pages the authenticating user administers (via GET /me/accounts)
in order to find the Page whose connected Instagram Business account the user
wants to link to Moka.

This is a one-time call per connection. We never display the full list of
Pages to the user unless required for disambiguation (multiple Pages
administered). We store only the selected Page's ID and access token.
```

#### 🧪 Reviewer Instructions

```
1. From logged-out Moka, click "Conectar Instagram" on the dashboard.
2. On the Facebook Login OAuth dialog, observe that `pages_show_list` is in
   the requested permissions list. Grant all requested permissions.
3. After grant, Moka internally calls GET /me/accounts to retrieve the list
   of Pages administered by the authenticated user.
4. If the test user administers multiple Pages, Moka presents a selection UI.
   If only one Page is linked to an Instagram Business account, Moka
   auto-selects it.
5. The connection completes with the selected Page's linked IG account.
```

---

### 2.4 `pages_read_engagement`

#### 📹 Video Script

**Duración objetivo:** 30-45s · **Nombre archivo:** `04_pages_read_engagement.mp4`

| Tiempo | Acción en pantalla | Caption |
|--------|--------------------|---------|
| 00:00-00:05 | Moka landing | **"Demonstrating `pages_read_engagement` — required bridge to the connected Instagram Business account."** |
| 00:05-00:15 | Connect Instagram flow (puede ser el mismo clip de 2.3 o regrabado) | **"Moka calls `GET /{page-id}?fields=instagram_business_account,access_token`."** |
| 00:15-00:25 | Back in Moka — header loads with Page avatar y IG username | **"Fields retrieved: IG Business account ID, Page access token, Page metadata."** (flecha a cada elemento) |
| 00:25-00:35 | Navigate `/instagram` — dashboard poblado | **"Token obtained via `pages_read_engagement` is the authentication basis for ALL subsequent IG Graph API calls."** |
| 00:35-00:45 | Cierre | **"Moka never reads Facebook Page posts. This permission is used only to bridge to the linked Instagram Business account."** |

#### 📋 Form Description

```
Moka uses pages_read_engagement to access the metadata of the Facebook Page
that the user selected during connection. Specifically, we read:

1. The instagram_business_account field (the IG Business account ID linked to
the Page) — required to fetch any IG media or insights.

2. The Page access token (obtained via GET /{page-id}?fields=access_token) —
required as the authentication token for subsequent Instagram Graph API calls.

3. Basic Page metadata (name, avatar) for display in the connection
confirmation UI.

We never read or display posts published to the Facebook Page itself. This
permission is used only as the bridge to the connected Instagram Business
account.
```

#### 🧪 Reviewer Instructions

```
1. During the Instagram connection flow (see permission 1), after Page
   selection, Moka calls
   GET /{page-id}?fields=instagram_business_account,access_token,name,picture.
2. The returned instagram_business_account.id is stored and used in all
   subsequent Instagram Graph API calls (reels, insights, stories, etc).
3. After successful connection, the Instagram dashboard loads fully populated
   — confirming the end-to-end connection works via pages_read_engagement.
```

---

### 2.5 `ads_read`

#### 📹 Video Script

**Duración objetivo:** 60-90s · **Nombre archivo:** `05_ads_read.mp4`

**Precondición:** test user tiene ad_account con spend real y al menos 1 campaña activa/pasada.

| Tiempo | Acción en pantalla | Caption |
|--------|--------------------|---------|
| 00:00-00:05 | Moka sidebar visible | **"Demonstrating `ads_read` — Meta Ads analytics, read-only."** |
| 00:05-00:15 | Click "Meta Ads" sidebar item | **"Navigate to Ads Intelligence dashboard."** |
| 00:15-00:30 | Tabla de ads con columnas: Ad name, impressions, spend, clicks, reach, CTR | **"Data from `GET /{ad_account_id}/insights?level=ad` — impressions, reach, spend, clicks, video_plays."** (flechas a columnas) |
| 00:30-00:45 | Click en una row (un ad específico) | **"Per-ad detail view: daily breakdown of the same metrics."** |
| 00:45-00:60 | Daily chart del ad seleccionado | **"Source: same `ads_read` endpoint with `time_increment=1`."** |
| 00:60-01:15 | Scroll up — mostrar que NO HAY botón "Crear", "Editar", "Pausar" o "Eliminar" | **"No UI element allows creating, modifying, pausing, or deleting ads. The interface is strictly read-only analytics."** |
| 01:15-01:30 | Cierre | **"Moka makes ZERO POST/PUT/DELETE calls to Marketing API endpoints. Grep against the codebase confirms this."** |

#### 📋 Form Description

```
Moka uses ads_read to fetch Meta Ads Insights data for ad accounts the user has
granted access to. Specifically:

1. Ad account enumeration: via business_management, we list the user's ad
accounts. For each account, we then make ads_read calls.

2. Ad details: GET /{ad_account_id}/ads?fields=id,name,campaign_id,adset_id,
creative to list ads and their creative references (used to link ads back to
their Instagram media).

3. Ad insights: GET /{ad_account_id}/insights?level=ad&fields=impressions,
reach,clicks,spend,video_plays,actions&time_range={...} to retrieve
performance metrics per ad per day.

All calls are GET only. The fetched data is displayed in our Ads Intelligence
dashboard where users see performance per ad, per campaign, and per day. No
POST, PUT, or DELETE operations are ever made to Marketing API endpoints.
```

#### 🧪 Reviewer Instructions

```
1. After connecting Instagram (which also authorizes the linked ad accounts
   via business_management), click "Meta Ads" in the left sidebar.
2. Observe the table of ads with columns: ad name, impressions, reach, spend,
   clicks, CTR, messaging conversations. Data sourced via ads_read.
3. Click any ad row. A detail panel opens showing daily metrics.
4. Note that no UI element allows creating, editing, pausing, or deleting ads
   — the interface is strictly read-only analytics.
```

---

### 2.6 `ads_management`

#### 📹 Video Script

**Duración objetivo:** 60-75s · **Nombre archivo:** `06_ads_management.mp4`

**Importante:** este video es casi idéntico al de `ads_read` porque hacemos las mismas GET calls. La diferencia clave es el énfasis en el caption inicial explicando por qué aparece el permiso y que solo se usa para reads.

| Tiempo | Acción en pantalla | Caption |
|--------|--------------------|---------|
| 00:00-00:10 | Moka sidebar | **"Demonstrating `ads_management` — IMPORTANT: Moka uses this permission for READ operations only. No write endpoints are ever called."** |
| 00:10-00:20 | Meta Ads page — misma tabla del video 2.5 | **"Same GET /{ad_account_id}/ads and /insights calls as `ads_read`. Meta's use case template auto-includes `ads_management`."** |
| 00:20-00:35 | Click un ad → detail view | **"Read-only metrics display."** |
| 00:35-00:50 | Panel con el reel linkeado al ad (si existe ad_mapping) | **"Ads are mapped to their Instagram creative via `effective_instagram_media_id` from the ad's creative field — read from `GET /{ad_id}?fields=creative{...}`."** |
| 00:50-01:05 | Slow scroll mostrando toda la UI: NO botones de write | **"NO create button. NO edit button. NO pause button. NO delete button. The entire feature is analytics."** |
| 01:05-01:15 | (Opcional) Abrir navegador devtools → Network tab → filter "graph.facebook" → mostrar solo GETs | **"Network log confirms only GET requests to Marketing API."** |

#### 📋 Form Description

```
Moka's Instagram use case template from Meta includes ads_management as a
required permission. However, our application performs only read operations —
there are no POST, PUT, or DELETE calls to any Marketing API endpoint in our
codebase.

The specific endpoints we call are identical to those under ads_read:

- GET /{ad_account_id}/ads
- GET /{ad_account_id}/insights
- GET /{ad_id}?fields=...

These endpoints technically accept either ads_read or ads_management
authorization. Meta's API call counter double-counts calls made with tokens
that granted both scopes, which is why our dashboard shows ~30.5k calls
attributed to ads_management despite our OAuth flow only requesting ads_read
semantically.

Our product has NO interface to create, edit, pause, duplicate, or delete ads,
campaigns, or ad sets. All functionality is read-only analytics. We commit to
notifying Meta if this ever changes and understand that any change to write
operations would require a new App Review.
```

#### 🧪 Reviewer Instructions

```
1. Follow the same test flow as ads_read — navigate to Meta Ads, observe the
   read-only analytics UI.
2. Verify there is no "Create ad", "Edit ad", "Pause ad", or "Delete ad"
   button anywhere in the application.
3. (Optional) Open browser DevTools → Network tab → filter "graph.facebook"
   → observe only GET requests to Marketing API endpoints.
4. (Optional) We can provide read-only access to our GitHub repository upon
   request; grep for POST|PUT|DELETE against /marketing or /act_ endpoints
   returns zero results.
```

---

### 2.7 `business_management`

#### 📹 Video Script

**Duración objetivo:** 30-45s · **Nombre archivo:** `07_business_management.mp4`

| Tiempo | Acción en pantalla | Caption |
|--------|--------------------|---------|
| 00:00-00:05 | Moka dashboard | **"Demonstrating `business_management` — enumerating Business Manager ad accounts."** |
| 00:05-00:15 | OAuth flow — highlight `business_management` en el dialog | **"Permission requested so Moka can enumerate the user's ad accounts administered via Business Manager."** |
| 00:15-00:25 | Return to Moka, connection success | **"Moka calls `GET /me/adaccounts` to list ad_account_ids the user has access to."** |
| 00:25-00:40 | Navigate `/meta-ads` — mostrar que TODAS las ad accounts del test user aparecen listadas (personal + agency) | **"All ad accounts the test user can access — personal-owned + Business Manager-granted — are synced for analytics."** |
| 00:40-00:45 | Cierre | **"Moka makes read-only calls to Business Manager. We never create or modify BM assets, roles, or permissions."** |

#### 📋 Form Description

```
Moka uses business_management to enumerate the user's Business Manager assets
— specifically the list of ad_account IDs they administer or have been granted
access to. This is required because most professional Instagram creators and
agencies manage their ad accounts through Business Manager rather than as
assets owned directly by their personal Facebook profile.

Specifically, we call GET /me/adaccounts after the OAuth grant to determine
which ad_account_ids to include in our Ads Insights sync. Without this
permission, we would only see ad accounts directly owned by the user's
personal profile, which would miss the typical agency workflow.

We make read-only calls to Business Manager endpoints. We do not create,
modify, or delete Business Manager assets, roles, or permissions.
```

#### 🧪 Reviewer Instructions

```
1. During the Instagram connection flow, after the Facebook Login OAuth, Moka
   internally calls GET /me/adaccounts (via business_management).
2. The detected ad accounts are stored in our backend and used as the basis
   for the Ads Insights sync.
3. After connection, observe in the Meta Ads dashboard that all of the test
   user's accessible ad accounts (personal + those granted through Business
   Manager) are visible with their metrics.
```

---

### 2.8 Feature: `Ads Management Standard Access`

#### 📹 Video Script

**Duración objetivo:** 30-45s · **Nombre archivo:** `08_ads_management_standard_access.mp4`

| Tiempo | Acción en pantalla | Caption |
|--------|--------------------|---------|
| 00:00-00:10 | Moka `/meta-ads` page con mucha data | **"Demonstrating Ads Management Standard Access — production-tier Marketing API access required for multi-tenant usage."** |
| 00:10-00:25 | Scroll through tabla mostrando volumen de ads (15-30 filas) y múltiples ad accounts | **"Moka serves multiple independent businesses. Each user manages multiple ad accounts. Dev-tier rate limits are insufficient."** |
| 00:25-00:40 | Mostrar daily chart de ads durante período largo (60-90 días) | **"Historical analytics require backfill of ~90 days of daily insights per ad. Feasible only with Standard Access."** |
| 00:40-00:45 | Cierre | **"Functionality remains read-only — Standard Access is needed for volume, not for write operations."** |

#### 📋 Form Description

```
Moka serves multiple independent business users (creators, agencies) who each
manage their own Instagram accounts and ad accounts. Meta's Development-tier
access to the Marketing API is insufficient for production — it imposes limits
that prevent us from serving real-world workload across multiple businesses.

We request Ads Management Standard Access to obtain the production-tier
Marketing API access necessary to serve our user base. Our actual API usage is
read-only (see ads_read and ads_management justifications). Standard Access is
required for the volume, not for write operations.

Typical workload per user: 30-day window of daily insights (~30 calls), plus
enumeration of 10-50 ads per ad_account (~1-5 calls), plus incremental syncs
every 6 hours via scheduled jobs. Multiplied by 100+ workspaces, this exceeds
Dev-tier quotas within hours of launch.
```

#### 🧪 Reviewer Instructions

```
1. Observe the Meta Ads dashboard for the test user — data is pulled from
   real production ad accounts with real spend and impressions data.
2. The volume and frequency of sync operations is consistent with
   multi-tenant production usage, which requires Standard Access.
3. Note that all operations shown are read-only analytics (see ads_read
   permission test for confirmation).
```

---

### 2.9 `public_profile`

#### 📹 No se requiere video

Meta lo auto-grantea; no hay funcionalidad específica que demostrar.

#### 📋 Form Description

```
public_profile is automatically granted by Meta during Facebook Login and
cannot be removed from our app's permission list per Meta's platform policy.
Moka does not rely on this permission for any specific feature — our user
identification and session management is handled independently via Supabase
Auth. The public profile fields (name, id) may be incidentally visible in
our backend logs as part of the OAuth response but are not displayed in the
UI nor stored as primary records.
```

#### 🧪 Reviewer Instructions

```
This permission requires no specific demonstration — it is the default
Meta-granted permission and has zero API calls attributed to it in our usage
dashboard.
```

---

## 3. Recording setup — cómo grabar los videos

### Herramienta recomendada: **Loom**

- Free tier tiene 25 videos de hasta 5 minutos cada uno — más que suficiente
- Cursor highlight incorporado
- Descarga como MP4 directo
- URL pública para pegar en el formulario de Meta

### Alternativa: **OBS Studio** (gratis, más control)

- Resolución: `1920x1080`
- FPS: `30`
- Format: `MP4 H.264`
- Bitrate: `8000 Kbps` (calidad alta)
- Audio: opcional; si lo ponés, narración en inglés

### Captions / overlay de texto

**Opción A (rápido):** Loom permite agregar text overlays post-grabación. Suficiente para la mayoría.

**Opción B (profesional):** Editar con CapCut (gratis), DaVinci Resolve (gratis) o Premiere. Poner captions en caja blanca semi-transparente, abajo, Arial 24-28px. Cada caption queda visible ≥3 segundos.

### Checklist antes de grabar cada video

- [ ] Browser en modo incógnito para limpiar cache
- [ ] Zoom del browser al 100% (Ctrl+0)
- [ ] Escritorio sin notificaciones ni ventanas extra
- [ ] Cursor visible, movimientos lentos
- [ ] Test user ya preparado con data real (no mockeada)
- [ ] Cerrar todo lo que muestre datos de producción de otros users (privacidad)
- [ ] Verificar que el video queda <50MB (si se excede, bajar bitrate)

---

## 4. Subida de los videos al submission

Para cada permiso, Meta pide URL pública del video. Usar una de estas:

- **Loom**: `https://loom.com/share/[id]` — público sin password
- **Google Drive**: Share con "Anyone with the link can view" → link directo
- **YouTube**: Unlisted video + link

**NO usar** Dropbox con password, OneDrive sin public access, ni Vimeo con NDA — Meta no puede verlos y rechaza el submission.

---

## 5. Screencast errors que rechaza Meta — checklist

- [ ] ❌ Video acelerado (>2x speed) → rechazo automático
- [ ] ❌ Cortes editados durante el OAuth flow (debe verse continuo desde que el user clickea "Conectar" hasta que vuelve a Moka)
- [ ] ❌ Credenciales del test user que fallan cuando el reviewer las usa
- [ ] ❌ Ad account sin spend real → la tabla de ads aparece vacía en el video 2.5
- [ ] ❌ IG account sin stories → no podés demostrar el chunk de historias (ver sección 6 abajo)
- [ ] ❌ Privacy Policy en URL que da 404
- [ ] ❌ Data Deletion callback que devuelve 500
- [ ] ❌ Descripción genérica copypasteada sin referencias a endpoints concretos
- [ ] ❌ Pedir permisos "por si acaso" sin demostrarlos en video
- [ ] ❌ UI con botones sin funcionalidad o secciones visiblemente mockeadas
- [ ] ❌ Video en español sin captions en inglés (si el UI está en ES, agregar overlay explicando cada label)

---

## 6. ¿Qué pasa con Stories y demás features que no tienen permiso dedicado?

Stories, posts, carruseles — todos caen bajo `instagram_basic` (lectura del media) + `instagram_manage_insights` (métricas). Los cubre el video 2.2.

Si el reviewer te pregunta por stories específicamente en el feedback, le respondés que el mismo permiso los cubre y le apuntás al minuto del video 2.2 donde se ve el tab "Historias" populado.

---

## 7. Privacy Policy — contenido obligatorio

Publicá en `https://usemoka.io/privacy` con estos bloques mínimos:

### 7.1 Data collected

```
Moka collects and stores the following data from connected Meta accounts:

• Instagram Business account profile: username, profile picture URL,
  follower/following count, media count, biography, business category.
• Instagram media metadata: post IDs, captions, permalinks, media URLs,
  thumbnails, publication timestamps, media type.
• Instagram media performance metrics: impressions, reach, saves, shares,
  views, total interactions, comments and likes counts.
• Instagram story insights: impressions, reach, replies, exits, taps,
  swipe-aways per slide.
• Daily account-level insights: reach, impressions, profile views, follower
  count changes.
• Follower demographics: aggregated age, gender, city, country.
• Meta Ads performance: ad IDs, campaign IDs, ad set IDs, ad account IDs,
  names, impressions, reach, clicks, spend, video plays, CTA clicks,
  messaging conversations.
• OAuth session tokens — stored encrypted at rest, rotated on Meta's
  standard cadence.
```

### 7.2 Purpose of processing

```
All data collected is used exclusively to:

• Render analytics dashboards visible only to the authenticated user and
  other members of their workspace who have been explicitly invited.
• Compute derived metrics (engagement rate, performance benchmarks,
  content-type breakdowns) for display purposes.
• Generate AI-assisted insights about the user's own content using
  third-party LLMs (Google Gemini, Anthropic Claude) under data
  processing agreements.

Moka does not sell, share, or monetize this data. Data is never
cross-referenced between unrelated users' accounts.
```

### 7.3 Data retention

```
User data is retained as long as the workspace remains active. Upon workspace
deletion, user-initiated disconnection, or account deletion request, all
Meta-sourced data is permanently deleted within 30 days from our production
databases and storage buckets.
```

### 7.4 Data deletion — obligatorio

```
Users can request immediate deletion by:

1. Disconnecting the Meta integration from the Moka Settings page — triggers
   immediate deletion of access tokens and queued deletion of cached data.

2. Emailing privacy@usemoka.io with subject "Data Deletion Request". We
   respond and confirm deletion within 7 business days.

3. Using Meta's Data Deletion Callback URL:
   https://app.usemoka.io/api/v1/auth/meta/data-deletion
   Called automatically when a user removes Moka from their Facebook apps
   list. Our callback returns a confirmation URL and code per Meta's spec.
```

---

## 8. Terms of Service — mínimos requeridos

Publicá en `https://usemoka.io/terms`:

- Definición del servicio (analytics read-only IG + Ads, multi-tenant SaaS)
- Usuario garantiza tener autorización para conectar las cuentas Meta
- Moka no se hace responsable por acciones de Meta (suspensiones de cuenta, cambios de API, etc.)
- Limitación de responsabilidad estándar
- Ley aplicable + jurisdicción

Plantilla mínima disponible en [termly.io](https://termly.io) o similar — tomá cualquier template de SaaS analytics y personalizalo.

---

## 9. UI language en los screencasts

Actualmente Moka está **100% en español**. Meta acepta apps en cualquier idioma siempre que cada label visible en el screencast tenga un caption en inglés explicándolo.

### Opción A (rápida — sin código)

Grabar los videos con UI en español + overlays en inglés. Por cada label clave que aparezca ("Alcance & Visibilidad", "Guardados", "Me Gusta"), poner un caption breve:

```
CAPTION: "'Alcance & Visibilidad' = Reach & Visibility"
```

Agrega ~20% más de edición pero evita trabajo de código.

### Opción B (i18n scoped — 1 día de laburo)

Agregar toggle ES/EN en Settings (cookie-based, Next cookies(), ~100 strings a traducir — solo las visibles en los screencasts). Más limpio para el reviewer y queda como base para mercado EN futuro.

**Mi recomendación**: Opción B si vas a ir al mercado EN en los próximos 6 meses. Si es solo para la review, Opción A es pragmática.

---

## 10. Test user — cómo armarlo

Meta exige credenciales funcionales. NO mandar tu cuenta personal.

### 10.1 Cuenta Facebook dedicada

1. Crear email `review+moka@tudominio.com` (o usar Proton/Gmail dedicado)
2. Facebook account con ese email
3. Confirmar email + 2FA (opcional pero recomendado)

### 10.2 Instagram Business account

1. Descargar app IG, crear cuenta con el mismo email
2. Convertir a cuenta profesional (Business, no Creator)
3. **Postear contenido real**:
   - ≥10 reels (no shorts, video >65s)
   - ≥5 posts (mix de imagen y carrusel)
   - ≥3 historias publicadas en los últimos 30 días
   - Interacciones reales — pedir a gente que like/comment para tener insights

### 10.3 Facebook Page

1. Crear Page con nombre "Moka Review Account" (o similar)
2. Conectar la cuenta IG Business a la Page

### 10.4 Business Manager + Ad account

1. Crear Business Manager
2. Añadir la Page a Business Manager
3. Crear ad_account dentro de BM
4. **Spend real mínimo $5-10 USD** en una campaña (puede ser un reel boost pequeño a audiencia local). Sin spend, el dashboard de ads del video 2.5 aparece vacío y el review se rechaza
5. Dejar la campaña correr ≥48h antes del submit para tener datos diarios

### 10.5 Cuenta Moka

1. Crear user en Moka con email `review@usemoka.io`
2. Connect con el test user de Facebook
3. Correr sync manual al menos 1 vez
4. Verificar que todos los dashboards cargan con data

### 10.6 Credentials a pegar en el formulario

```
--- Meta test account ---
Facebook email: review+moka@tudominio.com
Facebook password: [STRONG_PASSWORD]
Instagram handle: @moka_review_account
Facebook Page: Moka Review Account
Ad account ID: act_XXXXXXXXX

--- Moka test account ---
URL: https://usemoka.io
Email: review@usemoka.io
Password: [STRONG_PASSWORD]
```

---

## 11. Timeline esperado

- **Preparación**: 3-5 días (test user + data real + videos + privacy/terms + doc)
- **Grabación**: 1 día (8 videos)
- **Submit**: 1 hora (pegar todo en los forms)
- **Review por Meta**: 3-10 días hábiles
- **Posibles resultados**:
  1. ✅ **Approved** — permisos pasan a "Granted" para todos los users
  2. ⚠️ **More info requested** — Meta pide clarificación vía email. Respondés dentro de la plataforma. No es rechazo.
  3. ❌ **Rejected** — Meta cita qué permiso falló. Corregís SOLO ese, regrabás video si aplica, resubmit. Approval rate al 2° intento con feedback aplicado: >80%.

---

## 12. Referencias oficiales

- [Meta App Review Guide](https://developers.facebook.com/docs/app-review)
- [Screencast requirements](https://developers.facebook.com/docs/app-review/submission-guidelines#screencasts)
- [Permissions reference](https://developers.facebook.com/docs/permissions/reference)
- [Data Deletion Callback spec](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback)
- [Marketing API Access Levels](https://developers.facebook.com/docs/marketing-api/get-started)

---

**Última actualización**: 2026-04-21 · Moka v1.0 primera submission
