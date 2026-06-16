# Admin Panel + Sistema de Invitaciones

> **Estado:** Implementado (v0.11.0)
> **Migraciones:** `20260325000015_invitations_and_onboarding.sql`, `20260325000016_fix_profiles_admin_rls_recursion.sql`, `20260616120000_trial_plans.sql`
> **Ruta:** `/admin`, `/admin/clients`, `/admin/invitations`

---

## 1. Visión General

Arko es un SaaS premium de acceso por invitación. El admin panel permite al administrador:
- Ver estadísticas globales (clientes, workspaces, conexiones, invitaciones)
- Gestionar clientes (lista de workspaces con estado de conexión)
- Generar y gestionar invitaciones de registro

El registro público está bloqueado. Solo se puede acceder mediante un link de invitación generado por un admin.

---

## 2. Protección de Acceso (Defense-in-Depth)

### Capa 1: Middleware (`src/lib/supabase/middleware.ts`)
- Rutas `/admin/*` requieren `role='admin'` en profiles
- Role se cachea en cookie `arko_user_role` (httpOnly, 1h TTL)
- Si no es admin → redirect a `/`

### Capa 2: Layout Server Component (`src/app/(admin)/layout.tsx`)
- Double-check: lee profile del usuario autenticado
- Si no es admin → redirect a `/`

### Capa 3: RLS en Base de Datos
- Función `is_admin()` (SECURITY DEFINER): verifica admin sin recursión RLS
- Tabla `invitations`: solo admins (via `is_admin()`) pueden SELECT/INSERT/UPDATE
- Tabla `workspaces`: admins pueden ver todos los workspaces
- Tabla `meta_connections`: admins pueden ver todas las conexiones
- Las server actions usan `createClient()` que respeta RLS

---

## 3. Rutas

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/admin` | `src/app/(admin)/admin/page.tsx` | Dashboard con stats globales + signups recientes |
| `/admin/clients` | `src/app/(admin)/admin/clients/page.tsx` | Lista de workspaces con owner, plan, conexión Meta (excluye admin) |
| `/admin/invitations` | `src/app/(admin)/admin/invitations/page.tsx` | Generar invitaciones + tabla de estado |

---

## 4. Flujo de Invitación

```
Admin genera invitación (/admin/invitations)
  → Se crea registro en `invitations` con token UUID
  → Admin copia link: /invite/{token}

Usuario abre link (/invite/[token])
  → Server valida token via RPC `validate_invitation`
  → Si válido: form con email pre-filled (read-only) + nombre + contraseña
  → Si inválido: mensaje de error

Usuario se registra
  → `registerWithInvite()` server action valida token + signUp
  → Trigger `handle_new_user()` crea profile + workspace
  → Trigger también marca invitación como used (status='used', used_by, used_at)
  → Redirect a dashboard
```

---

## 5. Componentes

| Componente | Tipo | Ubicación |
|-----------|------|-----------|
| `AdminSidebar` | Client | `src/components/layout/AdminSidebar.tsx` |
| `InvitationForm` | Client | `src/app/(admin)/admin/invitations/InvitationForm.tsx` |
| `InvitationList` | Client | `src/app/(admin)/admin/invitations/InvitationList.tsx` |
| `InviteRegisterForm` | Client | `src/app/(auth)/invite/[token]/InviteRegisterForm.tsx` |

---

## 6. Server Actions

| Action | Archivo | Descripción |
|--------|---------|-------------|
| `createInvitation` | `src/app/(admin)/admin/invitations/actions.ts` | Crea invitación, valida duplicados |
| `expireInvitation` | `src/app/(admin)/admin/invitations/actions.ts` | Marca invitación como expired |
| `registerWithInvite` | `src/app/(auth)/actions.ts` | Registro con token de invitación |

---

## 7. Tablas de Onboarding (Schema Only)

Las siguientes tablas están creadas pero sin UI todavía. Serán usadas en el flujo de onboarding:

- `workspace_profile` — negocio, marca, avatar, oferta, audiencia
- `workspace_strategies` — estrategia por plataforma
- `workspace_competitors` — competidores + datos scrapeados
- `workspace_market` — industria, tendencias, creencias
- `workspace_references` — marcas de referencia
- `workspace_brand` — lenguaje de nicho, herramientas, mecanismos

Ver detalle completo en `docs/DB_SCHEMA.md`.

---

## 8. Trials (30 / 60 / 90 días gratis)

> **Estado:** v1 — solo visibilidad (sin enforcement de bloqueo al vencer).
> **Migración:** `20260616120000_trial_plans.sql`

Cada invitación lleva un **trial gratis** que el admin elige al generar el link. El conteo arranca cuando el usuario **se registra** (no al crear el link).

### Flujo
```
Admin genera invitación → elige trial (30/60/90, default 30)
  → invitations.trial_days

Usuario se registra con el link
  → handle_new_user() copia trial_days al workspace del usuario
  → estampa trial_started_at = now() y trial_ends_at = now() + trial_days
```

### Dónde se ve
- **`/admin/invitations`** → `InvitationForm` tiene un selector de 3 botones (30d / 60d / 90d) junto al idioma.
- **`/admin/clients`** → columna **Trial** con conteo regresivo día a día:
  - 🟢 verde: más de 7 días restantes
  - 🟡 ámbar: 7 días o menos (por vencer) + barra de progreso de lo consumido
  - 🔴 "Vencido": llegó a 0 (no bloquea el acceso en v1)
  - "—": sin trial (ej. cuentas admin, `trial_days` NULL)

### Datos
- `invitations.trial_days` smallint NOT NULL DEFAULT 30 CHECK IN (30,60,90)
- `workspaces.trial_days` / `trial_started_at` / `trial_ends_at` (nullable; NULL = sin trial)
- Índice parcial `idx_workspaces_trial_ends_at` para futuras queries de vencimiento.

### Pendiente (v2, si se decide)
- Enforcement: bloquear acceso al vencer (gate en middleware + UI de "trial vencido" + acción de extender/reactivar desde el admin).

---

## 9. Diseño

- Usa el mismo glass design system del dashboard
- Accent color: amber (en lugar del blanco del dashboard principal)
- AdminSidebar: 220px, fondo más oscuro (rgba(0,0,0,0.6))
- Link al admin panel visible en Sidebar principal solo para admins (Shield icon, amber)
