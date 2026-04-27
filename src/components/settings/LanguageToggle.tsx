"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Loader2, Languages } from "lucide-react";
import { updateUserLocale } from "@/i18n/actions";
import { LOCALES, type Locale } from "@/i18n/config";

export function LanguageToggle() {
  const t = useTranslations("settings.language");
  const router = useRouter();
  const currentLocale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
      router.refresh();
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
                  ? "bg-white/[0.10] border-white/[0.18] text-foreground"
                  : "bg-white/[0.04] border-white/[0.08] text-muted-foreground hover:bg-white/[0.06] hover:border-white/[0.12]"
              }`}
            >
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
