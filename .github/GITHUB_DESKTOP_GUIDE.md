# ARKO — Flujo Git con GitHub Desktop

> Guía para developers. La IA **nunca** ejecuta comandos git — todo el flujo git lo maneja el developer desde GitHub Desktop.

---

## 1. Modelo del repositorio

```
main       ← producción. NUNCA se toca directo.
develop    ← integración del equipo. NUNCA se pushea directo.
feature/*  ← trabajo nuevo. Siempre sale de develop.
fix/*      ← bugfix. Siempre sale de develop.
docs/*     ← documentación. Siempre sale de develop.
chore/*    ← mantenimiento. Siempre sale de develop.
```

Ciclo de vida de un cambio:
```
develop → tu rama → PR → develop → (cuando corresponda) → main
```

---

## 2. Flujo estándar paso a paso

### Antes de empezar una tarea

1. Abrir GitHub Desktop
2. Seleccionar el repositorio `arko`
3. Cambiar a la rama `develop` (menú "Current Branch")
4. Hacer **Fetch origin** y luego **Pull origin** para traer los últimos cambios
5. Crear una rama nueva desde `develop`: **Branch → New Branch**
   - Usar la nomenclatura correcta (ver sección 3)
   - La IA te sugiere el nombre

### Durante el trabajo

- La IA implementa los cambios en el código
- GitHub Desktop muestra en tiempo real los archivos modificados (panel izquierdo)

### Al terminar la tarea

1. En GitHub Desktop, revisar los archivos modificados
2. Seleccionar los archivos que van en el commit (tildar/destildar)
3. Escribir el mensaje de commit en el campo de texto (la IA sugiere el mensaje)
4. Click en **Commit to `feature/tu-rama`**
5. Click en **Push origin** para subir la rama
6. Click en **Create Pull Request** — abre GitHub en el navegador
7. Completar el PR con el template que aparece automáticamente

---

## 3. Nomenclatura de ramas

| Tipo | Prefijo | Ejemplo |
|------|---------|---------|
| Funcionalidad nueva | `feature/` | `feature/instagram-metrics` |
| Bugfix | `fix/` | `fix/sidebar-nav-flicker` |
| Documentación | `docs/` | `docs/team-onboarding` |
| Mantenimiento técnico | `chore/` | `chore/update-next-version` |

**Reglas del nombre:**
- Usar guiones, no underscores: `feature/mi-feature` ✅ `feature/mi_feature` ❌
- Descriptivo pero corto
- Siempre en minúsculas
- Sin caracteres especiales

---

## 4. Formato de commits — Conventional Commits

```
<tipo>: <descripción en imperativo, minúsculas>
```

| Tipo | Cuándo usarlo |
|------|---------------|
| `feat` | Feature nueva |
| `fix` | Bugfix |
| `docs` | Solo documentación |
| `chore` | Mantenimiento, dependencias, config |
| `refactor` | Refactor sin cambio de comportamiento |
| `style` | Cambios de formato/estilo sin lógica |
| `test` | Tests |

**Ejemplos correctos:**
```
feat: agrega sistema centralizado de ambientes
fix: corrige redirect de meta callback en staging
docs: agrega guía de onboarding del equipo
chore: actualiza dependencias de next.js a v15
```

**Ejemplos incorrectos:**
```
cambios          ❌ (sin contexto)
fix              ❌ (sin descripción)
WIP              ❌ (no es un commit real)
Agrega cosas     ❌ (mayúscula, vago)
```

---

## 5. Reglas absolutas

| Regla | Detalle |
|-------|---------|
| NUNCA pushear directo a `main` | Sin excepción. Ni hotfixes. |
| NUNCA pushear directo a `develop` | Todo entra por Pull Request |
| SIEMPRE partir desde `develop` actualizado | Pull antes de crear la rama |
| NUNCA commitear `.env*` reales | Solo `.env.example` |
| NUNCA mezclar cambios no relacionados | Un commit = una idea clara |
| NUNCA hacer merge desde GitHub Desktop | El merge se hace desde la UI de GitHub, después del review |

---

## 6. División de responsabilidades

| Acción | Developer | IA |
|--------|-----------|-----|
| Pull de develop | Developer (GitHub Desktop) | — |
| Crear rama | Developer (GitHub Desktop) | Sugiere el nombre |
| Implementar cambios en el código | — | IA |
| Actualizar docs y CHANGELOG | — | IA |
| Seleccionar archivos para commit | Developer (GitHub Desktop) | Indica qué archivos van |
| Escribir mensaje de commit | Developer (GitHub Desktop) | Sugiere el mensaje |
| Push | Developer (GitHub Desktop) | — |
| Abrir PR en GitHub | Developer | — |
| Escribir descripción del PR | Developer | Sugiere el contenido |
| Review del PR | Developer / equipo | — |
| Merge del PR | Developer / equipo | **NUNCA la IA** |
| Deploy | Developer | **NUNCA la IA** |

---

## 7. Checklist antes de abrir el PR

- [ ] Todos los cambios están commiteados
- [ ] La rama fue pusheada a origin
- [ ] `docs/features/[feature].md` fue actualizado
- [ ] `CHANGELOG.md` fue actualizado
- [ ] No hay archivos `.env` reales commiteados
- [ ] No hay `console.log` o código de debug
- [ ] No hay `any` en TypeScript sin justificación
- [ ] Los cambios de DB tienen su migración y `docs/DB_SCHEMA.md` actualizado
- [ ] Los cambios de API tienen `docs/API_DOCS.md` actualizado

---

## 8. Archivos relacionados

- `CLAUDE.md` — reglas principales para la IA
- `docs/06-github-stages-databases-guide.md` — guía completa de GitHub + ambientes + DB
- `docs/features/team-collaboration.md` — onboarding y colaboración en equipo
- `.github/PULL_REQUEST_TEMPLATE.md` — template para PRs
- `.github/workflows/ci.yml` — CI que corre en cada PR
- `CHANGELOG.md` — historial de cambios del proyecto
