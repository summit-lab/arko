"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useCallback } from "react";

const PERIODS = [
  { label: "7d",  value: "7"  },
  { label: "14d", value: "14" },
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
] as const;

export function PeriodFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const current = searchParams.get("days") || "90";

  const handleSelect = useCallback((value: string) => {
    if (value === current) return;
    window.dispatchEvent(new Event("nav:start"));
    const params = new URLSearchParams(searchParams.toString());
    params.set("days", value);
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }, [router, searchParams, current]);

  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded-full"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {PERIODS.map((p) => {
        const active = current === p.value;
        return (
          <button
            key={p.value}
            onClick={() => handleSelect(p.value)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-250 cursor-pointer ${
              active ? "text-white" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
            }`}
            style={active ? {
              background: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.22)",
              boxShadow: "0 1px 16px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.2)",
            } : undefined}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
