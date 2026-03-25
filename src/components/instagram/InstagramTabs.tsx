"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useCallback } from "react";
import { LayoutDashboard, Clapperboard, Image, BarChart3 } from "lucide-react";

export type TabKey = "dashboard" | "reels" | "posts" | "metrics";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "reels", label: "Reels", icon: Clapperboard },
  { key: "posts", label: "Posts", icon: Image },
  { key: "metrics", label: "Demografía", icon: BarChart3 },
];

export function InstagramTabs() {
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
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-full transition-opacity duration-150 ${isPending ? "opacity-60" : "opacity-100"}`}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {TABS.map((tab) => {
        const active = current === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => handleSelect(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-250 cursor-pointer ${
              active
                ? "text-black"
                : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
            }`}
            style={active ? {
              background: "rgba(255,255,255,0.95)",
              boxShadow: "0 2px 8px rgba(255,255,255,0.1), 0 1px 2px rgba(0,0,0,0.3)",
            } : undefined}
          >
            <tab.icon
              size={14}
              strokeWidth={active ? 2.2 : 1.6}
              style={{ color: active ? "#000000" : undefined }}
            />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
