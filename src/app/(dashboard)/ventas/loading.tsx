// Skeleton instantáneo para /ventas — sin esto Next esperaba el RSC entero
// (queries) antes de pintar nada = "6s en blanco" al navegar. Con loading.tsx,
// el skeleton aparece al toque y el contenido streamea cuando llega.
export default function VentasLoading() {
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

      {/* Tabla / lista */}
      <div className="glass-panel rounded-xl p-6 space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="h-9 w-9 rounded-lg bg-white/[0.04]" />
            <div className="flex-1 h-4 rounded bg-white/[0.04]" />
            <div className="h-3 w-20 rounded bg-white/[0.06]" />
            <div className="h-3 w-16 rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}
