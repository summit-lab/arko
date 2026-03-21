# ARKO — Flujo Git para IA

> Este documento es la referencia operativa para cualquier asistente de IA que trabaje en este repositorio.
> Si sos una IA nueva en este proyecto: **leé esto antes de tocar cualquier rama o hacer cualquier commit.**
> Guía completa del proyecto: `docs/06-github-stages-databases-guide.md`

---

## 1. Modelo mental del repo

```
main       ← producción. NUNCA se toca directo.
develop    ← integración del equipo. NUNCA se pushea directo.
feature/*  ← trabajo nuevo. Siempre sale de develop.
fix/*      ← bugfix. Siempre sale de develop.
docs/*     ← documentación. Siempre sale de develop.
chore/*    ← mantenimiento. Siempre sale de develop.
```

El ciclo de vida de un cambio es siempre:
```
develop → tu rama → PR → develop → (cuando corresponda) → main
```

---

## 2. Reglas absolutas — no negociables

| # | Regla |
|---|-------|
| 1 | NUNCA pushear directo a `main` — ni hotfixes, ni emergencias |
| 2 | NUNCA pushear directo a `develop` — todo entra por Pull Request |
| 3 | SIEMPRE partir desde `develop` actualizado |
| 4 | SIEMPRE crear una rama nueva antes de implementar |
| 5 | SIEMPRE pedir confirmación explícita antes de hacer push |
| 6 | NUNCA hacer merge — eso lo hace el humano desde GitHub |
| 7 | NUNCA usar `--force` en ninguna rama |
| 8 | NUNCA commitear archivos `.env` reales — solo `.env.example` |
| 9 | NUNCA mezclar cambios no relacionados en un mismo commit o PR |
| 10 | SIEMPRE actualizar docs y CHANGELOG antes de dar el trabajo por terminado |

---

## 3. Flujo estándar — paso a paso

### Al arrancar una tarea nueva

```bash
# 1. Ir a develop
git checkout develop

# 2. Traer los últimos cambios
git pull origin develop

# 3. Crear la rama para esta tarea
git checkout -b feature/nombre-descriptivo
```

**Antes del paso 3: confirmar con el humano el nombre de la rama.**

---

### Durante el trabajo

- Hacer commits frecuentes y atómicos (un commit = una idea clara)
- No acumular todo en un solo commit gigante
- Usar el formato de Conventional Commits (ver sección 5)

```bash
# Agregar solo los archivos relevantes (nunca git add -A sin revisar)
git add src/components/MiComponente.tsx
git add docs/features/mi-feature.md
git add CHANGELOG.md

git commit -m "feat: agrega componente de analytics al dashboard"
```

---

### Al terminar la tarea

```bash
# Verificar estado antes de pushear
git status
git diff --staged

# Push — PEDIR CONFIRMACIÓN ANTES
git push origin feature/nombre-descriptivo
```

**Después del push:**
- Mostrar al humano la URL para abrir el PR
- Sugerir título y descripción del PR usando el template de `.github/PULL_REQUEST_TEMPLATE.md`
- El humano abre el PR desde GitHub

---

## 4. Nomenclatura de ramas

| Tipo | Prefijo | Ejemplo |
|------|---------|---------|
| Funcionalidad nueva | `feature/` | `feature/instagram-metrics` |
| Bugfix | `fix/` | `fix/sidebar-nav-flicker` |
| Documentación | `docs/` | `docs/team-onboarding` |
| Mantenimiento técnico | `chore/` | `chore/update-next-version` |

### Reglas del nombre
- Usar guiones, no underscores: `feature/mi-feature` ✅ `feature/mi_feature` ❌
- Descriptivo pero corto: `feature/analytics-dashboard` ✅ `feature/agrega-el-nuevo-dashboard-de-analytics-con-graficos` ❌
- Siempre en minúsculas
- Sin caracteres especiales

---

## 5. Formato de commits (Conventional Commits)

```
<tipo>: <descripción en imperativo, minúsculas>
```

### Tipos válidos

| Tipo | Cuándo usarlo |
|------|---------------|
| `feat` | Feature nueva |
| `fix` | Bugfix |
| `docs` | Solo documentación |
| `chore` | Mantenimiento, dependencias, config |
| `refactor` | Refactor sin cambio de comportamiento |
| `style` | Cambios de formato/estilo sin lógica |
| `test` | Tests |

### Ejemplos correctos
```
feat: agrega sistema centralizado de ambientes
fix: corrige redirect de meta callback en staging
docs: agrega guía maestra de github
chore: actualiza dependencias de next.js a v15
refactor: extrae lógica de auth a hook separado
```

### Ejemplos incorrectos
```
cambios          ❌ (sin contexto)
fix              ❌ (sin descripción)
WIP              ❌ (no es un commit real)
Agrega cosas     ❌ (mayúscula, vago)
feat: Agrega X   ❌ (mayúscula en descripción)
```

---

## 6. División de responsabilidades

| Acción | IA | Humano |
|--------|----|----|
| `git pull origin develop` | IA ejecuta (con confirmación) | Aprueba |
| Crear rama | IA ejecuta (con confirmación) | Aprueba el nombre |
| Implementar cambios | IA | — |
| Actualizar docs y CHANGELOG | IA | — |
| `git add` archivos | IA (específicos, nunca -A sin revisar) | Aprueba |
| `git commit` | IA ejecuta (con confirmación) | Aprueba mensaje |
| `git push` | IA ejecuta (con confirmación explícita) | Aprueba |
| Abrir PR en GitHub | Humano | Humano |
| Escribir descripción del PR | IA sugiere | Humano confirma |
| Review del PR | — | Humano |
| Aprobar el PR | — | Humano |
| Merge del PR | **NUNCA la IA** | **Siempre el humano** |
| Deploy | **NUNCA la IA** | **Siempre el humano** |

---

## 7. Qué hacer si hay conflictos

Si al hacer `git pull origin develop` hay conflictos:

1. **No resolver solo** — avisar al humano
2. Mostrar los archivos en conflicto
3. Explicar qué cambió en cada lado
4. Resolver junto con el humano, o pedirle que lo haga
5. Una vez resuelto, commitear la resolución con mensaje claro:
   ```
   chore: resuelve conflicto con develop en src/components/Sidebar.tsx
   ```

---

## 8. Checklist antes de dar una tarea por terminada

Antes de sugerir que el humano abra el PR, verificar:

- [ ] Todos los cambios están commiteados
- [ ] La rama está actualizada con `develop` (sin conflictos)
- [ ] `docs/features/[feature].md` fue actualizado
- [ ] `CHANGELOG.md` fue actualizado
- [ ] No hay archivos `.env` reales commiteados
- [ ] No hay `console.log` o código de debug olvidado
- [ ] No hay `any` en TypeScript sin justificación
- [ ] Los cambios de DB tienen su migración y `docs/DB_SCHEMA.md` actualizado
- [ ] Los cambios de API tienen `docs/API_DOCS.md` actualizado

---

## 9. Cómo sugerir el PR al humano

Cuando la rama esté lista, decirle al humano:

```
La rama está lista para PR.

Título sugerido: feat: agrega sistema de analytics al dashboard

Para abrir el PR:
1. Ir a https://github.com/summit-lab/arko/compare/develop...feature/tu-rama
2. Usar el template que aparece automáticamente
3. Completar las secciones de riesgos y validación

Rama origen:  feature/tu-rama
Rama destino: develop
```

---

## 10. Archivos relacionados

- `CLAUDE.md` — reglas principales para la IA
- `docs/06-github-stages-databases-guide.md` — guía completa de GitHub + ambientes + DB
- `docs/features/team-collaboration.md` — onboarding y colaboración en equipo
- `.github/PULL_REQUEST_TEMPLATE.md` — template para PRs
- `.github/workflows/ci.yml` — CI que corre en cada PR
- `CHANGELOG.md` — historial de cambios del proyecto
