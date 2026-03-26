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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-250 cursor-pointer ${
              active
                ? "text-white"
                : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
            }`}
            style={active ? {
              background: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.22)",
              boxShadow: "0 1px 16px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.2)",
            } : undefined}
          >
            <tab.icon
              size={14}
              strokeWidth={active ? 2.2 : 1.6}
            />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
