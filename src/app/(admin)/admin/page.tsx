import { createClient } from "@/lib/supabase/server";
import { Users, Building2, Wifi, UserPlus } from "lucide-react";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Fetch stats in parallel
  const [profilesRes, workspacesRes, connectionsRes, invitationsRes, recentRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "user"),
    supabase.from("workspaces").select("id", { count: "exact", head: true }),
    supabase.from("meta_connections").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("invitations").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("profiles").select("id, email, full_name, role, created_at").order("created_at", { ascending: false }).limit(5),
  ]);

  const stats = [
    { label: "Clientes", value: profilesRes.count ?? 0, icon: Users, color: "text-blue-400" },
    { label: "Workspaces", value: workspacesRes.count ?? 0, icon: Building2, color: "text-violet-400" },
    { label: "Conexiones Activas", value: connectionsRes.count ?? 0, icon: Wifi, color: "text-emerald-400" },
    { label: "Invitaciones Pendientes", value: invitationsRes.count ?? 0, icon: UserPlus, color: "text-amber-400" },
  ];

  const recentUsers = recentRes.data ?? [];

  return (
    <div className="px-8 py-10 space-y-8">
      <div>
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="text-white/35 mt-3 text-[15px] font-light">
          Vista general de la plataforma.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-5">
        {stats.map((s, i) => (
          <div key={s.label} className={`glass-card px-6 py-5 animate-slide-up stagger-${i + 1}`}>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <p className="stat-label">{s.label}</p>
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center ${s.color}`}
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <s.icon className="h-[18px] w-[18px]" />
              </div>
            </div>
            <p className="stat-number-xl relative z-10">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Users */}
      <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-5">
        <h3 className="text-[15px] font-light text-white tracking-wide mb-5">
          Últimos Registros
        </h3>
        <div className="space-y-1">
          <div className="grid grid-cols-12 gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium pb-3 border-b border-white/[0.06] px-2">
            <div className="col-span-4">Nombre</div>
            <div className="col-span-4">Email</div>
            <div className="col-span-2 text-center">Rol</div>
            <div className="col-span-2 text-right">Fecha</div>
          </div>
          {recentUsers.length === 0 && (
            <p className="text-white/25 text-[13px] py-4 text-center">No hay usuarios registrados.</p>
          )}
          {recentUsers.map((u) => (
            <div key={u.id} className="grid grid-cols-12 gap-2 items-center py-3 rounded-lg hover:bg-white/[0.03] transition-all duration-200 px-2">
              <div className="col-span-4 text-[13px] font-light text-white/70">{u.full_name || "—"}</div>
              <div className="col-span-4 text-[13px] font-light text-white/50">{u.email}</div>
              <div className="col-span-2 text-center">
                <span className={`pill-badge ${u.role === "admin" ? "!bg-amber-400/10 !text-amber-400" : ""}`}>
                  {u.role}
                </span>
              </div>
              <div className="col-span-2 text-right text-[12px] text-white/30">
                {new Date(u.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
