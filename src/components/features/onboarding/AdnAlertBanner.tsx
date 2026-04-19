"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdnAlertBanner() {
  const pathname = usePathname();

  // Don't show on onboarding pages — user is already completing the ADN
  if (pathname.startsWith("/onboarding")) return null;

  return (
    <div className="mx-8 mt-4 mb-0">
      <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] backdrop-blur-sm px-5 py-3">
        <div className="shrink-0 h-5 w-5 rounded-full bg-amber-500/15 flex items-center justify-center">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-400"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <p className="text-[13px] text-amber-200/80 font-light flex-1">
          Tu{" "}
          <span className="font-medium text-amber-200">ADN de Comunicación</span>{" "}
          está pendiente. Completalo para que Moka AI pueda darte análisis y recomendaciones personalizadas.
        </p>
        <Link
          href="/onboarding/adn"
          className="shrink-0 text-[12px] font-medium text-amber-300 hover:text-amber-200 transition-colors px-3 py-1.5 rounded-lg bg-amber-500/[0.08] hover:bg-amber-500/[0.15] border border-amber-500/20"
        >
          Completar ADN
        </Link>
      </div>
    </div>
  );
}

export function AdnBlockOverlay() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl">
      <div className="text-center max-w-sm px-6">
        <div className="h-12 w-12 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-400"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <p className="text-[15px] font-medium text-white/80 mb-1.5">
          Moka AI necesita tu ADN
        </p>
        <p className="text-[13px] text-white/40 font-light mb-5 leading-relaxed">
          Para darte análisis y recomendaciones personalizadas, primero completá tu ADN de Comunicación.
        </p>
        <Link
          href="/onboarding/adn"
          className="inline-flex items-center gap-2 text-[13px] font-medium text-amber-300 hover:text-amber-200 transition-colors px-5 py-2.5 rounded-xl bg-amber-500/[0.1] hover:bg-amber-500/[0.18] border border-amber-500/25"
        >
          Completar ADN
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
