"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useCallback } from "react";
import { useTranslations } from "next-intl";
import { LayoutDashboard, Clapperboard, BarChart3, BookImage, Swords, Grid2X2, BookMarked } from "lucide-react";

export type TabKey = "dashboard" | "reels" | "historias" | "publicaciones" | "competencia" | "referencias" | "metrics";

const TABS: { key: TabKey; labelKey: string; icon: React.ElementType }[] = [
  { key: "dashboard",    labelKey: "dashboard",    icon: LayoutDashboard },
  { key: "reels",        labelKey: "reels",        icon: Clapperboard },
  { key: "historias",    labelKey: "stories",      icon: BookImage },
  { key: "publicaciones",labelKey: "publications", icon: Grid2X2 },
  { key: "competencia",  labelKey: "competition",  icon: Swords },
  { key: "referencias",  labelKey: "references",   icon: BookMarked },
  { key: "metrics",      labelKey: "demographics", icon: BarChart3 },
];

export function InstagramTabs() {
  const t = useTranslations("igShell");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const current = (searchParams.get("tab") as TabKey) || "dashboard";

  const handleSelect = useCallback((key: TabKey) => {
    if (key === current) return;
    window.dispatchEvent(new Event("nav:start"));
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    startTransition(() => {
      router.push(`/instagram?${params.toString()}`);
    });
  }, [router, searchParams, current]);

  return (
    <div className={`inline-flex items-center gap-1 p-1 rounded-full transition-opacity duration-150 bg-white/[0.04] border border-white/[0.06] ${isPending ? "opacity-60" : "opacity-100"}`}>
      {TABS.map((tab) => {
        const active = current === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => handleSelect(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-250 cursor-pointer border ${
              active
                ? "text-white bg-white/[0.1] border-white/[0.1]"
                : "text-white/40 hover:text-white/60 hover:bg-white/[0.04] border-transparent"
            }`}
          >
            <tab.icon
              size={14}
              strokeWidth={active ? 2.2 : 1.6}
            />
            {t(`tabs.${tab.labelKey}`)}
          </button>
        );
      })}
    </div>
  );
}
