// Skeleton instantáneo para /meta — sin esto Next esperaba el RSC entero
// (queries) antes de pintar nada = "6s en blanco" al navegar.
export default function MetaLoading() {
  return (
    <div className="px-8 py-10 animate-pulse">
      {/* Título */}
      <div className="mb-10">
        <div className="h-8 w-56 rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-80 rounded bg-white/[0.04] mt-3" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-5 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card px-6 py-5">
            <div className="h-3 w-20 rounded bg-white/[0.04] mb-4" />
            <div className="h-8 w-24 rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>

      {/* Grilla de cards */}
      <div className="grid grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-panel rounded-xl p-6">
            <div className="h-4 w-32 rounded bg-white/[0.06] mb-5" />
            <div className="h-[120px] rounded-lg bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}
