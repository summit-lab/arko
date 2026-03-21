# Meta Graph API Expert — Skill Reference (v25.0)

> **Skill para agentes IA.** Este documento centraliza todo el conocimiento de la Meta Graph API v25.0 relevante para Arko.
> Usalo como referencia antes de implementar cualquier integración con Facebook, Instagram, o Meta Ads.

---

## ROUTING — Índice para Agentes

> Navegá directo a la sección que necesitás según la tarea:

| Tarea | Sección |
|-------|---------|
| Entender cómo funciona la API en general | [→ Conceptos Base](#1-conceptos-base) |
| Hacer una request HTTP correctamente | [→ HTTP y Host](#2-http-y-host) |
| Trabajar con tokens de acceso | [→ Access Tokens](#3-access-tokens) |
| Leer datos de un objeto específico | [→ Nodos](#4-nodos) |
| Leer colecciones de objetos | [→ Perímetros (Edges)](#5-perímetros-edges) |
| Seleccionar campos específicos | [→ Campos (Fields)](#6-campos-fields) |
| Escribir, actualizar o eliminar datos | [→ Escritura y Eliminación](#7-escritura-actualización-y-eliminación) |
| Recibir notificaciones en tiempo real | [→ Webhooks](#8-webhooks) |
| Manejar versiones de la API | [→ Versiones](#9-versiones) |
| Manejar errores de la API | [→ Errores](#10-errores) |
| Entender niveles de acceso estándar/avanzado | [→ Niveles de Acceso](#11-niveles-de-acceso) |
| Paginar resultados de la API | [→ Paginación](#12-paginación) |
| Entender y manejar rate limits | [→ Rate Limits](#13-rate-limits) |
| Calcular cuota disponible para Instagram/Ads | [→ Rate Limits — Fórmulas por BUC](#rate-limits-buc-por-producto) |
| Leer headers de uso en tiempo real | [→ Headers de Rate Limit](#headers-de-rate-limit) |
| Ver códigos de error de rate limit | [→ Códigos de Error de Rate Limit](#códigos-de-error-de-rate-limit) |
| Entender features y app review | [→ Features Reference](#14-features-reference) |
| Obtener métricas de un video/reel en una Page | [→ Video Insights](#15-video-insights-video-idvideo_insights) |
| Ver qué métricas existen para Reels (Facebook Page) | [→ Métricas de Reels](#métricas-disponibles--reels) |
| Ver qué métricas existen para Videos de Page | [→ Métricas de Videos](#métricas-disponibles--videos-page-videos) |
| Ver métricas de Ad Breaks / monetización | [→ Métricas de Ad Breaks](#métricas-disponibles--ad-breaks) |
| Entender la curva de retención de un video | [→ Retención](#retención) |
| Leer un post individual de Facebook | [→ Post](#16-post-post-id) |
| Ver todos los campos disponibles de un post | [→ Campos de Post](#campos) |
| Ver edges de un post (comments, reactions, insights) | [→ Edges de Post](#edges-perímetros) |
| Publicar posts en feed de usuario/página | [→ Escritura de Post](#escritura) |
| Obtener insights de un post de Page | [→ Post Insights](#17-post-insights-post-idinsights) |
| Leer datos de una Story de Facebook | [→ Stories](#18-stories-stories-id) |
| Obtener métricas de una Story (impresiones, replies, shares) | [→ Stories Insights](#19-stories-insights-stories-idinsights) |

---

## 1. Conceptos Base

La **Graph API** es la API principal de Meta para leer y escribir datos dentro de la plataforma de Facebook/Instagram.

- Basada en HTTP
- Representa la información como una **"gráfica social"**: objetos conectados entre sí
- Tres conceptos clave:
  - **Nodos** — objetos individuales con ID único (usuario, página, foto, reel, etc.)
  - **Perímetros (Edges)** — conexiones entre nodos (fotos de un usuario, comentarios de una foto)
  - **Campos (Fields)** — propiedades de un nodo o colección

---

## 2. HTTP y Host

- Protocolo: **HTTP/1.1**, todos los endpoints requieren **HTTPS**
- URL base: `https://graph.facebook.com`
- Compatible con cualquier librería HTTP (cURL, fetch, axios, etc.)
- HSTS con `includeSubdomains` activado en facebook.com

**Ejemplo:**
```bash
curl -i -X GET "https://graph.facebook.com/facebook/picture?redirect=false"
```

---

## 3. Access Tokens

Casi todos los endpoints requieren un **access token** en cada request.

**Funciones:**
1. Permiten acceder a datos del usuario sin exponer su contraseña
2. Identifican la app, el usuario, y los permisos otorgados

> Ver documentación completa de tokens en la referencia oficial de Meta.

**Uso en requests:**
```bash
curl -i -X GET "https://graph.facebook.com/USER-ID?access_token=ACCESS-TOKEN"
```

---

## 4. Nodos

Un **nodo** es un objeto individual con ID único.

Ejemplos de nodos: usuarios, páginas, publicaciones, fotos, reels, comentarios.

**Request básica a un nodo:**
```bash
curl -i -X GET "https://graph.facebook.com/USER-ID?access_token=ACCESS-TOKEN"
```

**Respuesta por defecto:**
```json
{
  "name": "Your Name",
  "id": "YOUR-USER-ID"
}
```

### Nodo especial: `/me`
Se traduce automáticamente al ID del objeto (usuario o página) del access token actual.

```bash
curl -i -X GET "https://graph.facebook.com/me?access_token=ACCESS-TOKEN"
```

### Metadatos del nodo
> ⚠️ El parámetro `metadata` fue **retirado en v25.0** y dejará de funcionar en todas las versiones el **19 de mayo de 2026**.
> Usar el API Explorer o las referencias de la API en su lugar.

---

## 5. Perímetros (Edges)

Un **perímetro** es una colección de objetos conectados a un nodo.

**Formato:** `/{NODE-ID}/{EDGE-NAME}`

**Ejemplo — fotos de un usuario:**
```bash
curl -i -X GET "https://graph.facebook.com/USER-ID/photos?access_token=ACCESS-TOKEN"
```

**Respuesta:**
```json
{
  "data": [
    { "created_time": "2017-06-06T18:04:10+0000", "id": "1353272134728652" },
    { "created_time": "2017-06-06T18:01:13+0000", "id": "1353269908062208" }
  ]
}
```

---

## 6. Campos (Fields)

Por defecto, los nodos devuelven un conjunto mínimo de campos. Para especificar qué campos necesitás, usá el parámetro `fields`.

```bash
curl -i -X GET \
  "https://graph.facebook.com/USER-ID?fields=id,name,email,picture&access_token=ACCESS-TOKEN"
```

**Respuesta:**
```json
{
  "id": "USER-ID",
  "name": "EXAMPLE NAME",
  "email": "EXAMPLE@EMAIL.COM",
  "picture": {
    "data": {
      "height": 50,
      "is_silhouette": false,
      "url": "URL-FOR-USER-PROFILE-PICTURE",
      "width": 50
    }
  }
}
```

### Parámetros complejos
- **list:** sintaxis JSON — `["item1", "item2"]`
- **object:** sintaxis JSON — `{"key": "value", "key2": 123}`

---

## 7. Escritura, Actualización y Eliminación

### Actualizar un campo (POST)
```bash
curl -i -X POST \
  "https://graph.facebook.com/USER-ID?email=NEW@EMAIL.COM&access_token=ACCESS-TOKEN"
```

### Read-After-Write
Al crear o actualizar, la API puede devolver inmediatamente el objeto resultante. Usá el parámetro `fields` para especificar qué devolver:

```bash
curl -i -X POST \
  "https://graph.facebook.com/PAGE-ID/feed?message=Hello&fields=created_time,from,id,message&access_token=ACCESS-TOKEN"
```

**Respuesta:**
```json
{
  "created_time": "2017-04-06T22:04:21+0000",
  "from": { "name": "My Facebook Page", "id": "PAGE-ID" },
  "id": "POST_ID",
  "message": "Hello"
}
```

### Eliminar un nodo (DELETE)
```bash
curl -i -X DELETE "https://graph.facebook.com/PHOTO-ID?access_token=ACCESS-TOKEN"
```
> Solo podés eliminar nodos que hayas creado. Verificar requisitos en la referencia de cada nodo.

---

## 8. Webhooks

Para recibir notificaciones de cambios en nodos o interacciones, suscribirse a **Webhooks**.

> Ver documentación de Webhooks en la referencia oficial de Meta.

---

## 9. Versiones

La API Graph tiene versiones con **lanzamientos trimestrales**.

**Formato:** `/v{VERSION}/{PATH}`

```bash
curl -i -X GET \
  "https://graph.facebook.com/v25.0/USER-ID/photos?access_token=ACCESS-TOKEN"
```

> Este documento cubre la versión **v25.0**.

---

## 10. Errores

Si una request falla (campo inexistente, token inválido, etc.), la API devuelve una **respuesta de error estándar**.

> Ver guía de gestión de errores en la referencia oficial de Meta.

---

---

## 11. Niveles de Acceso

> Solo aplica a apps creadas con un tipo de aplicación. A partir del 1 de febrero de 2023, el acceso avanzado puede requerir verificación de empresa.

Hay dos niveles: **Estándar** y **Avanzado**.

| Nivel | ¿Quién puede usarlo? | Aprobación |
|-------|----------------------|------------|
| Estándar | Solo usuarios con rol en la app | Automática para todas las apps |
| Avanzado | Cualquier usuario de la app | Requiere App Review + verificación de empresa |

### Acceso Estándar
- Solo para usuarios con rol en la app (testers, devs, admins)
- Se aprueba automáticamente para todos los permisos disponibles según el tipo de app
- Útil durante desarrollo y testing

### Acceso Avanzado
- Permite solicitar permisos a cualquier usuario final
- Requiere pasar **App Review** de Meta (puede tomar 1-4 semanas)
- A partir de febrero 2023, también requiere **empresa verificada**
- Apps de consumidor reciben aprobación automática de acceso avanzado para `email` y `public_profile`, pero deben cambiarse manualmente y la app debe estar en modo **publicado**

### Data Use Checkup
Las apps con acceso avanzado deben completar la **Comprobación del uso de datos** anualmente, certificando que acceden a las APIs conforme a las políticas de Meta.

### Eliminar / Restaurar acceso
- Se puede eliminar cualquier permiso o feature desde App Review > Permisos y funciones (excepto `public_profile`)
- Restaurar acceso avanzado previamente aprobado **no requiere nueva revisión**
- Cambiar de avanzado a estándar **invalida** el permiso para usuarios sin rol en la app

---

## 12. Paginación

La mayoría de edges devuelven resultados paginados. Existen tres tipos:

### Paginación por Cursor (recomendada)
Usar siempre que sea posible. Los cursores son strings aleatorios que apuntan a un elemento específico.

> ⚠️ No almacenar cursores — pueden dejar de ser válidos si se eliminan elementos.

```json
{
  "data": [ ... ],
  "paging": {
    "cursors": {
      "after": "MTAxNTExOTQ1MjAwNzI5NDE=",
      "before": "NDMyNzQyODI3OTQw"
    },
    "previous": "https://graph.facebook.com/{user-id}/albums?limit=25&before=...",
    "next": "https://graph.facebook.com/{user-id}/albums?limit=25&after=..."
  }
}
```

**Parámetros:**
| Parámetro | Descripción |
|-----------|-------------|
| `before` | Cursor al inicio de la página actual |
| `after` | Cursor al final de la página actual |
| `limit` | Máximo de objetos a devolver (algunos edges tienen un máximo propio) |
| `next` | URL de la siguiente página. **Si no está presente → es la última página** |
| `previous` | URL de la página anterior |

> Si `next` no aparece en la respuesta → dejar de paginar. No usar el count de resultados como indicador de fin.

### Paginación por Tiempo
Para datos con timestamps Unix.

```json
{
  "data": [ ... ],
  "paging": {
    "previous": "https://graph.facebook.com/{user-id}/feed?limit=25&since=1364849754",
    "next": "https://graph.facebook.com/{user-id}/feed?limit=25&until=1364587774"
  }
}
```

**Parámetros:**
| Parámetro | Descripción |
|-----------|-------------|
| `since` | Timestamp Unix del inicio del rango |
| `until` | Timestamp Unix del fin del rango |
| `limit` | Máximo de objetos |

> Siempre especificar `since` y `until` juntos. Rango máximo recomendado: **6 meses**.

### Paginación por Offset
Usar solo si el edge no soporta cursor ni tiempo.

| Parámetro | Descripción |
|-----------|-------------|
| `offset` | Desplaza el inicio de la página |
| `limit` | Máximo de objetos |

> ⚠️ Si se agregan nuevos objetos durante la paginación, el contenido de las páginas cambia.

### Error de cursor excedido
```json
{
  "error": {
    "message": "(#100) The After Cursor specified exceeds the max limit supported by this endpoint",
    "type": "OAuthException",
    "code": 100
  }
}
```

---

## 13. Rate Limits

### Tipos de Rate Limit

| Tipo | Aplica a |
|------|----------|
| **Platform Rate Limits** | Graph API con app token o user token |
| **Business Use Case (BUC)** | Marketing API, Instagram Platform API, Pages API con page/system token |

> Si ambos pueden aplicar, se usan los **límites BUC**.

---

### Platform Rate Limits — Por App
Llamadas por hora por app (con app access token):
```
Calls per hour = 200 * Number of Daily Active Users
```
No es un límite por usuario — es el total de la app. Cualquier usuario puede hacer más de 200 calls/hora, mientras el total no supere el máximo.

### Platform Rate Limits — Por Usuario
Llamadas por hora por usuario (con user access token). El límite exacto no se revela por privacidad. Se distribuye entre todas las apps que usa ese usuario.

---

### Rate Limits BUC por Producto

#### Instagram Platform
```
Calls within 24 hours = 4800 * Number of Impressions
```
- Impresiones = veces que contenido del usuario apareció en pantalla en las últimas 24h
- Business Discovery y Hashtag Search API usan Platform Rate Limits (no BUC)

#### Instagram Messaging
| API | Límite |
|-----|--------|
| Conversations API | 2 calls/seg por cuenta profesional |
| Private Replies (Live comments) | 100 calls/seg por cuenta profesional |
| Private Replies (posts/reels comments) | 750 calls/hora por cuenta profesional |
| Send API (texto, links, stickers) | 100 calls/seg por cuenta profesional |
| Send API (audio/video) | 10 calls/seg por cuenta profesional |

#### Ads Insights
- Acceso estándar: `600 + 400 * Active Ads - 0.001 * User Errors` por hora
- Acceso avanzado: `190000 + 400 * Active Ads - 0.001 * User Errors` por hora

#### Ads Management
- Acceso estándar: `300 + 40 * Active Ads` por hora
- Acceso avanzado: `100000 + 40 * Active Ads` por hora

#### Custom Audience
- Estándar: `5000 + 40 * Active Custom Audiences` por hora (máx 700.000)
- Avanzado: `190000 + 40 * Active Custom Audiences` por hora

#### Pages (page/system token)
```
Calls within 24 hours = 4800 * Number of Engaged Users
```

#### Messenger API
```
Calls within 24 hours = 200 * Number of Engaged Users
```

---

### Headers de Rate Limit

#### `X-App-Usage` (Platform)
```json
{
  "call_count": 28,
  "total_time": 25,
  "total_cputime": 25
}
```

#### `X-Ad-Account-Usage` (Ads API v3.3 y anterior)
```json
{
  "acc_id_util_pct": 9.67,
  "reset_time_duration": 100,
  "ads_api_access_tier": "standard_access"
}
```

#### `X-Business-Use-Case-Usage` (BUC — hasta 32 objetos por call)
```json
{
  "{business-object-id}": [
    {
      "type": "ads_management",
      "call_count": 95,
      "total_cputime": 20,
      "total_time": 20,
      "estimated_time_to_regain_access": 0,
      "ads_api_access_tier": "development_access"
    }
  ]
}
```

**Campos clave del header BUC:**
| Campo | Descripción |
|-------|-------------|
| `type` | Tipo de BUC: `ads_insights`, `ads_management`, `instagram`, `pages`, etc. |
| `call_count` | % de llamadas usadas |
| `total_cputime` | % de CPU usada |
| `total_time` | % de tiempo total usado |
| `estimated_time_to_regain_access` | Minutos hasta recuperar acceso (0 = no bloqueado) |
| `ads_api_access_tier` | `development_access` o `standard_access` |

> Cuando `total_cputime` o `total_time` llegan a 100 → posibles throttles.

---

### Códigos de Error de Rate Limit

#### Platform
| Código | Descripción |
|--------|-------------|
| `4` | App alcanzó su rate limit |
| `17` | Usuario alcanzó su rate limit |
| `32` | App o usuario alcanzó rate limit de Pages |
| `613` | Rate limit personalizado alcanzado |
| `613` + subcode `1996` | Comportamiento incoherente en volumen de requests |

#### BUC
| Código | Tipo |
|--------|------|
| `80000` + subcode `2446079` | Ads Insights |
| `80004` + subcode `2446079` | Ads Management |
| `80003` + subcode `2446079` | Custom Audience |
| `80002` | Instagram |
| `80005` | Lead Generation |
| `80006` | Messenger |
| `80001` | Pages (page/system token) |
| `32` | Pages (user token) |
| `80008` | WhatsApp Business Management |
| `80014` | Catalog Batch |
| `80009` | Catalog Management |

**Ejemplo de respuesta de error:**
```json
{
  "error": {
    "message": "(#80001) There have been too many calls to this Page account. Wait a bit and try again.",
    "type": "OAuthException",
    "code": 80001,
    "fbtrace_id": "AmFGcW_3hwDB7qFbl_QdebZ"
  }
}
```

---

### Buenas Prácticas ante Rate Limits
1. **Parar inmediatamente** al recibir error de rate limit — seguir llamando aumenta el tiempo de bloqueo
2. Monitorear `X-App-Usage` y `X-Business-Use-Case-Usage` **antes** de llegar al límite
3. Distribuir requests uniformemente en el tiempo — evitar picos
4. Usar filtros para reducir tamaño de respuesta y llamadas redundantes
5. Rotar entre cuentas publicitarias si una está limitada
6. Crear nuevos anuncios en vez de modificar los existentes (para Ads API)
7. Cada ID en una request con múltiples IDs cuenta como **una llamada separada**

---

## 14. Features Reference

Las **Features** son mecanismos de autorización que permiten acceso a tipos específicos de datos. A diferencia de los permisos, no pueden ser otorgadas por el usuario — dependen del modo de la app y del rol del usuario.

| Contexto | Estado de Features |
|----------|--------------------|
| App en modo Development | Todas activas para usuarios con rol (excepto Page Public Content/Metadata Access) |
| App en modo Live | Solo las aprobadas por App Review |
| App tipo Business | Activas para usuarios con rol; requieren App Review para usuarios externos |

> Las Features aprobadas **no expiran** aunque no se usen (a diferencia de algunos permisos).

### Features clave para Arko

| Feature | Descripción | Uso en Arko |
|---------|-------------|-------------|
| **Ads Management Standard Access** | Acceso a Marketing API con menor rate limiting y cuentas ilimitadas | Sincronización de ads y atribución de views pagas |
| **Instagram Platform** | Acceso a endpoints de Instagram Graph API | Reels, métricas, media insights |
| **Business Asset User Profile Access** | Acceso a perfiles de usuario en assets empresariales | Gestión de cuentas conectadas |
| **Page Public Content Access** | Acceso a contenido público de páginas sin ser admin | Análisis de páginas de clientes |

### Ads Management Standard Access — detalle
Permite:
- Número ilimitado de cuentas publicitarias
- Rate limiting reducido vs. development access
- Leer reportes (`ads_read`) y/o administrar anuncios (`ads_management`)

Para obtenerlo: solicitar **acceso avanzado** en App Review.

---

---

## 15. Video Insights (`/{video-id}/video_insights`)

### Descripción
Métricas agregadas para videos en una Page. Soporta **Videos**, **Reels** y **Ad Breaks**.

### Requisitos
- Permiso `pages_manage_engagement`
- Permiso `read_insights`
- Page access token de un usuario con tarea **ANALYZE** en la Page
- Solo admins de la Page pueden consultar earnings insights

### Limitaciones
- No disponible para videos en Users o Groups — solo Pages
- Datos disponibles solo para los **últimos 2 años**
- Un video crossposteado tiene un ID único por cada Page donde se publicó

### Request
```http
GET /v25.0/{video-id}/video_insights HTTP/1.1
Host: graph.facebook.com
```

### Parámetros
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `metric` | `list<string>` | Lista de métricas a solicitar |
| `period` | `enum` | Período de agregación: `day`, `week`, `days_28`, `month`, `lifetime`, `total_over_range` |
| `since` | `datetime` | Límite inferior del rango de tiempo |
| `until` | `datetime` | Límite superior del rango de tiempo |

### Respuesta
```json
{
  "data": [],
  "paging": {}
}
```

### Códigos de Error
| Código | Descripción |
|--------|-------------|
| `200` | Error de permisos |
| `100` | Parámetro inválido |
| `104` | Firma incorrecta |
| `283` | Requiere `pages_read_engagement` y/o `pages_read_user_content` y/o `pages_manage_ads` y/o `pages_manage_metadata` |
| `190` | OAuth 2.0 Access Token inválido |
| `80001` | Demasiadas llamadas a esta Page account — rate limit alcanzado |

> Este endpoint es **solo lectura** — no soporta POST, PATCH ni DELETE.

---

### Métricas disponibles — Ad Breaks

| Métrica | Descripción | Período |
|---------|-------------|---------|
| `total_video_ad_break_ad_cpm` | CPM promedio pagado por anunciantes (en centavos USD, incluye parte de Facebook) | `day`, `lifetime` |
| `total_video_ad_break_ad_impressions` | Cantidad de veces que se mostró un anuncio en ad breaks del video | `day`, `lifetime` |
| `total_video_ad_break_earnings` | Estimación de ganancias por ad breaks (centavos USD, puede diferir del pago real) | `day`, `lifetime` |
| `creator_monetization_qualified_views` | Vistas del video que recibirán pago | `day`, `lifetime` |

---

### Métricas disponibles — Reels

> Todas las métricas de Reels usan período `lifetime`.

| Métrica | Descripción |
|---------|-------------|
| `blue_reels_play_count` | Reproducciones ≥ 1ms **excluyendo** replays |
| `fb_reels_replay_count` | Cantidad de replays ≥ 1ms dentro de la misma sesión |
| `fb_reels_total_plays` | Reproducciones ≥ 1ms **incluyendo** replays |
| `post_impressions_unique` | Personas únicas que vieron el reel al menos una vez (estimado). No requiere que hayan reproducido. |
| `post_video_avg_time_watched` | Tiempo promedio de reproducción en ms **por instancia**, incluyendo replays |
| `post_video_followers` | Follows generados por el reel |
| `post_video_likes_by_reaction_type` | Likes del reel |
| `post_video_retention_graph` | % de veces que el reel fue reproducido en cada segmento temporal vs total de plays. Curva descendente típica desde 100%. |
| `post_video_social_actions` | Comentarios + shares del reel |
| `post_video_view_time` | Tiempo total de reproducción en ms, incluyendo replays |

> `post_video_retention_graph` es la métrica más cercana a una "curva de retención" para Reels — devuelve % por segmentos de tiempo, no segundo a segundo.

#### Aplicación en Arko
- La integración actual de Instagram Intelligence usa `/{ig-media-id}/insights` para Reels de Instagram, no `/{video-id}/video_insights`.
- Estas métricas de `video_insights` sirven como referencia para una futura expansión cuando Arko disponga de IDs de video/reel de **Facebook Page** y permisos de `read_insights` + Page token con tarea `ANALYZE`.
- Para Ads Intelligence ligados a Reels, en la práctica actual de Arko resultaron válidos en Marketing API: `impressions`, `reach`, `clicks`, `spend`, `ctr`, `cpc`, `cpp`, `frequency`, `inline_link_clicks`, `outbound_clicks`, `video_play_actions`, `video_p25_watched_actions`, `video_p50_watched_actions`, `video_p75_watched_actions`, `video_p95_watched_actions` y `video_p100_watched_actions`.
- `thruplay` debe validarse por cuenta/objeto antes de usarlo; en el flujo actual de Arko devolvió `(#100) not valid for fields param`.

---

### Métricas disponibles — Videos (Page Videos)

> Todas las métricas de Videos usan período `lifetime`.

#### Vistas generales
| Métrica | Descripción |
|---------|-------------|
| `total_video_views` | Reproducciones ≥ 3 segundos (o duración total si < 3s). Excluye replays. |
| `total_video_views_unique` | Personas únicas con reproducción ≥ 3s |
| `total_video_views_autoplayed` | Reproducciones automáticas ≥ 3s |
| `total_video_views_clicked_to_play` | Reproducciones ≥ 3s iniciadas por click |
| `total_video_views_sound_on` | Reproducciones ≥ 3s con sonido activado |
| `total_video_views_live` | Vistas ≥ 3s durante transmisión en vivo |

#### Vistas orgánicas vs pagas
| Métrica | Descripción |
|---------|-------------|
| `total_video_views_organic` | Reproducciones ≥ 3s por alcance orgánico |
| `total_video_views_organic_unique` | Personas únicas con vista orgánica ≥ 3s |
| `total_video_views_paid` | Reproducciones ≥ 3s de videos promovidos |
| `total_video_views_paid_unique` | Personas únicas con vista paga ≥ 3s |

#### Vistas completas (97%+)
| Métrica | Descripción |
|---------|-------------|
| `total_video_complete_views` | Reproducciones ≥ 97% de duración |
| `total_video_complete_views_unique` | Personas únicas con vista completa |
| `total_video_complete_views_auto_played` | Vistas completas autoplay |
| `total_video_complete_views_clicked_to_play` | Vistas completas por click |
| `total_video_complete_views_organic` | Vistas completas orgánicas |
| `total_video_complete_views_organic_unique` | Personas únicas con vista completa orgánica |
| `total_video_complete_views_paid` | Vistas completas pagas |
| `total_video_complete_views_paid_unique` | Personas únicas con vista completa paga |

#### Vistas por duración (10s, 15s, 30s, 60s)
| Métrica | Descripción |
|---------|-------------|
| `total_video_10s_views` | Reproducciones ≥ 10s |
| `total_video_10s_views_unique` | Personas únicas con vista ≥ 10s |
| `total_video_10s_views_auto_played` | Autoplay ≥ 10s |
| `total_video_10s_views_clicked_to_play` | Click-to-play ≥ 10s |
| `total_video_10s_views_organic` | Orgánico ≥ 10s |
| `total_video_10s_views_paid` | Pago ≥ 10s |
| `total_video_10s_views_sound_on` | Con sonido ≥ 10s |
| `total_video_15s_views` | Reproducciones ≥ 15s |
| `total_video_30s_views` | Reproducciones ≥ 30s (o 97% si < 30s) |
| `total_video_60s_excludes_shorter_views` | Reproducciones ≥ 60s |

#### Retención
| Métrica | Descripción |
|---------|-------------|
| `total_video_retention_graph` | % de reproducciones en cada intervalo vs total (40 intervalos iguales). Puede mostrar más impresiones al final por skips/replays. |
| `total_video_retention_graph_autoplayed` | Retención para reproducciones automáticas |
| `total_video_retention_graph_clicked_to_play` | Retención para reproducciones por click |

#### Tiempo de reproducción
| Métrica | Descripción |
|---------|-------------|
| `total_video_avg_time_watched` | Tiempo promedio visto en ms |
| `total_video_view_total_time` | Tiempo total visto en ms |
| `total_video_view_total_time_organic` | Tiempo total orgánico en ms |
| `total_video_view_total_time_paid` | Tiempo total pago en ms |
| `total_video_view_total_time_live` | Tiempo total visto durante live en ms |

#### Impresiones
| Métrica | Descripción |
|---------|-------------|
| `total_video_impressions` | Total de impresiones |
| `total_video_impressions_unique` | Impresiones únicas |
| `total_video_impressions_paid` | Impresiones pagas |
| `total_video_impressions_paid_unique` | Impresiones pagas únicas |
| `total_video_impressions_organic` | Impresiones orgánicas |
| `total_video_impressions_organic_unique` | Impresiones orgánicas únicas |
| `total_video_impressions_viral` | Impresiones en historias de amigos |
| `total_video_impressions_viral_unique` | Impresiones virales únicas |
| `total_video_impressions_fan` | Impresiones para fans de la Page |
| `total_video_impressions_fan_unique` | Impresiones únicas para fans |
| `total_video_impressions_fan_paid` | Impresiones pagas para fans |
| `total_video_impressions_fan_paid_unique` | Impresiones pagas únicas para fans |

#### Demografía y distribución
| Métrica | Descripción |
|---------|-------------|
| `total_video_view_time_by_age_bucket_and_gender` | Tiempo total visto por audiencia: edad + género |
| `total_video_view_time_by_region_id` | Tiempo total visto por Top 45 ubicaciones (Region - Country) |
| `total_video_views_by_distribution_type` | Vistas por tipo de distribución: `page_owned` / `shared` |
| `total_video_view_time_by_distribution_type` | Tiempo visto por tipo de distribución |
| `total_video_views_by_country_id` | Vistas por país |
| `total_video_views_by_age_bucket_and_gender` | Vistas por edad y género |
| `total_video_views_gender_male` | Vistas ≥ 3s por hombres |
| `total_video_views_gender_female` | Vistas ≥ 3s por mujeres |
| `has_total_video_views_by_publisher_platform_type` | Si el video se reprodujo ≥ 3s desglosado por plataforma |

#### Interacciones
| Métrica | Descripción |
|---------|-------------|
| `total_video_stories_by_action_type` | Historias creadas sobre el video por tipo: like, comment, share, etc. |
| `total_video_reactions_by_type_total` | Reacciones al video por tipo |

#### Live (transmisiones en vivo)
| Métrica | Descripción |
|---------|-------------|
| `total_video_views_live` | Vistas ≥ 3s durante live |
| `total_video_views_live_clicked_to_play` | Vistas ≥ 3s durante live iniciadas por click |
| `total_video_views_live_autoplayed` | Vistas ≥ 3s durante live en autoplay |
| `total_video_views_gender_male_live` | Vistas masculinas ≥ 3s durante live |
| `total_video_views_gender_female_live` | Vistas femeninas ≥ 3s durante live |

---

---

## 16. Post (`/{post-id}`)

### Descripción
Un post individual en el feed de un perfil (usuario, página, app o grupo).

### Permisos requeridos
| Token | Qué puede leer |
|-------|----------------|
| Page access token | Todos los posts publicados en o por la Page |
| Page access token + `pages_manage_posts` + Page Public Content Access Feature | Posts públicos de la Page (requiere ser admin) |
| User access token | Posts que la app creó en nombre del usuario |
| User access token + `user_posts` | Posts del usuario + posts donde fue etiquetado (sujeto a privacidad del autor) |

> Feature **Page Public Content Access** puede ser requerida.

### Limitaciones
Los siguientes campos fueron **deprecados en v3.3** para `/page/feed`, `/page/posts`, `/pageposts` y `/page/published_posts`:
`caption`, `description`, `link`, `name`, `object_id`, `source`, `type`

### Request
```http
GET /v25.0/{post-id} HTTP/1.1
Host: graph.facebook.com
```
> No tiene parámetros. Solo lectura — no soporta POST ni DELETE directo en este endpoint.

---

### Campos

#### Identificación y metadata
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | ID del post |
| `created_time` | datetime | Timestamp de publicación (UNIX) |
| `updated_time` | datetime | Última actualización (no incluye comentarios) |
| `backdated_time` | datetime | Tiempo backdateado (null para posts normales) |
| `scheduled_publish_time` | float | UNIX timestamp de publicación programada |
| `is_published` | bool | Si el post programado fue publicado |
| `is_expired` | bool | Si el tiempo de expiración ya pasó |
| `is_hidden` | bool | Si el post fue ocultado |
| `status_type` | string | Tipo de status update |
| `type` | string | Tipo de objeto del post |

#### Contenido
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `message` | string | Texto del post *(default)* |
| `story` | string | Texto de historias no generadas intencionalmente por el usuario *(default)* |
| `message_tags` | list | Perfiles mencionados/etiquetados en el mensaje |
| `story_tags` | list | Tags en la descripción del post |
| `caption` | string | Caption de un link *(deprecado en v3.3)* |
| `description` | string | Descripción de un link *(deprecado en v3.3)* |
| `name` | string | Nombre del link *(deprecado en v3.3)* |
| `link` | uri | Link del post *(deprecado en v3.3)* |
| `source` | string | URL de Flash/video adjunto *(deprecado en v3.3)* |
| `object_id` | string | ID de foto o video adjunto *(deprecado en v3.3)* |

#### Autor y destino
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `from` | User\|Page | Quién publicó el post |
| `to` | Edge\<Profile\> | Perfiles mencionados o destinatarios |
| `target` | Profile | Perfil donde se publicó (si difiere del autor) |
| `via` | User\|Page | Usuario/Page desde donde se compartió |
| `admin_creator` | BusinessUser\|User\|Application | Admin creador (solo disponible si hay más de un admin en la Page) |
| `application` | Application | App que publicó el post |
| `parent_id` | Post ID | ID del post padre (ej. si este post menciona a otro) |

#### Multimedia
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `full_picture` | string | URL de la foto (redimensionada a max 720px en la dimensión mayor) |
| `height` / `width` | unsigned int32 | Dimensiones del adjunto |
| `expanded_height` / `expanded_width` | unsigned int32 | Dimensiones expandidas del adjunto |
| `icon` | string | Ícono representativo del tipo de post |
| `properties` | list | Propiedades de video adjunto (ej. duración) |
| `coordinates` | struct | Info del adjunto (checkin, coords, etc.) |
| `is_spherical` | bool | Si es un video esférico (360°) |
| `child_attachments` | list | Sub-shares de un multi-link post |

#### Engagement y visibilidad
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `shares` | struct `{count}` | Cantidad de shares |
| `subscribed` | bool | Si el usuario está suscrito al post |
| `is_popular` | bool | Si el post es popular (total actions / reach supera umbral) |
| `can_reply_privately` | bool | Si el viewer puede enviar respuesta privada |
| `comments_mirroring_domain` | string | Dominio externo donde se espejan los comentarios |
| `privacy` | Privacy | Configuración de privacidad del post |
| `timeline_visibility` | string | Visibilidad en timeline |
| `targeting` | struct | Demografía que limita la audiencia |
| `feed_targeting` | struct | Targeting para aumentar/reducir probabilidad en feed (solo Pages) |

#### Publicidad y promoción
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `is_eligible_for_promotion` | bool | Si el post es elegible para promoverse |
| `is_instagram_eligible` | bool | Si se puede promover en Instagram |
| `instagram_eligibility` | enum | `"eligible"` o razón de inelegibilidad para Instagram |
| `video_buying_eligibility` | list\<enum\> | Opciones de compra de video disponibles (lista vacía = elegible) |
| `allowed_advertising_objectives` | list\<string\> | Objetivos publicitarios permitidos para este post |
| `promotable_id` | Post ID | ID alternativo para promoción (cuando el post no se puede promover directamente) |
| `call_to_action` | struct `{type, value}` | CTA para mobile app engagement ads |
| `is_inline_created` | bool | Si fue creado inline al crear un anuncio |
| `is_app_share` | bool | Si el post referencia una app |
| `multi_share_end_card` | bool | Si muestra end card en multi-link post |
| `multi_share_optimized` | bool | Si el orden de links se optimiza automáticamente en ads |
| `place` | Place | Lugar asociado al post |
| `event` | Event | Evento asociado al lugar del post |
| `permalink_url` | uri | URL permanente estática del post en facebook.com |

---

### Edges (perímetros)

| Edge | Tipo | Descripción |
|------|------|-------------|
| `attachments` | Edge\<StoryAttachment\> | Adjuntos asociados al post |
| `comments` | Edge\<Comment\> | Comentarios en el post |
| `reactions` | Edge\<Profile\> | Perfiles que reaccionaron |
| `sharedposts` | Edge\<Post\> | Posts que compartieron este post |
| `insights` | Edge\<InsightsResult\> | Insights del post (**solo para Pages**) |
| `dynamic_posts` | Edge\<RTBDynamicPost\> | Creatives dinámicos de anuncios |
| `sponsor_tags` | Edge\<Page\> | Pages patrocinadoras etiquetadas |
| `to` | Edge\<Profile\> | Perfiles mencionados o destinatarios |

---

### Códigos de Error

| Código | Descripción |
|--------|-------------|
| `100` | Parámetro inválido |
| `200` | Error de permisos |
| `210` | Usuario no visible |
| `368` | Acción considerada abusiva o no permitida |
| `459` | Sesión inválida (usuario en checkpoint) |
| `104` | Firma incorrecta |
| `190` | OAuth 2.0 Access Token inválido |
| `2500` | Error parseando query del graph |
| `80001` | Rate limit de Page alcanzado |

---

### Escritura
No se puede crear un Post directamente en `/{post-id}`.
Para publicar posts usar los edges:
- `/{user-id}/feed`
- `/{page-id}/feed`
- `/{event-id}/feed`
- `/{group-id}/feed`

> Con **user access token** → post en voz del usuario. Con **page access token** → post en voz de la Page.

---

---

## 17. Post Insights (`/{post-id}/insights`)

> Soportado para Nueva experiencia para las páginas.

### Request
```http
GET /v25.0/{post-id}/insights HTTP/1.1
Host: graph.facebook.com
```

### Parámetros
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `metric` | `list<string>` | Métricas a obtener |
| `period` | `enum` | Período: `day`, `week`, `days_28`, `month`, `lifetime`, `total_over_range` |
| `since` | `datetime` | Límite inferior del rango |
| `until` | `datetime` | Límite superior del rango |
| `date_preset` | `enum` | Rango predefinido: `today`, `yesterday`, `last_7d`, `last_28d`, `last_30d`, `last_90d`, `this_month`, `last_month`, `this_quarter`, `last_quarter`, `this_year`, `last_year`, `maximum`, `data_maximum`, etc. **No funciona si `since` o `until` están presentes.** |

### Respuesta
```json
{ "data": [], "paging": {} }
```

### Códigos de Error
| Código | Descripción |
|--------|-------------|
| `100` | Parámetro inválido |
| `200` | Error de permisos |
| `190` | OAuth 2.0 Access Token inválido |
| `3001` | Query inválida |

---

## 18. Stories (`/{stories-id}`)

> Soportado para Nueva experiencia para las páginas.

### Request
```http
GET /v25.0/{stories-id} HTTP/1.1
Host: graph.facebook.com
```
> No tiene parámetros.

### Campos
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `creation_time` | string | Tiempo de creación de la story *(default)* |
| `media_id` | string | ID del media (video/foto) *(default)* |
| `media_type` | enum | Tipo de media *(default)* |
| `post_id` | string | ID del post *(default)* |
| `status` | string | Estado: `archived`, `published`, `draft`, `scheduled` *(default)* |
| `url` | string | URL permanente de la Story *(default)* |

### Edges
| Edge | Descripción |
|------|-------------|
| `insights` | Edge\<InsightsResult\> — métricas de la story |

### Códigos de Error
| Código | Descripción |
|--------|-------------|
| `100` | Parámetro inválido |
| `190` | OAuth 2.0 Access Token inválido |

---

## 19. Stories Insights (`/{stories-id}/insights`)

### Request
```http
GET /v25.0/{stories-id}/insights HTTP/1.1
Host: graph.facebook.com
```

### Parámetro
| Parámetro | Valores disponibles |
|-----------|---------------------|
| `metric` | `PAGE_STORY_IMPRESSIONS_BY_STORY_ID`, `PAGE_STORY_IMPRESSIONS_BY_STORY_ID_UNIQUE`, `PAGES_FB_STORY_STICKER_INTERACTIONS`, `PAGES_FB_STORY_REPLIES`, `PAGES_FB_STORY_THREAD_LIGHTWEIGHT_REACTIONS`, `PAGES_FB_STORY_SHARES`, `STORY_INTERACTION`, `STORY_MEDIA_VIEW`, `STORY_TOTAL_MEDIA_VIEW_UNIQUE` |

### Métricas — descripción

| Métrica | Descripción |
|---------|-------------|
| `PAGE_STORY_IMPRESSIONS_BY_STORY_ID` | Total de impresiones de la story |
| `PAGE_STORY_IMPRESSIONS_BY_STORY_ID_UNIQUE` | Personas únicas que vieron la story |
| `PAGES_FB_STORY_STICKER_INTERACTIONS` | Interacciones con stickers de la story |
| `PAGES_FB_STORY_REPLIES` | Respuestas a la story |
| `PAGES_FB_STORY_THREAD_LIGHTWEIGHT_REACTIONS` | Reacciones rápidas (tipo thread) |
| `PAGES_FB_STORY_SHARES` | Veces que se compartió la story |
| `STORY_INTERACTION` | Total de interacciones con la story |
| `STORY_MEDIA_VIEW` | Vistas del media de la story |
| `STORY_TOTAL_MEDIA_VIEW_UNIQUE` | Personas únicas que vieron el media |

### Respuesta
```json
{ "data": [], "paging": {} }
```

### Códigos de Error
| Código | Descripción |
|--------|-------------|
| `100` | Parámetro inválido |

---

*— Secciones adicionales se agregarán a medida que se documente Instagram Graph API específica, Marketing API endpoints, y casos de uso concretos de Arko.*
