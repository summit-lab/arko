# Design System — Arko Dashboard v3 (Liquid Glass)

Inspiración: Stakent, paneles DeFi premium — **glassmorphism real** con `backdrop-blur`, tipografías finas enormes, bordes luminosos translúcidos. Todo tiene que sentirse como una app tech de $1M.

---

## 1. Fondo

- **Body:** `#000000` — negro puro 100%.
- **Sin imagen**, sin overlay `::before`, sin textura.
- Definido en `globals.css` → `body { background: #000000; }`.

## 2. Superficies / Tarjetas

### `.glass-card` (KPIs, widgets, botones)
```css
backdrop-blur-xl
background: rgba(255, 255, 255, 0.04)
border: 1px solid rgba(255, 255, 255, 0.08)
box-shadow: 0 8px 32px rgba(0,0,0,0.3),
            inset 0 1px 0 rgba(255,255,255,0.06),
            inset 0 -1px 0 rgba(255,255,255,0.02)
rounded-xl
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)
```
**Hover:** `bg → rgba(255,255,255,0.06)`, `border → 0.12`, shadow más profunda.
**Reflejos laterales:** `::before` (izquierda, más brillante) y `::after` (derecha, sutil) con gradient vertical blanco que simula reflejo de luz ambiental en vidrio.

### `.glass-section` (Secciones grandes)
```css
backdrop-blur-xl
background: rgba(255, 255, 255, 0.025)
border: 1px solid rgba(255, 255, 255, 0.06)
box-shadow: 0 8px 40px rgba(0,0,0,0.35),
            inset 0 1px 0 rgba(255,255,255,0.05)
rounded-xl
```

### `.glass-panel` (legacy compat)
```css
backdrop-blur-xl
background: rgba(255, 255, 255, 0.03)
border: 1px solid rgba(255, 255, 255, 0.08)
box-shadow: 0 8px 32px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(255,255,255,0.06)
rounded-xl
```

> **Border radius estándar:** `rounded-xl` (12px) para TODA la app. No usar `rounded-2xl` (16px) ni `rounded-[20px]`.

**Principio:** El `inset` top y bottom simula un reflejo de luz ambiental (liquid glass). **SIEMPRE usar `backdrop-blur-xl`** para el efecto glass real.

## 3. Tipografía — CLAVE DEL LOOK PREMIUM

| Elemento | Clase | Detalles |
|----------|-------|----------|
| Números KPI | `.stat-number` | `text-[34px] font-light tracking-[-0.02em]` |
| Números Hero | `.stat-number-xl` | `text-[48px] font-extralight tracking-[-0.03em]` |
| Etiquetas | `.stat-label` | `text-[11px] font-medium tracking-[0.08em] uppercase` color `rgba(255,255,255,0.4)` |
| Títulos sección | inline | `text-[22px] font-extralight tracking-[-0.02em]` |
| Subtítulos | inline | `text-[13px] font-light text-white/35` |
| Página título | `.page-title` | `font-extralight tracking-[-0.03em]` clamp `2rem–2.75rem` |

- **Fuente body:** Manrope Light (`/fonts/manrope.light.otf`)
- **Fuente headings:** Manrope Bold (`/fonts/manrope.bold.otf`)
- **Regla:** Los números SIEMPRE son `font-light` o `font-extralight`. NUNCA `font-bold` para datos numéricos. Esto es lo que da el look Stakent.

## 4. Gráficos (Recharts)

- **Strokes:** `strokeWidth={2}`.
- **Colores:** Violeta `#818cf8`, Cyan `#22d3ee`, Rosa `#f472b6`, Esmeralda `#34d399`.
- **Gradientes area:** `0.25–0.3` opacidad arriba → 0 abajo.
- **Grilla:** Solo horizontal, `strokeDasharray="3 3"`, `stroke="rgba(255,255,255,0.04)"`.
- **Ejes:** `axisLine={false}`, `tickLine={false}`, `fill="rgba(255,255,255,0.3)"`, `fontSize: 11`.
- **Tooltips:** `.glass-card` con `box-shadow: 0 12px 48px rgba(0,0,0,0.6)`.
- **Neon lines:** Envolver contenedor en `.neon-line-*` para glow dual `drop-shadow`.
- **Bars:** `radius={[6,6,0,0]}`.

## 5. Iconos

- **Tamaño KPIs:** `h-[18px] w-[18px]`.
- **Contenedor:** `h-10 w-10 rounded-full` con `background: rgba(255,255,255,0.06)` + `inset 0 1px 0 rgba(255,255,255,0.1)`.
- **Color:** heredado del `text-{color}-400` del padre.

## 6. Espaciados

- **Gap grillas KPI:** `gap-5`.
- **Padding tarjeta KPI:** `p-6`.
- **Padding sección:** `p-8`.
- **Espacio entre secciones:** `space-y-10`.
- **Padding página:** `px-8 py-10`.
- **Margen label→número:** `mb-5`.
- **Margen subtítulo→contenido:** `mb-7`.

## 7. Controles (Tabs, Filtros, Botones)

- **Contenedor:** `rounded-2xl p-1 backdrop-blur-xl`, `bg: rgba(255,255,255,0.03)`, `border: rgba(255,255,255,0.07)`.
- **Item activo:** `bg-white/[0.07] text-white rounded-xl`.
- **Item inactivo:** `text-white/35 hover:text-white/70 hover:bg-white/[0.03]`.
- **Texto:** `text-[13px] font-light`.
- **Pill badges:** `.pill-badge` → `rounded-full text-[11px] font-medium`, bg glass `rgba(255,255,255,0.06)`.
- **Botones acción:** `.glass-card` con `font-light`.
- **Transiciones:** `duration-300`.

## 8. Tablas

- **Contenedor:** `rounded-xl`, `bg: rgba(255,255,255,0.02)`, `border: rgba(255,255,255,0.06)`.
- **Headers:** `text-[11px] uppercase tracking-[0.08em] font-medium text-white/40`.
- **Celdas:** `text-[13px]` — datos en `font-light text-white`, labels en `text-white/70 font-light`.
- **Hover fila:** `hover:bg-white/[0.03]`.

## 9. Z-index stack

Un **único** stack de z-index para toda la app. Cualquier overlay fullscreen (modal, drawer) **DEBE** estar en z-[80] o mayor para quedar arriba del header sticky. Igualar z-50 al header no alcanza: el header tiene `backdrop-blur-xl` que crea stacking context propio y gana por DOM order.

| Capa | z-index | Ejemplos |
|------|---------|----------|
| Contenido normal | `auto` / 0-20 | cards, dropdowns locales, tooltips dentro de containers |
| Sidebar fijo | `z-40` | `src/components/layout/Sidebar.tsx` |
| Header sticky | `z-50` | `src/components/layout/Header.tsx` |
| Layout dividers | `z-[60]` | bordes del dashboard shell (pointer-events-none) |
| Modal / drawer backdrop | `z-[70]` | overlay semi-transparente con blur |
| Modal / drawer content | `z-[80]` | panel del chat de reel, modales de venta/pago, etc. |
| Alert críticos (onboarding forzado) | `z-[100]` | `AdnCompetitorModal` |

**Regla:** nunca uses `z-50` en un `fixed inset-0` — va a quedar tapado por el header. Usa `z-[80]` siempre para modales fullscreen.

## 10. Neon Line Glows

Para gráficos y pies, aplicar al contenedor wrapper:

```css
.neon-line-cyan {
  filter: drop-shadow(0 0 8px rgba(34,211,238,0.5))
          drop-shadow(0 0 24px rgba(34,211,238,0.2));
}
```

Colores disponibles: `cyan`, `violet`, `rose`, `emerald`.

## 11. UX optimista y performance percibida

> Referenciado por CLAUDE.md §6. Estos patrones ya se pagaron con debugging caro — **no reintroducir los anti-patrones**.

### Imágenes externas → `ReelThumbnail`, NUNCA `next/image`

**Regla:** toda imagen cuya URL venga de Meta (scontent/cdninstagram, expira en horas/días) o sea una **signed URL de Storage** (cambia en cada render) se renderiza con `ReelThumbnail` (`src/components/instagram/ReelThumbnail.tsx`): `<img>` directo + `onError` → placeholder + `loading="lazy"` (o `priority` para above-the-fold).

**Por qué:** el optimizer de `next/image` cachea por URL → con signed URLs que rotan el cache es 0% hit: 1 transformación facturable por imagen POR VISITA, portadas cargando "de a 2-3", y 502/403 cuando la URL de Meta ya expiró. Bug original arreglado en ReelsGrid/PublicacionesGrid (PR #127) y extendido a StoriesGrid/PostDetailView/ventas.

### Portadas → storage-first (`src/lib/storage-thumbs.ts`)

El sync re-hostea thumbnails en Storage (`reel-media` para reels/posts, `story-media` para slides de historias) porque las URLs crudas de Meta expiran. En los Server Components:

1. Seleccionar `media_storage_path` en la query.
2. Firmar TODOS los paths en UN batch por bucket con `signStorageThumbs(supabase, bucket, paths)` — si hay varios buckets, en `Promise.all` (nunca awaits seriales).
3. Resolver con `pickThumb(map, storagePath, rawUrl)` — signed primero, cruda de fallback.

### Data pesada de tabs no-default → `<Suspense>` + Loader

La data que no bloquea la tab default se carga en un Server Component async propio (patrón `CompetitorsLoader`/`ReferencesLoader`) streameado vía `<Suspense>` como slot. El page NUNCA `await`-ea data de tabs secundarias en el critical path.

### Lazy tabs: `dynamic()` SÍ, `ssr:false` NO

`dynamic(() => import(...))` mantiene el code-splitting (el chunk baja al visitar la tab). Pero `ssr:false` hace que el cold load muestre skeleton hasta hidratar aunque la data ya viajó en el payload — sin `ssr:false`, el HTML inicial trae las cards y el browser pide las imágenes de inmediato.

### Auth en paths calientes → `getAuthUser()`

`getAuthUser()` de `src/lib/supabase/auth-claims.ts` valida el JWT localmente (`getClaims`, ES256 vía JWKS) con fallback a `getUser()`. Nunca `auth.getUser()` directo en middleware/layouts/headers: es un round-trip de red por request (~0.2-0.6s) ANTES del streaming.

### Sync / acciones largas → recompensa rápida + fire-and-forget

- Click → feedback inmediato (`useTransition` + `isPending`, `NavProgressBar`, `cursor-pointer`).
- Recompensa rápida en ~3-4s (ej: quick sync pinta la primera página y marca "Listo"); el resto corre en background **fire-and-forget**.
- NUNCA `router.refresh()` en loop/intervalo (causó storms de ~228 requests por sync).
- Respuestas de rutas largas: parsear como texto + try-JSON (un 504 del gateway devuelve texto plano y `res.json()` crashea).
- `loading.tsx` en toda ruta del dashboard (skeleton instantáneo).

---

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/app/globals.css` | `.glass-card`, `.glass-section`, `.glass-panel`, `.stat-*`, `.neon-line-*`, `.pill-badge` |
| `src/components/instagram/ReelThumbnail.tsx` | Portadas robustas (`<img>` + onError, fuera del optimizer) — §11 |
| `src/lib/storage-thumbs.ts` | Firmado batch storage-first (`signStorageThumbs` / `pickThumb`) — §11 |
| `src/components/instagram/IGMetrics.tsx` | Implementación completa liquid glass |
| `src/components/instagram/InstagramTabs.tsx` | Tabs glassmorphic |
| `src/components/instagram/PeriodFilter.tsx` | Filtro glassmorphic |
| `src/components/instagram/SyncButton.tsx` | Botón glass-card |
| `src/app/(dashboard)/instagram/page.tsx` | Layout + KPI cards glassmorphic |
| `src/components/instagram/ReelMetricsSkeleton.tsx` | Skeletons glassmorphic |

---

*Próximos candidatos: sidebar, reel detail page, dashboard global, onboarding.*
