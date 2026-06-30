# ARKO — Reglas para IA

> **Documentation-Driven Development.** ANTES de codear, leer los docs relevantes.

---

## 1. Mandamientos (INVIOLABLES)

- **NO ALUCINAR** — Solo lo pedido. Ante duda → PREGUNTAR
- **SEPARAR LÓGICA DE ESTILOS** — Nunca en el mismo archivo
- **DOCUMENTAR** — Ningún cambio sin doc + CHANGELOG
- **PROTEGER CREDENCIALES** — Todo en .env, nada hardcodeado
- **TIPAR TODO** — TypeScript estricto, cero `any`
- **SEGUIR ESTRUCTURA** — No crear archivos fuera de la estructura existente
- **CONSISTENCIA** — Seguir convenciones del código existente
- **DISEÑAR PARA ESCALA** — 100+ usuarios, multi-tenant, índices compuestos, RLS

---

## 2. Protocolo (antes de cada cambio)

1. IDENTIFICAR qué feature se modifica
2. LEER `docs/features/[feature].md` (si no existe → crearlo)
3. Si toca DB → `docs/DB_SCHEMA.md` | Si toca API → `docs/API_DOCS.md` | Si toca auth → `docs/03-security.md` | Si toca UI → `docs/08-design-system.md`
4. Después del cambio: actualizar docs + CHANGELOG

---

## 3. Router de Documentación

### Proyecto

| Doc | Tema | Leer si... |
|-----|------|------------|
| `docs/01-project-overview.md` | Visión, stack, módulos | Inicio de feature nueva |
| `docs/02-architecture.md` | Carpetas, convenciones | Crear archivos nuevos |
| `docs/03-security.md` | Auth, RLS, permisos | Tocar auth/seguridad |
| `docs/04-deployment.md` | Deploy, CI/CD, Vercel | Tocar deploy |
| `docs/05-environments-guide.md` | Env vars, ambientes | Tocar .env o env.ts |
| `docs/06-github-stages-databases-guide.md` | Git flow, staging, prod | Flujo operativo |
| `docs/07-mcp-guide.md` | MCP, Supabase directo | DB, schema, migraciones |
| `docs/08-design-system.md` | Glassmorphism, UI tokens | UI, estilos, componentes |

### Referencia

| Doc | Leer si... |
|-----|------------|
| `docs/DB_SCHEMA.md` | Modificar base de datos |
| `docs/API_DOCS.md` | Modificar endpoints |
| `docs/SKILLS.md` | Implementar feature nueva |
| `docs/ARKO_PRD_INSTAGRAM_v1.md` | Tocar módulo Instagram |
| `docs/DOCS_MANAGEMENT.md` | Crear docs nuevos, nomenclatura, checklist |

### Features

| Doc | Tema |
|-----|------|
| `docs/features/ig-intelligence.md` | Instagram Intelligence |
| `docs/features/yt-intelligence.md` | YouTube Intelligence |
| `docs/features/ads-intelligence.md` | Ads Intelligence |
| `docs/features/customer-voice.md` | Customer Voice |
| `docs/features/ai-agents.md` | Agentes de IA (chat) |
| `docs/features/dashboard-layout.md` | Dashboard, sidebar, header |
| `docs/features/admin-panel.md` | Admin panel, invitaciones |
| `docs/features/onboarding-adn.md` | ADN de Comunicación |
| `docs/features/team-collaboration.md` | Setup developer, onboarding |

### Lookup rápido (archivo → doc)

| Archivo | Doc |
|---------|-----|
| `src/app/api/**` | `docs/API_DOCS.md` + feature doc |
| `src/app/(admin)/**` | `docs/features/admin-panel.md` + `docs/03-security.md` |
| `src/app/(dashboard)/onboarding/adn/**` | `docs/features/onboarding-adn.md` |
| `src/components/**` | `docs/08-design-system.md` + feature doc |
| `supabase/migrations/**` | `docs/DB_SCHEMA.md` + `docs/07-mcp-guide.md` |
| `src/lib/env.ts`, `.env.*` | `docs/05-environments-guide.md` |

---

## 4. Git — Sesiones de Trabajo

> **NUNCA push directo a `develop` ni `main`** — todo via PR.

**Inicio:** `git checkout develop` → `git pull` → `git checkout -b feature/nombre` → reportar estado.

**Durante:** Trabajar en feature branch. No commitear automáticamente.

**Cierre** (cuando dice "terminé", "commitea", "cerrá sesión"):
EJECUTAR inmediatamente (no describir):
1. `git add` → `git commit` (Conventional Commits) → `git push` → `gh pr create` a develop
2. Reportar: link PR, resumen, pendientes, migraciones DEV pendientes en PROD

**Reglas inviolables:** NUNCA push/merge a main. Solo humano mergea a main. Commits solo después de testear.

**Ramas:** `feature/` | `fix/` | `docs/` | `chore/` | `design/`

**Commits:** `feat:` | `fix:` | `docs:` | `chore:` | `design:`

---

## 5. MCP y Base de Datos

MCP de Supabase configurado. Guía: `docs/07-mcp-guide.md`

> **Realidad operativa (actualizado 2026-06-29):** Dev Arko (`hrsvglgswatwklivkoyp`) quedó **abandonado** y desincronizado. La DB de trabajo es **Prod Arko (`zphvrohosizkbrnxtppj`)**. Ya no hay ambiente de desarrollo: **toda migración es, de hecho, un release a producción.**

### Regla INVIOLABLE

> **Lectura libre; escritura SOLO con confirmación explícita y SQL mostrado.**
> La IA puede hacer `SELECT` en Prod en cualquier momento. **NUNCA** aplica DDL/DML (migraciones, `UPDATE`, `DELETE`, etc.) sin haber mostrado el SQL exacto y recibido confirmación explícita del humano en ese mismo intercambio. Una confirmación previa NO habilita cambios futuros.

| Acción | Prod Arko |
|--------|-----------|
| SELECT / inspección | SI (siempre) |
| Migraciones / DDL / DML | SI, **solo vía protocolo de release** |

**Protocolo de release (obligatorio para todo cambio en Prod):**
1. **Mostrar el SQL exacto** (idealmente como archivo en `supabase/migrations/`).
2. **Confirmación explícita** del humano sobre ese SQL puntual.
3. **Aplicar de a una** (una migración por vez), preferentemente aditiva y reversible (incluir rollback).
4. **Verificar** el resultado con `SELECT` después de aplicar.

**Antes de escribir una migración:** inspeccionar el estado REAL de Prod (no asumir desde los archivos del repo ni los docs — pueden estar desincronizados).

**Orden:** DB primero, código después. Nunca al revés.

---

## 6. UX Optimista

Todo click = feedback visual inmediato. Detalles en `docs/08-design-system.md`.

Patrones: `NavProgressBar`, `useTransition` + `isPending`, `loading.tsx` skeletons, `cursor-pointer` en todo interactivo.
