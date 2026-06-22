# Feature: Arko AI

## Descripción
Asistente unificado de IA con acceso a toda la data del workspace. El usuario conversa con "Arko" en lenguaje natural. Arko usa **tool_use** para decidir qué datos necesita y consulta la base de datos on-demand. El usuario nunca ve el routing — para él, Arko simplemente sabe todo.

**Arko NO es un asistente genérico.** Su system prompt contiene el "segundo cerebro" de Francisco Doglio — toda su filosofía de análisis de contenido, extraída de una call de entrenamiento de 2 horas. Cada análisis que Arko realiza está filtrado por el framework de Fran: jerarquía concepto → estructura → ejecución, contenido semi-viral, seguidor ideal vs cliente ideal, los 5 tipos de hooks, las 7 características de un buen CTA, la regla 80/20, y más.

## Arquitectura

### Un solo asistente, herramientas inteligentes
- No hay @mentions ni selección de agentes. Arko es uno.
- **tool_use**: Claude decide qué datos necesita y los consulta via herramientas definidas en el backend.
- ADN del workspace siempre incluido en el system prompt (contexto estático).
- "Cerebro de Fran" incluido en el system prompt — framework completo de análisis de contenido (contexto estático).
- Datos de métricas/reels se cargan on-demand via tool calls (contexto dinámico).

### Flujo
1. Usuario envía mensaje
2. Backend carga ADN → construye system prompt (incluye "Cerebro de Fran")
3. Llama al LLM (Claude Sonnet 4) con historial + herramientas disponibles
4. Si Claude retorna tool_calls → ejecuta queries en la DB → alimenta resultados → repite (max 5 iteraciones)
5. Si Claude llama `consult_specialist` → se hace una segunda LLM call con el prompt ultra-especializado del sub-agente → el resultado se alimenta de vuelta a Arko
6. Claude genera respuesta final integrando datos + análisis especializado
7. Guarda respuesta + logs de uso (cada iteración se loguea por separado)

### Herramientas disponibles
| Tool | Descripción |
|------|-------------|
| `query_reels` | Busca reels con métricas, filtros (days_back, has_ads, min_views) y ordenamiento |
| `get_reel_details` | Todos los datos de un reel: métricas, transcript, narrativa, visual, audio, diagnóstico |
| `get_benchmarks` | Benchmarks promedio del workspace (90 días) |
| `get_goals` | Metas mensuales del usuario |
| `search_reels_by_topic` | Busca reels por tema en captions, hooks, transcripts |
| `get_top_hooks` | Hooks de los reels con mejor rendimiento |
| `get_topic_clusters` | Clusters de temas con métricas promedio |
| `consult_specialist` | Consulta a un sub-agente especializado para análisis profundo (ver abajo) |

### Sub-agentes especializados (multi-call)

Arko puede consultar sub-agentes especializados cuando necesita profundidad. El usuario no ve el routing — Arko integra el análisis del especialista en su respuesta.

| Especialista | Dominio |
|-------------|---------|
| `hook_expert` | Análisis y creación de hooks (5 tipos de Fran), códigos de lenguaje del nicho |
| `content_strategist` | Evaluación de conceptos, estructura narrativa, tipo de contenido, seguidor vs cliente ideal, regla 80/20 |
| `metrics_analyst` | Diagnóstico por patrones (views vs engagement), comparación vs benchmarks, orgánico vs pago |
| `cta_expert` | Evaluación contra las 7 características, creación de CTAs, análisis del recurso |
| `concept_evaluator` | Evaluación de ideas ganadoras usando los filtros de Fran |

**Arquitectura multi-call**: Arko detecta que necesita profundidad → llama `consult_specialist` como tool → backend hace una segunda LLM call con el prompt ultra-especializado + ADN + datos relevantes → resultado vuelve a Arko → Arko integra en su respuesta.

## Multi-sesión
- El usuario puede tener múltiples conversaciones.
- Sidebar izquierdo muestra historial de sesiones.
- Cada sesión persiste en `chat_sessions` + `chat_messages`.
- Las sesiones se pueden eliminar (soft-delete).

## Modelo
- Provider: Anthropic
- Modelo: `claude-sonnet-4-6`
- Max tokens: 4096
- Config: `getLLMConfig('ai-agents')`

## Archivos clave
- `src/services/arko-ai-context.ts` — Tool definitions + execution + ADN loading + specialist routing
- `src/services/arko-ai-prompts.ts` — System prompt builder: ADN context + "Cerebro de Fran" (framework de análisis)
- `src/services/arko-ai-specialists.ts` — Sub-agente specialist prompts (5 dominios) + `callSpecialist()` multi-call
- `src/app/api/v1/chat/route.ts` — Chat API (POST) con tool_use loop + specialist support
- `src/app/api/v1/chat/sessions/route.ts` — Sessions API (GET, DELETE)
- `src/app/api/v1/chat/messages/route.ts` — Messages API (GET)
- `src/app/(dashboard)/agents/page.tsx` — Server page
- `src/app/(dashboard)/agents/AgentsClient.tsx` — Client UI

## Ruta
`/agents`
