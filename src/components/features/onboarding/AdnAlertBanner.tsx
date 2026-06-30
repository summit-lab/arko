"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { FeatureLock } from "@/components/common/FeatureLock";

export function AdnAlertBanner() {
  const pathname = usePathname();
  const t = useTranslations("adnBanner");

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
        <p className="text-[13px] text-amber-700 dark:text-amber-200/80 font-light flex-1">
          {t("pendingPrefix")}{" "}
          <span className="font-medium text-amber-800 dark:text-amber-200">{t("pendingTitle")}</span>{" "}
          {t("pendingSuffix")}
        </p>
        <Link
          href="/onboarding/adn"
          className="shrink-0 text-[12px] font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 transition-colors px-3 py-1.5 rounded-lg bg-amber-500/[0.08] hover:bg-amber-500/[0.15] border border-amber-500/20"
        >
          {t("completeCta")}
        </Link>
      </div>
    </div>
  );
}

export function AdnBlockOverlay() {
  const t = useTranslations("adnBanner");
  return (
    <FeatureLock
      variant="overlay"
      title={t("blockedTitle")}
      description={t("blockedDescription")}
      ctaText={t("completeCta")}
      ctaHref="/onboarding/adn"
    />
  );
}
