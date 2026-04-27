"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { Loader2 } from "lucide-react";
import { updateUserLocale } from "@/i18n/actions";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";

interface LanguageSwitcherProps {
  /**
   * "auth" — pre-login: writes only the NEXT_LOCALE cookie client-side.
   * "app"  — authenticated: calls updateUserLocale (DB + cookie).
   * Both modes hard-reload after a successful change. router.refresh() is
   * unreliable for picking up cookie writes inside Turbopack/Next 16 RSC
   * server actions, which is why the previous version looked stuck.
   */
  mode?: "auth" | "app";
}

const FLAGS: Record<Locale, { src: string; alt: string; label: string }> = {
  es: { src: "/Bandera_de_España.svg.png", alt: "Español", label: "ES" },
  en: { src: "/Flag_of_the_United_Kingdom_(3-5).svg.png", alt: "English", label: "EN" },
};

export function LanguageSwitcher({ mode = "app" }: LanguageSwitcherProps) {
  const currentLocale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Locale | null>(null);
  const active = optimistic ?? currentLocale;

  function setLocale(next: Locale) {
    if (next === active || isPending) return;
    setOptimistic(next);

    if (mode === "auth") {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      window.location.reload();
      return;
    }

    startTransition(async () => {
      const res = await updateUserLocale(next);
      if (!res.ok) {
        setOptimistic(null);
        return;
      }
      // Hard reload — see comment on LanguageSwitcherProps about why
      // router.refresh() doesn't reliably pick up the new cookie.
      window.location.reload();
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Language"
      className="inline-flex items-center gap-1 select-none"
    >
      {(["es", "en"] as const).map((loc) => {
        const isActive = active === loc;
        const flag = FLAGS[loc];
        const showSpinner = isPending && optimistic === loc;
        return (
          <button
            key={loc}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setLocale(loc)}
            disabled={isPending}
            title={flag.alt}
            className={`relative h-6 w-6 rounded-full overflow-hidden flex items-center justify-center transition-all cursor-pointer disabled:cursor-default ${
              isActive
                ? "ring-1 ring-foreground/40 dark:ring-white/60 opacity-100"
                : "opacity-40 hover:opacity-70"
            }`}
          >
            {showSpinner ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : (
              <Image
                src={flag.src}
                alt={flag.label}
                fill
                sizes="24px"
                className="object-cover"
                unoptimized
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
