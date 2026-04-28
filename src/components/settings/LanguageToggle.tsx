"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Check, Loader2, Languages } from "lucide-react";
import { updateUserLocale } from "@/i18n/actions";
import { LOCALES, type Locale } from "@/i18n/config";

const LOCALE_FLAGS: Record<Locale, string> = {
  es: "/Bandera_de_España.svg.png",
  en: "/usaflag.png",
};

export function LanguageToggle() {
  const t = useTranslations("settings.language");
  const currentLocale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Used only to keep the button visually selected during the (very brief)
  // window between the server action returning and the page reloading.
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function handleSelect(next: Locale) {
    if (next === currentLocale || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await updateUserLocale(next);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedAt(Date.now());
      // Hard reload — router.refresh() doesn't reliably pick up the cookie
      // change inside the same RSC response on Next 16/Turbopack.
      window.location.reload();
    });
  }

  return (
    <div className="glass-panel rounded-xl p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
          <Languages className="h-4 w-4 text-muted-foreground" />
          {t("label")}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">{t("description")}</p>
      </div>

      <div className="flex gap-2">
        {LOCALES.map((loc) => {
          const isActive = loc === currentLocale;
          return (
            <button
              key={loc}
              type="button"
              onClick={() => handleSelect(loc)}
              disabled={isPending || isActive}
              aria-pressed={isActive}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm transition-all border cursor-pointer disabled:cursor-default flex items-center justify-center gap-2 ${
                isActive
                  ? "bg-white/[0.10] border-border text-foreground"
                  : "bg-white/[0.04] border-border/60 text-muted-foreground hover:bg-white/[0.06] hover:border-border"
              }`}
            >
              <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
                <Image
                  src={LOCALE_FLAGS[loc]}
                  alt=""
                  fill
                  sizes="20px"
                  className="object-cover"
                />
              </span>
              {isPending && !isActive ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isActive ? (
                <Check className="h-3.5 w-3.5" />
              ) : null}
              {t(loc)}
            </button>
          );
        })}
      </div>

      {savedAt && !isPending && !error ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">{t("saved")}</p>
      ) : null}
      {error ? <p className="text-xs text-red-500 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
