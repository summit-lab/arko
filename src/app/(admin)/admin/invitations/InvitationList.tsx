"use client";

import { Clock, CheckCircle, XCircle } from "lucide-react";
import { expireInvitation } from "./actions";

interface Invitation {
  id: string;
  email: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
  used_at: string | null;
  used_by: string | null;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  pending: { label: "Pendiente", icon: Clock, color: "text-amber-400", bg: "bg-amber-400/10" },
  used: { label: "Usada", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  expired: { label: "Expirada", icon: XCircle, color: "text-red-400", bg: "bg-red-400/10" },
};

export function InvitationList({ invitations }: { invitations: Invitation[] }) {
  return (
    <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-2">
      <h3 className="text-[15px] font-light text-white tracking-wide mb-5">
        Historial de Invitaciones
      </h3>

      <div className="space-y-1">
        <div className="grid grid-cols-12 gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium pb-3 border-b border-white/[0.06] px-2">
          <div className="col-span-4">Email</div>
          <div className="col-span-2 text-center">Estado</div>
          <div className="col-span-2 text-center">Creada</div>
          <div className="col-span-2 text-center">Expira</div>
          <div className="col-span-2 text-right">Acción</div>
        </div>

        {invitations.length === 0 && (
          <p className="text-white/25 text-[13px] py-4 text-center">No hay invitaciones.</p>
        )}

        {invitations.map((inv) => {
          const config = statusConfig[inv.status] ?? statusConfig.pending;
          const StatusIcon = config.icon;
          const isExpired = new Date(inv.expires_at) < new Date() && inv.status === "pending";

          return (
            <div key={inv.id} className="grid grid-cols-12 gap-2 items-center py-3 rounded-lg hover:bg-white/[0.03] transition-all duration-200 px-2">
              <div className="col-span-4 text-[13px] font-light text-white/60">{inv.email}</div>
              <div className="col-span-2 text-center">
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${config.color} ${config.bg} px-2 py-0.5 rounded-full`}>
                  <StatusIcon size={10} />
                  {isExpired ? "Expirada" : config.label}
                </span>
              </div>
              <div className="col-span-2 text-center text-[12px] text-white/30">
                {new Date(inv.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
              </div>
              <div className="col-span-2 text-center text-[12px] text-white/30">
                {new Date(inv.expires_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
              </div>
              <div className="col-span-2 text-right">
                {inv.status === "pending" && !isExpired && (
                  <form action={expireInvitation} className="inline">
                    <input type="hidden" name="id" value={inv.id} />
                    <button
                      type="submit"
                      className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </form>
                )}
                {inv.status === "used" && inv.used_at && (
                  <span className="text-[11px] text-white/20">
                    {new Date(inv.used_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
