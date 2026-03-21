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
    <div className="inline-flex items-center gap-1">
      {PERIODS.map((p) => {
        const active = current === p.value;
        return (
          <button
            key={p.value}
            onClick={() => handleSelect(p.value)}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 cursor-pointer ${
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
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
