import { createClient } from "@/lib/supabase/server";

export default async function AdminClientsPage() {
  const supabase = await createClient();

  // Fetch workspaces with meta_connections
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select(`
      id, name, slug, is_active, created_at, owner_id,
      meta_connections (status, ig_username)
    `)
    .order("created_at", { ascending: false });

  // Fetch all profiles separately (no FK between workspaces and profiles)
  const ownerIds = (workspaces ?? []).map((w) => w.owner_id).filter(Boolean);
  const { data: profiles } = ownerIds.length > 0
    ? await supabase.from("profiles").select("id, email, full_name, role").in("id", ownerIds)
    : { data: [] as { id: string; email: string; full_name: string | null; role: string }[] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const clients = (workspaces ?? [])
    .filter((w) => profileMap.get(w.owner_id)?.role !== "admin")
    .map((w) => {
    const profile = profileMap.get(w.owner_id);
    const connection = Array.isArray(w.meta_connections) ? w.meta_connections[0] : w.meta_connections;
    return {
      id: w.id,
      name: w.name,
      slug: w.slug,
      is_active: w.is_active,
      created_at: w.created_at,
      owner_email: profile?.email ?? "—",
      owner_name: profile?.full_name ?? "—",
      connection_status: connection?.status ?? null,
      ig_username: connection?.ig_username ?? null,
    };
  });

  return (
    <div className="px-8 py-10 space-y-8">
      <div>
        <h1 className="page-title">Clientes</h1>
        <p className="text-white/35 mt-3 text-[15px] font-light">
          Todos los workspaces registrados en la plataforma.
        </p>
      </div>

      <div className="glass-panel rounded-xl p-6">
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium pb-3 border-b border-white/[0.06] px-2">
            <div className="col-span-3">Workspace</div>
            <div className="col-span-3">Owner</div>
            <div className="col-span-3 text-center">Conexión</div>
            <div className="col-span-1 text-center">Estado</div>
            <div className="col-span-2 text-right">Creado</div>
          </div>

          {clients.length === 0 && (
            <p className="text-white/25 text-[13px] py-4 text-center">No hay clientes registrados.</p>
          )}

          {clients.map((c) => (
            <div key={c.id} className="grid grid-cols-12 gap-2 items-center py-3.5 rounded-lg hover:bg-white/[0.03] transition-all duration-200 px-2">
              <div className="col-span-3">
                <p className="text-[13px] font-light text-white/70">{c.name}</p>
                <p className="text-[11px] text-white/25 mt-0.5">{c.slug}</p>
              </div>
              <div className="col-span-3">
                <p className="text-[13px] font-light text-white/60">{c.owner_name}</p>
                <p className="text-[11px] text-white/25 mt-0.5">{c.owner_email}</p>
              </div>
              <div className="col-span-3 text-center">
                {c.connection_status === "active" ? (
                  <span className="text-[12px] text-emerald-400">
                    @{c.ig_username}
                  </span>
                ) : (
                  <span className="text-[12px] text-white/25">Sin conexión</span>
                )}
              </div>
              <div className="col-span-1 text-center">
                <span className={`inline-block h-2 w-2 rounded-full ${c.is_active ? "bg-emerald-400" : "bg-red-400"}`} />
              </div>
              <div className="col-span-2 text-right text-[12px] text-white/30">
                {new Date(c.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
