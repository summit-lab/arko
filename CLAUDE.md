# ARKO — Reglas para IA (Método AInnovate v2)

> **ATENCIÓN IA:** Este proyecto usa Documentation-Driven Development.
> **ANTES** de escribir CUALQUIER línea de código, DEBES leer los docs relevantes.
> Documento completo del método: `METODO_AINNOVATE.md` (raíz del proyecto)

## Protocolo Obligatorio (antes de cada cambio)
1. LEER `docs/01-project-overview.md`
2. LEER `docs/02-architecture.md`
3. IDENTIFICAR qué feature se modifica
4. LEER `docs/features/[feature].md`
5. Si NO existe doc para la feature → CREARLO antes de codear
6. Si se toca DB → LEER `docs/DB_SCHEMA.md`
7. Si se toca API → LEER `docs/API_DOCS.md`
8. Si se toca auth/seguridad → LEER `docs/03-security.md`

## Los 12 Mandamientos del Vibe Coding (INVIOLABLES)
| # | Mandamiento | Regla |
|---|-------------|-------|
| I | NO ALUCINARÁS | Solo implementar exactamente lo pedido. Ante duda → PREGUNTAR |
| II | SEPARARÁS LÓGICA DE ESTILOS | Nunca mezclar en el mismo archivo |
| III | DOCUMENTARÁS CADA CAMBIO | Ningún cambio sin su doc correspondiente |
| IV | ACTUALIZARÁS EL CHANGELOG | Cada request → nueva entrada |
| V | DOCUMENTARÁS LA DB | Cada cambio de schema → DB_SCHEMA.md |
| VI | SEGUIRÁS LA ESTRUCTURA | No crear archivos fuera de la estructura |
| VII | USARÁS EL SISTEMA DE ESTILOS | Respetar TailwindCSS + shadcn/ui |
| VIII | PROTEGERÁS CREDENCIALES | Nada hardcodeado, todo en .env |
| IX | TIPARÁS TODO | TypeScript estricto, cero `any` |
| X | VALIDARÁS ANTES DE ENTREGAR | Checklist obligatorio |
| XI | MANTENDRÁS CONSISTENCIA | Seguir convenciones existentes |
| XII | COMUNICARÁS CON CLARIDAD | Resumen de acciones al terminar |

## 4 Leyes de Operación
1. **LEER ANTES DE ACTUAR** — Consultar docs antes de cualquier cambio
2. **NO ROMPER LO QUE FUNCIONA** — Detenerse si hay conflicto con la arquitectura
3. **DOCUMENTACIÓN CONTINUA** — Actualizar docs + CHANGELOG después de cada cambio
4. **SEGURIDAD** — Nunca deploy/push/cambios destructivos sin confirmación

## UX Optimista (OBLIGATORIO en toda la app)
Todo click o acción debe tener recompensa visual INMEDIATA. Sin excepción.

### Reglas de Feedback Instantáneo
| Acción | Feedback inmediato requerido |
|--------|------------------------------|
| Navegación entre páginas (sidebar) | `NavProgressBar` + estado activo optimista en sidebar |
| Cambio de tab interno (ej: Reels→Posts) | `nav:start` event + `isPending` opacity en tabs |
| Cambio de filtro (ej: 7d→90d) | `nav:start` event + opacity transition |
| Botón de acción (sync, save, etc.) | Estado `loading` con spinner inmediato |
| Click en cards/links | `cursor-pointer` + hover state visible |

### Implementación estándar
- **Navegación global**: `window.dispatchEvent(new Event("nav:start"))` antes de cualquier `router.push()`
- **Progress bar**: `NavProgressBar` en `(dashboard)/layout.tsx` via `Suspense`
- **Estado optimista**: `useTransition` + `isPending` para UI transitions
- **Skeletons**: Cada ruta tiene su `loading.tsx` — deben matchear pixel-perfect el layout real
- **Cursor**: Todo elemento interactivo tiene `cursor-pointer`

## Documentación del Proyecto
| Doc | Cuándo leerlo |
|-----|--------------|
| `docs/01-project-overview.md` | SIEMPRE (visión, stack, estado) |
| `docs/02-architecture.md` | SIEMPRE (estructura, convenciones) |
| `docs/03-security.md` | Si se toca auth, credenciales, RLS |
| `docs/04-deployment.md` | Si se toca deploy, CI/CD |
| `docs/DB_SCHEMA.md` | Si se toca base de datos |
| `docs/API_DOCS.md` | Si se toca endpoints/API |
| `docs/SKILLS.md` | ANTES de implementar cualquier feature nueva |
| `docs/05-environments-guide.md` | Si se toca: variables de entorno, URLs, ambientes, callbacks, env.ts |
| `docs/features/team-collaboration.md` | Si se toca onboarding, GitHub, setup, trabajo en paralelo o guías operativas |
| `docs/features/*.md` | El doc de la feature que se modifica |

## Tabla de Lookup
| Archivo que se modifica | Doc que se debe leer |
|------------------------|---------------------|
| `src/app/api/**` | `docs/API_DOCS.md` + `docs/features/[feature].md` |
| `supabase/migrations/*.sql` | `docs/DB_SCHEMA.md` |
| `README.md` | `docs/features/team-collaboration.md` |
| `.env.example` | `docs/features/team-collaboration.md` + `docs/03-security.md` |
| `.github/PULL_REQUEST_TEMPLATE.md` | `docs/features/team-collaboration.md` |
| `.windsurf/workflows/*.md` | `docs/features/team-collaboration.md` |
| `src/lib/env.ts` | `docs/05-environments-guide.md` |
| `.env.example` | `docs/05-environments-guide.md` + `docs/03-security.md` |
| _(la IA agrega entradas conforme se crean features)_ | |
