"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coins, Check, Loader2, Infinity as InfinityIcon, RotateCcw } from "lucide-react";
import { adjustCredits } from "./actions";
import { creditView, type CreditBalanceRow } from "@/lib/credits";
import { dailyCoins, type Tier } from "@/lib/tier/config";

interface CreditAdminControlProps {
  workspaceId: string;
  /** Tier del CLIENTE (define el allotment base). */
  tier: Tier;
  initialRow: CreditBalanceRow | null;
}

/**
 * Control de Moka Coins en el detalle de cliente del admin. Permite:
 *  - Monedas infinitas (unlimited) on/off
 *  - Sumar cupo diario extra (bonus)
 *  - Resetear el gasto de hoy
 * Escribe vía la server action adjustCredits → RPC gated is_admin().
 */
export function CreditAdminControl({ workspaceId, tier, initialRow }: CreditAdminControlProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unlimited = !!initialRow?.unlimited;
  const bonus = initialRow?.bonus_daily_coins ?? 0;
  const [bonusInput, setBonusInput] = useState(String(bonus));

  const view = creditView(tier, initialRow);
  const base = dailyCoins(tier);

  function run(patch: { unlimited?: boolean; bonusDailyCoins?: number; resetToday?: boolean }) {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await adjustCredits(workspaceId, patch);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <div className="glass-card px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <Coins size={14} className="text-yellow-400" />
        <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium">Moka Coins</p>
      </div>

      {/* Estado actual */}
      <div className="flex items-baseline gap-1.5">
        {unlimited ? (
          <span className="inline-flex items-center gap-1 text-[15px] font-light text-yellow-400/90">
            <InfinityIcon size={16} /> ilimitadas
          </span>
        ) : (
          <>
            <span className="text-[18px] font-light text-white/80 tabular-nums">{view.remaining}</span>
            <span className="text-[12px] text-white/30">/ {view.allotment} hoy</span>
          </>
        )}
      </div>
      {!unlimited && (
        <p className="text-[10px] text-white/25 mt-1">
          Base {base}
          {bonus > 0 ? ` + bonus ${bonus}` : ""} · gastado hoy {view.spent}
        </p>
      )}

      {/* Monedas infinitas */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11px] text-white/50">Monedas infinitas</span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run({ unlimited: !unlimited })}
          className={`relative h-5 w-9 rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
            unlimited ? "bg-yellow-500/60" : "bg-white/[0.1]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              unlimited ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Bonus diario */}
      <div className="mt-3">
        <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium mb-1.5">Cupo diario extra</p>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            value={bonusInput}
            disabled={isPending || unlimited}
            onChange={(e) => setBonusInput(e.target.value)}
            className="h-7 w-20 rounded-md bg-white/[0.04] border border-white/[0.08] px-2 text-[12px] text-white/80 tabular-nums outline-none focus:border-white/20 disabled:opacity-40"
          />
          <button
            type="button"
            disabled={isPending || unlimited}
            onClick={() => run({ bonusDailyCoins: Math.max(0, parseInt(bonusInput || "0", 10) || 0) })}
            className="h-7 px-3 rounded-md bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] font-medium text-white/70 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
          </button>
        </div>
      </div>

      {/* Reset hoy */}
      <button
        type="button"
        disabled={isPending}
        onClick={() => run({ resetToday: true })}
        className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors cursor-pointer disabled:opacity-40"
      >
        <RotateCcw size={12} /> Resetear gasto de hoy
      </button>

      {savedAt && !isPending && !error ? (
        <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-emerald-400/80">
          <Check className="h-2.5 w-2.5" /> guardado
        </span>
      ) : null}
      {error ? <p className="text-[10px] text-red-400/80 mt-1">{error}</p> : null}
    </div>
  );
}
