# Feature: ArkoAI Live Intelligence Chat

> **Estado:** Pendiente de implementación
> **Fecha de planificación:** 2026-03-22
> **Prioridad:** Alta — es el núcleo de valor diferencial de Arko

---

## Visión General

ArkoAI Live Intelligence es una IA que **conoce al creador en profundidad** y puede moverse activamente entre sus datos para responder preguntas con criterio, no solo con números.

Combina tres capas:
1. **Creator DNA Profile** — síntesis cualitativa persistente del creador, actualizada automáticamente
2. **Tool Use dinámico** — el LLM decide qué datos necesita y hace queries a Supabase en tiempo real
3. **Contexto de pieza específica** — cuando se invoca desde un Reel o video, tiene foco quirúrgico en esa pieza

El resultado: una IA que puede responder tanto "¿cómo estoy comunicando mi contenido actualmente?" como "¿cuáles fueron mis 10 mejores Reels y por qué?" con la misma fluidez.

---

## Los 2 Modos de Invocación

### Modo 1 — Chat General (`/agents`)
- Acceso a TODAS las redes: Instagram, YouTube, Ads, Customer Voice
- Carga el Creator DNA Profile completo del workspace
- Puede llamar tools de cualquier módulo
- Respuestas estratégicas y panorámicas

### Modo 2 — Chat por Pieza (dentro de `/instagram/[id]` o `/youtube/[id]`)
- Foco en esa pieza específica (métricas + transcript + análisis ArkoAI)
- El Creator DNA Profile se carga como contexto de referencia (para comparar)
- Tools limitadas al scope de esa pieza
- Respuestas tácticas y específicas

---

## Arquitectura Completa

```
REQUEST del usuario (chat general o chat por pieza)
      │
      ▼
POST /api/v1/chat  (o /api/v1/chat/reel/[id])
      │
      ├── 1. Auth Middleware
      │       └── session → user_id → workspace_id
      │           workspace_id NUNCA viene del cliente ni del LLM
      │
      ├── 2. Carga Creator DNA Profile
      │       └── SELECT * FROM workspace_profiles WHERE workspace_id = $1
      │
      ├── 3. Si modo pieza: carga contexto del Reel/Video
      │       └── SELECT reel + métricas + transcript + análisis ArkoAI
      │           Valida que reel.workspace_id = workspace_id de sesión
      │
      ├── 4. Construye System Prompt
      │       ├── [A] Base: cerebro de Fran (framework de análisis, benchmarks)
      │       ├── [B] Creator DNA Profile del usuario
      │       ├── [C] Si modo pieza: datos completos de la pieza
      │       └── [D] Instrucciones de uso de tools
      │
      ├── 5. Define Tools con workspace_id hardcodeado desde servidor
      │       └── El LLM puede invocarlas pero NO puede cambiar el workspace_id
      │
      ├── 6. Llama a OpenAI (streaming)
      │
      ├── 7. Si el LLM llama una tool:
      │       ├── Intercepta el tool_call
      │       ├── Valida IDs contra workspace_id de sesión (double-check)
      │       ├── Ejecuta query en Supabase
      │       ├── Supabase RLS valida a nivel DB (tercera capa)
      │       └── Devuelve resultado al LLM para que continúe
      │
      └── 8. Stream de respuesta al cliente
```

---

## Creator DNA Profile

### Qué es
Un documento vivo, generado y mantenido por IA, que describe al creador en profundidad. No son métricas crudas — es una síntesis cualitativa que el LLM puede leer como contexto base sin necesidad de procesar cientos de reels en cada conversación.

### Estructura del Perfil

```json
{
  "identity": {
    "dominant_narrative_style": "educativo-directo con anclaje en resultados propios",
    "mastered_formats": ["talking head + lista estructurada", "storytelling de caso real"],
    "tone_profile": "alta energía, informal, ~185 WPM, sin muletillas excesivas",
    "consistent_brand_elements": ["fondo neutro", "ropa oscura", "texto en pantalla mínimo"],
    "core_promise_pattern": "podés hacer lo que yo hice si entendés esto"
  },
  "content_map": {
    "active_topic_clusters": ["lanzamientos digitales", "marca personal", "productividad creativa"],
    "best_converting_topics": ["marca personal (3x guardados promedio)"],
    "best_reach_topics": ["productividad (2.1x views promedio)"],
    "underexploited_topics": ["pricing", "audiencia de nicho"],
    "best_performing_format": "storytelling < 45s con CTA implícito",
    "worst_performing_format": "tutorial largo > 90s"
  },
  "account_situation": {
    "stage": "crecimiento activo",
    "detected_problem_pattern": "hooks fuertes pero completion rate cayendo — desarrollo no cumple la promesa",
    "main_strength": "generación de guardados (+62% vs benchmark propio 90d)",
    "immediate_opportunity": "explotar topic de marca personal que está subrepresentado",
    "plateau_signal": "engagement estabilizado hace 6 semanas pese a mayor volumen"
  },
  "business_context": {
    "top_pain_points": ["no sé por dónde empezar", "tengo miedo de no vender"],
    "frequent_objections": ["precio", "tiempo disponible"],
    "main_buying_reasons": ["confianza por el contenido", "resultados propios del creador"],
    "ideal_client_profile": "emprendedor 28-40, tiene audiencia pequeña, quiere monetizar"
  },
  "evolution": {
    "trajectory": "mayor consistencia visual, hooks más fuertes, narrativa menos profunda",
    "risk_signal": "volumen subió, profundidad bajó — riesgo de superficialidad percibida",
    "trend_direction": "improving_surface / declining_depth"
  },
  "raw_narrative": "Francisco es un creador de contenido educativo-comercial..."
}
```

### Cuándo Se Actualiza (Triggers)

| Trigger | Qué actualiza | Cómo |
|---------|--------------|------|
| Reel analizado con ArkoAI | `identity`, `content_map` | Edge Function post-análisis |
| Sync de métricas completado | `account_situation` | Al finalizar `/api/v1/sync/instagram` |
| Customer Voice procesado | `business_context` | Al procesar llamada o formulario |
| Cron semanal (sin cambios) | Revisión acumulativa | pg_cron → Edge Function |

### Regla de Actualización
No se regenera el perfil completo en cada trigger. Se actualiza **solo la sección afectada** y se regenera el `raw_narrative` que es lo que lee el LLM. Esto es eficiente y evita perder contexto histórico.

---

## Las Tools del LLM

Todas las tools reciben `workspace_id` **pre-inyectado desde el servidor**. El LLM solo elige qué tool llamar y con qué parámetros — nunca puede cambiar el workspace al que apunta.

### Tools disponibles en Chat General

```typescript
getTopReels(limit: number, period_days: number, sort_by: 'views' | 'hook_rate' | 'saves' | 'engagement' | 'completion_rate')
// Retorna: métricas + transcript + análisis ArkoAI de los top N reels
// Ejemplo de uso: "¿cuáles fueron mis mejores Reels?"

getWorstReels(limit: number, period_days: number)
// Retorna: bottom performers con análisis para diagnosticar fallos
// Ejemplo de uso: "¿qué contenido no funcionó y por qué?"

getReelDetails(reel_id: string)
// Retorna: perfil completo de un Reel (métricas + transcript + análisis narrativo/visual/audio + benchmark)
// Ejemplo de uso: "contame más sobre el Reel del [tema]"

getContentByTopic(topic: string)
// Retorna: todos los reels de un topic cluster específico
// Ejemplo de uso: "¿cómo me fue con el contenido de marca personal?"

getAccountBenchmarks(period_days: number)
// Retorna: promedios de la cuenta (hook rate, completion, engagement, saves, views)
// Ejemplo de uso: referencia para comparar piezas individuales

compareReels(reel_ids: string[])
// Retorna: comparación directa de múltiples piezas
// Ejemplo de uso: "comparame estos dos Reels"

getYoutubeVideos(limit: number, sort_by: 'views' | 'watch_time' | 'ctr')
// Retorna: top/bottom videos de YouTube con análisis
// Ejemplo de uso: "¿cómo está mi canal de YouTube?"

getAdsPerformance(period_days: number)
// Retorna: campañas activas, creativos, CPM, CTR, spend, top/bottom creativos
// Ejemplo de uso: "¿cómo están mis ads este mes?"

getCustomerVoiceInsights()
// Retorna: dolores, objeciones, razones de compra, frases textuales de clientes
// Ejemplo de uso: "¿qué dicen mis prospectos en las llamadas?"

searchContentByKeyword(query: string)
// Búsqueda semántica en transcripts de todos los Reels/videos
// Ejemplo de uso: "¿en qué videos hablé de pricing?"

getRecentContent(days: number)
// Retorna: últimas N piezas publicadas con contexto completo
// Ejemplo de uso: "¿qué publiqué en los últimos 14 días?"
```

### Tools disponibles en Chat por Pieza (subset)

```typescript
getReelDetails(reel_id: string)         // el reel ya cargado, por si necesita profundizar
getAccountBenchmarks(period_days: number) // para comparar esta pieza vs el promedio
compareReels(reel_ids: string[])         // para comparar con otras piezas
```

---

## Seguridad Multi-Tenant — 3 Capas

```
CAPA 1 — Server Session (más importante)
  workspace_id viene ÚNICAMENTE de la sesión autenticada del servidor
  El cliente, el usuario, y el LLM nunca pueden pasar un workspace_id distinto
  Implementado en: API Route middleware

CAPA 2 — Validación por tool (double-check)
  Antes de ejecutar cualquier query con un ID (reel_id, video_id, etc.):
    SELECT workspace_id FROM reels WHERE id = $reel_id
    → si no coincide con workspace de sesión → throw 403, no ejecuta
  Implementado en: cada función de tool

CAPA 3 — RLS de Supabase (última línea de defensa)
  Todas las tablas tienen RLS activo con is_workspace_member()
  Aunque fallen las capas 1 y 2, Supabase devuelve vacío o error
  Implementado en: migraciones existentes (ya configurado)
```

Para que haya una brecha de datos, las 3 capas tienen que fallar simultáneamente — prácticamente imposible.

---

## Base de Datos — Cambios Necesarios

### Tabla Nueva: `workspace_profiles`
**Migración:** `20260322000010_workspace_profiles.sql`

```sql
CREATE TABLE workspace_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Secciones del perfil (actualizadas por trigger)
  identity_data       jsonb NOT NULL DEFAULT '{}',   -- estilo, formatos, tono, marca
  content_map         jsonb NOT NULL DEFAULT '{}',   -- topics, formatos, patterns
  account_situation   jsonb NOT NULL DEFAULT '{}',   -- etapa, fortalezas, oportunidades
  business_context    jsonb NOT NULL DEFAULT '{}',   -- dolores, objeciones, cliente ideal
  evolution_notes     jsonb NOT NULL DEFAULT '{}',   -- trayectoria, señales de riesgo

  -- Texto completo para el LLM (se regenera al actualizar secciones)
  raw_narrative       text,

  -- Metadatos de actualización
  last_updated        timestamptz NOT NULL DEFAULT now(),
  updated_by_trigger  text,         -- 'reel_analysis' | 'sync' | 'customer_voice' | 'cron' | 'manual'
  version             int NOT NULL DEFAULT 1,
  is_ready            boolean NOT NULL DEFAULT false,  -- false mientras se genera por primera vez

  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE(workspace_id)
);

-- RLS
ALTER TABLE workspace_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_profiles_select" ON workspace_profiles
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "workspace_profiles_insert" ON workspace_profiles
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "workspace_profiles_update" ON workspace_profiles
  FOR UPDATE USING (is_workspace_member(workspace_id));

-- Trigger updated_at
CREATE TRIGGER handle_updated_at_workspace_profiles
  BEFORE UPDATE ON workspace_profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

### Tabla Existente: `chat_sessions` — Columnas a agregar
```sql
-- Agregar a chat_sessions (migración 000010 también)
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'general';
-- valores: 'general' | 'reel' | 'youtube' | 'ads'
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS context_id uuid;
-- reel_id o video_id si mode != 'general'
```

### Tabla Existente: `chat_messages` — Columnas a agregar
```sql
-- Agregar a chat_messages (migración 000010 también)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS tool_calls jsonb;
-- qué tools invocó el LLM y con qué parámetros
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS tool_results jsonb;
-- qué devolvieron las tools (para debugging y audit)
```

---

## API Routes Nuevas

### `POST /api/v1/chat`
Chat general — acceso a todas las redes.

**Request:**
```typescript
{
  session_id?: string,   // si es null, crea sesión nueva
  message: string,
  days?: number          // período de análisis (default: 90)
}
```

**Response:** Stream de texto (SSE) con chunks de la respuesta del LLM.

---

### `POST /api/v1/chat/reel/[reel_id]`
Chat por pieza — foco en un Reel específico.

**Request:**
```typescript
{
  session_id?: string,
  message: string
}
```

**Validación:** `reel_id` debe pertenecer al `workspace_id` de la sesión.
**Response:** Stream de texto (SSE).

---

### `GET /api/v1/chat/sessions`
Lista las sesiones de chat del workspace (para historial).

---

### `GET /api/v1/chat/sessions/[session_id]/messages`
Recupera mensajes de una sesión anterior.

---

### `POST /api/v1/workspace/profile/generate`
Genera o regenera el Creator DNA Profile desde cero.
Útil para el primer setup o si el usuario quiere un refresh manual.

---

### `GET /api/v1/workspace/profile`
Devuelve el Creator DNA Profile actual (para mostrar al usuario si se decide hacerlo visible).

---

## Estructura de Archivos a Crear

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── agents/
│   │       ├── page.tsx                    # Chat general (ya existe, refactorizar)
│   │       └── loading.tsx
│   └── api/
│       └── v1/
│           ├── chat/
│           │   ├── route.ts                # POST — chat general
│           │   └── reel/
│           │       └── [reel_id]/
│           │           └── route.ts        # POST — chat por pieza
│           └── workspace/
│               └── profile/
│                   ├── route.ts            # GET perfil
│                   └── generate/
│                       └── route.ts        # POST generar/regenerar
├── lib/
│   ├── arko-chat/
│   │   ├── tools.ts                        # Definición de todas las tools
│   │   ├── tool-executor.ts                # Ejecutor de tools con validación
│   │   ├── system-prompts.ts               # System prompts (base + modos)
│   │   ├── context-builders.ts             # Builders de contexto por modo
│   │   └── profile-updater.ts              # Lógica de actualización del Creator DNA
│   └── openai/
│       └── client.ts                       # Cliente OpenAI (ya existe, extender)
├── services/
│   └── workspace-profile.service.ts        # CRUD del Creator DNA Profile
└── components/
    └── features/
        └── agents/
            ├── ChatInterface.tsx            # UI del chat (input + mensajes)
            ├── ChatMessage.tsx              # Render de un mensaje (user/assistant/tool)
            ├── ToolCallIndicator.tsx        # "Consultando tus datos..." mientras llama tools
            ├── CreatorDNAPanel.tsx          # Panel que muestra el perfil (opcional, visible al usuario)
            └── ReelChatDrawer.tsx           # Chat por pieza dentro del drawer del Reel
```

---

## System Prompts

### Base (Cerebro de Fran) — mismo para ambos modos

```
Sos ArkoAI, el Director de Marketing IA de Arko.
Tu forma de analizar contenido está modelada en el framework de Francisco Doglio,
experto en contenido, marca personal y creación de personajes para el ecosistema
hispanohablante.

FRAMEWORK DE ANÁLISIS:
- Siempre mirás hook, desarrollo, core promise y CTA como unidad narrativa
- Sabés que un hook fuerte con completion rate bajo indica que el desarrollo no cumplió la promesa
- Diferenciás entre contenido de alcance, de conversión y de comunidad
- Analizás tono, energía, WPM y delivery como factores de retención, no solo el contenido
- Cruzás métricas cuantitativas con análisis cualitativo antes de emitir un diagnóstico
- Nunca inventás datos — si no tenés el dato, lo decís y lo buscás con las tools disponibles
- Tus recomendaciones son accionables: siempre terminan con qué hacer, no solo qué está mal

BENCHMARKS DE REFERENCIA (ecosistema hispano):
- Hook rate bueno: >40% | aceptable: 25-40% | malo: <25%
- Completion rate bueno: >35% en 60s | >50% en 30s
- Engagement rate bueno: >4% | aceptable: 2-4%
- Guardados sobre views: bueno >1%

REGLA DE ORO: si el usuario hace una pregunta que requiere datos específicos,
usá las tools disponibles para buscarlos antes de responder. No des respuestas
genéricas si tenés acceso a los datos reales del creador.
```

### Adición para Chat General

```
Tenés acceso a TODAS las redes del creador: Instagram, YouTube, Ads y Customer Voice.
Podés cruzar datos entre redes para detectar patrones que no son visibles en una sola.

CREATOR DNA PROFILE (actualizado automáticamente):
[aquí se inyecta el raw_narrative del workspace_profile]
```

### Adición para Chat por Pieza

```
Estás analizando una pieza específica. Tenés su contexto completo inyectado abajo.
Tu foco es esta pieza, pero podés referenciar el Creator DNA Profile para comparar.

PIEZA ANALIZADA:
[aquí se inyectan los datos completos del reel/video]

CREATOR DNA PROFILE (para contexto comparativo):
[aquí se inyecta el raw_narrative del workspace_profile]
```

---

## Flujo de Implementación — Paso a Paso

### FASE 1 — Base de Datos (Día 1, mañana)

- [ ] **Paso 1.1** — Leer schema actual con MCP antes de escribir la migración
- [ ] **Paso 1.2** — Crear migración `20260322000010_workspace_profiles_and_chat_update.sql`
  - Tabla `workspace_profiles` con RLS
  - Columnas adicionales en `chat_sessions` (`mode`, `context_id`)
  - Columnas adicionales en `chat_messages` (`tool_calls`, `tool_results`)
- [ ] **Paso 1.3** — Aplicar migración en staging, verificar con MCP
- [ ] **Paso 1.4** — Generar tipos TypeScript actualizados

### FASE 2 — Tools del LLM (Día 1)

- [ ] **Paso 2.1** — Crear `src/lib/arko-chat/tools.ts`
  - Definir todas las tools con su schema (nombre, descripción, parámetros)
  - `workspace_id` nunca en el schema de params — viene del servidor
- [ ] **Paso 2.2** — Crear `src/lib/arko-chat/tool-executor.ts`
  - Función `executeTool(toolName, params, workspaceId)`
  - Validación de workspace en cada tool antes de ejecutar
  - Queries a Supabase con service role para cada tool
- [ ] **Paso 2.3** — Testear cada tool aislada con datos reales (via MCP primero)

### FASE 3 — System Prompts y Context Builders (Día 1)

- [ ] **Paso 3.1** — Crear `src/lib/arko-chat/system-prompts.ts`
  - `buildBasePrompt()` — el cerebro de Fran
  - `buildGeneralChatPrompt(profile)` — base + DNA Profile
  - `buildReelChatPrompt(profile, reelContext)` — base + DNA + pieza
- [ ] **Paso 3.2** — Crear `src/lib/arko-chat/context-builders.ts`
  - `buildReelContext(reelId, workspaceId)` — query completa del reel con análisis
  - `buildAccountContext(workspaceId, days)` — resumen rápido de cuenta (fallback si no hay perfil)

### FASE 4 — Creator DNA Profile (Día 1-2)

- [ ] **Paso 4.1** — Crear `src/services/workspace-profile.service.ts`
  - `getProfile(workspaceId)` — lee perfil existente
  - `generateProfile(workspaceId)` — genera desde cero consultando todos los datos
  - `updateProfileSection(workspaceId, section, newData)` — actualización parcial
- [ ] **Paso 4.2** — Crear `src/lib/arko-chat/profile-updater.ts`
  - `onReelAnalyzed(workspaceId, reelId)` — actualiza identity + content_map
  - `onSyncCompleted(workspaceId)` — actualiza account_situation
  - `onCustomerVoiceProcessed(workspaceId)` — actualiza business_context
- [ ] **Paso 4.3** — API Routes del perfil
  - `GET /api/v1/workspace/profile`
  - `POST /api/v1/workspace/profile/generate`
- [ ] **Paso 4.4** — Hookear los updaters en los endpoints existentes
  - Al finalizar ArkoAI analysis → llamar `onReelAnalyzed`
  - Al finalizar sync → llamar `onSyncCompleted`

### FASE 5 — API Routes del Chat (Día 2)

- [ ] **Paso 5.1** — `POST /api/v1/chat/route.ts` (chat general)
  - Auth middleware → workspace_id
  - Cargar/crear chat_session
  - Cargar Creator DNA Profile
  - Build system prompt
  - Inyectar tools con workspace_id hardcodeado
  - Loop de tool calls: interceptar → validar → ejecutar → continuar
  - Stream de respuesta
  - Guardar mensaje y tool_calls en chat_messages
- [ ] **Paso 5.2** — `POST /api/v1/chat/reel/[reel_id]/route.ts` (chat por pieza)
  - Validar que reel pertenece al workspace (CAPA 2)
  - Cargar contexto del reel completo
  - Mismo flujo que general con tools limitadas

### FASE 6 — Frontend (Día 2-3)

- [ ] **Paso 6.1** — `ChatInterface.tsx` — UI del chat
  - Input de texto + botón enviar
  - Lista de mensajes con scroll
  - Streaming: mostrar texto mientras llega
  - Indicador de "Consultando datos..." cuando el LLM llama una tool
- [ ] **Paso 6.2** — `ChatMessage.tsx` — render de mensajes
  - Mensaje de usuario (derecha)
  - Mensaje del asistente con markdown renderizado (izquierda)
  - Indicador visual de qué tool se llamó (opcional, buena UX)
- [ ] **Paso 6.3** — `ToolCallIndicator.tsx`
  - Muestra "🔍 Consultando tus mejores Reels..." mientras ejecuta la tool
  - Desaparece cuando llega la respuesta
- [ ] **Paso 6.4** — Integrar en `/agents/page.tsx` (chat general)
- [ ] **Paso 6.5** — `ReelChatDrawer.tsx` — chat por pieza dentro del detail del Reel
  - Drawer o panel lateral que aparece al hacer clic en "Hablar con ArkoAI"
  - Usa el endpoint de chat por pieza

### FASE 7 — Polish y Seguridad (Día 3)

- [ ] **Paso 7.1** — Límite de tool calls por request (máximo 5 para evitar loops)
- [ ] **Paso 7.2** — Manejo de errores: si una tool falla, el LLM recibe el error y puede responder igual
- [ ] **Paso 7.3** — Guardar en `audit_logs` toda interacción con qué tools se llamaron
- [ ] **Paso 7.4** — Límite de tokens de contexto: si el perfil + contexto superan X tokens, truncar secciones menos prioritarias
- [ ] **Paso 7.5** — Rate limiting por workspace en los endpoints de chat

---

## Decisiones Pendientes (a definir antes de arrancar)

| # | Pregunta | Opciones | Recomendación |
|---|----------|----------|---------------|
| 1 | ¿El chat guarda historial entre sesiones? | Sí / No / Opcional | Sí — mejora la experiencia de "IA que te conoce" |
| 2 | ¿Límite de tool calls por mensaje? | 3 / 5 / sin límite | 5 max — evita loops sin limitar casos legítimos |
| 3 | ¿Chat general y chat por pieza son la misma UI? | Misma / Separadas | Misma UI, contexto diferente según dónde se abre |
| 4 | ¿Streaming en tiempo real? | Sí / No | Sí — el streaming es crítico para UX de chat |
| 5 | ¿Si un Reel no tiene análisis ArkoAI, el chat lo dispara? | Sí / No / Avisa | Avisa al usuario y ofrece dispararlo |
| 6 | ¿El Creator DNA Profile es visible para el usuario? | Sí / Solo interno | Visible — es diferencial de producto muy poderoso |
| 7 | ¿Cuántos días por defecto carga el chat general? | 30 / 60 / 90 | 90 días |
| 8 | ¿El perfil se genera automáticamente al primer sync? | Sí / Manual | Manual primero (botón "Generar mi perfil"), automático después |

---

## Dependencias

- `workspace_profiles` tabla creada y con RLS ✅ (pendiente de migración)
- `chat_sessions` y `chat_messages` ya existen ✅ (solo agregar columnas)
- OpenAI client ya configurado en el proyecto ✅
- Supabase RLS ya funciona en todas las tablas ✅
- Al menos algunos Reels con análisis ArkoAI para que el perfil tenga sustancia

---

## Métricas de Éxito

- El chat puede responder preguntas de métricas sin inventar datos
- El chat puede explicar POR QUÉ un Reel funcionó usando el transcript + análisis
- El Creator DNA Profile se actualiza automáticamente después de cada análisis
- Ningún usuario puede ver datos de otro workspace (verificar con logs de audit)
- Tiempo de primera respuesta (hasta que empieza el streaming): < 2 segundos

---

## Notas de Implementación

- **Modelo LLM:** GPT-4o es el modelo recomendado para tool use — tiene mejor capacidad de decidir cuándo y qué tool invocar vs GPT-4 turbo
- **Streaming con tool calls:** OpenAI soporta streaming + tool calls. La respuesta viene en chunks pero las tool calls llegan completas. El loop es: stream → detectar tool_call → ejecutar → continuar stream
- **Costo estimado por chat:** cada conversación con 2-3 tool calls cuesta ~$0.01-0.03 USD. Con volumen, considerar caché de queries frecuentes.
- **El `raw_narrative` del perfil** debe ser un texto bien estructurado en español, no JSON. El LLM procesa texto natural mejor como contexto base.

---

## Registro de Cambios en Otros Docs Necesarios

Al terminar la implementación, actualizar:
- [ ] `docs/DB_SCHEMA.md` — agregar tabla `workspace_profiles` y columnas nuevas
- [ ] `docs/API_DOCS.md` — documentar los 4 endpoints nuevos
- [ ] `docs/features/ai-agents.md` — reemplazar descripción actual con la arquitectura real
- [ ] `docs/02-architecture.md` — agregar `src/lib/arko-chat/` a la estructura de carpetas
- [ ] `CHANGELOG.md` — entrada por la implementación
- [ ] `CLAUDE.md` sección 9.5 — el próximo número disponible pasa a `10` (este es el doc `09`)... en realidad este es un doc de feature, no numerado. El próximo numerado sigue siendo `09`.


Lo Que Necesitamos Definir Antes de Implementar

  1. ¿El chat guarda historial entre sesiones o empieza limpio cada vez que el usuario entra?
  2. ¿Hay límite de tool calls por mensaje? (sin límite el LLM podría hacer 10 queries en una sola respuesta)    
  3. ¿El chat general y el chat por pieza son la misma UI con contexto diferente o rutas separadas?
  4. ¿Streaming en tiempo real (el usuario ve la respuesta mientras se escribe) o respuesta completa?
  5. ¿Qué pasa si el LLM pide analizar un Reel que no tiene ArkoAI analysis aún — ¿lo dispara automáticamente o  
  avisa que falta?

  Respondé esas 5 y arrancamos con el diseño de la DB y los endpoints.