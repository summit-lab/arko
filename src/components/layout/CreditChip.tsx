"use client";

import { useEffect, useState } from "react";
import { Coins, Lock, Infinity as InfinityIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Tier } from "@/lib/tier/config";
import { creditView, type CreditBalanceRow } from "@/lib/credits";

interface CreditChipProps {
  workspaceId: string;
  tier: Tier;
  /** Fila de balance resuelta en SSR (valor inicial antes del 1er evento Realtime). */
  initialRow: CreditBalanceRow | null;
}

/**
 * Chip de Moka Coins en el header. Muestra `restantes / allotment` y se
 * actualiza EN VIVO por Supabase Realtime (postgres_changes sobre
 * workspace_credit_balances) — baja al instante aunque el gasto ocurra en otra
 * request o en background, sin recargar. Respeta los overrides de admin
 * (unlimited → ∞, bonus → allotment mayor), que llegan en el mismo payload.
 *
 * Demo no gasta nunca (features OFF): chip fijo con candado, sin suscripción.
 */
export function CreditChip({ workspaceId, tier, initialRow }: CreditChipProps) {
  const [row, setRow] = useState<CreditBalanceRow | null>(initialRow);
  const isDemo = tier === "demo";

  useEffect(() => {
    if (isDemo) return; // demo nunca debita → chip estático
    const supabase = createClient();
    const channel = supabase
      .channel(`wallet:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "workspace_credit_balances",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => setRow(payload.new as CreditBalanceRow),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, isDemo]);

  const view = creditView(tier, row);
  const pctLeft = view.allotment > 0 ? view.remaining / view.allotment : 0;
  const tone = isDemo
    ? "text-muted-foreground"
    : view.unlimited
      ? "text-yellow-400"
      : pctLeft <= 0
        ? "text-rose-400"
        : pctLeft <= 0.2
          ? "text-amber-400"
          : "text-yellow-400";

  const title = isDemo
    ? "Moka Coins — plan Demo"
    : view.unlimited
      ? "Moka Coins ilimitadas"
      : `Te quedan ${view.remaining} de ${view.allotment} Moka Coins hoy · se renuevan a la medianoche`;

  return (
    <div className="flex items-center gap-2" title={title}>
      {isDemo ? (
        <Lock className="h-3.5 w-3.5 text-muted-foreground opacity-60" strokeWidth={1.8} />
      ) : (
        <Coins className={`h-4 w-4 ${tone} opacity-80`} strokeWidth={1.8} />
      )}
      <div className="flex flex-col leading-none">
        <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-[0.1em]">Moka</span>
        {view.unlimited ? (
          <span className={`flex items-center ${tone} leading-none mt-1`}>
            <InfinityIcon className="h-4 w-4" strokeWidth={2} />
          </span>
        ) : (
          <span className={`text-[13px] font-light ${tone} leading-none mt-1 tabular-nums`}>
            {view.remaining}
            <span className="text-muted-foreground/50"> / {view.allotment}</span>
          </span>
        )}
      </div>
    </div>
  );
}
