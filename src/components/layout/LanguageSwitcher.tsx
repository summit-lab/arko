"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Loader2 } from "lucide-react";
import { updateUserLocale } from "@/i18n/actions";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";

interface LanguageSwitcherProps {
  /**
   * "auth" — pre-login: writes only the NEXT_LOCALE cookie client-side, no server call.
   * "app"  — authenticated: calls updateUserLocale (DB + cookie + revalidate).
   */
  mode?: "auth" | "app";
}

const FLAG_ES = "🇦🇷";
const FLAG_EN = "🇬🇧";

export function LanguageSwitcher({ mode = "app" }: LanguageSwitcherProps) {
  const router = useRouter();
  const currentLocale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Locale | null>(null);
  const active = optimistic ?? currentLocale;

  function setLocale(next: Locale) {
    if (next === active || isPending) return;
    setOptimistic(next);

    if (mode === "auth") {
      // Pre-login: just write the cookie + reload. No DB write because the
      // user isn't authenticated yet.
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      // router.refresh() doesn't pick up cookie changes for getRequestConfig
      // reliably; a hard reload is the safe path on the public auth surface.
      window.location.reload();
      return;
    }

    startTransition(async () => {
      const res = await updateUserLocale(next);
      if (!res.ok) {
        setOptimistic(null);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Language"
      className="relative inline-flex items-center h-8 rounded-full bg-accent/60 border border-border p-0.5 select-none"
    >
      {/* Sliding indicator */}
      <span
        aria-hidden
        className="absolute top-0.5 bottom-0.5 w-[34px] rounded-full bg-background shadow-[0_1px_2px_rgba(0,0,0,0.15)] dark:bg-white/[0.10] dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-all duration-200 ease-out"
        style={{
          left: active === "es" ? "2px" : "calc(50%)",
        }}
      />
      <button
        type="button"
        role="radio"
        aria-checked={active === "es"}
        onClick={() => setLocale("es")}
        disabled={isPending}
        className={`relative z-10 h-7 w-[34px] rounded-full text-[11px] font-medium tracking-wide transition-colors flex items-center justify-center cursor-pointer disabled:cursor-default ${
          active === "es" ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
        }`}
        title="Español"
      >
        {isPending && optimistic === "es" ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>{FLAG_ES}</span>}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={active === "en"}
        onClick={() => setLocale("en")}
        disabled={isPending}
        className={`relative z-10 h-7 w-[34px] rounded-full text-[11px] font-medium tracking-wide transition-colors flex items-center justify-center cursor-pointer disabled:cursor-default ${
          active === "en" ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
        }`}
        title="English"
      >
        {isPending && optimistic === "en" ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>{FLAG_EN}</span>}
      </button>
    </div>
  );
}
