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
  en: { src: "/usaflag.png", alt: "English" },
};

function writeCookieClientSide(next: Locale) {
  // Build conditionally — Secure only on HTTPS contexts. On http://localhost,
  // setting Secure would cause the browser to silently reject the cookie.
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const parts = [
    `${LOCALE_COOKIE}=${next}`,
    `path=/`,
    `max-age=${60 * 60 * 24 * 365}`,
    `SameSite=Lax`,
  ];
  if (isHttps) parts.push("Secure");
  document.cookie = parts.join("; ");
}

export function LanguageSwitcher({ mode = "app" }: LanguageSwitcherProps) {
  const currentLocale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Locale | null>(null);
  const active = optimistic ?? currentLocale;

  function setLocale(next: Locale) {
    if (next === active || isPending) return;
    setOptimistic(next);

    // Write cookie FIRST so it's definitely in the browser before any reload.
    writeCookieClientSide(next);

    if (mode === "auth") {
      window.location.reload();
      return;
    }

    startTransition(async () => {
      const res = await updateUserLocale(next);
      if (!res.ok) {
        setOptimistic(null);
        return;
      }
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
      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-accent/60 border border-border cursor-pointer disabled:cursor-default hover:bg-accent transition-colors"
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : (
        <>
          <span className="relative h-3.5 w-3.5 rounded-full overflow-hidden shrink-0">
            <Image
              src={flag.src}
              alt=""
              fill
              sizes="14px"
              className="object-cover"
              unoptimized
            />
          </span>
          <span className="text-[10px] font-semibold tracking-wide text-foreground">
            {active.toUpperCase()}
          </span>
        </>
      )}
    </button>
  );
}
