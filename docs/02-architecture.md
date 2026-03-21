# Arquitectura — Arko

## Stack Completo

| Categoría | Tecnología | Versión | Propósito |
|-----------|-----------|---------|-----------|
| Framework | Next.js (App Router) | 16.1.7 | SSR, API Routes, estructura de app |
| Frontend | React | 19.2.3 | UI reactiva |
| Lenguaje | TypeScript | ^5 | Tipado estricto |
| Estilos | TailwindCSS | ^4 | Utility-first CSS |
| Componentes | shadcn/ui | 4.0.8 | Componentes accesibles y personalizables |
| Iconos | Lucide React | 0.577.0 | Iconografía consistente |
| Base de datos | Supabase (PostgreSQL) | - | DB, Auth, Storage, Edge Functions |
| Supabase JS | @supabase/supabase-js | 2.99.2 | Cliente de Supabase |
| Supabase SSR | @supabase/ssr | 0.9.0 | Auth SSR con cookies |
| Auth | Supabase Auth | - | Autenticación y autorización |
| IA/LLM | OpenAI API (GPT-4) | - | Análisis de contenido, generación de insights |
| Transcripción | OpenAI Whisper API | - | Transcripción de audio/video |
| Tareas Async | Supabase Edge Functions + pg_cron | - | Procesamiento en segundo plano |
| Deploy | Vercel | - | Hosting y CI/CD |
| Validación | Zod | 4.3.6 | Validación de schemas |

## Estructura de Carpetas

```
arko/
├── docs/                           # Documentación (Método AInnovate)
│   ├── 01-project-overview.md
│   ├── 02-architecture.md
│   ├── 03-security.md
│   ├── 04-deployment.md
│   ├── DB_SCHEMA.md
│   ├── API_DOCS.md
│   ├── SKILLS.md
│   ├── 05-environments-guide.md    # Guía de ambientes (local/staging/prod)
│   ├── 06-github-stages-databases-guide.md # Guía maestra de GitHub del proyecto
│   └── features/                   # Un .md por funcionalidad
│       └── team-collaboration.md   # Onboarding, GitHub, trabajo en paralelo e IA
├── src/
│   ├── app/                        # App Router (páginas y layouts)
│   │   ├── (auth)/                 # Grupo de rutas de auth (login, register)
│   │   ├── (dashboard)/            # Grupo de rutas protegidas
│   │   │   ├── dashboard/          # Dashboard Global
│   │   │   ├── instagram/          # Instagram Intelligence
│   │   │   ├── youtube/            # YouTube Intelligence
│   │   │   ├── ads/                # Ads Intelligence
│   │   │   ├── customer-voice/     # Customer Voice
│   │   │   └── agents/             # Agentes de IA (chat)
│   │   ├── api/                    # API Routes
│   │   │   └── v1/
│   │   │       └── health/route.ts # Health check endpoint
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Landing / Home
│   │   ├── favicon.ico
│   │   └── globals.css             # Estilos globales (Tailwind)
│   ├── components/                 # Componentes reutilizables
│   │   ├── ui/                     # Componentes base (shadcn/ui)
│   │   │   └── button.tsx          # Button (shadcn)
│   │   ├── layout/                 # Header, Sidebar, Footer, Container
│   │   └── features/               # Componentes por feature
│   │       ├── dashboard/
│   │       ├── instagram/
│   │       ├── youtube/
│   │       ├── ads/
│   │       ├── customer-voice/
│   │       └── agents/
│   ├── lib/                        # Utilidades y configuraciones
│   │   ├── supabase/               # Cliente Supabase
│   │   │   ├── client.ts           # Browser client
│   │   │   ├── server.ts           # Server client (cookies)
│   │   │   └── middleware.ts       # Session update helper
│   │   ├── env.ts                  # Variables de entorno validadas y helpers por ambiente
│   │   ├── openai/                 # Cliente OpenAI (pendiente)
│   │   └── utils.ts                # cn() y utilidades generales
│   ├── hooks/                      # Custom hooks
│   ├── types/                      # Tipos globales TypeScript
│   ├── constants/                  # Constantes de la app
│   ├── services/                   # Servicios y lógica de negocio
│   └── middleware.ts               # Next.js middleware (session refresh)
├── public/                         # Assets estáticos
├── supabase/                       # Supabase config + migrations
│   ├── migrations/
│   └── config.toml
├── .windsurfrules                  # Reglas para IA (Windsurf)
├── CLAUDE.md                       # Reglas para IA (Claude Code)
├── .cursorrules                    # Reglas para IA (Cursor)
├── .clinerules                     # Reglas para IA (Cline)
├── .aider.conf.yml                 # Reglas para IA (Aider)
├── .github/
│   ├── copilot-instructions.md     # Reglas para IA (GitHub Copilot)
│   ├── workflows/                  # GitHub Actions (CI de lint, types y build)
│   └── PULL_REQUEST_TEMPLATE.md    # Template estándar de Pull Requests
├── .windsurf/
│   └── workflows/                  # Workflows operativos reutilizables por IA/equipo
├── CHANGELOG.md                    # Historial de cambios
├── METODO_AINNOVATE.md             # Método AInnovate completo
├── components.json                 # Configuración de shadcn/ui
├── .env.local                      # Variables de entorno (NO COMMIT)
├── .env.example                    # Template de variables
├── .gitignore
├── eslint.config.mjs               # Configuración de ESLint
├── next.config.ts                  # Configuración de Next.js
├── tsconfig.json                   # Configuración de TypeScript
├── postcss.config.mjs              # Configuración de PostCSS
└── package.json
```

## Base de Datos
> Detalle completo en `docs/DB_SCHEMA.md`

Supabase PostgreSQL con las siguientes áreas principales:
- **Auth:** Gestión de usuarios y sesiones (Supabase Auth nativo)
- **Profiles:** Datos extendidos del usuario (plan, empresa, configuración)
- **Social Connections:** Tokens y configs de APIs conectadas (Instagram, YouTube, Meta Ads)
- **Content:** Videos descargados, transcripciones, métricas
- **Customer Voice:** Transcripciones de llamadas, respuestas de formularios
- **Agent Sessions:** Historial de conversaciones con agentes de IA

## Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│  FUENTES DE DATOS                                               │
│  Instagram API ─┐                                               │
│  YouTube API ───┼──→ Supabase Edge Functions (async) ──→ DB     │
│  Meta Ads API ──┤         ↓                                     │
│  Typeform API ──┤   Whisper (transcripción)                     │
│  Call Recordings┘   GPT-4 (análisis)                            │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  PROCESAMIENTO                                                   │
│  1. Descarga de contenido (videos, audios)                      │
│  2. Transcripción (Whisper)                                     │
│  3. Análisis de contenido (GPT-4)                               │
│  4. Cruce con métricas cuantitativas                            │
│  5. Almacenamiento de insights en DB                            │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  CONSUMO (Frontend)                                              │
│  Dashboard ←── Supabase Client ←── DB (datos procesados)        │
│  Agentes IA ←── API Route ←── GPT-4 + RAG (DB como fuente)     │
└─────────────────────────────────────────────────────────────────┘
```

## Variables de Entorno
| Variable | Descripción | Tipo | Requerida |
|----------|-------------|------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | pública | SI |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon de Supabase | pública | SI |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role (solo server) | privada | SI |
| `OPENAI_API_KEY` | API key de OpenAI | privada | SI |
| `APIFY_API_TOKEN` | API key de Apify para enriquecer Reels públicos | privada | NO |
| `NEXT_PUBLIC_APP_URL` | URL base de la app | pública | SI |
| `INSTAGRAM_CLIENT_ID` | Client ID de Instagram API | privada | SI |
| `INSTAGRAM_CLIENT_SECRET` | Client Secret de Instagram API | privada | SI |
| `YOUTUBE_API_KEY` | API key de YouTube Data API | privada | SI |
| `META_ADS_ACCESS_TOKEN` | Token de Meta Ads API | privada | SI |

## Convenciones del Proyecto

| Tipo | Convención | Ejemplo |
|------|------------|---------|
| Componentes | PascalCase | `UserCard.tsx` |
| Hooks | camelCase con "use" | `useAuth.ts` |
| Utilidades | camelCase | `formatDate.ts` |
| Constantes | SCREAMING_SNAKE | `API_ENDPOINTS.ts` |
| Tipos/Interfaces | PascalCase | `UserTypes.ts` |
| CSS (Tailwind) | Clases en JSX | `className="flex items-center"` |
| Variables CSS | kebab-case | `--color-primary` |
| Servicios | camelCase + .service | `instagram.service.ts` |
| Rutas API | kebab-case | `/api/v1/instagram-reels` |
| Tablas DB | snake_case | `social_connections` |

## Decisiones Arquitectónicas

### ADR-001: Next.js App Router como framework principal
**Fecha:** 2026-03-17
**Contexto:** Se necesita un framework que soporte SSR, API Routes, y buena DX para un SaaS complejo
**Decisión:** Usar Next.js 15 con App Router para aprovechar React Server Components y streaming
**Consecuencias:** Curva de aprendizaje con RSC, pero mejor performance y SEO

### ADR-002: Supabase como backend principal
**Fecha:** 2026-03-17
**Contexto:** Se necesita auth, DB, storage y funciones serverless en un solo servicio
**Decisión:** Usar Supabase para Auth, PostgreSQL, Storage y Edge Functions
**Consecuencias:** Dependencia de Supabase, pero simplifica enormemente la arquitectura

### ADR-003: Procesamiento asíncrono con Edge Functions
**Fecha:** 2026-03-17
**Contexto:** Descargar y transcribir videos es pesado y no puede bloquear la UI
**Decisión:** Usar Supabase Edge Functions para tareas de procesamiento en segundo plano
**Consecuencias:** Arquitectura más compleja pero la app nunca se cuelga durante procesamiento

### ADR-004: RAG para precisión de la IA
**Fecha:** 2026-03-17
**Contexto:** La IA no debe inventar métricas; debe consultar datos reales
**Decisión:** Implementar RAG (Retrieval-Augmented Generation) que consulta DB primero, luego genera
**Consecuencias:** Respuestas más lentas pero 100% basadas en datos reales del usuario

### ADR-005: Performance — No bloquear render con llamadas externas
**Fecha:** 2026-03-19
**Contexto:** Apify y APIs externas tardan 10-15s, bloqueando la carga de páginas
**Decisión:**
1. **Datos externos en sync:** Apify, scraping, APIs externas se ejecutan durante el sync background, no en page load
2. **Workspace cacheado:** `workspace_id` se cachea en cookie `arko_workspace_id` por el middleware (24h)
3. **Helper centralizado:** `getWorkspaceId()` en `@/lib/workspace.ts` lee de cookie o fallback a DB
4. **Degradación graceful:** Si un dato externo no está en DB, mostrar "—" en vez de bloquear
5. **Sync incremental:** Límites por sync (`MAX_INSIGHTS_PER_SYNC=30`, `MAX_DURATION_ENRICHMENTS=5`)
**Consecuencias:** Páginas cargan en <3s, datos se enriquecen gradualmente en background
