"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

/**
 * Overlay/página de feature bloqueada por tier (blur + candado).
 * Generaliza el patrón de AdnBlockOverlay. Lo usa:
 *  - el pop-up trampa del Demo (variant="page", texto de TRAP)
 *  - el bloqueo de Moka AI sin ADN (variant="overlay", AdnBlockOverlay)
 *
 * `variant="overlay"` = absolute inset-0 con blur sobre el contenido del tab.
 * `variant="page"`    = ocupa el alto de la página (única salida: el CTA).
 */
interface FeatureLockProps {
  title: string;
  description: string;
  ctaText?: string;
  ctaHref?: string;
  variant?: "overlay" | "page";
}

export function FeatureLock({
  title,
  description,
  ctaText = "Volver al dashboard",
  ctaHref = "/",
  variant = "overlay",
}: FeatureLockProps) {
  const wrapper =
    variant === "page"
      ? "min-h-[calc(100vh-180px)] flex items-center justify-center px-6"
      : "absolute inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-xl";

  return (
    <div className={wrapper}>
      <div className="text-center max-w-sm px-6">
        <div className="h-12 w-12 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
          <Lock size={22} strokeWidth={1.5} className="text-amber-400" />
        </div>
        <p className="text-[15px] font-medium text-foreground mb-1.5">{title}</p>
        <p className="text-[13px] text-muted-foreground font-light mb-5 leading-relaxed">
          {description}
        </p>
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 transition-colors px-5 py-2.5 rounded-xl bg-amber-500/[0.1] hover:bg-amber-500/[0.18] border border-amber-500/25"
        >
          {ctaText}
        </Link>
      </div>
    </div>
  );
}
