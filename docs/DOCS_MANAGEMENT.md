# Autogestión de Documentación

> Todo cambio en el proyecto DEBE dejar la documentación actualizada.
> No existen cambios "solo de código". Si cambia la funcionalidad, cambia el doc.

---

## Checklist (después de cada cambio)

- [ ] ¿Se actualizó `docs/features/[feature].md`?
- [ ] ¿Se actualizó `CHANGELOG.md`?
- [ ] ¿Si se creó un doc nuevo, se registró en CLAUDE.md (Router, sección 3)?
- [ ] ¿Si se creó un doc nuevo, se registró en `docs/02-architecture.md`?
- [ ] ¿Si se tocó DB, se actualizó `docs/DB_SCHEMA.md`?
- [ ] ¿Si se tocó API, se actualizó `docs/API_DOCS.md`?
- [ ] ¿Si se tocó UI/estilos, se respetó `docs/08-design-system.md`?

---

## Cuándo crear un doc nuevo

| Situación | Acción |
|-----------|--------|
| Feature nueva | Crear `docs/features/<nombre>.md` |
| Doc numerado nuevo | Usar siguiente número: `docs/XX-nombre.md` |
| MCP nuevo | Agregar sección en `docs/07-mcp-guide.md` |
| Skill nueva | Agregar en `docs/SKILLS.md` |

---

## Nomenclatura

| Tipo | Formato | Ejemplo |
|------|---------|---------|
| Doc numerado | `docs/XX-nombre.md` | `docs/09-testing-guide.md` |
| Feature | `docs/features/nombre.md` | `docs/features/youtube-sync.md` |
| Referencia | `docs/NOMBRE_CAPS.md` | `docs/DB_SCHEMA.md` |
| Operativo | `.github/NOMBRE_CAPS.md` | `.github/GITHUB_DESKTOP_GUIDE.md` |
| ADR | `docs/ADR-XXX-nombre.md` | `docs/ADR-006-caching-strategy.md` |

---

## Próximo número disponible: `09`

(Actualizar cada vez que se cree un doc numerado nuevo)
