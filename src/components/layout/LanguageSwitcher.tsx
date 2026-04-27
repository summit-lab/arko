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
   * Both modes hard-reload after a successful change. We also write the
   * cookie client-side as a belt-and-suspenders so the browser definitely
   * has it before the reload (server-action Set-Cookie via cookies().set()
   * has been flaky in Next 16 / Turbopack RSC responses).
   */
  mode?: "auth" | "app";
}

const FLAGS: Record<Locale, { src: string; alt: string }> = {
  es: { src: "/Bandera_de_España.svg.png", alt: "Español" },
  en: { src: "/Flag_of_the_United_Kingdom_(3-5).svg.png", alt: "English" },
};

function writeCookieClientSide(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function LanguageSwitcher({ mode = "app" }: LanguageSwitcherProps) {
  const currentLocale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Locale | null>(null);
  const active = optimistic ?? currentLocale;

  function setLocale(next: Locale) {
    if (next === active || isPending) return;
    setOptimistic(next);

    if (mode === "auth") {
      writeCookieClientSide(next);
      window.location.reload();
      return;
    }

    startTransition(async () => {
      const res = await updateUserLocale(next);
      if (!res.ok) {
        setOptimistic(null);
        return;
      }
      // Write the cookie client-side too — belt-and-suspenders, see comment
      // on LanguageSwitcherProps. Then hard reload to ensure getRequestConfig
      // reads the new cookie on the next request.
      writeCookieClientSide(next);
      window.location.reload();
    });
  }

  function toggle() {
    if (isPending) return;
    setLocale(active === "es" ? "en" : "es");
  }

  const isEn = active === "en";
  const flag = FLAGS[active];

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      role="switch"
      aria-checked={isEn}
      aria-label={`Cambiar idioma — actual: ${flag.alt}`}
      title={flag.alt}
      className="relative inline-flex items-center h-7 w-[58px] rounded-full bg-accent/60 border border-border cursor-pointer disabled:cursor-default transition-colors hover:bg-accent"
    >
      {/* Inactive label on the side opposite the indicator */}
      <span
        className={`absolute text-[10px] font-semibold tracking-wide text-muted-foreground transition-opacity ${
          isEn ? "left-2" : "right-2"
        }`}
      >
        {isEn ? "ES" : "EN"}
      </span>

      {/* Sliding indicator with the active flag */}
      <span
        className="absolute top-0.5 h-6 w-6 rounded-full overflow-hidden bg-background border border-border shadow-[0_1px_2px_rgba(0,0,0,0.15)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition-all duration-200 ease-out flex items-center justify-center"
        style={{ left: isEn ? "calc(100% - 26px)" : "2px" }}
        aria-hidden
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <Image
            src={flag.src}
            alt=""
            fill
            sizes="24px"
            className="object-cover"
            unoptimized
          />
        )}
      </span>
    </button>
  );
}
