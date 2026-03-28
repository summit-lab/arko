import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { User, Building2, Shield, Instagram, Mail, Calendar, Globe, Palette } from "lucide-react";
import { DisconnectMetaButton } from "@/components/meta/DisconnectMetaButton";
import { updateBranding } from "./actions";
import { cookies } from "next/headers";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: { full_name: string | null; role: string; email: string; created_at: string } | null = null;
  let workspace: { id: string; name: string; slug: string; plan: string; created_at: string; settings: Record<string, unknown> } | null = null;
  let connection: { status: string; ig_username: string | null; ig_business_account_id: string | null; last_validated_at: string | null; last_error: string | null } | null = null;

  if (user) {
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name, role, email, created_at")
      .eq("id", user.id)
      .single();
    profile = p;

    const cookieStore = await cookies();
    const workspaceId = cookieStore.get("arko_workspace_id")?.value;
    const { data: w } = await supabase
      .from("workspaces")
      .select("id, name, slug, plan, created_at, settings")
      .eq(workspaceId ? "id" : "owner_id", workspaceId ?? user.id)
      .limit(1)
      .single();
    workspace = w ? { ...w, settings: (w.settings as Record<string, unknown>) ?? {} } : null;

    if (workspace) {
      const { data: c } = await supabase
        .from("meta_connections")
        .select("status, ig_username, ig_business_account_id, last_validated_at, last_error")
        .eq("workspace_id", workspace.id)
        .single();
      connection = c;
    }
  }

  const isAdmin = profile?.role === "admin";
  const hasActiveConnection = connection?.status === "active";

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-zinc-400 mt-1 text-sm">Configuración de tu cuenta y workspace.</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Profile */}
        <div className="glass-panel rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <User className="h-4 w-4 text-zinc-400" />
            Perfil
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Nombre</span>
              <span className="text-sm text-zinc-200">{profile?.full_name || "--"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Email</span>
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-zinc-500" />
                <span className="text-sm text-zinc-200">{profile?.email || user?.email || "--"}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Rol</span>
              <div className="flex items-center gap-1.5">
                {isAdmin && <Shield className="h-3 w-3 text-amber-400" />}
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${isAdmin ? "text-amber-400 bg-amber-400/10" : "text-zinc-400 bg-white/5"}`}>
                  {profile?.role || "--"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Miembro desde</span>
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-zinc-500" />
                <span className="text-sm text-zinc-200">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) : "--"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace */}
        <div className="glass-panel rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-zinc-400" />
            Workspace
          </h3>
          {workspace ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Nombre</span>
                <span className="text-sm text-zinc-200">{workspace.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Slug</span>
                <div className="flex items-center gap-2">
                  <Globe className="h-3 w-3 text-zinc-500" />
                  <code className="text-xs text-zinc-400">{workspace.slug}</code>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Plan</span>
                <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded capitalize">{workspace.plan}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No hay workspace configurado.</p>
          )}
        </div>
      </div>

      {/* Admin Panel Access */}
      {isAdmin && (
        <Link
          href="/admin"
          className="glass-panel rounded-xl p-6 flex items-center justify-between group hover:border-amber-400/20 transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-400">Admin Panel</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Gestionar clientes, invitaciones y estadísticas globales</p>
            </div>
          </div>
          <span className="text-xs text-zinc-500 group-hover:text-amber-400/70 transition-colors">Ir al panel →</span>
        </Link>
      )}

      {/* Branding */}
      <form action={updateBranding} className="glass-panel rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <Palette className="h-4 w-4 text-zinc-400" />
          Branding del workspace
        </h3>
        <p className="text-xs text-zinc-500">Personaliza cómo aparece tu marca en el sidebar.</p>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">
              Nombre de marca
            </label>
            <input
              name="brand_name"
              type="text"
              defaultValue={(workspace?.settings?.brand_name as string) ?? workspace?.name ?? ""}
              placeholder="Ej: Mi Empresa"
              maxLength={40}
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">
              URL del logo (imagen)
            </label>
            <input
              name="logo_url"
              type="url"
              defaultValue={(workspace?.settings?.logo_url as string) ?? ""}
              placeholder="https://..."
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
            />
            <p className="text-[10px] text-zinc-600 mt-1">Pegá la URL de tu logo. Recomendado: imagen cuadrada PNG/SVG.</p>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.10] text-sm text-zinc-200 hover:bg-white/[0.10] hover:border-white/[0.16] transition-all cursor-pointer"
          >
            Guardar branding
          </button>
        </div>
      </form>

      {/* Meta Connection */}
      <div className="glass-panel rounded-xl p-6">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
          <Instagram className="h-4 w-4 text-zinc-400" />
          Conexión Meta / Instagram
        </h3>
        {hasActiveConnection && connection ? (
          <div className="space-y-5">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] text-zinc-500 mb-1">Estado</p>
                <span className="text-xs font-medium px-2 py-0.5 rounded text-emerald-400 bg-emerald-400/10">
                  conectada
                </span>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 mb-1">Cuenta IG</p>
                <p className="text-sm text-zinc-200">@{connection.ig_username || "--"}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 mb-1">IG Account ID</p>
                <code className="text-[10px] text-zinc-400">{connection.ig_business_account_id || "--"}</code>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 mb-1">Última validación</p>
                <p className="text-xs text-zinc-400">
                  {connection.last_validated_at ? new Date(connection.last_validated_at).toLocaleDateString("es-AR") : "--"}
                </p>
              </div>
            </div>

            {workspace ? (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-4">
                <div>
                  <p className="text-sm text-zinc-200">¿Querés volver a conectar otra cuenta?</p>
                  <p className="text-xs text-zinc-500 mt-1">Podés desconectar esta cuenta y reiniciar el flujo cuando quieras.</p>
                </div>
                <DisconnectMetaButton workspaceId={workspace.id} />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-center py-6">
            <Instagram className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500 mb-2">No hay cuenta de Instagram conectada.</p>
            {connection?.last_error ? (
              <p className="text-xs text-red-400 mb-4">La última conexión no se completó. Podés volver a intentarlo.</p>
            ) : (
              <p className="text-xs text-zinc-500 mb-4">Conectá tu cuenta para habilitar Instagram Intelligence.</p>
            )}
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 text-sm text-pink-300 px-5 py-2.5 rounded-lg hover:from-pink-500/30 hover:to-purple-500/30 transition-all"
            >
              <Instagram className="h-4 w-4" />
              {connection ? "Reintentar conexión" : "Conectar cuenta"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
