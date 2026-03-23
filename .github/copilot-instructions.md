# ARKO — Reglas para IA (Método AInnovate v2)

> **ATENCIÓN IA:** Este proyecto usa Documentation-Driven Development.
> **ANTES** de escribir CUALQUIER línea de código, DEBES leer los docs relevantes.
> Hub central: `CLAUDE.md` — ahí está el router completo de toda la documentación.

## Protocolo Obligatorio (antes de cada cambio)

1. LEER `CLAUDE.md` (router, reglas, autogestión)
2. LEER `docs/01-project-overview.md`
3. LEER `docs/02-architecture.md`
4. IDENTIFICAR qué feature se modifica
5. LEER `docs/features/[feature].md`
6. Si NO existe doc para la feature → CREARLO antes de codear
7. Si se toca DB → LEER `docs/DB_SCHEMA.md` + `docs/07-mcp-guide.md`
8. Si se toca API → LEER `docs/API_DOCS.md`
9. Si se toca auth/seguridad → LEER `docs/03-security.md`
10. Si se toca UI/estilos → LEER `docs/08-design-system.md`

## Reglas de operación

1. **LEER ANTES DE ACTUAR** — Consultar docs antes de cualquier cambio
2. **NO ROMPER LO QUE FUNCIONA** — Detenerse si hay conflicto con la arquitectura
3. **DOCUMENTACIÓN CONTINUA** — Actualizar docs + CHANGELOG después de cada cambio
4. **SEGURIDAD** — Nunca deploy/push/cambios destructivos sin confirmación

## Flujo git

- NUNCA pushear directo a `main` ni a `develop`
- Todo entra por Pull Request
- Guía completa: `.github/AI_GIT_WORKFLOW.md`

## Router de documentación completo

Ver `CLAUDE.md` sección 4 — ahí está el mapa de todos los docs con cuándo leer cada uno.
