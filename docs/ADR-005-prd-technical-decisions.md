# ADR-005: Decisiones Técnicas para PRD Instagram v1

**Fecha:** 2026-03-18
**Contexto:** El PRD (docs/ARKO_PRD_INSTAGRAM_v1.md) deja abiertos puntos de la sección 14. Este ADR documenta las decisiones tomadas.

---

## 14.1 Infraestructura y tech stack

| Decisión | Valor | Razón |
|----------|-------|-------|
| Framework | Next.js 16 + Supabase | Ya configurado, alineado con el PRD |
| DB | Supabase PostgreSQL | Multi-tenant con RLS nativo |
| Object Storage | Supabase Storage | Buckets `reels-media` (MP4) y `reels-frames` (frames extraídos) |
| Queue/Workers | Supabase Edge Functions + pg_cron | Edge Functions para pipelines async, pg_cron para sync periódico |
| Deploy | Vercel (frontend) + Supabase (backend) | Ya definido en architecture.md |

## 14.2 Modelo de datos

- **Multi-tenant:** Tabla `workspaces` como entidad raíz. Cada tabla referencia `workspace_id`.
- **RLS:** Activado en TODAS las tablas. Políticas basadas en `workspace_id` ↔ `auth.uid()`.
- **Tablas diseñadas:** 15 tablas (ver DB_SCHEMA.md actualizado).
- **Migraciones:** Archivos SQL secuenciales en `supabase/migrations/`.

## 14.3 API interna

| Decisión | Valor |
|----------|-------|
| Protocolo | REST (Next.js API Routes) |
| Prefijo | `/api/v1/` |
| Auth | Bearer JWT (Supabase Auth) |
| Paginación | Cursor-based para listados grandes, offset para dashboards |
| Formato | JSON con envelope `{ data, pagination?, error? }` |

## 14.4 Rate limiting y quotas de Meta

| Decisión | Valor |
|----------|-------|
| Batch size sync | 50 reels por request (paginación de Meta) |
| Retry strategy | Exponential backoff: 1s, 2s, 4s, 8s, max 3 retries |
| Token refresh | Long-lived tokens (60 días), refresh automático via Edge Function cron |
| Rate limit handling | Respetar `x-business-use-case-usage` header, pausar si >80% |
| Backfill | Al conectar cuenta nueva: sync últimos 90 días completos |

## 14.5 Pipeline IA — proveedores y costos

| Componente | Proveedor | Costo estimado/Reel | Razón |
|-----------|-----------|---------------------|-------|
| ASR (transcripción) | OpenAI Whisper API | ~$0.006/min | Ya en stack, buena calidad español |
| Visión/OCR | OpenAI GPT-4o (vision) | ~$0.01/5 frames | Multi-modal, un solo proveedor |
| LLM análisis narrativo | OpenAI GPT-4o | ~$0.02/análisis | Automático, prompts optimizados |
| LLM diagnóstico completo | OpenAI GPT-4o | ~$0.05/diagnóstico | Bajo demanda, más tokens |
| **Total automático/Reel** | — | **~$0.036** | — |
| **Total con diagnóstico** | — | **~$0.086** | — |
| Caching | Hash de media_url → skip si ya procesado | $0 | Evitar re-procesar |

## 14.6 Prompts del copiloto

- **Mega-prompt diagnóstico:** Se inyecta contexto estructurado (métricas + benchmark + transcript + visual) como JSON en system prompt. Max ~4K tokens de contexto por Reel.
- **System prompt chat:** Instrucciones de grounding + reglas del PRD sección 9.1. Contexto inyectado via RAG (top-K reels relevantes).
- **Prompt templates:** Almacenados en tabla `prompt_templates` (fase 2). MVP: hardcoded en frontend.
- **Context window:** Usar summarización progresiva si el chat excede 8K tokens de historial.

## 14.7 Multi-tenancy y pricing

| Decisión | Valor |
|----------|-------|
| Multi-tenant | Sí, desde día 1 via `workspaces` |
| Medición de uso | Reels procesados + análisis IA generados + mensajes de chat |
| Tiers MVP | Free (10 reels), Pro ($49/mo, 100 reels), Agency ($149/mo, unlimited) |
| Enforcement | Soft limits via check en API antes de procesar |

## 14.8 Seguridad y compliance

| Decisión | Valor |
|----------|-------|
| Tokens Meta | Encriptados con `pgcrypto` (`pgp_sym_encrypt`) at rest |
| Clave de encriptación | `META_TOKENS_ENCRYPTION_KEY` en env vars |
| GDPR | Botón "Eliminar mi cuenta" borra workspace + cascade a todo |
| Retención media | MP4 descargados se eliminan después de procesamiento IA (solo se guardan frames + transcript) |

## 14.9 Refresh y sincronización

| Decisión | Valor |
|----------|-------|
| Sync periódico | Cada 6 horas via pg_cron para cuentas activas |
| Re-sync métricas | Reels con < 7 días se re-sincronizan (métricas cambian) |
| Backfill | Al conectar: últimos 90 días |
| Método | Polling (no webhooks de Meta, son unreliable para insights) |
| Tracking | Tabla `sync_jobs` con status, timestamps, errores |

## 14.10 UX / wireframes

- MVP usa el diseño glassmorphic ya implementado.
- Dashboard principal: Grid de Reels con thumbnails + badges (rediseño del actual).
- Ficha de Reel: Nueva ruta `/instagram/[id]` con las 5 secciones del PRD 8.2.
- Onboarding: `/onboarding` con flujo de conexión Meta OAuth.
- Estados vacíos y loading states se implementan progresivamente.

## 14.11 Testing y validación

| Aspecto | Estrategia |
|---------|-----------|
| Métricas vs Instagram nativo | Comparación manual en fase beta con 3 cuentas de prueba |
| Mapeo Reel ↔ Ad | Tests unitarios con fixtures de respuestas de Meta API |
| Calidad IA | Evaluación humana de 20 diagnósticos en beta + scoring rubric |
| E2E | Playwright para flujos críticos (connect, sync, view reel) |
