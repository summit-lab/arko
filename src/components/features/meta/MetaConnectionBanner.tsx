"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";

interface MetaConnectionBannerProps {
  /** Status from `meta_connections.status` — banner only shows when not 'active'. */
  status: string;
  /** Optional human-readable error from the last sync attempt. */
  lastError?: string | null;
}

/**
 * Banner persistente que aparece en el dashboard cuando la conexión a Meta
 * está caída (status != 'active'). Antes este caso era SILENCIOSO: el cron
 * dejaba de sincronizar al usuario y el dashboard mostraba data vieja sin
 * ningún aviso. Ahora el usuario lo ve apenas entra y tiene un CTA directo
 * para reconectar.
 *
 * Se oculta en /onboarding (donde el flujo ya pide reconectar).
 */
export function MetaConnectionBanner({ status, lastError }: MetaConnectionBannerProps) {
  const pathname = usePathname();
  const t = useTranslations("metaConnectionBanner");

  if (status === "active") return null;
  if (pathname.startsWith("/onboarding")) return null;

  // status puede ser "expired", "pending", "error". Tono distinto para cada uno.
  const isExpired = status === "expired";
  const tone = isExpired
    ? {
        border: "border-rose-500/25",
        bg: "bg-rose-500/[0.08]",
        iconBg: "bg-rose-500/15",
        iconColor: "text-rose-400",
        text: "text-rose-700 dark:text-rose-200/85",
        textBold: "text-rose-800 dark:text-rose-200",
        button: "text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-200 bg-rose-500/[0.1] hover:bg-rose-500/[0.18] border-rose-500/25",
      }
    : {
        border: "border-amber-500/25",
        bg: "bg-amber-500/[0.06]",
        iconBg: "bg-amber-500/15",
        iconColor: "text-amber-400",
        text: "text-amber-700 dark:text-amber-200/80",
        textBold: "text-amber-800 dark:text-amber-200",
        button: "text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 bg-amber-500/[0.08] hover:bg-amber-500/[0.15] border-amber-500/20",
      };

  return (
    <div className="mx-8 mt-4 mb-0">
      <div className={`flex items-center gap-3 rounded-xl border ${tone.border} ${tone.bg} backdrop-blur-sm px-5 py-3`}>
        <div className={`shrink-0 h-5 w-5 rounded-full ${tone.iconBg} flex items-center justify-center`}>
          <AlertCircle size={12} className={tone.iconColor} />
        </div>
        <div className="flex-1">
          <p className={`text-[13px] ${tone.text} font-light`}>
            <span className={`font-medium ${tone.textBold}`}>{t("title")}</span>
            {" — "}
            {isExpired ? t("expiredDescription") : t("pendingDescription")}
          </p>
          {lastError && (
            <p className="text-[11px] text-foreground/40 font-light mt-0.5 truncate">{lastError}</p>
          )}
        </div>
        <Link
          href="/onboarding"
          className={`shrink-0 text-[12px] font-medium transition-colors px-3 py-1.5 rounded-lg border ${tone.button}`}
        >
          {t("reconnectCta")}
        </Link>
      </div>
    </div>
  );
}
