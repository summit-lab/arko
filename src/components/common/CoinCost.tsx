"use client";

import { Coins } from "lucide-react";
import { ACTION_ESTIMATES, type EstimableAction } from "@/lib/credit-estimates";

interface CoinCostProps {
  action: EstimableAction;
  /** Nota extra para el tooltip (ej. "La actualización de datos está incluida en tu plan"). */
  note?: string;
  className?: string;
}

/**
 * "Previsto" de Moka Coins junto a botones de acciones caras: `~30 Moka`.
 * Estimación estática (src/lib/credit-estimates.ts) — el débito real lo decide
 * el server; esto es puro aviso pre-acción para que nadie se sorprenda.
 */
export function CoinCost({ action, note, className = "" }: CoinCostProps) {
  const est = ACTION_ESTIMATES[action];
  const title = `Esta acción usa ~${est.typ} Moka Coins (hasta ~${est.max}).${note ? ` ${note}` : ""}`;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-[10px] font-medium text-yellow-500/70 tabular-nums whitespace-nowrap ${className}`}
    >
      <Coins size={10} strokeWidth={2} />
      ~{est.typ} Moka
    </span>
  );
}
