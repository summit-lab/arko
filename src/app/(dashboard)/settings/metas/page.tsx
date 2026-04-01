import { Target, Plus } from "lucide-react";

export default function MetasSettingsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">Metas</h1>
        <p className="text-zinc-400 mt-1 text-sm">Definí tus objetivos mensuales de contenido y crecimiento.</p>
      </div>

      {/* Placeholder */}
      <div className="glass-panel rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-4">
        <div className="h-14 w-14 rounded-full bg-white/[0.06] flex items-center justify-center">
          <Target className="h-7 w-7 text-white/30" />
        </div>
        <div>
          <p className="text-white/60 font-light text-[15px]">Metas configurables — próximamente</p>
          <p className="text-white/25 text-sm mt-1 font-light">Podrás definir objetivos de views, seguidores, engagement y ventas</p>
        </div>
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/30 cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          Nueva meta
        </button>
      </div>

      {/* Preview de metas (dummy) */}
      <div className="glass-panel rounded-xl p-6 space-y-4">
        <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-[0.1em]">Ejemplo de metas</h3>
        <div className="space-y-4">
          {[
            { label: "Views mensuales", current: 71500, goal: 100000, color: "bg-blue-400" },
            { label: "Seguidores nuevos", current: 96, goal: 200, color: "bg-emerald-400" },
            { label: "Engagement Rate", current: 1.9, goal: 3.0, unit: "%", color: "bg-amber-400" },
          ].map((m) => {
            const pct = Math.min(Math.round((m.current / m.goal) * 100), 100);
            return (
              <div key={m.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] text-white/60 font-light">{m.label}</span>
                  <span className="text-[12px] text-white/30 font-light">
                    {m.unit ? `${m.current}${m.unit}` : m.current.toLocaleString()} / {m.unit ? `${m.goal}${m.unit}` : m.goal.toLocaleString()}
                  </span>
                </div>
                <div className="h-[6px] w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div className={`h-full rounded-full ${m.color} opacity-60 transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-white/20 mt-1">{pct}% completado</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
