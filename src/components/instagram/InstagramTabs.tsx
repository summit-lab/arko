"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useCallback } from "react";
import { FilmSlateIcon, ImageIcon, ChartBarIcon } from "@phosphor-icons/react";

export type TabKey = "reels" | "posts" | "all" | "metrics";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "reels", label: "Reels", icon: FilmSlateIcon },
  { key: "posts", label: "Posts", icon: ImageIcon },
  { key: "metrics", label: "IG Metrics", icon: ChartBarIcon },
];

export function InstagramTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const current = (searchParams.get("tab") as TabKey) || "reels";

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
    <div className={`inline-flex items-center gap-1 transition-opacity duration-150 ${isPending ? "opacity-60" : "opacity-100"}`}>
      {TABS.map((tab) => {
        const active = current === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => handleSelect(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 cursor-pointer ${
              active ? "text-white" : "text-white/40 hover:text-white/60"
            }`}
            style={active ? {
              background: "#17171f",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
            } : {
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <tab.icon
              size={15}
              weight={active ? "fill" : "regular"}
              style={{ color: active ? "#ffffff" : "rgba(255,255,255,0.4)" }}
            />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
