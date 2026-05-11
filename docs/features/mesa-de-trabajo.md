# Feature: Mesa de Trabajo

## 1. Descripción General

La **Mesa de Trabajo** es el módulo de planificación y creación de contenido de Moka. Permite a los usuarios pasar de un insight de IA a un contenido concreto sin salir de la plataforma.

**Motivación:** Antes del módulo, el flujo era: Moka genera insight → usuario sale a Google Docs o Notion → planifica el contenido por fuera. Ahora todo ocurre dentro de Moka.

---

## 2. Acceso

- **URL:** `/mesa-de-trabajo`
- **Sidebar:** ítem "Mesa de trabajo" con ícono `Pencil` (Lucide), entre Ventas y Moka AI.

---

## 3. Vistas

### 3.1 Pipeline (Kanban)

Vista principal. 8 columnas, una por estado:

| Estado | Label | Color |
|--------|-------|-------|
| `idea` | Idea | Blanco translúcido |
| `script` | Script | Violeta |
| `needs_recording` | Falta grabar | Naranja |
| `recorded` | Grabado | Verde |
| `needs_editing` | Falta editar | Naranja |
| `editing` | Editando | Azul |
| `scheduled` | Programado | Celeste |
| `published` | Publicado | Verde intenso |

Cada columna muestra sus cards, un contador de items y un botón `+` para agregar directamente en ese estado.

### 3.2 Calendario

Vista mensual. Items posicionados según `planned_date`. Click en un día → abre modal de creación con esa fecha pre-cargada. Items sin fecha no aparecen en el calendario (se muestra contador al pie).

---

## 4. Tipos de Contenido

| Tipo | Emoji |
|------|-------|
| `reel` | 🎬 |
| `carousel` | 🖼️ |
| `story` | 📱 |

Filtro rápido en la toolbar (Todos / Reels / Carruseles / Historias).

---

## 5. Schema de DB

**Tabla:** `content_plan` (existía desde migración 024, extendida en migración 100)

```sql
id            UUID PK
workspace_id  UUID FK → workspaces (RLS)
planned_date  DATE
title         TEXT NOT NULL
description   TEXT          -- notas / brief
script        TEXT          -- guion o caption completo (migración 100)
platform      TEXT          -- 'instagram' | 'tiktok' | 'youtube'
content_type  TEXT          -- 'reel' | 'carousel' | 'story'
status        TEXT          -- pipeline status
source_type   TEXT          -- 'manual' | 'ai_insight' | 'competitor_reel' (migración 100)
source_ref    TEXT          -- id de referencia si vino de otro módulo (migración 100)
metrics       JSONB         -- { reach, likes, saves, comments, shares } (migración 100)
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

**Migraciones:**
- `20260327000024_content_calendar.sql` — tabla base
- `20260510000100_content_plan_mesa_de_trabajo.sql` — agrega script, source_type, source_ref, metrics

---

## 6. API

**Endpoint:** `GET|POST|PATCH|DELETE /api/v1/content-plan`

| Método | Descripción |
|--------|-------------|
| GET | Lista todos los items del workspace |
| POST | Crea un nuevo item |
| PATCH | Actualiza un item (requiere `id` en body) |
| DELETE | Elimina un item (requiere `id` en query param) |

---

## 7. Componentes

| Componente | Ruta | Descripción |
|------------|------|-------------|
| `MesaDeTrabajoShell` | `src/components/features/mesa-de-trabajo/MesaDeTrabajoShell.tsx` | Shell client: estado global, callbacks, modal |
| `ContentPipeline` | `src/components/features/mesa-de-trabajo/ContentPipeline.tsx` | Kanban por status |
| `ContentCalendar` | `src/components/features/mesa-de-trabajo/ContentCalendar.tsx` | Vista calendario mensual |
| `ContentCard` | `src/components/features/mesa-de-trabajo/ContentCard.tsx` | Card individual |
| `ContentItemModal` | `src/components/features/mesa-de-trabajo/ContentItemModal.tsx` | Modal crear / editar |

**Page (server component):** `src/app/(dashboard)/mesa-de-trabajo/page.tsx`

---

## 8. Integración futura

- **Botón "→ Mesa de Trabajo"** en insights de IA (agents) y en cards de reels de competidores → crea un item con `source_type: 'ai_insight'` o `'competitor_reel'` y `source_ref` con el ID correspondiente.
- **Métricas automáticas** una vez publicado: jaladas desde Instagram API y guardadas en el campo `metrics`.
- **Generación de script con IA** desde el modal.
