# Feature: ADN de Comunicación — Onboarding Conversacional

**Estado:** En desarrollo
**Migración:** `20260326000018_onboarding_completed.sql`
**API:** `POST/GET /api/v1/onboarding/chat`

---

## Descripción

Onboarding obligatorio para nuevos usuarios. Arko AI guía una conversación para construir el "ADN de Comunicación" del usuario — un perfil profundo de su marca, estrategia, competidores y mercado. Sin ADN completo, todas las features del dashboard están bloqueadas.

## Arquitectura

- **Chat conversacional** con Claude Haiku (`claude-haiku-4-5-20251001`)
- **Extracción estructurada** via `tool_use` — en cada respuesta, Claude devuelve texto + tool calls para guardar datos
- **Progreso derivado** de las 6 tablas de onboarding (no hay campo `current_step`)
- **Persistencia total** — cada mensaje se guarda en `chat_messages`, el usuario puede salir y volver
- **Feature blocking** — middleware redirige a `/onboarding/adn` si `onboarding_completed = false`

## Las 4 Secciones

| # | Sección | Tablas destino | Tool |
|---|---------|---------------|------|
| 1 | Tu Negocio | `workspace_profile` | `save_profile` |
| 2 | Tu Contenido | `workspace_strategies` | `save_strategy` |
| 3 | Tu Mercado | `workspace_market`, `workspace_competitors` | `save_market`, `save_competitor` |
| 4 | Tu Marca | `workspace_brand`, `workspace_references` | `save_brand`, `save_reference` |

## Flujo

1. Usuario nuevo entra al dashboard → middleware detecta `onboarding_completed = false` → redirect a `/onboarding/adn`
2. Arko saluda y pregunta sobre el negocio (Sección 1)
3. Usuario responde en lenguaje natural
4. Claude extrae datos estructurados via tool_use → se guardan en la tabla correspondiente
5. Claude evalúa la calidad de la respuesta — si es vaga o genérica, NO la guarda y repregunta con foco específico hasta obtener info accionable (protocolo anti-vaguedad)
6. Al completar una sección, transiciona a la siguiente
7. Al completar las 4 secciones → `workspaces.onboarding_completed = true` → redirect a `/`

## Archivos

### Backend
- `src/services/anthropic.service.ts` — Wrapper fetch para Anthropic API
- `src/services/adn-progress.service.ts` — Query de progreso en 6 tablas
- `src/services/adn-prompts.ts` — System prompt, welcome message, tool definitions
- `src/app/api/v1/onboarding/chat/route.ts` — GET (estado) + POST (procesar mensaje)

### Frontend
- `src/app/(dashboard)/onboarding/adn/page.tsx` — Server component, carga datos iniciales
- `src/app/(dashboard)/onboarding/adn/loading.tsx` — Skeleton
- `src/components/features/onboarding/AdnChat.tsx` — Chat principal (client)
- `src/components/features/onboarding/AdnSectionProgress.tsx` — Sidebar de progreso
- `src/components/features/onboarding/AdnMessage.tsx` — Burbuja de mensaje

### Middleware
- `src/lib/supabase/middleware.ts` — Gate de onboarding con cookie caching (24h)

### Layout
- `src/components/layout/Sidebar.tsx` — `onboardingMode` prop, links deshabilitados
- `src/app/(dashboard)/layout.tsx` — Pasa `onboardingMode` basado en cookie

## Criterios de Completitud

| Tabla | Umbral mínimo |
|-------|--------------|
| `workspace_profile` | 3+ campos llenos |
| `workspace_strategies` | Al menos plataforma 'instagram' |
| `workspace_market` | 3+ campos llenos |
| `workspace_competitors` | Al menos 1 competidor |
| `workspace_brand` | 2+ campos llenos |
| `workspace_references` | Al menos 1 referencia |
