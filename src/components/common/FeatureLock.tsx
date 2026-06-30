"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { LockedPreview, type PreviewKind } from "./LockedPreview";

/**
 * Overlay/página de feature bloqueada por tier (blur + candado). Lo usa:
 *  - el pop-up trampa del Demo (variant="page", texto de TRAP)
 *  - el bloqueo de Moka AI sin ADN (variant="overlay", AdnBlockOverlay)
 *
 * `variant="overlay"` = absolute inset-0 con blur sobre el contenido REAL del tab.
 * `variant="page"`    = toma la página completa y, en vez de un fondo vacío,
 *                       deja entrever un dashboard premium BORROSO detrás del
 *                       candado (paywall frosted-glass). Única salida: el CTA.
 */
interface FeatureLockProps {
  title: string;
  description: string;
  ctaText?: string;
  ctaHref?: string;
  variant?: "overlay" | "page";
  /** Qué mock de fondo borroso mostrar (variant="page"). Default: metrics. */
  preview?: PreviewKind;
}

function LockCard({
  title,
  description,
  ctaText,
  ctaHref,
  floating = false,
}: {
  title: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  floating?: boolean;
}) {
  return (
    <div className="relative">
      {/* Glow cálido detrás de la tarjeta */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-12 rounded-full blur-2xl [background:radial-gradient(circle,rgba(251,191,36,0.12),transparent_70%)]"
      />
      <div
        className={
          floating
            ? "glass-card relative max-w-sm px-8 py-9 text-center shadow-2xl backdrop-blur-xl"
            : "relative max-w-sm px-6 text-center"
        }
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 glow-amber">
          <Lock size={24} strokeWidth={1.5} className="text-amber-400" />
        </div>
        <p className="mb-2 text-[17px] font-medium text-foreground">{title}</p>
        <p className="mb-6 text-[13.5px] font-light leading-relaxed text-muted-foreground">
          {description}
        </p>
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.12] px-5 py-2.5 text-[13px] font-medium text-amber-700 transition-colors hover:bg-amber-500/[0.2] hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
        >
          {ctaText}
        </Link>
      </div>
    </div>
  );
}

export function FeatureLock({
  title,
  description,
  ctaText = "Volver al dashboard",
  ctaHref = "/",
  variant = "overlay",
  preview = "metrics",
}: FeatureLockProps) {
  if (variant === "page") {
    return (
      <div className="relative w-full min-h-[calc(100vh-80px)] overflow-hidden">
        {/* Fondo: preview premium de la feature, BORROSO (decorativo).
            Sin scale → respeta los márgenes de la app (no sangra bajo el sidebar). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 select-none opacity-95 blur-[7px]"
        >
          <LockedPreview kind={preview} />
        </div>

        {/* Scrim para profundidad y foco en el candado (suave, deja ver el fondo) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/25 via-background/45 to-background/65"
        />

        {/* Candado premium centrado */}
        <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
          <LockCard
            title={title}
            description={description}
            ctaText={ctaText}
            ctaHref={ctaHref}
            floating
          />
        </div>
      </div>
    );
  }

  // variant="overlay" — blur sobre el contenido real del tab (sin mock de fondo)
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-sm">
      <LockCard title={title} description={description} ctaText={ctaText} ctaHref={ctaHref} />
    </div>
  );
}
