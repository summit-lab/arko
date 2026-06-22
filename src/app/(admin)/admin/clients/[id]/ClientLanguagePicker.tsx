"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { updateClientLanguage } from "./actions";
import type { Locale } from "@/i18n/config";

interface ClientLanguagePickerProps {
  userId: string;
  initialLanguage: Locale;
}

export function ClientLanguagePicker({ userId, initialLanguage }: ClientLanguagePickerProps) {
  const router = useRouter();
  const [language, setLanguage] = useState<Locale>(initialLanguage);
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(next: Locale) {
    if (next === language || isPending) return;
    setLanguage(next);
    setError(null);
    startTransition(async () => {
      const res = await updateClientLanguage(userId, next);
      if (!res.ok) {
        setError(res.error);
        setLanguage(initialLanguage);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <div className="mt-3">
      <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium mb-1.5">Idioma</p>
      <div className="inline-flex items-center h-7 rounded-md bg-white/[0.04] border border-white/[0.08] p-0.5">
        <button
          type="button"
          onClick={() => pick("es")}
          disabled={isPending}
          className={`h-[22px] px-2.5 rounded-sm text-[11px] font-medium transition-all cursor-pointer disabled:cursor-default ${
            language === "es"
              ? "bg-white/[0.08] text-white"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          {isPending && language === "es" ? <Loader2 className="h-3 w-3 animate-spin" /> : "🇦🇷 ES"}
        </button>
        <button
          type="button"
          onClick={() => pick("en")}
          disabled={isPending}
          className={`h-[22px] px-2.5 rounded-sm text-[11px] font-medium transition-all cursor-pointer disabled:cursor-default ${
            language === "en"
              ? "bg-white/[0.08] text-white"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          {isPending && language === "en" ? <Loader2 className="h-3 w-3 animate-spin" /> : "🇬🇧 EN"}
        </button>
      </div>
      {savedAt && !isPending && !error ? (
        <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-emerald-400/80">
          <Check className="h-2.5 w-2.5" /> guardado
        </span>
      ) : null}
      {error ? <p className="text-[10px] text-red-400/80 mt-1">{error}</p> : null}
    </div>
  );
}
