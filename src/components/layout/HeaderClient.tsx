"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Calendar } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function HeaderClient() {
  const locale = useLocale();
  const [date, setDate] = useState("");

  useEffect(() => {
    const now = new Date();
    const formatted = now.toLocaleDateString(locale === "en" ? "en-US" : "es-AR", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    setDate(formatted);
  }, [locale]);

  if (!date) return null;

  return (
    <>
      <div className="hidden md:flex items-center gap-2 h-8 px-3 rounded-xl bg-accent/60 border border-border">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
        <span className="text-[11px] text-muted-foreground font-light">{date}</span>
      </div>
      <LanguageSwitcher mode="app" />
      <ThemeToggle />
    </>
  );
}
