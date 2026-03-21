---
description: onboarding técnico del proyecto, setup local, ramas y checklist de colaboración
---
# Team Onboarding — Arko

1. Leer `docs/01-project-overview.md`.
2. Leer `docs/02-architecture.md`.
3. Leer `docs/features/team-collaboration.md`.
4. Leer `docs/03-security.md` si vas a configurar variables, auth o proveedores.
5. Confirmar que el repo no contiene secretos reales en archivos versionados.
6. Instalar dependencias con `npm install`.
7. Copiar `.env.example` a `.env.local`.
8. Completar las variables del ambiente local.
9. Levantar el proyecto con `npm run dev`.
10. Validar tipos con `npx tsc --noEmit`.
11. Crear una rama desde `develop` usando el naming correcto (`feature/*`, `fix/*`, `docs/*`, `chore/*`).
12. Antes de tocar código, leer el doc de la feature específica en `docs/features/`.
13. Después de cada cambio, actualizar docs y `CHANGELOG.md`.
14. Abrir Pull Request usando `.github/PULL_REQUEST_TEMPLATE.md`.
15. No hacer `push` a `main`, deploy ni cambios destructivos sin confirmación explícita.
