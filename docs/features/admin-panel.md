# Admin Panel + Sistema de Invitaciones

> **Estado:** Implementado (v0.11.0)
> **Migraciones:** `20260325000015_invitations_and_onboarding.sql`, `20260325000016_fix_profiles_admin_rls_recursion.sql`
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

## 8. Diseño

- Usa el mismo glass design system del dashboard
- Accent color: amber (en lugar del blanco del dashboard principal)
- AdminSidebar: 220px, fondo más oscuro (rgba(0,0,0,0.6))
- Link al admin panel visible en Sidebar principal solo para admins (Shield icon, amber)
