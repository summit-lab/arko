# Feature: Team Collaboration, Repository Onboarding & AI Operating System

## 1. Objetivo
Definir un sistema de trabajo reproducible para que múltiples integrantes del equipo puedan clonar Arko, configurarlo localmente, trabajar en paralelo sin pisarse cambios y usar asistentes de IA de forma consistente y segura.

Este documento es la referencia principal para:
- setup inicial del repositorio
- flujo de ramas y pull requests
- manejo de variables de entorno
- coordinación de cambios de DB, API y documentación
- uso correcto de IA dentro del proyecto

## 2. Principios Operativos
- El repositorio es **documentation-driven**: no se modifica código sin leer primero los docs obligatorios.
- Toda feature o fix se trabaja en una rama aislada.
- Ningún cambio se considera terminado si no actualiza su documentación y `CHANGELOG.md`.
- Ninguna credencial real se guarda en el repo.
- Los cambios de DB, API y seguridad requieren coordinación explícita porque impactan al resto del equipo.

## 3. Requisitos para Integrantes Nuevos
Cada integrante debe tener acceso a:
- GitHub repository de Arko
- proyecto Supabase correspondiente al ambiente con el que va a trabajar
- variables de entorno necesarias para su ambiente local
- proveedor/s externos según el alcance de su tarea (Meta, OpenAI, Gemini, Apify, YouTube)
- herramienta de IA que vaya a usar (Windsurf, Cursor, Claude Code, Cline, Aider o Copilot)

## 3.1 Repositorio canónico del proyecto
- nombre del proyecto: `arko`
- organización / usuario GitHub: `summit-lab`
- remoto principal: `https://github.com/summit-lab/arko.git`
- contacto operativo del repositorio: `summit@nalify.marketing`

## 4. Setup Inicial del Proyecto

### 4.1 Prerrequisitos locales
- Node.js 20+
- npm 10+
- Git
- acceso al proyecto Supabase del equipo
- editor/IDE con soporte TypeScript

### 4.2 Instalación inicial
1. Clonar el repositorio.
2. Instalar dependencias con `npm install`.
3. Copiar `.env.example` a `.env.local`.
4. Completar las variables de entorno reales del ambiente.
5. Ejecutar `npm run dev`.
6. Verificar acceso en `http://localhost:3000`.

### 4.3 Verificación mínima post-setup
- la app levanta sin errores de build
- el login funciona
- Supabase responde correctamente
- las rutas protegidas redirigen bien
- no faltan variables críticas en `.env.local`

## 5. Variables de Entorno

### 5.1 Regla general
- `.env.local` es local y privado
- `.env.example` documenta TODAS las variables requeridas
- cualquier variable nueva debe agregarse en ambos lugares: código + `.env.example` + documentación relevante

### 5.2 Clasificación operativa
- **Públicas**: `NEXT_PUBLIC_*`
- **Privadas server-side**: keys de proveedores, tokens, service role keys
- **Opcionales por feature**: solo necesarias si se trabaja en ese módulo

### 5.3 Reglas de equipo
- nunca compartir secretos por commits
- nunca pegar claves reales en PRs, issues o docs
- si una credencial se expuso, se rota y se documenta el incidente
- cada integrante debe saber qué variables necesita según la feature que toca

## 6. Modelo de Branching

### 6.1 Ramas canónicas
- `main` → producción
- `develop` → integración del equipo
- `feature/<nombre>` → nueva funcionalidad
- `fix/<nombre>` → bugfix
- `docs/<nombre>` → cambios de documentación y operación
- `chore/<nombre>` → mantenimiento técnico

### 6.2 Reglas
- nunca trabajar directamente sobre `main`
- evitar trabajar directamente sobre `develop` salvo tareas de integración coordinadas
- una rama = un objetivo claro
- hacer pull/rebase frecuente contra `develop`
- abrir PR hacia `develop` salvo releases excepcionales

### 6.3 Naming recomendado
- `feature/instagram-metrics-loading`
- `fix/sidebar-optimistic-nav`
- `docs/team-onboarding`
- `chore/update-env-template`

## 7. Flujo Diario de Trabajo
1. Actualizar `develop` local.
2. Crear una rama nueva desde `develop`.
3. Leer docs obligatorios.
4. Implementar cambios.
5. Actualizar docs de la feature.
6. Actualizar `CHANGELOG.md`.
7. Validar build/lint/types según corresponda.
8. Abrir Pull Request usando el template del repo.
9. Resolver review.
10. Mergear a `develop`.

## 8. Pull Requests

### 8.1 Un PR correcto debe incluir
- objetivo claro
- alcance acotado
- archivos afectados
- riesgos conocidos
- docs actualizadas
- evidencia visual si cambia UI
- notas de DB/API/security si aplica
- pasar el CI del repositorio (`.github/workflows/ci.yml`)

### 8.2 Antes de pedir review
- releer el diff completo
- verificar que no haya secretos
- confirmar que la documentación refleje el estado real
- confirmar que el PR no mezcle cambios no relacionados
- confirmar que `lint`, `tsc` y `build` pasen localmente o en CI

## 9. Coordinación de Cambios Sensibles

### 9.1 Base de datos
Si una tarea toca migraciones o schema:
- leer `docs/DB_SCHEMA.md`
- crear una nueva migración, nunca editar una ya aplicada
- avisar al equipo que existe cambio de schema
- actualizar docs de DB y changelog

### 9.2 API
Si una tarea toca endpoints o contratos:
- leer `docs/API_DOCS.md`
- documentar request/response y side effects
- avisar a frontend/backend si el contrato cambia

### 9.3 Seguridad / auth / credenciales
Si una tarea toca auth, permisos o variables:
- leer `docs/03-security.md`
- no desactivar protecciones existentes
- no hacer cambios destructivos sin coordinación explícita

## 10. Sistema de Trabajo con IA

### 10.1 Regla principal
La IA no debe actuar como improvisación libre. Debe seguir la documentación del repo y usar este orden:
1. `docs/01-project-overview.md`
2. `docs/02-architecture.md`
3. `docs/features/[feature].md`
4. `docs/03-security.md` / `docs/API_DOCS.md` / `docs/DB_SCHEMA.md` según corresponda
5. este documento cuando la tarea afecte setup, colaboración, GitHub, onboarding o reglas operativas

### 10.2 Cuándo consultar este documento
- cambios en `README.md`
- cambios en `.env.example`
- cambios en plantillas de PR / workflow de GitHub
- cambios en `.windsurf/workflows/`
- tareas de onboarding del equipo
- publicación del repo
- creación de guías operativas para otros developers o IAs

### 10.3 Salida esperada de la IA
Toda implementación debe dejar explícito:
- archivos creados/modificados
- docs actualizadas
- si hubo cambios de DB o API
- cómo validar localmente
- riesgos pendientes

## 11. Publicación del Repositorio
Antes de hacer público/compartido el repo:
- verificar `.gitignore`
- revisar que `.env.example` no tenga valores reales
- revisar historial reciente por exposición accidental de secretos
- dejar `README.md` completo
- dejar guías IA alineadas
- dejar `CHANGELOG.md` actualizado
- dejar flujo de ramas y PRs documentado
- dejar checklist de onboarding reproducible

## 12. Definition of Done para trabajo en equipo
Una tarea queda realmente lista cuando:
- el código funciona
- el branch model está respetado
- la documentación quedó actualizada
- no hay secretos expuestos
- el PR puede ser entendido por otra persona sin contexto oral adicional
- otra persona del equipo podría continuar el trabajo leyendo solo el repo

## 13. Archivos Relacionados
- `README.md`
- `.env.example`
- `docs/01-project-overview.md`
- `docs/02-architecture.md`
- `docs/03-security.md`
- `docs/04-deployment.md`
- `CHANGELOG.md`
- `.github/copilot-instructions.md`
- `.windsurfrules`
- `.windsurf/workflows/team-onboarding.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
