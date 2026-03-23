# ARKO — Reglas para IA (Método AInnovate v2)

> **ATENCIÓN IA:** Este proyecto usa Documentation-Driven Development.
> **ANTES** de escribir CUALQUIER línea de código, DEBES leer los docs relevantes.
> Documento completo del método: `METODO_AINNOVATE.md` (raíz del proyecto)

---

## 1. Protocolo Obligatorio (antes de cada cambio)

1. LEER `docs/01-project-overview.md`
2. LEER `docs/02-architecture.md`
3. IDENTIFICAR qué feature se modifica
4. LEER `docs/features/[feature].md`
5. Si NO existe doc para la feature → CREARLO antes de codear
6. Si se toca DB → LEER `docs/DB_SCHEMA.md`
7. Si se toca API → LEER `docs/API_DOCS.md`
8. Si se toca auth/seguridad → LEER `docs/03-security.md`

---

## 2. Los 12 Mandamientos (INVIOLABLES)

| # | Mandamiento | Regla |
|---|-------------|-------|
| I | NO ALUCINARÁS | Solo implementar exactamente lo pedido. Ante duda → PREGUNTAR |
| II | SEPARARÁS LÓGICA DE ESTILOS | Nunca mezclar en el mismo archivo |
| III | DOCUMENTARÁS CADA CAMBIO | Ningún cambio sin su doc correspondiente |
| IV | ACTUALIZARÁS EL CHANGELOG | Cada request → nueva entrada |
| V | DOCUMENTARÁS LA DB | Cada cambio de schema → DB_SCHEMA.md |
| VI | SEGUIRÁS LA ESTRUCTURA | No crear archivos fuera de la estructura |
| VII | USARÁS EL SISTEMA DE ESTILOS | Respetar TailwindCSS + shadcn/ui + `docs/08-design-system.md` |
| VIII | PROTEGERÁS CREDENCIALES | Nada hardcodeado, todo en .env |
| IX | TIPARÁS TODO | TypeScript estricto, cero `any` |
| X | VALIDARÁS ANTES DE ENTREGAR | Checklist obligatorio |
| XI | MANTENDRÁS CONSISTENCIA | Seguir convenciones existentes |
| XII | COMUNICARÁS CON CLARIDAD | Resumen de acciones al terminar |

---

## 3. Leyes de Operación

1. **LEER ANTES DE ACTUAR** — Consultar docs antes de cualquier cambio
2. **NO ROMPER LO QUE FUNCIONA** — Detenerse si hay conflicto con la arquitectura
3. **DOCUMENTACIÓN CONTINUA** — Actualizar docs + CHANGELOG después de cada cambio
4. **SEGURIDAD** — Nunca cambios destructivos en producción sin confirmación del humano

---

## 4. Router de Documentación

> Este es el mapa central. Cuando necesites información, buscá acá primero.
> Cada doc tiene UNA responsabilidad. No se pisan entre sí.

### 4.1 Docs del proyecto (numerados)

| # | Doc | Tema | Cuándo leerlo |
|---|-----|------|---------------|
| 01 | `docs/01-project-overview.md` | Visión, stack, módulos, estado | SIEMPRE |
| 02 | `docs/02-architecture.md` | Estructura de carpetas, convenciones, ADRs | SIEMPRE |
| 03 | `docs/03-security.md` | Auth, credenciales, RLS, permisos | Si se toca auth o seguridad |
| 04 | `docs/04-deployment.md` | Deploy, CI/CD, Vercel, checklists de release | Si se toca deploy |
| 05 | `docs/05-environments-guide.md` | Variables de entorno, ambientes, env.ts | Si se toca config de ambientes |
| 06 | `docs/06-github-stages-databases-guide.md` | GitHub, ramas, PRs, staging, production, Supabase | Si se toca flujo operativo |
| 07 | `docs/07-mcp-guide.md` | Conexiones MCP, acceso directo a Supabase | Si se consulta DB, schema o genera migraciones |
| 08 | `docs/08-design-system.md` | Glassmorphism, tipografía, colores, espaciados | Si se toca UI, estilos o componentes visuales |

### 4.2 Docs de referencia (sin numerar)

| Doc | Tema | Cuándo leerlo |
|-----|------|---------------|
| `docs/DB_SCHEMA.md` | Tablas, columnas, RLS, migraciones, diagrama ER | Si se modifica la base de datos |
| `docs/API_DOCS.md` | Endpoints, contratos request/response | Si se modifica un endpoint |
| `docs/SKILLS.md` | Skills y MCP servers disponibles | Antes de implementar feature nueva |
| `docs/ARKO_PRD_INSTAGRAM_v1.md` | PRD completo de Instagram Intelligence | Si se toca el módulo de Instagram |
| `docs/ADR-005-prd-technical-decisions.md` | Decisiones técnicas del PRD | Si se necesita entender por qué algo fue diseñado así |

### 4.3 Docs de features

| Doc | Tema |
|-----|------|
| `docs/features/team-collaboration.md` | Onboarding, setup de developer nuevo, flujo operativo |
| `docs/features/ig-intelligence.md` | Instagram Intelligence — métricas, sync, análisis |
| `docs/features/yt-intelligence.md` | YouTube Intelligence |
| `docs/features/ads-intelligence.md` | Ads Intelligence |
| `docs/features/customer-voice.md` | Customer Voice |
| `docs/features/ai-agents.md` | Agentes de IA (chat) |
| `docs/features/dashboard-layout.md` | Layout del dashboard, sidebar, header |

### 4.4 Docs operativos (fuera de docs/)

| Doc | Tema | Cuándo leerlo |
|-----|------|---------------|
| `.github/GITHUB_DESKTOP_GUIDE.md` | Guía de GitHub Desktop para developers | Referencia para developers, no para la IA |
| `.github/PULL_REQUEST_TEMPLATE.md` | Template de PRs | Al sugerir descripción de un PR |
| `.github/workflows/ci.yml` | CI que corre en cada PR | Si falla el CI |
| `CHANGELOG.md` | Historial de todos los cambios | Después de cada cambio (para agregar entrada) |
| `METODO_AINNOVATE.md` | Método completo de trabajo | Referencia general |

---

## 5. Tabla de Lookup (archivo → doc)

> Cuando vas a modificar un archivo, consultá esta tabla para saber qué doc leer ANTES.

| Archivo que se modifica | Doc que se debe leer |
|------------------------|---------------------|
| `src/app/api/**` | `docs/API_DOCS.md` + `docs/features/[feature].md` |
| `supabase/migrations/*.sql` | `docs/DB_SCHEMA.md` + `docs/07-mcp-guide.md` |
| `src/app/globals.css` | `docs/08-design-system.md` |
| `src/components/**` | `docs/08-design-system.md` + `docs/features/[feature].md` |
| `src/lib/env.ts` | `docs/05-environments-guide.md` |
| `.env.example` | `docs/05-environments-guide.md` + `docs/03-security.md` |
| `.github/**` | `docs/06-github-stages-databases-guide.md` |
| `README.md` | `docs/features/team-collaboration.md` |

---

## 6. Flujo Git — Responsabilidades

> **El flujo git es 100% responsabilidad del developer usando GitHub Desktop.**
> **La IA NUNCA ejecuta comandos git de ningún tipo.**

### Regla absoluta

**La IA NO hace:**
- `git pull`, `git push`, `git commit`, `git checkout`, `git add`, ni ningún otro comando git
- Crear ramas, cambiar de ramas, hacer merge, ni nada relacionado con git

**La IA SÍ puede:**
- Sugerir el nombre de rama a crear (el developer la crea en GitHub Desktop)
- Sugerir el mensaje de commit (el developer lo escribe en GitHub Desktop)
- Sugerir el título y descripción del PR (el developer lo abre desde GitHub)
- Indicar qué archivos se cambiaron y deben commitearse

### Nomenclatura de ramas (referencia para el developer)

| Tipo de cambio | Prefijo | Ejemplo |
|----------------|---------|---------|
| Funcionalidad nueva | `feature/` | `feature/dashboard-analytics` |
| Bugfix | `fix/` | `fix/login-redirect` |
| Documentación | `docs/` | `docs/guia-onboarding` |
| Mantenimiento | `chore/` | `chore/update-dependencies` |

### Formato de commits — Conventional Commits (referencia para el developer)

```
feat: agrega sistema de analytics al dashboard
fix: corrige redirect de meta callback en staging
docs: actualiza guía de onboarding del equipo
chore: actualiza dependencias de next.js
```

### Cómo trabaja la IA al terminar un cambio

Al finalizar una tarea, la IA indica:
1. Qué archivos fueron modificados y deben commitearse
2. El mensaje de commit sugerido
3. El nombre de rama sugerido (si aplica)
4. El título y descripción sugeridos para el PR

El developer hace todo eso desde GitHub Desktop.

> Guía de GitHub Desktop para developers: `.github/GITHUB_DESKTOP_GUIDE.md`

---

## 7. MCP — Conexiones activas

Este proyecto tiene el MCP de Supabase configurado.

- **Úsalo** para consultar el schema real antes de generar migraciones
- **Úsalo** para verificar tablas, columnas y políticas RLS existentes
- **Úsalo** para generar tipos TypeScript desde el schema actual
- **Guía completa:** `docs/07-mcp-guide.md`

### Regla INVIOLABLE de bases de datos

> **Durante el desarrollo, la IA SOLO aplica migraciones en Dev Arko (`hrsvglgswatwklivkoyp`).**
> **La IA NUNCA toca Prod Arko durante el desarrollo, ni aunque el humano lo pida.**

#### Dos modos de operación

| Modo | Cuándo | Qué puede hacer la IA en Prod Arko |
|------|--------|-------------------------------------|
| **Desarrollo** | Mientras se trabaja en features/fixes | Solo SELECT (lectura). **Nada de escritura.** |
| **Release** | El developer pide explícitamente un deploy a producción | Aplicar las migraciones ya testeadas en DEV |

#### Cómo distinguir un release de desarrollo normal

Un release se identifica cuando el developer dice algo como:
- "Pasá las migraciones a PROD"
- "Hacé el deploy a producción"
- "Release a PROD"
- "Mové la DB a producción"

Si no hay una instrucción explícita de release, **siempre es desarrollo** y PROD es intocable.

#### Qué PUEDE hacer la IA con MCP

| Acción | Dev Arko (siempre) | Prod Arko (desarrollo) | Prod Arko (release) |
|--------|-------------------|----------------------|-------------------|
| Consultar schema | SÍ | SÍ | SÍ |
| Leer datos (SELECT) | SÍ | SÍ | SÍ |
| Aplicar migraciones | SÍ | **NUNCA** | SÍ |
| Ejecutar DDL | SÍ | **NUNCA** | SÍ |
| Ejecutar DML | SÍ | **NUNCA** | Solo si es parte de la migración |

#### Protocolo de release a PROD

Cuando el developer solicita un release, la IA debe:

1. **Listar** todas las migraciones pendientes en PROD (comparar DEV vs PROD)
2. **Mostrar** el SQL que se va a ejecutar para que el developer lo revise
3. **Pedir confirmación explícita** antes de ejecutar cada migración
4. **Aplicar** una migración a la vez, verificando éxito antes de la siguiente
5. **Verificar** el estado final de PROD (schema, constraints, policies)

### 7.1 Flujo de migraciones DEV → PROD

```
Desarrollo:  IA aplica migración en DEV → Developer testea → PR → Merge a main
Release:     Developer pide release → IA lista pendientes → Confirmación → IA aplica en PROD → Vercel deploya
```

El orden es: **DB primero, código después** (o simultáneo). Nunca código antes que DB.

---

## 8. UX Optimista (OBLIGATORIO en toda la app)

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

---

## 9. Autogestión de Documentación (OBLIGATORIO)

> Estas reglas garantizan que la documentación escale con el proyecto.
> Si la IA no las sigue, el sistema se desactualiza y pierde valor.

### 9.1 Regla general

**Todo cambio en el proyecto DEBE dejar la documentación actualizada antes de considerarse terminado.**

No existen cambios "solo de código". Si cambia la funcionalidad, cambia el doc.

### 9.2 Cuándo crear un doc nuevo

| Situación | Acción |
|-----------|--------|
| Se crea una feature nueva | Crear `docs/features/<nombre>.md` |
| Se agrega un doc numerado nuevo | Usar el siguiente número disponible: `docs/XX-nombre.md` |
| Se conecta un MCP nuevo | Agregar sección en `docs/07-mcp-guide.md` |
| Se agrega una skill nueva | Agregar entrada en `docs/SKILLS.md` |

### 9.3 Checklist de autogestión (después de cada cambio)

La IA DEBE verificar estos puntos antes de dar una tarea por terminada:

- [ ] ¿Se actualizó `docs/features/[feature].md`?
- [ ] ¿Se actualizó `CHANGELOG.md`?
- [ ] ¿Si se creó un doc nuevo, se registró en la sección 4 (Router) de este archivo?
- [ ] ¿Si se creó un doc nuevo, se agregó en la Tabla de Lookup (sección 5)?
- [ ] ¿Si se creó un doc nuevo, se registró en `docs/02-architecture.md` en la estructura de carpetas?
- [ ] ¿Si se tocó DB, se actualizó `docs/DB_SCHEMA.md`?
- [ ] ¿Si se tocó API, se actualizó `docs/API_DOCS.md`?
- [ ] ¿Si se tocó UI/estilos, se respetó `docs/08-design-system.md`?

### 9.4 Nomenclatura de docs nuevos

| Tipo | Formato | Ejemplo |
|------|---------|---------|
| Doc numerado (guía del proyecto) | `docs/XX-nombre-descriptivo.md` | `docs/09-testing-guide.md` |
| Doc de feature | `docs/features/nombre-feature.md` | `docs/features/youtube-sync.md` |
| Doc de referencia (schema, api, skills) | `docs/NOMBRE_CAPS.md` | `docs/DB_SCHEMA.md` |
| Doc operativo / guía developer | `.github/NOMBRE_CAPS.md` | `.github/GITHUB_DESKTOP_GUIDE.md` |
| ADR (decisión arquitectónica) | `docs/ADR-XXX-nombre.md` | `docs/ADR-006-caching-strategy.md` |
| Skill doc | `docs/skills/nombre-skill.md` | `docs/skills/meta-api-expert.md` |

### 9.5 Próximo número disponible para docs numerados

**Próximo número disponible: `09`**

(Actualizar este número cada vez que se cree un doc numerado nuevo)

### 9.6 Regla de oro

> Si un developer nuevo clona el repo mañana, su IA debe poder leer `CLAUDE.md` y encontrar TODO lo que necesita sin preguntar. Si falta algo, este archivo está incompleto.
