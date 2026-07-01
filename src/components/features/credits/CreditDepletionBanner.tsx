"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle } from "lucide-react";

interface CreditDepletionBannerProps {
  /** Moka Coins restantes hoy (resuelto en SSR). */
  remaining: number;
  /** Allotment diario del tier. */
  allotment: number;
}

/**
 * Banner persistente de "te estás quedando / te quedaste sin Moka Coins".
 * Clon de MetaConnectionBanner (mismo tono glass). SSR-driven: se recalcula en
 * cada navegación. La señal instantánea la da el CreditChip (Realtime); este
 * banner es el aviso prominente. No aparece por debajo del 80% gastado, ni en
 * /onboarding. Demo nunca lo dispara (allotment lleno, gastado 0).
 */
export function CreditDepletionBanner({ remaining, allotment }: CreditDepletionBannerProps) {
  const pathname = usePathname();
  if (pathname.startsWith("/onboarding")) return null;
  if (allotment <= 0) return null;

  const spentPct = 1 - remaining / allotment;
  if (spentPct < 0.8) return null;

  const isOut = remaining <= 0;
  const tone = isOut
    ? {
        border: "border-rose-500/25",
        bg: "bg-rose-500/[0.08]",
        iconBg: "bg-rose-500/15",
        iconColor: "text-rose-400",
        text: "text-rose-700 dark:text-rose-200/85",
        textBold: "text-rose-800 dark:text-rose-200",
        button:
          "text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-200 bg-rose-500/[0.1] hover:bg-rose-500/[0.18] border-rose-500/25",
      }
    : {
        border: "border-amber-500/25",
        bg: "bg-amber-500/[0.06]",
        iconBg: "bg-amber-500/15",
        iconColor: "text-amber-400",
        text: "text-amber-700 dark:text-amber-200/80",
        textBold: "text-amber-800 dark:text-amber-200",
        button:
          "text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 bg-amber-500/[0.08] hover:bg-amber-500/[0.15] border-amber-500/20",
      };

  return (
    <div className="mx-8 mt-4 mb-0">
      <div className={`flex items-center gap-3 rounded-xl border ${tone.border} ${tone.bg} backdrop-blur-sm px-5 py-3`}>
        <div className={`shrink-0 h-5 w-5 rounded-full ${tone.iconBg} flex items-center justify-center`}>
          <AlertCircle size={12} className={tone.iconColor} />
        </div>
        <div className="flex-1">
          <p className={`text-[13px] ${tone.text} font-light`}>
            <span className={`font-medium ${tone.textBold}`}>
              {isOut ? "Te quedaste sin Moka Coins por hoy" : "Estás por quedarte sin Moka Coins"}
            </span>
            {" — "}
            {isOut
              ? "se renuevan a la medianoche. Para más créditos, comunicate con nuestro equipo."
              : `te quedan ${remaining} de ${allotment} hoy.`}
          </p>
        </div>
        <Link
          href="/"
          className={`shrink-0 text-[12px] font-medium transition-colors px-3 py-1.5 rounded-lg border ${tone.button}`}
        >
          Ver planes
        </Link>
      </div>
    </div>
  );
}
