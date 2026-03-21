# Deployment — Arko

> Guía operativa de ambientes, ramas e integración previa al deploy.

## Plataforma de Deploy
- **Frontend:** Vercel
- **Backend:** Supabase (Edge Functions)
- **Base de datos:** Supabase (PostgreSQL)

## Proceso de Deploy

### 1. Flujo recomendado de integración
1. Cada integrante trabaja en una rama propia desde `develop`.
2. Los Pull Requests se abren hacia `develop`.
3. `develop` actúa como rama de integración y validación del equipo.
4. Cuando `develop` está estable, se prepara merge hacia `main`.
5. `main` representa el estado deployable a producción.

### 2. Preparación previa por ambiente
- Configurar variables de entorno en el proveedor correspondiente.
- Confirmar que el proyecto Supabase del ambiente sea el correcto.
- Confirmar que las credenciales privadas no estén expuestas al cliente.
- Validar build y chequeos básicos antes del merge.

### 3. Integración con GitHub
- El repositorio debe usar Pull Requests para todo cambio hacia `develop` y `main`.
- Cada PR debe usar el template del repositorio.
- El título del PR debe describir claramente el alcance.
- Si el PR toca DB/API/seguridad, debe declararlo explícitamente.
- El workflow `.github/workflows/ci.yml` debe pasar antes del merge (`lint`, `tsc`, `build`).

### 4. Publicación del repositorio
Antes de sumar nuevos integrantes o publicar el repo:
- revisar `.env.example`
- revisar `.gitignore`
- revisar `README.md`
- revisar `CHANGELOG.md`
- revisar las reglas para IA
- revisar que no existan secretos reales en la historia reciente ni en archivos versionados

## Checklist Pre-Deploy
- [ ] Todas las variables de entorno configuradas en Vercel
- [ ] RLS activado en todas las tablas
- [ ] Tests críticos pasando
- [ ] Build sin errores
- [ ] Documentación actualizada
- [ ] CHANGELOG al día
- [ ] Checklist de seguridad completado (ver `03-security.md`)

## Ambientes
| Ambiente | URL | Branch | Supabase Project |
|----------|-----|--------|-----------------|
| Desarrollo | localhost:3000 | develop | proyecto de desarrollo del equipo |
| Staging | TBD | develop / release branch | proyecto staging si existe |
| Producción | TBD | main | proyecto productivo |

## Checklist de Release del Equipo
- [ ] `develop` estable y revisado
- [ ] PRs importantes mergeados y documentados
- [ ] `CHANGELOG.md` actualizado
- [ ] `README.md` actualizado si cambió onboarding/setup
- [ ] `docs/features/*.md` alineados con el estado real
- [ ] `.env.example` completo y sin valores reales
- [ ] Validaciones de seguridad completadas (`docs/03-security.md`)
