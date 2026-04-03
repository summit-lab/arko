import { DollarSign } from "lucide-react";

export default function VentasPage() {
  return (
    <div className="px-8 py-10">
      <div className="animate-slide-up mb-10">
        <h1 className="page-title">Ventas</h1>
        <p className="text-white/35 mt-3 text-[15px] font-light">Seguimiento de ventas generadas desde tu contenido.</p>
      </div>

      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.15)" }}
        >
          <DollarSign className="h-7 w-7 text-emerald-400" />
        </div>
        <div className="text-center">
          <p className="text-[22px] font-light text-white tracking-[-0.02em]">Próximamente</p>
          <p className="text-[14px] text-white/30 font-light mt-2 max-w-sm">
            Estamos trabajando en el módulo de ventas. Pronto podrás ver todas tus conversiones y revenue generado desde cada pieza de contenido.
          </p>
        </div>
        <div
          className="px-4 py-1.5 rounded-full text-[11px] font-medium text-emerald-400/70 uppercase tracking-[0.12em]"
          style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.12)" }}
        >
          Coming Soon
        </div>
      </div>
    </div>
  );
}
