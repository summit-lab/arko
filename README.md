# Arko — AI Marketing Director

Plataforma analítica para creadores y marcas personales que cruza métricas cuantitativas, datos cualitativos y análisis con IA en una sola operación de marketing.

## Repositorio Oficial

- Proyecto: `arko`
- Organización / usuario GitHub: `summit-lab`
- Repositorio remoto: `https://github.com/summit-lab/arko.git`
- Contacto operativo: `summit@nalify.marketing`

## Stack Principal

- Next.js 16 (App Router)
- React 19
- TypeScript
- TailwindCSS 4
- shadcn/ui
- Supabase (Auth, Postgres, Storage, Edge Functions)

## Documentación Base

El hub central de documentación es `CLAUDE.md` — ahí está el router completo a todos los docs.

Antes de tocar cualquier parte del proyecto, leer en este orden:

1. `CLAUDE.md` — reglas, router de docs, flujo git, autogestión
2. `docs/01-project-overview.md` — visión, stack, estado
3. `docs/02-architecture.md` — estructura, convenciones
4. `docs/features/[feature].md` — la feature que se va a tocar
5. `docs/03-security.md` — si se tocan credenciales, auth o permisos
6. `docs/07-mcp-guide.md` — si se va a consultar la DB o generar migraciones

## Setup Local

### 1. Requisitos

- Node.js 20+
- npm 10+
- Git
- Acceso al proyecto Supabase del equipo

### 2. Instalación

```bash
npm install
```

### 3. Variables de entorno

Copiar el template y completar los valores reales:

```bash
cp .env.example .env.local
```

Si estás en Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Luego completar `.env.local` con las credenciales del ambiente correspondiente.

Guía completa de ambientes y variables: `docs/05-environments-guide.md`.

### 4. Levantar el proyecto

```bash
npm run dev
```

Abrir `http://localhost:3000`.

## Scripts Disponibles

- `npm run dev` — entorno local
- `npm run build` — build de producción
- `npm run start` — servir build
- `npm run lint` — lint
- `npx tsc --noEmit` — validación de tipos

## Flujo de Trabajo en Equipo

### Branches

- `main` → producción
- `develop` → integración
- `feature/*` → nuevas funcionalidades
- `fix/*` → correcciones
- `docs/*` → documentación
- `chore/*` → mantenimiento técnico

### Flujo recomendado

1. Actualizar `develop`
2. Crear rama nueva desde `develop`
3. Implementar el cambio
4. Actualizar documentación y `CHANGELOG.md`
5. Validar tipos/build
6. Abrir Pull Request hacia `develop`

Más detalle en `docs/features/team-collaboration.md`.

## Trabajo con IA

Este repo está preparado para asistentes como Windsurf, Cursor, Claude Code, Cline, Aider y GitHub Copilot.

Archivos principales de reglas:

- `.windsurfrules`
- `.cursorrules`
- `.clinerules`
- `CLAUDE.md`
- `.aider.conf.yml`
- `.github/copilot-instructions.md`

Regla clave: la IA debe leer documentación antes de modificar código.

## Seguridad

- No commitear `.env.local`
- No pegar API keys reales en docs, PRs ni commits
- `SUPABASE_SERVICE_ROLE_KEY` solo server-side
- Si una credencial se expone, debe rotarse

Ver `docs/03-security.md`.

## Publicación del Repo

Antes de compartir el repositorio con otro integrante:

- verificar que `.env.example` no contenga valores reales
- confirmar que `README.md` y docs estén actualizados
- confirmar que `CHANGELOG.md` esté al día
- revisar el flujo de ramas y PRs
- dejar claros los accesos externos necesarios

## Referencias Rápidas

- Hub central (router): `CLAUDE.md`
- Arquitectura: `docs/02-architecture.md`
- Seguridad: `docs/03-security.md`
- Deploy: `docs/04-deployment.md`
- Ambientes: `docs/05-environments-guide.md`
- GitHub y flujo operativo: `docs/06-github-stages-databases-guide.md`
- MCP (acceso a Supabase): `docs/07-mcp-guide.md`
- Design system: `docs/08-design-system.md`
- Colaboración: `docs/features/team-collaboration.md`
- Flujo git para IA: `.github/AI_GIT_WORKFLOW.md`
- Historial: `CHANGELOG.md`
